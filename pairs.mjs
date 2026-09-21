// fallkit · pairs.mjs — the ingestion depth: turn a company's real records into train + held-out eval
// PAIRS, which is what fallforgemint actually needs to mint a specialist and what fallforge-gate needs
// to say BEATS or LOSES honestly. This is where "auto-builds it" lives or dies, so the rules are strict:
//
//   • it never invents a label. If the data has no plausible target column, it REFUSES ("unlabeled —
//     this can't train a supervised node yet") rather than fabricate outputs. An honest opening, not a
//     fake capability.
//   • the split is DETERMINISTIC and LEAKAGE-FREE: a pair lands in train or held-out by hashing its
//     INPUT, so the same input always lands in the same bucket and can never appear in both. The gate's
//     verdict means nothing if the model was tested on something it trained on.
//   • it reads the values LOCALLY (the page uses the File API); the pairs it builds stay on the machine,
//     to be handed to fallforgemint there. Nothing is uploaded.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

import { splitCsvLine, detectFormat } from './fieldmap.mjs';

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

// Columns whose NAME marks them as a likely target/label (the thing a specialist would predict).
const TARGET_HINTS = /category|categor|priorit|status|label|outcome|resolution|resolv|disposition|sentiment|intent|\btag\b|\bclass\b|\btype\b|\bstage\b|decision|verdict|rating/i;
// Columns that are identifiers, not signal — excluded from the input.
const ID_HINTS = /(^|_)id\b|^id$|uuid|guid|reference|\bref\b|\bnumber\b|timestamp|created|updated|\bdate\b/i;

/** parseRecords(text, format?) — read the actual VALUES into row objects. CSV: header + rows; JSON:
 *  an array of objects. Returns { ok, format, columns, records }. */
export function parseRecords(text, format) {
  if (!isStr(text)) return { ok: false, why: 'export must be text' };
  const fmt = format || detectFormat(text);
  if (fmt === 'csv') {
    const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rows.length < 2) return { ok: false, why: 'need a header row and at least one data row' };
    const columns = splitCsvLine(rows[0]).filter((c) => c.length > 0);
    if (columns.length === 0) return { ok: false, why: 'no header columns' };
    const records = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = splitCsvLine(rows[i]);
      const rec = {};
      columns.forEach((col, c) => { rec[col] = isStr(cells[c]) ? cells[c] : ''; });
      records.push(rec);
    }
    return { ok: true, format: 'csv', columns, records };
  }
  if (fmt === 'json') {
    let data;
    try { data = JSON.parse(text); } catch { return { ok: false, why: 'invalid JSON' }; }
    const rows = isArr(data) ? data : (isObj(data) ? data.records : null); // .records may be absent/non-array; the isArr check below is the real guard
    if (!isArr(rows) || rows.length === 0) return { ok: false, why: 'JSON needs an array of record objects' };
    const records = rows.filter(isObj);
    if (records.length === 0) return { ok: false, why: 'JSON records are not objects' };
    return { ok: true, format: 'json', columns: Object.keys(records[0]), records };
  }
  return { ok: false, why: 'unrecognised format — CSV with a header, or a JSON array of records' };
}

/** pickTarget(columns) — choose the target column (the label a specialist predicts) by name, and take
 *  the rest (minus identifiers) as inputs. Returns { ok, target, inputs } or { ok:true, target:null }
 *  when nothing looks like a label — the honest "unlabeled" case. */
export function pickTarget(columns) {
  if (!isArr(columns)) return { ok: false, why: 'columns must be an array' };
  const target = columns.find((c) => isStr(c) && TARGET_HINTS.test(c)) || null;
  if (target === null) return { ok: true, target: null, inputs: [], reason: 'no column looks like a label/outcome — unlabeled' };
  const inputs = columns.filter((c) => c !== target && !ID_HINTS.test(c));
  return { ok: true, target, inputs, reason: 'target "' + target + '" chosen by name; identifiers excluded from input' };
}

/** pairText(record, inputs, target) — one training example as readable text: the input fields joined,
 *  and the target value as the output. Skips a record whose target value is blank. */
export function pairText(record, inputs, target) {
  if (!isObj(record) || !isArr(inputs) || !isStr(target)) return null;
  const out = isStr(record[target]) ? record[target].trim() : '';
  if (out === '') return null; // no label on this row — cannot be a supervised pair
  const input = inputs.map((c) => c + ': ' + (isStr(record[c]) ? record[c] : '')).join(' | ');
  return { input, output: out };
}

/** makePairs(records, inputs, target) — every record with a real label becomes a pair. */
export function makePairs(records, inputs, target) {
  if (!isArr(records)) return { ok: false, why: 'records must be an array' };
  const pairs = [];
  let skipped = 0;
  for (const r of records) { const p = pairText(r, inputs, target); if (p) pairs.push(p); else skipped += 1; }
  return { ok: true, pairs, skipped };
}

// a small deterministic string hash — used only to bucket pairs reproducibly (not for security).
function hashStr(s) {
  let h = 5381;
  for (const ch of s) h = (((h * 33) >>> 0) ^ ch.charCodeAt(0)) >>> 0;
  return h >>> 0;
}

/** splitPairs(pairs, holdoutPct) — deterministic, leakage-free split. A pair goes to held-out iff a
 *  hash of its INPUT falls in the held-out band, so identical inputs share a bucket and never straddle
 *  train and held-out. Returns { ok, train, holdout, leakage } — leakage is always false by construction
 *  and re-checked. */
export function splitPairs(pairs, holdoutPct) {
  if (!isArr(pairs)) return { ok: false, why: 'pairs must be an array' };
  const pct = (typeof holdoutPct === 'number' && holdoutPct >= 0 && holdoutPct <= 100) ? holdoutPct : 20;
  const train = [];
  const holdout = [];
  for (const p of pairs) {
    if (!isObj(p) || !isStr(p.input)) continue;
    if (hashStr(p.input) % 100 < pct) holdout.push(p); else train.push(p);
  }
  const trainInputs = new Set(train.map((p) => p.input));
  const leakage = holdout.some((p) => trainInputs.has(p.input));
  return { ok: true, train, holdout, leakage };
}

/** generatePairs(text, opts) — the whole ingestion step: parse -> pick target -> make pairs -> split,
 *  with honest warnings (unlabeled, too few pairs, thin held-out) and a leakage check. Refuses rather
 *  than fabricates. opts: { holdoutPct?, minPairs? }. */
export function generatePairs(text, opts) {
  const parsed = parseRecords(text, isObj(opts) ? opts.format : undefined);
  if (!parsed.ok) return { ok: false, why: parsed.why };
  const pick = pickTarget(parsed.columns);
  if (!pick.ok) return { ok: false, why: pick.why };
  if (pick.target === null) return { ok: true, labeled: false, why: 'unlabeled — no column looks like a label, so this data cannot train a supervised node yet. That is an opening for labelling, not a failure.', columns: parsed.columns };
  const made = makePairs(parsed.records, pick.inputs, pick.target);
  const split = splitPairs(made.pairs, isObj(opts) ? opts.holdoutPct : 20);
  const minPairs = (isObj(opts) && Number.isInteger(opts.minPairs)) ? opts.minPairs : 12;
  const warnings = [];
  if (made.pairs.length < minPairs) warnings.push('only ' + made.pairs.length + ' labelled pairs — thin; a gate verdict on this little data is weak');
  if (split.holdout.length === 0) warnings.push('held-out set is empty — cannot gate honestly; add more rows');
  if (made.skipped > 0) warnings.push(made.skipped + ' row(s) had a blank label and were skipped');
  if (split.leakage) warnings.push('LEAKAGE DETECTED — refusing (this should be impossible)');
  return {
    ok: true, labeled: true,
    target: pick.target, inputs: pick.inputs,
    trainCount: split.train.length, holdoutCount: split.holdout.length,
    totalPairs: made.pairs.length, skipped: made.skipped,
    leakage: split.leakage,
    sampleTrain: split.train.slice(0, 2),
    sampleHoldout: split.holdout.slice(0, 2),
    warnings,
  };
}

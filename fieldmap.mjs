// fallkit · fieldmap.mjs — slice-one of the auto-architect: ingest ONE real export from a company's
// actual tool and map its DATA SHAPE onto the owned equivalent, then emit a hashed scaffold plan.
//
// Slice-zero (fallkit.mjs) matched a tool NAME to an organ. This goes one step deeper: you drop in a
// real export (a CSV or JSON dump from that tool) and it reads the SHAPE only — the column names and
// how many records — never the values, and works out which owned organ it belongs to and how each of
// its fields lines up with what that organ expects. The output is a plan you can check and keep, not
// an import: nothing here runs anything, moves anything, or sends anything. The four human doors hold.
//
// LOCAL-FIRST, by construction: every function here is pure and takes the file's text as a string the
// browser already read with the File API. There is no fetch, no upload, no storage. The page proves it
// with a live zero-requests counter, and this kernel never even sees the network.
//
// Honest by construction: a field either MAPPED (a column clearly is that field), FUZZY (a likely
// match, flagged for a human to confirm), or MISSING (the organ wants it, the export hasn't got it).
// Columns the organ doesn't expect are reported as EXTRA, never silently dropped. sha256 + canon are
// vendored verbatim from the estate (fallbrain/cascade.mjs) so the plan's hash is reproducible anywhere.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

// ── SHA-256 + canonical JSON (vendored verbatim from fallbrain/cascade.mjs) ──
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256(text) {
  if (!isStr(text)) return { ok: false, why: 'sha256 takes a string' };
  const data = new TextEncoder().encode(text);
  const len = data.length;
  const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return { ok: true, hash: hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7) };
}
export function canon(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '"?"';
}

// ── what the owned organs expect (a small, reviewed schema per organ — extend with real exports) ──
export const TARGET_SCHEMAS = {
  fallcrm:     { repo: 'fallcrm',     label: 'CRM · contacts & pipeline', fields: ['name', 'email', 'company', 'phone', 'stage', 'owner', 'notes'] },
  fallaccount: { repo: 'fallaccount', label: 'Accounting · transactions', fields: ['date', 'amount', 'description', 'category', 'reference'] },
  fallinvoice: { repo: 'fallinvoice', label: 'Invoicing · invoices',      fields: ['number', 'date', 'client', 'amount', 'due', 'status'] },
  fallhr:      { repo: 'fallhr',      label: 'HR · people',               fields: ['name', 'email', 'role', 'start', 'manager', 'salary'] },
  fallrecruit: { repo: 'fallrecruit', label: 'Recruitment · candidates',  fields: ['name', 'email', 'role', 'stage', 'source'] },
};

// synonyms: a source column normalises to a target field if it equals, or contains, a listed alias.
const SYNONYMS = {
  name:        ['name', 'fullname', 'contactname', 'client', 'customer', 'candidate'],
  email:       ['email', 'emailaddress', 'mail'],
  company:     ['company', 'organisation', 'organization', 'account', 'business'],
  phone:       ['phone', 'mobile', 'tel', 'telephone'],
  stage:       ['stage', 'status', 'dealstage', 'pipeline'],
  owner:       ['owner', 'assignedto', 'rep', 'accountmanager'],
  notes:       ['notes', 'note', 'comment', 'comments', 'description'],
  date:        ['date', 'createddate', 'transactiondate', 'issued', 'invoicedate'],
  amount:      ['amount', 'total', 'value', 'sum', 'gross', 'net'],
  description: ['description', 'memo', 'details', 'narrative'],
  category:    ['category', 'type', 'account', 'nominal'],
  reference:   ['reference', 'ref', 'id', 'number'],
  number:      ['number', 'invoiceno', 'invoicenumber', 'no', 'ref'],
  client:      ['client', 'customer', 'contact', 'company', 'bill'],
  due:         ['due', 'duedate', 'payby'],
  status:      ['status', 'state', 'paid'],
  role:        ['role', 'title', 'jobtitle', 'position'],
  start:       ['start', 'startdate', 'joined', 'hiredate'],
  manager:     ['manager', 'reportsto', 'supervisor'],
  salary:      ['salary', 'pay', 'wage', 'compensation'],
  source:      ['source', 'channel', 'origin', 'via'],
};

const norm = (s) => (isStr(s) ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '');

/** splitCsvLine(line) — one CSV row into fields; understands "double-quoted" fields with embedded
 *  commas and "" escapes. Pure, total (non-string -> []). */
export function splitCsvLine(line) {
  if (!isStr(line)) return [];
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else { cur += ch; }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** detectFormat(text) — 'json' if it parses to an array/object, else 'csv' if it has a comma header,
 *  else 'unknown'. */
export function detectFormat(text) {
  if (!isStr(text)) return 'unknown';
  const t = text.trim();
  if (t.length === 0) return 'unknown';
  if (t[0] === '[' || t[0] === '{') {
    try { JSON.parse(t); return 'json'; } catch { /* fall through */ }
  }
  const firstLine = t.split(/\r?\n/)[0];
  if (firstLine.indexOf(',') !== -1) return 'csv';
  return 'unknown';
}

/** parseColumns(text, format?) — read only the SHAPE: the column names and the record count. Never
 *  keeps a single value. Returns { ok, format, columns, recordCount }. */
export function parseColumns(text, format) {
  if (!isStr(text)) return { ok: false, why: 'export must be text' };
  const fmt = format || detectFormat(text);
  if (fmt === 'csv') {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { ok: false, why: 'empty CSV' };
    const columns = splitCsvLine(lines[0]).filter((c) => c.length > 0);
    if (columns.length === 0) return { ok: false, why: 'no header columns found' };
    return { ok: true, format: 'csv', columns, recordCount: lines.length - 1 };
  }
  if (fmt === 'json') {
    let data;
    try { data = JSON.parse(text); } catch { return { ok: false, why: 'invalid JSON' }; }
    const rows = isArr(data) ? data : (isArr(data.records) ? data.records : (isObj(data) ? [data] : null));
    if (!isArr(rows) || rows.length === 0) return { ok: false, why: 'JSON has no array of records' };
    const first = rows.find(isObj);
    if (!first) return { ok: false, why: 'JSON records are not objects' };
    return { ok: true, format: 'json', columns: Object.keys(first), recordCount: rows.length };
  }
  return { ok: false, why: 'unrecognised format — give a CSV with a header row or a JSON array of records' };
}

/** guessTarget(columns, filename?) — which owned organ this export belongs to, by scoring each
 *  schema's fields against the columns (plus a small filename hint). Returns the best organ id, or
 *  null if nothing scores. */
export function guessTarget(columns, filename) {
  if (!isArr(columns)) return null;
  const cols = columns.map(norm);
  const fname = norm(filename || '');
  let best = null;
  let bestScore = 0;
  for (const id of Object.keys(TARGET_SCHEMAS)) {
    let score = 0;
    for (const field of TARGET_SCHEMAS[id].fields) {
      const aliases = SYNONYMS[field] || [field];
      if (cols.some((c) => aliases.some((a) => c === a || c.indexOf(a) !== -1))) score += 1;
    }
    if (fname.indexOf(id.replace('fall', '')) !== -1) score += 1; // e.g. "invoice" in the filename
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best; // best is null iff nothing scored (it is only assigned when score > bestScore >= 0)
}

/** mapFields(columns, targetId) — line each target field up with a source column: MAPPED (a column
 *  equals an alias), FUZZY (a column contains an alias — confirm by hand), or MISSING. Columns no
 *  field claims are reported as EXTRA. Never throws. */
export function mapFields(columns, targetId) {
  if (!isArr(columns)) return { ok: false, why: 'columns must be an array' };
  const schema = TARGET_SCHEMAS[targetId];
  if (!schema) return { ok: false, why: 'unknown target organ: ' + targetId };
  const used = new Set();
  const fields = [];
  let mapped = 0;
  for (const field of schema.fields) {
    const aliases = SYNONYMS[field] || [field];
    let source = null;
    let status = 'MISSING';
    // exact alias match first (MAPPED), then containment (FUZZY) — .entries() so there is no loop
    // bound to mutate into an off-by-one; the index is only needed to mark a column used.
    for (const [i, col] of columns.entries()) {
      if (used.has(i)) continue;
      if (aliases.some((a) => norm(col) === a)) { source = col; status = 'MAPPED'; used.add(i); break; }
    }
    if (source === null) {
      for (const [i, col] of columns.entries()) {
        if (used.has(i)) continue;
        if (aliases.some((a) => norm(col).indexOf(a) !== -1)) { source = col; status = 'FUZZY'; used.add(i); break; }
      }
    }
    if (status === 'MAPPED' || status === 'FUZZY') mapped += 1;
    fields.push({ field, source, status });
  }
  const extra = columns.filter((c, i) => !used.has(i));
  return {
    ok: true, target: targetId, repo: schema.repo, label: schema.label,
    fields, extra, coverage: { mapped, total: schema.fields.length },
  };
}

/** buildManifest({ sourceTool, targetId, columns, recordCount, createdAt }) — the scaffold plan: what
 *  would be built, from what, with a reproducible hash over the plan (NOT over any data). This is the
 *  seed of the "company blueprint" — a human approves it; nothing acts on it here. createdAt is passed
 *  in (never read from the clock) so the same plan hashes the same everywhere. */
export function buildManifest(meta) {
  if (!isObj(meta)) return { ok: false, why: 'meta must be an object' };
  if (!isStr(meta.sourceTool)) return { ok: false, why: 'sourceTool required' };
  const m = mapFields(isArr(meta.columns) ? meta.columns : [], meta.targetId);
  if (!m.ok) return { ok: false, why: m.why };
  const plan = {
    kind: 'fallkit-scaffold-plan',
    sourceTool: meta.sourceTool,
    target: m.target,
    targetRepo: m.repo,
    recordCount: Number.isInteger(meta.recordCount) ? meta.recordCount : 0,
    fieldMap: m.fields,
    extraColumns: m.extra,
    coverage: m.coverage,
    createdAt: isStr(meta.createdAt) ? meta.createdAt : '',
    dataStored: false,
    autoRun: false,
  };
  const h = sha256(canon(plan));
  if (!h.ok) return { ok: false, why: 'could not hash the plan' };
  return { ok: true, plan: { ...plan, manifestHash: h.hash } };
}

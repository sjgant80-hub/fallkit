// fallkit · multi.mjs — slice-five: broader ingestion. Slice-one mapped ONE export; this takes SEVERAL
// (a CRM dump, an accounting export, an HR list...) and builds one combined picture of the company:
// which owned organ each source maps to, the suggested loadout grouped by seat, and the sources that
// map to nothing yet — which are exactly the build-queue signals slice-three ranks. It reuses
// slice-one's field mapping and slice-two's armoury seats; it invents nothing, it composes.
//
// Pure and total: garbage in -> { ok:false, why } (or a skipped source), never a throw. No I/O — the
// page parses the files (locally) and hands this the shapes.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

import { guessTarget, mapFields, TARGET_SCHEMAS } from './fieldmap.mjs';
import { organById, SEATS } from './loadout.mjs';

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;
const isInt = (v) => Number.isInteger(v);

/** ingestSource(source) — map ONE parsed export shape ({ name, columns, recordCount }) to its owned
 *  organ, seat and coverage, or mark it unmatched (a gap). Never throws. */
export function ingestSource(source) {
  if (!isObj(source) || !isArr(source.columns)) return { ok: false, why: 'source needs { name, columns }' };
  const name = isStr(source.name) ? source.name : 'export';
  const recordCount = isInt(source.recordCount) ? source.recordCount : 0;
  const target = guessTarget(source.columns, name);
  if (!target) {
    return { ok: true, name, matched: false, target: null, repo: null, seat: '', tier: '', columns: source.columns.length, recordCount };
  }
  const m = mapFields(source.columns, target);
  const organ = organById(target);
  return {
    ok: true, name, matched: true, target,
    repo: TARGET_SCHEMAS[target] ? TARGET_SCHEMAS[target].repo : target,
    seat: organ ? organ.seat : '', tier: organ ? organ.tier : '',
    columns: source.columns.length, recordCount, coverage: m.coverage,
  };
}

/** combineSources(sources) — fold several exports into one company picture: a per-seat suggested
 *  loadout of the matched organs, the list of unmatched sources (gaps), and totals. */
export function combineSources(sources) {
  if (!isArr(sources)) return { ok: false, why: 'sources must be an array' };
  const results = [];
  const loadout = {};
  for (const s of SEATS) loadout[s] = [];
  const gaps = [];
  let totalRecords = 0;
  const organs = [];
  for (const src of sources) {
    const r = ingestSource(src);
    if (!r.ok) continue;
    results.push(r);
    totalRecords += r.recordCount;
    if (r.matched) {
      if (r.seat && isArr(loadout[r.seat]) && loadout[r.seat].indexOf(r.target) === -1) loadout[r.seat].push(r.target);
      if (organs.indexOf(r.target) === -1) organs.push(r.target);
    } else {
      gaps.push(r.name);
    }
  }
  return { ok: true, sources: results, loadout, gaps, totalRecords, organCount: organs.length, sourceCount: results.length };
}

// fallkit · queue.mjs — slice-three: the flywheel. Every gap a company hits — a tool with no owned
// equivalent, a field nothing maps, a seat only prototype gear can fill — is a signal. Aggregate those
// signals across companies and you get the estate's own build queue, ranked by how many real companies
// need each thing. The ranking is nothing but a count, so it cannot be gamed or faked: the more
// companies hit the same gap, the higher it sits, and that is the honest priority for what to build (or
// mint via seam) next. A gap is not a failure in the pitch — it is the roadmap writing itself.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw. No I/O — the page persists the queue.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

export const GAP_KINDS = ['no-equivalent', 'unknown', 'missing-field', 'prototype-only'];

/** gapKey(gap) — the canonical key a gap is counted under (case- and whitespace-insensitive). */
export function gapKey(gap) {
  return isStr(gap) ? gap.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

/** recordGap(queue, signal) — fold one gap signal into the queue, incrementing its demand if it is
 *  already there. signal: { gap, seat?, kind? }. Never mutates the input. */
export function recordGap(queue, signal) {
  if (!isArr(queue)) return { ok: false, why: 'queue must be an array' };
  if (!isObj(signal) || !isStr(signal.gap) || signal.gap.trim() === '') return { ok: false, why: 'signal needs a non-empty gap' };
  const key = gapKey(signal.gap);
  const next = queue.map((e) => (isObj(e) ? { ...e } : e));
  const existing = next.find((e) => isObj(e) && gapKey(e.gap) === key);
  if (existing) {
    existing.demand += 1;
  } else {
    next.push({
      gap: signal.gap.trim(),
      seat: isStr(signal.seat) ? signal.seat : '',
      kind: (isStr(signal.kind) && GAP_KINDS.indexOf(signal.kind) !== -1) ? signal.kind : 'no-equivalent',
      demand: 1,
    });
  }
  return { ok: true, queue: next };
}

/** mergeSignals(queue, signals) — fold many signals in, one company's worth or many. */
export function mergeSignals(queue, signals) {
  if (!isArr(queue) || !isArr(signals)) return { ok: false, why: 'queue and signals must be arrays' };
  let q = queue.map((e) => (isObj(e) ? { ...e } : e));
  for (const s of signals) {
    const r = recordGap(q, s);
    if (r.ok) q = r.queue;
  }
  return { ok: true, queue: q };
}

/** rankQueue(queue) — the build queue, most-demanded first; ties broken by name so the order is stable
 *  and reproducible. Each entry gets a 1-based rank. */
export function rankQueue(queue) {
  if (!isArr(queue)) return { ok: false, why: 'queue must be an array' };
  const rows = queue.filter(isObj);
  const sorted = rows.slice().sort((a, b) => {
    const d = (b.demand || 0) - (a.demand || 0);
    if (d !== 0) return d;
    return gapKey(a.gap).localeCompare(gapKey(b.gap));
  });
  return { ok: true, ranked: sorted.map((e, i) => ({ ...e, rank: i + 1 })) };
}

/** queueStats(queue) — totals and the single most-demanded gap. */
export function queueStats(queue) {
  if (!isArr(queue)) return { ok: false, why: 'queue must be an array' };
  const rows = queue.filter(isObj);
  let totalDemand = 0;
  for (const e of rows) totalDemand += (e.demand || 0);
  const r = rankQueue(rows);
  const top = r.ranked.length > 0 ? r.ranked[0] : null;
  return { ok: true, gaps: rows.length, totalDemand, top };
}

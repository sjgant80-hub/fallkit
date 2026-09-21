// fallkit · mint.mjs — the wire from an OPENING to the factory. slice-zero..six find what a company
// needs and which owned organs already cover it; this turns everything that ISN'T covered into a
// concrete, honest build plan the estate can act on:
//
//   • a gap with NO owned equivalent (NONE / UNKNOWN)  ->  MINT a new node, via fallforgemint, starting
//     at the SMALLEST tier and escalating only when the gate says it lost — never assume the tier.
//   • a match that exists but isn't gated (prototype)  ->  GATE the existing organ, via witness, before
//     it can be equipped — build nothing new, just prove what's there (exactly what we're doing to
//     witness itself right now).
//
// It plans; it does not mint. Minting needs the company's real data turned into train + held-out eval
// pairs and a local model runtime — that boundary is the human door and fallforgemint's job. So every
// mint target is honestly marked `needs-data`: this names WHAT to build and HOW it must prove itself,
// not a node that already exists.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

// the tier ladder — the estate's own cascade (fall-kit T0/T2/T3, fallforge-gate escalation). Always
// start at the smallest that could work; walk UP one step only when the gate reports the node LOST.
export const TIER_LADDER = ['1b', '4b', '7b', '14b', '32b', '70b', 'frontier'];

/** nextTier(tier) — the tier to escalate to when the gate says LOSES, or null at the top (frontier is
 *  the last resort; there is nowhere above it). */
export function nextTier(tier) {
  if (!isStr(tier)) return null;
  const i = TIER_LADDER.indexOf(tier);
  if (i === -1 || i === TIER_LADDER.length - 1) return null;
  return TIER_LADDER[i + 1];
}

/** planMint(gap) — turn one opening ({ gap, seat? }) into a mint target: what capability to mint, the
 *  tier to START at, the escalation ladder, the gate it must pass, and the data it still needs. Honest
 *  status: `needs-data`, because nothing can be minted without the company's real examples. */
export function planMint(gap) {
  if (!isObj(gap) || !isStr(gap.gap) || gap.gap.trim() === '') return { ok: false, why: 'a gap needs a non-empty name' };
  return {
    ok: true,
    capability: gap.gap.trim(),
    seat: isStr(gap.seat) ? gap.seat : '',
    action: 'mint',
    via: 'fallforgemint',
    startTier: TIER_LADDER[0], // always the smallest first
    ladder: TIER_LADDER,
    gate: 'fallforge-gate — must BEAT the base model on a held-out eval, or escalate one tier',
    needs: ['train examples from your data', 'a held-out eval set'],
    status: 'needs-data',
  };
}

/** planGate(organ) — a matched-but-ungated organ ({ repo, seat?, tier? }) becomes a GATE target:
 *  build nothing new, run it through witness so it can be equipped. */
export function planGate(organ) {
  if (!isObj(organ) || !isStr(organ.repo) || organ.repo.trim() === '') return { ok: false, why: 'an organ needs a repo' };
  return {
    ok: true,
    repo: organ.repo.trim(),
    seat: isStr(organ.seat) ? organ.seat : '',
    tier: isStr(organ.tier) ? organ.tier : 'prototype',
    action: 'gate',
    via: 'witness',
    status: 'ungated — needs a mutation gate before it can be equipped',
  };
}

/** mintPortfolio({ gaps, ungatedMatches }) — the whole build plan for a company: mint targets for the
 *  openings, gate targets for the ungated matches, with counts. The demand map, made actionable. */
export function mintPortfolio(input) {
  if (!isObj(input)) return { ok: false, why: 'input must be an object' };
  const gaps = isArr(input.gaps) ? input.gaps : [];
  const ungated = isArr(input.ungatedMatches) ? input.ungatedMatches : [];
  const toMint = [];
  for (const g of gaps) { const p = planMint(g); if (p.ok) toMint.push(p); }
  const toGate = [];
  for (const o of ungated) { const p = planGate(o); if (p.ok) toGate.push(p); }
  return { ok: true, toMint, toGate, summary: { mint: toMint.length, gate: toGate.length } };
}

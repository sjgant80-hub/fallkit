// Intent tests for mint.mjs — the wire from openings to the factory. Pins: a gap becomes a mint target
// that starts at the smallest tier and is honestly marked needs-data; an ungated organ becomes a gate
// target; escalation walks the ladder and stops at frontier. Witness-checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIER_LADDER, nextTier, planMint, planGate, mintPortfolio } from './mint.mjs';

test('nextTier walks the ladder and stops at frontier', () => {
  assert.equal(nextTier('1b'), '4b');
  assert.equal(nextTier('14b'), '32b');
  assert.equal(nextTier('70b'), 'frontier');
  assert.equal(nextTier('frontier'), null); // nowhere above the frontier
  assert.equal(nextTier('nonsense'), null);
  assert.equal(nextTier(42), null);
});

test('planMint turns an opening into a mint target that STARTS SMALL and is honest about data', () => {
  const p = planMint({ gap: 'Voice agent', seat: 'Sales & CRM', kind: 'no-equivalent' });
  assert.equal(p.ok, true);
  assert.equal(p.action, 'mint');
  assert.equal(p.via, 'fallforgemint');
  assert.equal(p.startTier, '1b');                 // always the smallest first, never assumed
  assert.equal(p.ladder[p.ladder.length - 1], 'frontier');
  assert.match(p.gate, /BEAT the base/);
  assert.equal(p.status, 'needs-data');            // cannot claim a node exists without real examples
  assert.ok(p.needs.some((n) => /held-out eval/.test(n)));
  assert.equal(p.capability, 'Voice agent');
});

test('planMint refuses an empty/blank gap', () => {
  assert.equal(planMint({ gap: '   ' }).ok, false);
  assert.equal(planMint({}).ok, false);
  assert.equal(planMint(null).ok, false);
});

test('planGate turns an ungated match into a GATE target (build nothing new)', () => {
  const g = planGate({ repo: 'fallcrm', seat: 'Sales & CRM', tier: 'prototype' });
  assert.equal(g.ok, true);
  assert.equal(g.action, 'gate');
  assert.equal(g.via, 'witness');
  assert.equal(g.repo, 'fallcrm');
  assert.match(g.status, /needs a mutation gate/);
  assert.equal(planGate({}).ok, false);
  assert.equal(planGate(null).ok, false);
});

test('mintPortfolio splits openings into mint targets and ungated matches into gate targets', () => {
  const p = mintPortfolio({
    gaps: [{ gap: 'Voice agent', seat: 'Sales & CRM' }, { gap: 'Docs / wiki', seat: 'Work' }, { gap: '  ' }],
    ungatedMatches: [{ repo: 'fallcrm', tier: 'prototype' }, { repo: 'the-wallet', tier: 'prototype' }, {}],
  });
  assert.equal(p.ok, true);
  assert.equal(p.summary.mint, 2);  // two real gaps (blank dropped)
  assert.equal(p.summary.gate, 2);  // two real organs (empty dropped)
  assert.deepEqual(p.toMint.map((t) => t.capability), ['Voice agent', 'Docs / wiki']);
  assert.deepEqual(p.toGate.map((t) => t.repo), ['fallcrm', 'the-wallet']);
  assert.ok(p.toMint.every((t) => t.startTier === '1b'));
});

test('mintPortfolio is total on hostile input', () => {
  assert.equal(mintPortfolio('nope').ok, false);
  assert.equal(mintPortfolio({}).summary.mint, 0);
  assert.equal(mintPortfolio({ gaps: 'x', ungatedMatches: null }).summary.gate, 0);
});

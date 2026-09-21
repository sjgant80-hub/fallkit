// Intent tests for blueprint.mjs — slice-two, part two. The load-bearing claim is that the receipt can
// say FAILS: it catches an altered field (hash), and it refuses an ungated organ even when the forger
// recomputes a valid hash (semantics). Checked by witness mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256, canon, blueprintBody, sealBlueprint, verifyBlueprint } from './blueprint.mjs';
import { emptyLoadout, equip } from './loadout.mjs';

const oracle = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function realCompany() {
  let l = emptyLoadout();
  l = equip(l, 'Money', 'fallaccount').loadout;   // proven
  l = equip(l, 'Overseer', 'agent-proof').loadout; // proven
  l = equip(l, 'People', 'fallhr').loadout;        // proven
  l = equip(l, 'Legal', 'fallsignature').loadout;  // works
  return l;
}

test('sha256 matches Node crypto (kills the vendored-hash mutants)', () => {
  for (const s of ['', 'abc', 'x'.repeat(200), 'Acme £ π 🚚']) assert.equal(sha256(s).hash, oracle(s));
  assert.equal(sha256(7).ok, false);
});

test('canon renders each type exactly', () => {
  assert.equal(canon(null), 'null');
  assert.equal(canon(false), 'false');
  assert.equal(canon(3), '3');
  assert.equal(canon('a'), '"a"');
  assert.equal(canon([1, null]), '[1,null]');
  assert.equal(canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('sealBlueprint records which organs fill which seats, with coverage and a real hash', () => {
  const s = sealBlueprint(realCompany(), { company: 'Meridian Logistics', createdAt: '2026-09-21T00:00:00Z' });
  assert.equal(s.ok, true);
  assert.equal(s.receipt.kind, 'fallkit-company-blueprint');
  assert.equal(s.receipt.company, 'Meridian Logistics');
  assert.deepEqual(s.receipt.seats.Money.map((o) => o.id), ['fallaccount']);
  assert.equal(s.receipt.coverage.equipped, 4);
  assert.equal(s.receipt.coverage.proven, 3);
  assert.equal(s.receipt.coverage.works, 1);
  assert.equal(s.receipt.coverage.seatsFilled, 4);
  // the hash actually covers the body
  const body = {}; for (const k of Object.keys(s.receipt)) if (k !== 'blueprintHash') body[k] = s.receipt[k];
  assert.equal(s.receipt.blueprintHash, oracle(canon(body)));
  assert.equal(s.receipt.blueprintHash.length, 64);
});

test('sealBlueprint is reproducible and drops organs that are not in the armoury', () => {
  const meta = { company: 'X', createdAt: '2026-09-21T00:00:00Z' };
  assert.equal(sealBlueprint(realCompany(), meta).receipt.blueprintHash, sealBlueprint(realCompany(), meta).receipt.blueprintHash);
  const l = equip(emptyLoadout(), 'Money', 'fallaccount').loadout;
  l['Money'] = [...l['Money'], 'ghost-tool']; // a non-existent organ
  assert.equal(sealBlueprint(l, meta).receipt.coverage.equipped, 1); // ghost dropped
});

test('sealBlueprint handles a partial loadout and missing meta fields without inventing values', () => {
  // partial loadout: only one seat present, the other seven absent (kills the normalise && guard)
  const s = sealBlueprint({ Money: ['fallaccount'] }, { company: 'Acme', createdAt: '2026-09-21T00:00:00Z' });
  assert.equal(s.ok, true);
  assert.equal(s.receipt.coverage.equipped, 1);
  assert.deepEqual(s.receipt.seats['Trust rail'], []); // absent seat normalised to empty, not thrown
  // missing meta fields must become '' (not undefined) — the && guards, not ||
  const noMeta = sealBlueprint({ Money: ['fallaccount'] }, { createdAt: 'x' });
  assert.equal(noMeta.receipt.company, '');
  const noDate = sealBlueprint({ Money: ['fallaccount'] }, { company: 'Acme' });
  assert.equal(noDate.receipt.createdAt, '');
});

test('verifyBlueprint accepts an honestly sealed blueprint', () => {
  const s = sealBlueprint(realCompany(), { company: 'Meridian', createdAt: '2026-09-21T00:00:00Z' });
  const v = verifyBlueprint(s.receipt);
  assert.equal(v.valid, true);
  assert.match(v.why, /hash matches/);
});

test('verifyBlueprint catches an altered field (the hash no longer matches)', () => {
  const s = sealBlueprint(realCompany(), { company: 'Meridian', createdAt: '2026-09-21T00:00:00Z' });
  const forged = { ...s.receipt, company: 'Not Meridian' }; // changed content, stale hash
  const v = verifyBlueprint(forged);
  assert.equal(v.valid, false);
  assert.match(v.why, /altered/);
});

test('verifyBlueprint REFUSES an ungated organ even with a freshly recomputed valid hash', () => {
  // a determined forger inserts a prototype organ (the-wallet) into its seat and re-hashes the body
  const body = blueprintBody(realCompany(), { company: 'Meridian', createdAt: '2026-09-21T00:00:00Z' });
  body.seats['Trust rail'] = [{ id: 'the-wallet', repo: 'the-wallet', tier: 'prototype' }];
  const forged = { ...body, blueprintHash: sha256(canon(body)).hash }; // VALID hash over the bad body
  const v = verifyBlueprint(forged);
  assert.equal(v.valid, false);
  assert.match(v.why, /ungated organ cannot sit/);
});

test('verifyBlueprint REFUSES a prototype relabelled as proven (tier does not match reality)', () => {
  const body = blueprintBody(realCompany(), { company: 'M', createdAt: '2026-09-21T00:00:00Z' });
  body.seats['Trust rail'] = [{ id: 'the-wallet', repo: 'the-wallet', tier: 'proven' }]; // lying about the tier
  const forged = { ...body, blueprintHash: sha256(canon(body)).hash };
  const v = verifyBlueprint(forged);
  assert.equal(v.valid, false);
  assert.match(v.why, /claims tier/);
});

test('verifyBlueprint catches an unknown organ and a wrong-seat organ', () => {
  const body = blueprintBody(realCompany(), { company: 'M', createdAt: 'x' });
  body.seats.Money = [{ id: 'not-real', repo: 'not-real', tier: 'proven' }];
  const f1 = { ...body, blueprintHash: sha256(canon(body)).hash };
  assert.match(verifyBlueprint(f1).why, /unknown organ/);

  const body2 = blueprintBody(realCompany(), { company: 'M', createdAt: 'x' });
  body2.seats.Money = [{ id: 'fallhr', repo: 'fallhr', tier: 'proven' }]; // fallhr belongs in People
  const f2 = { ...body2, blueprintHash: sha256(canon(body2)).hash };
  assert.match(verifyBlueprint(f2).why, /not a "Money" organ/);
});

test('verifyBlueprint is total on hostile / non-blueprint input', () => {
  assert.equal(verifyBlueprint(null).ok, false);
  assert.equal(verifyBlueprint({ kind: 'something-else' }).valid, false);
  assert.equal(verifyBlueprint({ kind: 'fallkit-company-blueprint' }).valid, false); // no hash
});

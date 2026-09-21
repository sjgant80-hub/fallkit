// Intent tests for loadout.mjs — slice-two. The load-bearing claim is the rule: proven/works may be
// equipped, prototype may NOT, and an organ only fits its own seat. Checked by witness mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEATS, ARMOURY, organById, canEquip, emptyLoadout, equip, unequip, loadoutStatus, planToOrganId,
} from './loadout.mjs';

test('canEquip: proven and works may be equipped, prototype may not', () => {
  assert.equal(canEquip({ tier: 'proven' }).allowed, true);
  assert.equal(canEquip({ tier: 'works' }).allowed, true);
  const p = canEquip({ tier: 'prototype' });
  assert.equal(p.allowed, false);
  assert.match(p.reason, /ungated gear cannot be equipped/);
  assert.equal(canEquip(null).ok, false);
});

test('equip slots a gated organ into its own seat and does not mutate the input', () => {
  const l0 = emptyLoadout();
  const r = equip(l0, 'Money', 'fallaccount');
  assert.equal(r.ok, true);
  assert.deepEqual(r.loadout.Money, ['fallaccount']);
  assert.deepEqual(l0.Money, []); // input untouched
  assert.equal(r.loadout['Sales & CRM'].length, 0);
});

test('equip REFUSES ungated (prototype) gear, even into the correct seat', () => {
  // fallcrm is a real live CRM but reads prototype in the estate scan -> blocked
  const r = equip(emptyLoadout(), 'Sales & CRM', 'fallcrm');
  assert.equal(r.ok, false);
  assert.match(r.why, /prototype/);
});

test('equip refuses an organ in the wrong seat and an unknown organ', () => {
  assert.equal(equip(emptyLoadout(), 'Money', 'fallhr').ok, false);        // fallhr is People
  assert.match(equip(emptyLoadout(), 'Money', 'fallhr').why, /belongs in/);
  assert.equal(equip(emptyLoadout(), 'Money', 'no-such-organ').ok, false);
  assert.equal(equip(emptyLoadout(), 'Nowhere', 'fallaccount').ok, false); // bad seat
  assert.equal(equip('not a loadout', 'Money', 'fallaccount').ok, false);
});

test('equip does not add the same organ twice', () => {
  let l = emptyLoadout();
  l = equip(l, 'Money', 'fallaccount').loadout;
  l = equip(l, 'Money', 'fallaccount').loadout;
  assert.deepEqual(l.Money, ['fallaccount']);
});

test('unequip removes an organ and leaves the input untouched', () => {
  const l = equip(emptyLoadout(), 'Money', 'fallinvoice').loadout;
  const r = unequip(l, 'Money', 'fallinvoice');
  assert.deepEqual(r.loadout.Money, []);
  assert.deepEqual(l.Money, ['fallinvoice']); // input untouched
});

test('loadoutStatus counts equipped organs by tier and filled seats', () => {
  let l = emptyLoadout();
  l = equip(l, 'Money', 'fallaccount').loadout;   // proven
  l = equip(l, 'Work', 'fallmail').loadout;        // works
  const s = loadoutStatus(l);
  assert.equal(s.equipped, 2);
  assert.equal(s.proven, 1);
  assert.equal(s.works, 1);
  assert.equal(s.seatsFilled, 2);
  assert.equal(s.seatsEmpty, SEATS.length - 2);
  assert.equal(s.totalSeats, 8);
});

test('loadoutStatus is total on hostile input', () => {
  assert.equal(loadoutStatus(null).ok, false);
  assert.equal(loadoutStatus(emptyLoadout()).equipped, 0);
});

test('a PARTIAL loadout (missing seats) is normalised, not spread-of-undefined', () => {
  // only one seat present; the other seven are absent — normalise must fill them, not throw
  const s = loadoutStatus({ Money: ['fallaccount'] });
  assert.equal(s.ok, true);
  assert.equal(s.equipped, 1);
  assert.equal(s.proven, 1);
  assert.equal(s.seatsEmpty, 7);
  // and equipping into a partial loadout keeps what was there
  const r = equip({ Money: ['fallaccount'] }, 'People', 'fallhr');
  assert.deepEqual(r.loadout.Money, ['fallaccount']);
  assert.deepEqual(r.loadout.People, ['fallhr']);
});

test('planToOrganId bridges a slice-one plan to an armoury organ', () => {
  assert.equal(planToOrganId({ targetRepo: 'fallaccount' }), 'fallaccount');
  assert.equal(planToOrganId({ targetRepo: 'not-in-armoury' }), null);
  assert.equal(planToOrganId(null), null);
  assert.equal(planToOrganId({}), null);
});

test('organById finds real organs and is total', () => {
  assert.equal(organById('agent-proof').repo, 'agent-proof');
  assert.equal(organById('nope'), null);
  assert.equal(organById(42), null);
});

test('every armoury organ names a real seat and a valid tier', () => {
  for (const o of ARMOURY) {
    assert.ok(SEATS.includes(o.seat), o.id + ' has a non-seat: ' + o.seat);
    assert.ok(['proven', 'works', 'prototype'].includes(o.tier), o.id + ' has a bad tier');
    assert.ok(typeof o.repo === 'string' && o.repo.length > 0);
  }
  // the rule has teeth only if the armoury actually contains BOTH equippable and blocked gear
  assert.ok(ARMOURY.some((o) => o.tier === 'proven' || o.tier === 'works'));
  assert.ok(ARMOURY.some((o) => o.tier === 'prototype'));
});

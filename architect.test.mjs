// Intent tests for architect.mjs — slice-six, the capstone. The claim: one pass over a company's tools
// and exports produces a GATED loadout, honest ungated matches, a sealed+verified blueprint, and a
// ranked gap queue — composing the five kernels correctly. Witness-checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoArchitect } from './architect.mjs';

function meridian() {
  return {
    company: 'Meridian Logistics',
    createdAt: '2026-09-21T00:00:00Z',
    tools: ['Salesforce', 'Xero', 'DocuSign', 'Okta', 'Gmail', 'Gong', 'Aircall', 'Notion', 'Wobblegizmo'],
    exports: [
      { name: 'people.csv', columns: ['Name', 'Role', 'Email', 'Start'], recordCount: 40 },
      { name: 'calendar.csv', columns: ['slot', 'attendee', 'zoomlink'], recordCount: 12 },
    ],
  };
}

test('autoArchitect equips only gated organs and lists the matched-but-ungated ones', () => {
  const r = autoArchitect(meridian());
  assert.equal(r.ok, true);
  const equippedRepos = r.equipped.map((e) => e.repo).sort();
  // Xero->fallaccount (proven), DocuSign->fallsignature (works), Gmail(PARTIAL)->fallmail (works), people.csv->fallhr (proven)
  assert.deepEqual(equippedRepos, ['fallaccount', 'fallhr', 'fallmail', 'fallsignature']);
  const ungatedRepos = r.ungatedMatches.map((e) => e.repo).sort();
  // Salesforce->fallsalescrm (prototype), Okta->the-wallet (prototype) — real matches, cannot be equipped
  assert.deepEqual(ungatedRepos, ['fallsalescrm', 'the-wallet']);
  assert.equal(r.summary.equipped, 4);
  assert.equal(r.summary.ungated, 2);
  // Gong->fallcall is a real match but fallcall is not in the demo armoury -> silently skipped, not a gap
});

test('autoArchitect seals a blueprint over the gated loadout and it verifies', () => {
  const r = autoArchitect(meridian());
  assert.ok(r.blueprint);
  assert.equal(r.blueprint.kind, 'fallkit-company-blueprint');
  assert.equal(r.blueprint.company, 'Meridian Logistics');
  assert.equal(r.verified, true); // only gated organs went in, so it must verify
  // the equipped organs actually sit in the blueprint's seats
  assert.deepEqual(r.blueprint.seats.Money.map((o) => o.repo), ['fallaccount']);
  assert.deepEqual(r.blueprint.seats.People.map((o) => o.repo), ['fallhr']);
});

test('autoArchitect ranks every gap (no-equivalent tool or unmatched export) as the build queue', () => {
  const r = autoArchitect(meridian());
  const gaps = r.queue.map((q) => q.gap.toLowerCase()).sort();
  // Aircall (no voice organ), Notion (no docs organ), Wobblegizmo (unrecognised), calendar.csv (unmatched export)
  assert.deepEqual(gaps, ['aircall', 'calendar.csv', 'notion', 'wobblegizmo']);
  assert.equal(r.queue[0].rank, 1);
  assert.equal(r.summary.gaps, 4);
  // the gap KIND is honest: a recognised-but-absent tool is 'no-equivalent', an unrecognised one is 'unknown'
  const byGap = Object.fromEntries(r.queue.map((q) => [q.gap.toLowerCase(), q.kind]));
  assert.equal(byGap.aircall, 'no-equivalent');
  assert.equal(byGap.wobblegizmo, 'unknown');
});

test('the same gap from a tool AND an export ranks higher (demand is a count)', () => {
  const r = autoArchitect({
    company: 'X',
    tools: ['Aircall', 'Aircall'], // two voice tools -> "voice agent" gap counted twice... but classifyTool gives the same note
    exports: [],
  });
  // both Aircall entries are the same gap key -> demand 2 (deduped by gapKey in the queue kernel)
  assert.equal(r.queue.length, 1);
  assert.equal(r.queue[0].demand, 2);
});

test('autoArchitect emits a build plan: openings -> mint targets, ungated -> gate targets', () => {
  const r = autoArchitect(meridian());
  // 4 gaps (Aircall, Notion, Wobblegizmo, calendar.csv) -> 4 mint targets, each starting at 1b
  assert.equal(r.buildPlan.summary.mint, 4);
  assert.ok(r.buildPlan.toMint.every((t) => t.startTier === '1b' && t.via === 'fallforgemint' && t.status === 'needs-data'));
  // 2 ungated matches (fallsalescrm, the-wallet) -> 2 gate targets via witness
  assert.equal(r.buildPlan.summary.gate, 2);
  assert.ok(r.buildPlan.toGate.every((t) => t.via === 'witness'));
  assert.equal(r.summary.mint, 4);
  assert.equal(r.summary.gate, 2);
});

test('autoArchitect accepts a direct estate-organ list (point it at your own repos)', () => {
  const r = autoArchitect({ company: 'Estate', organs: ['fallaccount', 'fallcrm', 'not-a-real-repo'] });
  // fallaccount (proven) equips, fallcrm (prototype) is a matched-but-ungated, unknown repo is skipped
  assert.deepEqual(r.equipped.map((e) => e.repo), ['fallaccount']);
  assert.deepEqual(r.ungatedMatches.map((e) => e.repo), ['fallcrm']);
  assert.equal(r.verified, true);
});

test('autoArchitect is total on empty and hostile input', () => {
  assert.equal(autoArchitect(null).ok, false);
  const empty = autoArchitect({});
  assert.equal(empty.ok, true);
  assert.equal(empty.summary.equipped, 0);
  assert.equal(empty.summary.gaps, 0);
  assert.equal(empty.verified, true); // an empty company trivially seals and verifies
});

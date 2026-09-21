// Intent tests for multi.mjs — slice-five. The claim: several exports fold into one company picture,
// each mapped to its organ and seat, unmatched sources become gaps, and organs de-dupe. Witness-checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingestSource, combineSources } from './multi.mjs';

test('ingestSource maps a recognised export to its organ, seat and coverage', () => {
  const r = ingestSource({ name: 'hubspot-contacts.csv', columns: ['Full Name', 'Email', 'Company', 'Deal Stage'], recordCount: 500 });
  assert.equal(r.matched, true);
  assert.equal(r.target, 'fallcrm');
  assert.equal(r.seat, 'Sales & CRM');
  assert.equal(r.recordCount, 500);
  assert.ok(r.coverage.mapped >= 3);
});

test('ingestSource marks an unrecognised export as an unmatched gap, not a false match', () => {
  const r = ingestSource({ name: 'mystery.csv', columns: ['foo', 'bar', 'baz'], recordCount: 10 });
  assert.equal(r.matched, false);
  assert.equal(r.target, null);
  assert.equal(r.seat, '');
});

test('ingestSource is total on hostile input', () => {
  assert.equal(ingestSource(null).ok, false);
  assert.equal(ingestSource({ name: 'x' }).ok, false); // no columns
});

test('combineSources folds several exports into a per-seat loadout with totals', () => {
  const c = combineSources([
    { name: 'crm.csv', columns: ['Full Name', 'Email', 'Company', 'Deal Stage'], recordCount: 500 },
    { name: 'accounts.csv', columns: ['Date', 'Amount', 'Description', 'Category'], recordCount: 1200 },
    { name: 'people.csv', columns: ['Name', 'Role', 'Email', 'Start'], recordCount: 40 },
  ]);
  assert.equal(c.ok, true);
  assert.equal(c.sourceCount, 3);
  assert.equal(c.totalRecords, 1740);
  assert.deepEqual(c.loadout['Sales & CRM'], ['fallcrm']);
  assert.deepEqual(c.loadout.Money, ['fallaccount']);
  assert.deepEqual(c.loadout.People, ['fallhr']);
  assert.equal(c.organCount, 3);
  assert.deepEqual(c.gaps, []);
});

test('combineSources de-dupes an organ that two exports both map to', () => {
  const c = combineSources([
    { name: 'invoices-2025.csv', columns: ['Invoice Number', 'Client', 'Amount', 'Due', 'Status'], recordCount: 100 },
    { name: 'invoices-2026.csv', columns: ['Invoice Number', 'Client', 'Amount', 'Due', 'Status'], recordCount: 120 },
  ]);
  assert.deepEqual(c.loadout.Money, ['fallinvoice']); // once, not twice
  assert.equal(c.organCount, 1);
  assert.equal(c.totalRecords, 220);
});

test('combineSources collects unmatched sources as gaps', () => {
  const c = combineSources([
    { name: 'crm.csv', columns: ['Full Name', 'Email', 'Company'], recordCount: 5 },
    { name: 'calendar.csv', columns: ['slot', 'attendee', 'zoomlink'], recordCount: 5 },
  ]);
  assert.deepEqual(c.gaps, ['calendar.csv']);
  assert.equal(c.organCount, 1);
});

test('combineSources is total on hostile input', () => {
  assert.equal(combineSources('nope').ok, false);
  assert.equal(combineSources([]).sourceCount, 0);
  assert.equal(combineSources([null, 42]).sourceCount, 0); // bad sources skipped
});

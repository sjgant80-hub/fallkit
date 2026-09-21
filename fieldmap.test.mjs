// Intent tests for fieldmap.mjs — slice-one. Pins the honest claims: it reads only the SHAPE, maps
// fields into MAPPED/FUZZY/MISSING with EXTRA never dropped, and the plan hash is reproducible and
// carries dataStored:false / autoRun:false. Checked by witness mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  sha256, canon, splitCsvLine, detectFormat, parseColumns, guessTarget, mapFields, buildManifest, TARGET_SCHEMAS,
} from './fieldmap.mjs';

const oracle = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

test('sha256 matches Node crypto across sizes and unicode', () => {
  for (const s of ['', 'abc', 'a'.repeat(100), 'Meridian, Ltd. £4,200', 'π 🚚']) {
    assert.equal(sha256(s).hash, oracle(s));
  }
  assert.equal(sha256(42).ok, false);
});

test('canon renders each JSON type exactly (kills the type-guard mutants)', () => {
  assert.equal(canon(null), 'null');
  assert.equal(canon(true), 'true');
  assert.equal(canon(false), 'false');
  assert.equal(canon(42), '42');
  assert.equal(canon('x'), '"x"');
  assert.equal(canon([1, null, 'a']), '[1,null,"a"]');
  assert.equal(canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('splitCsvLine handles quoted fields, embedded commas and "" escapes', () => {
  assert.deepEqual(splitCsvLine('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(splitCsvLine('"a,b",c'), ['a,b', 'c']);
  assert.deepEqual(splitCsvLine('a,"b""c",d'), ['a', 'b"c', 'd']);
  assert.deepEqual(splitCsvLine('  spaced , trimmed '), ['spaced', 'trimmed']);
  assert.deepEqual(splitCsvLine(42), []);
});

test('detectFormat tells JSON, CSV and unknown apart', () => {
  assert.equal(detectFormat('[{"a":1}]'), 'json');       // array
  assert.equal(detectFormat('{"a":1}'), 'json');         // object (exercises the '{' clause)
  assert.equal(detectFormat('name,email\nA,a@x.com'), 'csv');
  assert.equal(detectFormat('just some prose with no comma'), 'unknown');
  assert.equal(detectFormat(''), 'unknown');
  assert.equal(detectFormat('[not valid json'), 'unknown'); // '[' but doesn't parse, no comma
});

test('parseColumns reads columns and record count from CSV — values never retained', () => {
  const csv = 'Name,Email,Company\nAda,ada@x.com,Analytical\nGrace,grace@y.com,Navy';
  const r = parseColumns(csv);
  assert.equal(r.ok, true);
  assert.equal(r.format, 'csv');
  assert.deepEqual(r.columns, ['Name', 'Email', 'Company']);
  assert.equal(r.recordCount, 2);
  assert.equal(JSON.stringify(r).includes('ada@x.com'), false); // no value leaked into the result
});

test('parseColumns excludes blank lines from the record count and empty trailing header columns', () => {
  // blank lines in the middle/end must NOT count as records (the > 0 filter, not >= 0)
  const r = parseColumns('Name,Email\nA,a\n\nB,b\n');
  assert.equal(r.recordCount, 2);
  // a trailing comma makes an empty header column, which must be dropped (also > 0)
  const h = parseColumns('Name,Email,\nA,a,');
  assert.deepEqual(h.columns, ['Name', 'Email']);
});

test('parseColumns reads a JSON array of records', () => {
  const json = '[{"deal":"x","amount":10},{"deal":"y","amount":20}]';
  const r = parseColumns(json);
  assert.equal(r.ok, true); assert.equal(r.format, 'json');
  assert.deepEqual(r.columns, ['deal', 'amount']); assert.equal(r.recordCount, 2);
});

test('parseColumns refuses empty / unrecognised input without throwing', () => {
  assert.equal(parseColumns('').ok, false);
  assert.equal(parseColumns('no delimiters here').ok, false);
  const empty = parseColumns('[]'); // valid JSON, no records
  assert.equal(empty.ok, false);
  assert.match(empty.why, /no array of records/); // refused at the right check, not by accident
  assert.equal(parseColumns(42).ok, false);
});

test('guessTarget picks the organ whose schema the columns fit', () => {
  assert.equal(guessTarget(['Full Name', 'Email', 'Company', 'Deal Stage']), 'fallcrm');
  assert.equal(guessTarget(['Date', 'Amount', 'Description', 'Category']), 'fallaccount');
  assert.equal(guessTarget(['Invoice Number', 'Due Date', 'Client', 'Amount', 'Status']), 'fallinvoice');
  assert.equal(guessTarget(['x1', 'x2', 'x3']), null); // nothing fits
  assert.equal(guessTarget('not an array'), null);
});

test('guessTarget uses synonyms, containment, the filename hint, and breaks ties to the first organ', () => {
  // synonym-only: "Organisation" matches company only via the synonym list, not the field name
  assert.equal(guessTarget(['Organisation']), 'fallcrm');
  // containment-only: "Customer Email" contains aliases but equals none exactly
  assert.equal(guessTarget(['Customer Email']), 'fallcrm');
  // filename hint decides when the columns are ambiguous
  assert.equal(guessTarget(['a', 'b'], 'invoices-export.csv'), 'fallinvoice');
  // a genuine tie (name+email+stage fit fallcrm AND fallrecruit) resolves to the first organ, not the last
  assert.equal(guessTarget(['name', 'email', 'stage']), 'fallcrm');
});

test('mapFields sorts every field into MAPPED / FUZZY / MISSING and reports EXTRA', () => {
  const cols = ['Full Name', 'Email Address', 'Company', 'Deal Stage', 'Phone Number', 'Random Extra'];
  const m = mapFields(cols, 'fallcrm');
  assert.equal(m.ok, true);
  const byField = Object.fromEntries(m.fields.map((f) => [f.field, f]));
  assert.equal(byField.name.status, 'MAPPED');   assert.equal(byField.name.source, 'Full Name');
  assert.equal(byField.email.status, 'MAPPED');
  assert.equal(byField.company.status, 'MAPPED');
  assert.equal(byField.stage.status, 'MAPPED');   // "Deal Stage" -> dealstage alias
  assert.equal(byField.phone.status, 'FUZZY');    // "Phone Number" contains phone, not exact
  assert.equal(byField.owner.status, 'MISSING');
  assert.equal(byField.notes.status, 'MISSING');
  assert.deepEqual(m.extra, ['Random Extra']);
  assert.deepEqual(m.coverage, { mapped: 5, total: 7 });
});

test('mapFields does not reuse one column for two fields', () => {
  // a single "email" column must not satisfy both email and (via containment) anything else twice
  const m = mapFields(['email', 'email'], 'fallcrm');
  const emailSources = m.fields.filter((f) => f.source === 'email');
  // two identical columns, but each source index used at most once
  assert.ok(m.fields.filter((f) => f.status !== 'MISSING').length <= 2);
  assert.equal(m.ok, true);
});

test('mapFields is total on hostile input', () => {
  assert.equal(mapFields('nope', 'fallcrm').ok, false);
  assert.equal(mapFields(['a'], 'no-such-organ').ok, false);
});

test('buildManifest emits a hashed plan that is reproducible and marks dataStored/autoRun false', () => {
  const meta = { sourceTool: 'HubSpot', targetId: 'fallcrm', columns: ['Full Name', 'Email', 'Company', 'Deal Stage', 'Phone'], recordCount: 250, createdAt: '2026-09-21T00:00:00Z' };
  const a = buildManifest(meta);
  assert.equal(a.ok, true);
  assert.equal(a.plan.kind, 'fallkit-scaffold-plan');
  assert.equal(a.plan.sourceTool, 'HubSpot');
  assert.equal(a.plan.target, 'fallcrm');
  assert.equal(a.plan.targetRepo, 'fallcrm');
  assert.equal(a.plan.recordCount, 250);
  assert.equal(a.plan.dataStored, false);
  assert.equal(a.plan.autoRun, false);
  assert.equal(typeof a.plan.manifestHash, 'string');
  assert.equal(a.plan.manifestHash.length, 64);
  // reproducible: same input + same createdAt -> identical hash
  const b = buildManifest(meta);
  assert.equal(a.plan.manifestHash, b.plan.manifestHash);
  // and the hash actually covers the plan content (not a constant)
  const c = buildManifest({ ...meta, recordCount: 999 });
  assert.notEqual(a.plan.manifestHash, c.plan.manifestHash);
});

test('buildManifest refuses malformed meta', () => {
  assert.equal(buildManifest(null).ok, false);
  assert.equal(buildManifest({ targetId: 'fallcrm' }).ok, false); // no sourceTool
  assert.equal(buildManifest({ sourceTool: 'X', targetId: 'nope', columns: [] }).ok, false);
});

test('every TARGET_SCHEMAS organ names a repo and fields', () => {
  for (const id of Object.keys(TARGET_SCHEMAS)) {
    assert.ok(typeof TARGET_SCHEMAS[id].repo === 'string' && TARGET_SCHEMAS[id].repo.length > 0);
    assert.ok(Array.isArray(TARGET_SCHEMAS[id].fields) && TARGET_SCHEMAS[id].fields.length > 0);
  }
});

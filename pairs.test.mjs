// Intent tests for pairs.mjs — the ingestion depth. Pins the honest rules: never invent a label
// (refuse unlabeled), a real target column is found, blank-label rows are skipped, and the split is
// deterministic and LEAKAGE-FREE (identical inputs never straddle train and held-out). Witness-checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecords, pickTarget, pairText, makePairs, splitPairs, generatePairs } from './pairs.mjs';

const TICKETS = 'subject,body,category\nCant log in,password reset help,Access\nRefund please,double charged,Billing\nApp crashes,white screen,Bug\nWrong invoice,charged twice,Billing';

test('parseRecords reads real values into row objects (CSV and JSON)', () => {
  const r = parseRecords(TICKETS);
  assert.equal(r.ok, true);
  assert.equal(r.records.length, 4);
  assert.equal(r.records[0].category, 'Access');
  assert.equal(r.records[1].body, 'double charged');
  const j = parseRecords('[{"q":"hi","label":"greet"},{"q":"bye","label":"leave"}]');
  assert.equal(j.ok, true); assert.equal(j.records.length, 2); assert.equal(j.records[0].label, 'greet');
  assert.equal(parseRecords('only a header,no rows').ok, false);
  assert.equal(parseRecords(42).ok, false);
});

test('pickTarget finds the label column by name and excludes it + identifiers from the input', () => {
  const p = pickTarget(['ticket_id', 'subject', 'body', 'category']);
  assert.equal(p.target, 'category');
  assert.deepEqual(p.inputs, ['subject', 'body']); // ticket_id excluded as an identifier, category is the target
});

test('pickTarget REFUSES to invent a label when nothing looks like one (honest unlabeled case)', () => {
  const p = pickTarget(['subject', 'body', 'notes']);
  assert.equal(p.target, null); // no category/label/outcome column -> unlabeled, not a guess
  assert.match(p.reason, /unlabeled/);
});

test('pairText joins inputs, uses the target as output, and skips a blank label', () => {
  const p = pairText({ subject: 'Cant log in', body: 'help', category: 'Access' }, ['subject', 'body'], 'category');
  assert.equal(p.output, 'Access');
  assert.match(p.input, /subject: Cant log in/);
  assert.equal(pairText({ subject: 'x', category: '   ' }, ['subject'], 'category'), null); // blank label -> no pair
  assert.equal(pairText(null, ['a'], 'category'), null);
});

test('makePairs counts skipped (unlabelled) rows honestly', () => {
  const recs = [{ s: 'a', category: 'X' }, { s: 'b', category: '' }, { s: 'c', category: 'Y' }];
  const m = makePairs(recs, ['s'], 'category');
  assert.equal(m.pairs.length, 2);
  assert.equal(m.skipped, 1);
});

test('splitPairs is deterministic, roughly honours the held-out fraction, and never leaks', () => {
  const pairs = Array.from({ length: 200 }, (_, i) => ({ input: 'row ' + i, output: 'y' }));
  const a = splitPairs(pairs, 20);
  const b = splitPairs(pairs, 20);
  assert.deepEqual(a.train.map((p) => p.input), b.train.map((p) => p.input)); // deterministic
  assert.equal(a.train.length + a.holdout.length, 200);
  assert.equal(a.leakage, false);
  assert.ok(a.holdout.length > 5 && a.holdout.length < 60); // ~20%, not degenerate
});

test('splitPairs puts identical inputs in the SAME bucket — no train/held-out leakage', () => {
  // two pairs with the same input must not be split across train and held-out
  const pairs = [{ input: 'dup', output: '1' }, { input: 'dup', output: '2' }, { input: 'other', output: '3' }];
  const s = splitPairs(pairs, 50);
  const dupInTrain = s.train.filter((p) => p.input === 'dup').length;
  const dupInHoldout = s.holdout.filter((p) => p.input === 'dup').length;
  assert.ok(dupInTrain === 0 || dupInHoldout === 0); // all 'dup' on one side, never split
  assert.equal(s.leakage, false);
});

test('generatePairs runs the whole ingestion and warns honestly on thin data', () => {
  const g = generatePairs(TICKETS, { holdoutPct: 25 });
  assert.equal(g.ok, true);
  assert.equal(g.labeled, true);
  assert.equal(g.target, 'category');
  assert.equal(g.trainCount + g.holdoutCount, 4);
  assert.equal(g.leakage, false);
  assert.ok(g.warnings.some((w) => /thin/.test(w))); // only 4 pairs < minPairs default 12
});

test('generatePairs REFUSES unlabelled data instead of fabricating outputs', () => {
  const g = generatePairs('subject,body,notes\na,b,c\nd,e,f');
  assert.equal(g.ok, true);
  assert.equal(g.labeled, false);
  assert.match(g.why, /unlabeled|opening for labelling/);
});

test('splitPairs honours the pct boundaries and defaults a bad pct to 20', () => {
  const pairs = Array.from({ length: 200 }, (_, i) => ({ input: 'r' + i, output: 'y' }));
  assert.equal(splitPairs(pairs, 0).holdout.length, 0);   // 0% -> all train (>= 0 boundary, and < pct)
  assert.equal(splitPairs(pairs, 100).train.length, 0);   // 100% -> all held-out (<= 100 boundary)
  const d1 = splitPairs(pairs, 'nope');                   // non-number -> default 20
  const d2 = splitPairs(pairs, -5);                       // negative -> default 20
  assert.deepEqual(d1.holdout.map((p) => p.input), d2.holdout.map((p) => p.input));
  assert.ok(d1.holdout.length > 5 && d1.holdout.length < 60);
});

test('splitPairs skips a malformed pair (no input) rather than throwing', () => {
  const s = splitPairs([{ output: 'x' }, { input: 'a', output: 'y' }, 'nope'], 50);
  assert.equal(s.train.length + s.holdout.length, 1); // only the well-formed pair counts
});

test('parseRecords excludes blank lines, refuses a header-only file, drops empty header cols', () => {
  assert.equal(parseRecords('a,b\n1,2\n\n3,4\n').records.length, 2); // blank line is not a record
  assert.equal(parseRecords('a,b\n').ok, false);                      // header only -> refuse
  assert.deepEqual(parseRecords('a,b,\n1,2,3').columns, ['a', 'b']);  // trailing comma -> empty col dropped
});

test('parseRecords accepts a JSON {records:[...]} envelope and refuses an empty array', () => {
  const r = parseRecords('{"records":[{"category":"X","s":"a"}]}');
  assert.equal(r.ok, true); assert.equal(r.records[0].category, 'X');
  const e = parseRecords('[]');
  assert.equal(e.ok, false); assert.match(e.why, /array of record/);
});

test('pairText checks each of its arguments', () => {
  const rec = { s: 'a', category: 'X' };
  assert.equal(pairText(rec, 'not-array', 'category'), null);
  assert.equal(pairText(rec, ['s'], 42), null);
});

test('generatePairs warnings are exact at the boundaries', () => {
  const rows = ['q,category']; for (let i = 0; i < 20; i++) rows.push('item ' + i + ',Cat' + (i % 3));
  const g = generatePairs(rows.join('\n'), { minPairs: 12, holdoutPct: 25 });
  assert.equal(g.warnings.some((w) => /skipped/.test(w)), false); // 0 skipped -> no skip warning (> 0, not >= 0)
  assert.equal(g.warnings.some((w) => /thin/.test(w)), false);    // 20 pairs, not < 12
  const g0 = generatePairs(rows.join('\n'), { minPairs: 1, holdoutPct: 0 });
  assert.ok(g0.warnings.some((w) => /held-out set is empty/.test(w))); // 0 held-out -> honest "cannot gate"
  // exactly minPairs pairs must NOT be flagged thin (< minPairs, not <= minPairs)
  const exact = ['q,category']; for (let i = 0; i < 12; i++) exact.push('x' + i + ',C' + (i % 2));
  assert.equal(generatePairs(exact.join('\n'), { minPairs: 12, holdoutPct: 25 }).warnings.some((w) => /thin/.test(w)), false);
});

test('generatePairs is total on hostile input', () => {
  assert.equal(generatePairs(42).ok, false);
  assert.equal(generatePairs('').ok, false);
});

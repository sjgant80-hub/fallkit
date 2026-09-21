// Intent tests for queue.mjs — slice-three. The claim is that demand is an honest count: the same gap
// from many companies ranks higher, and ordering is stable. Checked by witness mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapKey, recordGap, mergeSignals, rankQueue, queueStats } from './queue.mjs';

test('gapKey normalises case and whitespace', () => {
  assert.equal(gapKey('  Voice  Agent '), 'voice agent');
  assert.equal(gapKey('VOICE AGENT'), 'voice agent');
  assert.equal(gapKey(42), '');
});

test('recordGap adds a new gap at demand 1 and increments an existing one', () => {
  let q = [];
  q = recordGap(q, { gap: 'Voice agent', seat: 'Sales & CRM', kind: 'no-equivalent' }).queue;
  assert.equal(q.length, 1);
  assert.equal(q[0].demand, 1);
  q = recordGap(q, { gap: 'voice AGENT' }).queue; // same gap, different casing
  assert.equal(q.length, 1);
  assert.equal(q[0].demand, 2); // counted, not duplicated
});

test('recordGap does not mutate the input and refuses a blank/non-object signal', () => {
  const q0 = [];
  recordGap(q0, { gap: 'x' });
  assert.equal(q0.length, 0);
  assert.equal(recordGap('nope', { gap: 'x' }).ok, false);
  assert.equal(recordGap([], { gap: '   ' }).ok, false);
  assert.equal(recordGap([], {}).ok, false);
  assert.equal(recordGap([], null).ok, false); // null is not an object here (isObj must reject it)
  assert.equal(recordGap([], ['gap']).ok, false); // an array is not an object signal
});

test('rankQueue and mergeSignals treat arrays/non-objects strictly, not as records', () => {
  // an array entry in the queue is NOT a record and must be filtered out
  assert.equal(rankQueue([{ gap: 'a', demand: 1 }, [1, 2]]).ranked.length, 1);
  // mergeSignals needs BOTH arguments to be arrays
  assert.equal(mergeSignals([], 'nope').ok, false);
  assert.equal(mergeSignals('nope', []).ok, false);
});

test('recordGap defaults an unknown kind to no-equivalent, keeps a valid one', () => {
  assert.equal(recordGap([], { gap: 'a', kind: 'made-up' }).queue[0].kind, 'no-equivalent');
  assert.equal(recordGap([], { gap: 'a', kind: 'missing-field' }).queue[0].kind, 'missing-field');
});

test('mergeSignals folds several companies worth of gaps and ranks by demand', () => {
  // three companies: voice agent x3, scheduling x2, wiki x1
  const signals = [
    { gap: 'Voice agent' }, { gap: 'Scheduling' }, { gap: 'Wiki' },
    { gap: 'voice agent' }, { gap: 'scheduling' },
    { gap: 'VOICE AGENT' },
  ];
  const m = mergeSignals([], signals);
  const r = rankQueue(m.queue);
  assert.equal(r.ranked[0].gap.toLowerCase(), 'voice agent');
  assert.equal(r.ranked[0].demand, 3);
  assert.equal(r.ranked[0].rank, 1);
  assert.equal(r.ranked[1].demand, 2); // scheduling
  assert.equal(r.ranked[2].demand, 1); // wiki
});

test('rankQueue breaks ties by name so the order is stable', () => {
  const q = [{ gap: 'Zebra', demand: 2 }, { gap: 'Apple', demand: 2 }];
  const r = rankQueue(q);
  assert.equal(r.ranked[0].gap, 'Apple'); // same demand -> alphabetical
  assert.equal(r.ranked[1].gap, 'Zebra');
});

test('rankQueue and queueStats are total on hostile input', () => {
  assert.equal(rankQueue('nope').ok, false);
  assert.equal(rankQueue([]).ranked.length, 0);
  assert.equal(queueStats('nope').ok, false);
});

test('queueStats reports gap count, total demand, and the top gap', () => {
  const m = mergeSignals([], [{ gap: 'A' }, { gap: 'A' }, { gap: 'B' }]);
  const s = queueStats(m.queue);
  assert.equal(s.gaps, 2);
  assert.equal(s.totalDemand, 3);
  assert.equal(s.top.gap, 'A');
  assert.equal(queueStats([]).top, null);
});

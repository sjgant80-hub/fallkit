// Intent tests for vault.mjs — slice-four. The claims: access needs BOTH capability and budget, the
// budget genuinely runs out, every use (granted or refused) is recorded, and the audit chain catches
// tampering. Checked by witness mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256, canon, newVault, addKey, requestUse, verifyChain, keyStatus, GENESIS } from './vault.mjs';

const oracle = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function vaultWithKey() {
  const v = newVault();
  return addKey(v, { id: 'openai', name: 'OpenAI key', capabilities: ['draft', 'classify'], budget: 3 }).vault;
}

test('sha256 matches Node crypto (kills the vendored-hash mutants)', () => {
  for (const s of ['', 'abc', 'z'.repeat(120), 'key £ π']) assert.equal(sha256(s).hash, oracle(s));
  assert.equal(sha256(1).ok, false);
});

test('canon renders each type exactly', () => {
  assert.equal(canon(null), 'null'); assert.equal(canon(true), 'true'); assert.equal(canon(2), '2');
  assert.equal(canon('a'), '"a"'); assert.equal(canon([1, null]), '[1,null]'); assert.equal(canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('addKey registers a grant (never the secret value) and refuses duplicates', () => {
  const v = vaultWithKey();
  assert.equal(v.keys.length, 1);
  assert.equal(v.keys[0].used, 0);
  assert.deepEqual(v.keys[0].capabilities, ['draft', 'classify']);
  assert.equal(JSON.stringify(v).includes('sk-'), false); // no secret material anywhere
  assert.equal(addKey(v, { id: 'openai' }).ok, false);    // duplicate id
  assert.equal(addKey(v, {}).ok, false);                  // no id
  assert.equal(addKey('nope', { id: 'x' }).ok, false);
  assert.equal(addKey(v, { id: 'anthropic', capabilities: ['draft'], budget: 1 }).ok, true); // a DIFFERENT key is fine
  // each part of the vault guard must be checked (|| not &&)
  assert.equal(addKey({ keys: 'nope', chain: [] }, { id: 'x' }).ok, false);
  assert.equal(addKey({ keys: [], chain: 'nope' }, { id: 'x' }).ok, false);
});

test('requestUse GRANTS only with the capability AND budget, and spends the budget', () => {
  let v = vaultWithKey();
  const r = requestUse(v, 'openai', { organ: 'fallcrm', needs: 'draft', cost: 2 });
  assert.equal(r.allowed, true);
  assert.equal(r.reason, 'granted');
  assert.equal(r.vault.keys[0].used, 2);       // budget spent
  assert.equal(r.receipt.allowed, true);
  assert.equal(r.vault.chain.length, 1);        // recorded
  assert.equal(v.keys[0].used, 0);              // input untouched
});

test('requestUse REFUSES a missing capability and records the refusal', () => {
  const v = vaultWithKey();
  const r = requestUse(v, 'openai', { organ: 'rogue', needs: 'wire-funds', cost: 1 });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /lacks capability/);
  assert.equal(r.vault.keys[0].used, 0);        // budget NOT spent on a refusal
  assert.equal(r.vault.chain.length, 1);        // refusal still recorded
  assert.equal(r.receipt.allowed, false);
});

test('requestUse REFUSES over-budget use even with the capability — the budget runs out', () => {
  let v = vaultWithKey();
  v = requestUse(v, 'openai', { organ: 'a', needs: 'draft', cost: 2 }).vault; // used 2 of 3
  const r = requestUse(v, 'openai', { organ: 'a', needs: 'draft', cost: 2 }); // wants 2, only 1 left
  assert.equal(r.allowed, false);
  assert.match(r.reason, /over budget/);
  // boundary: exactly the remaining budget is allowed
  const ok = requestUse(v, 'openai', { organ: 'a', needs: 'draft', cost: 1 });
  assert.equal(ok.allowed, true);
});

test('requestUse needs BOTH — capability-yes/budget-no and capability-no/budget-yes both refuse', () => {
  const noBudget = addKey(newVault(), { id: 'k', capabilities: ['draft'], budget: 0 }).vault;
  assert.equal(requestUse(noBudget, 'k', { organ: 'a', needs: 'draft', cost: 1 }).allowed, false);
  const noCap = addKey(newVault(), { id: 'k', capabilities: [], budget: 9 }).vault;
  assert.equal(requestUse(noCap, 'k', { organ: 'a', needs: 'draft', cost: 1 }).allowed, false);
});

test('requestUse is total on hostile input — every guard clause checked', () => {
  const v = vaultWithKey();
  assert.equal(requestUse(v, 'nope', { organ: 'a', needs: 'draft', cost: 1 }).ok, false);
  assert.equal(requestUse(v, 'openai', { organ: 'a', needs: 'draft' }).ok, false);      // no cost
  assert.equal(requestUse(v, 'openai', { needs: 'draft', cost: 1 }).ok, false);          // no organ
  assert.equal(requestUse(v, 'openai', { organ: 'a', cost: 1 }).ok, false);              // no needs
  assert.equal(requestUse(v, 'openai', { organ: 'a', needs: 'draft', cost: Infinity }).ok, false); // non-finite cost
  assert.equal(requestUse(v, 'openai', null).ok, false);
  assert.equal(requestUse('nope', 'openai', { organ: 'a', needs: 'draft', cost: 1 }).ok, false);
  assert.equal(requestUse({ keys: 'nope', chain: [] }, 'openai', { organ: 'a', needs: 'draft', cost: 1 }).ok, false);
  assert.equal(requestUse({ keys: [], chain: 'nope' }, 'openai', { organ: 'a', needs: 'draft', cost: 1 }).ok, false);
});

test('the audit chain links, verifies, and catches tampering', () => {
  let v = vaultWithKey();
  v = requestUse(v, 'openai', { organ: 'a', needs: 'draft', cost: 1 }).vault;
  v = requestUse(v, 'openai', { organ: 'b', needs: 'nope', cost: 1 }).vault; // refused, recorded
  const chain = v.chain;
  assert.equal(chain[0].prevHash, GENESIS);
  assert.equal(chain[1].prevHash, chain[0].hash);
  assert.equal(verifyChain(chain).valid, true);
  // flip a recorded refusal into an "allowed" without re-hashing -> caught
  const forged = chain.map((e, i) => i === 1 ? { ...e, allowed: true } : e);
  const vv = verifyChain(forged);
  assert.equal(vv.valid, false);
  assert.equal(vv.brokenAt, 1);
  assert.match(vv.reason, /altered/);
});

test('verifyChain is total, and keyStatus counts only the requested key', () => {
  assert.equal(verifyChain('nope').ok, false);
  assert.equal(verifyChain([]).valid, true);
  let v = vaultWithKey();
  v = addKey(v, { id: 'anthropic', capabilities: ['draft'], budget: 5 }).vault;
  v = requestUse(v, 'openai', { organ: 'a', needs: 'draft', cost: 1 }).vault;    // grant on openai
  v = requestUse(v, 'openai', { organ: 'b', needs: 'nope', cost: 1 }).vault;     // refuse on openai
  v = requestUse(v, 'anthropic', { organ: 'c', needs: 'draft', cost: 1 }).vault; // grant on anthropic (must NOT count for openai)
  const s = keyStatus(v, 'openai');
  assert.equal(s.remaining, 2);
  assert.equal(s.grants, 1);    // only openai's grant, not anthropic's
  assert.equal(s.refusals, 1);
  assert.equal(keyStatus(v, 'nope').ok, false);
  assert.equal(keyStatus({ keys: 'nope' }, 'x').ok, false);
});

// fallkit · vault.mjs — slice-four: the composed API-key vault. Kar flagged this as real, unbuilt work
// (no single organ IS a general secrets vault); this wires the three real estate patterns into one
// gated block. A key is (1) sealed at rest — AES-256-GCM, done in the page with Web Crypto, the value
// never enters this kernel; (2) usable only by an organ that holds the right capability AND is within a
// budget it cannot cross (the-wallet / openkonomi); (3) every use — granted OR refused — appended to a
// tamper-evident hash-chain (agent-proof's receipt that can say FAILS). The budget is spent on grant,
// so it genuinely runs out. Nothing is auto-used: the vault decides and records, a caller acts.
//
// sha256 + canon vendored verbatim (fallbrain/cascade.mjs). Pure and total: garbage in -> {ok:false},
// never a throw. No I/O, no network — the page does the encryption and the (in-memory) use.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ── SHA-256 + canonical JSON (vendored verbatim from fallbrain/cascade.mjs) ──
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256(text) {
  if (!isStr(text)) return { ok: false, why: 'sha256 takes a string' };
  const data = new TextEncoder().encode(text);
  const len = data.length;
  const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return { ok: true, hash: hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7) };
}
export function canon(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '"?"';
}

export const GENESIS = '0'.repeat(64);
function receiptHash(record) {
  const rest = {};
  for (const k of Object.keys(record)) if (k !== 'hash') rest[k] = record[k];
  const h = sha256(canon(rest));
  return h.ok ? h.hash : null;
}

/** newVault() — an empty vault: no keys, an empty audit chain. */
export function newVault() { return { keys: [], chain: [] }; }

/** addKey(vault, spec) — register a key by its GRANT only: { id, name, capabilities, budget }. The
 *  secret value itself is never passed here — it is sealed with AES-GCM in the page. Never mutates. */
export function addKey(vault, spec) {
  if (!isObj(vault) || !isArr(vault.keys) || !isArr(vault.chain)) return { ok: false, why: 'not a vault' };
  if (!isObj(spec) || !isStr(spec.id) || spec.id.trim() === '') return { ok: false, why: 'key needs an id' };
  for (const k of vault.keys) if (isObj(k) && k.id === spec.id) return { ok: false, why: 'a key with id "' + spec.id + '" already exists' };
  const key = {
    id: spec.id,
    name: isStr(spec.name) ? spec.name : spec.id,
    capabilities: isArr(spec.capabilities) ? spec.capabilities.filter(isStr) : [],
    budget: isNum(spec.budget) ? spec.budget : 0,
    used: 0,
  };
  return { ok: true, vault: { keys: [...vault.keys, key], chain: [...vault.chain] } };
}

/** requestUse(vault, keyId, req) — the composed decision. req: { organ, needs, cost }. Grants only if
 *  the key's capabilities include req.needs AND the remaining budget covers req.cost. EITHER WAY it
 *  appends a receipt to the tamper-evident chain (a refusal is recorded, not swallowed); on a grant it
 *  also spends the budget. Returns { ok, allowed, reason, receipt, vault }. Never mutates the input. */
export function requestUse(vault, keyId, req) {
  if (!isObj(vault) || !isArr(vault.keys) || !isArr(vault.chain)) return { ok: false, why: 'not a vault' };
  if (!isObj(req) || !isStr(req.organ) || !isStr(req.needs) || !isNum(req.cost)) return { ok: false, why: 'request needs { organ, needs, cost }' };
  const key = vault.keys.find((k) => isObj(k) && k.id === keyId);
  if (!key) return { ok: false, why: 'no such key: ' + keyId };
  const remaining = key.budget - key.used;
  const hasCap = key.capabilities.indexOf(req.needs) !== -1;
  const within = req.cost <= remaining;
  const allowed = hasCap && within;
  const reason = allowed
    ? 'granted'
    : (!hasCap
      ? 'organ "' + req.organ + '" lacks capability "' + req.needs + '" for this key'
      : 'over budget: cost ' + req.cost + ' exceeds the ' + remaining + ' remaining');
  const seq = vault.chain.length;
  const prev = vault.chain[seq - 1]; // undefined when seq === 0, guarded below
  const prevHash = (isObj(prev) && isStr(prev.hash)) ? prev.hash : GENESIS;
  const record = { seq, keyId, organ: req.organ, needs: req.needs, cost: req.cost, allowed, reason, prevHash };
  const hash = receiptHash(record);
  if (hash === null) return { ok: false, why: 'could not hash the use record' };
  const nextChain = [...vault.chain, { ...record, hash }];
  const nextKeys = vault.keys.map((k) => (allowed && isObj(k) && k.id === keyId) ? { ...k, used: k.used + req.cost } : { ...k });
  return { ok: true, allowed, reason, receipt: { ...record, hash }, vault: { keys: nextKeys, chain: nextChain } };
}

/** verifyChain(chain) — recompute the audit chain; catch a tampered field, a broken prevHash link, or
 *  an out-of-order seq. Returns { ok, valid, brokenAt, reason }. */
export function verifyChain(chain) {
  if (!isArr(chain)) return { ok: false, why: 'chain must be an array' };
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (!isObj(e)) return { ok: true, valid: false, brokenAt: i, reason: 'entry ' + i + ' is not an object' };
    if (e.seq !== i) return { ok: true, valid: false, brokenAt: i, reason: 'seq ' + e.seq + ' out of order (expected ' + i + ')' };
    const expectedPrev = i === 0 ? GENESIS : chain[i - 1].hash;
    if (e.prevHash !== expectedPrev) return { ok: true, valid: false, brokenAt: i, reason: 'prevHash does not match the previous entry' };
    const recomputed = receiptHash(e);
    if (recomputed !== e.hash) return { ok: true, valid: false, brokenAt: i, reason: 'entry ' + i + ' was altered — its hash no longer matches' };
  }
  return { ok: true, valid: true, brokenAt: null, reason: 'every use in the audit chain verifies' };
}

/** keyStatus(vault, keyId) — remaining budget and use counts for one key. */
export function keyStatus(vault, keyId) {
  if (!isObj(vault) || !isArr(vault.keys)) return { ok: false, why: 'not a vault' };
  const key = vault.keys.find((k) => isObj(k) && k.id === keyId);
  if (!key) return { ok: false, why: 'no such key' };
  const chain = isArr(vault.chain) ? vault.chain : [];
  let grants = 0, refusals = 0;
  for (const e of chain) { if (isObj(e) && e.keyId === keyId) { if (e.allowed) grants += 1; else refusals += 1; } }
  return { ok: true, id: key.id, name: key.name, budget: key.budget, used: key.used, remaining: key.budget - key.used, grants, refusals };
}

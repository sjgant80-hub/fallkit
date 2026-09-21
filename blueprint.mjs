// fallkit · blueprint.mjs — slice-two, part two: seal an assembled loadout into a signed company
// blueprint, and verify it in a way that can say FAILS.
//
// A blueprint is a plain, canonical record of exactly which proven organs fill which seats, with a
// SHA-256 over its own content. verifyBlueprint recomputes that hash AND re-checks every organ against
// the real armoury — so the receipt catches two different forgeries: altering any field (the hash
// stops matching), and smuggling an ungated organ in even with a freshly-computed hash (the semantic
// check refuses it). This is agent-proof's pattern — a receipt with no LLM in the loop that can print
// BLOCK — pointed at a company spec instead of an agent action. An auditor can re-run it anywhere.
//
// Nothing here builds or runs a company. It seals a plan and verifies a plan. The organs and the equip
// rule are imported from loadout.mjs, not re-implemented; sha256 + canon are vendored verbatim from the
// estate (fallbrain/cascade.mjs) so the blueprint hash is reproducible on any machine.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

import { SEATS, organById, canEquip } from './loadout.mjs';

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

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

/** blueprintBody(loadout, meta) — the canonical, hashable record (everything but the hash): which
 *  organs (id/repo/tier) sit in which seat, plus coverage counts. Only organs that exist in the
 *  armoury are included. Pure. */
export function blueprintBody(loadout, meta) {
  const seats = {};
  let equipped = 0, proven = 0, works = 0;
  const filled = [];
  for (const s of SEATS) {
    const ids = (isObj(loadout) && isArr(loadout[s])) ? loadout[s] : [];
    const organs = [];
    for (const id of ids) {
      const o = organById(id);
      if (!o) continue;
      organs.push({ id: o.id, repo: o.repo, tier: o.tier });
      equipped += 1;
      if (o.tier === 'proven') proven += 1;
      else if (o.tier === 'works') works += 1;
    }
    seats[s] = organs;
    if (organs.length > 0) filled.push(s);
  }
  return {
    kind: 'fallkit-company-blueprint',
    company: (isObj(meta) && isStr(meta.company)) ? meta.company : '',
    seats,
    coverage: { equipped, proven, works, seatsFilled: filled.length, totalSeats: SEATS.length },
    createdAt: (isObj(meta) && isStr(meta.createdAt)) ? meta.createdAt : '',
  };
}

/** sealBlueprint(loadout, meta) — seal a loadout into a receipt: the body plus a SHA-256 over it.
 *  Returns { ok, receipt }. Total on hostile input. */
export function sealBlueprint(loadout, meta) {
  if (!isObj(loadout)) return { ok: false, why: 'loadout must be an object' };
  const body = blueprintBody(loadout, meta);
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: 'could not hash the blueprint' };
  return { ok: true, receipt: { ...body, blueprintHash: h.hash } };
}

/** verifyBlueprint(receipt) — the part that can say FAILS. Returns { ok, valid, why }. Refuses when:
 *  the hash no longer matches the content (any field altered), an organ is unknown or in the wrong
 *  seat, an organ's claimed tier does not match its real tier, or ANY organ is ungated (prototype).
 *  So a forger cannot slip an ungated organ into a "valid" blueprint even by recomputing the hash. */
export function verifyBlueprint(receipt) {
  if (!isObj(receipt)) return { ok: false, why: 'receipt must be an object' };
  if (receipt.kind !== 'fallkit-company-blueprint') return { ok: true, valid: false, why: 'not a company blueprint' };
  if (!isStr(receipt.blueprintHash)) return { ok: true, valid: false, why: 'no blueprint hash' };
  const body = {};
  for (const k of Object.keys(receipt)) if (k !== 'blueprintHash') body[k] = receipt[k];
  const h = sha256(canon(body));
  if (!h.ok) return { ok: true, valid: false, why: 'could not recompute the hash' };
  if (h.hash !== receipt.blueprintHash) return { ok: true, valid: false, why: 'the receipt was altered — its hash no longer matches its content' };
  if (!isObj(receipt.seats)) return { ok: true, valid: false, why: 'the blueprint has no seats' };
  for (const s of SEATS) {
    const organs = isArr(receipt.seats[s]) ? receipt.seats[s] : [];
    for (const entry of organs) {
      const o = organById(isObj(entry) ? entry.id : null);
      if (!o) return { ok: true, valid: false, why: 'unknown organ in "' + s + '": ' + (isObj(entry) ? entry.id : entry) };
      if (o.seat !== s) return { ok: true, valid: false, why: o.id + ' is not a "' + s + '" organ' };
      if (entry.tier !== o.tier) return { ok: true, valid: false, why: o.id + ' claims tier "' + entry.tier + '" but is really "' + o.tier + '"' };
      if (!canEquip(o).allowed) return { ok: true, valid: false, why: o.id + ' is ' + o.tier + ' — an ungated organ cannot sit in a sealed blueprint' };
    }
  }
  return { ok: true, valid: true, why: 'hash matches and every organ is proven-or-works, in its correct seat' };
}

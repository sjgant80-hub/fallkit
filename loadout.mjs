// fallkit · loadout.mjs — slice-two: the company as a character sheet. Eight seats, an armoury of real
// estate organs, and one unbendable rule borrowed from the-armoury's own loadout: you cannot equip
// gear that isn't gated. A tool that hasn't cleared proof-of-play (tier "prototype") stays in the
// inventory, greyed out — a human can see it, but it cannot be slotted into a company being assembled.
//
// The tiers here are the estate's OWN published verdicts (mint-an-app/catalogue-data.json: 149 proven,
// 122 works, 1355 prototype), not a fresh opinion — so they are reproducible, and honestly some real,
// useful tools (a live CRM, the identity wallet) read as prototype because the strict scan hasn't
// cleared them yet. The loadout refuses them anyway. That is the point: it equips what is PROVEN, not
// what someone is sure about.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw. No I/O, no network — the page wires
// the drag-and-drop; this kernel only decides what may be equipped and reports the loadout's state.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

export const SEATS = ['Sales & CRM', 'Money', 'Legal', 'People', 'Work', 'Office', 'Overseer', 'Trust rail'];

// The armoury: real estate organs with their real tier (from catalogue-data.json). proven/works can be
// equipped; prototype cannot. Descriptions are the organs' own — not inflated.
export const ARMOURY = [
  { id: 'fallforce',    repo: 'fallforce',    seat: 'Sales & CRM', tier: 'proven',    does: 'FallCRM Elite — sovereign sales platform.' },
  { id: 'fallcrm',      repo: 'fallcrm',      seat: 'Sales & CRM', tier: 'prototype', does: 'Sovereign single-file CRM — the delete-HubSpot wedge.' },
  { id: 'fallsalescrm', repo: 'fallsalescrm', seat: 'Sales & CRM', tier: 'prototype', does: 'Sovereign Salesforce replacement — your data stays yours.' },
  { id: 'fallaccount',  repo: 'fallaccount',  seat: 'Money',       tier: 'proven',    does: 'Sovereign accounting — single file, any LLM.' },
  { id: 'fallinvoice',  repo: 'fallinvoice',  seat: 'Money',       tier: 'proven',    does: 'Sovereign invoicing + reminders + one-click-pay.' },
  { id: 'fallledger',   repo: 'fallledger',   seat: 'Money',       tier: 'proven',    does: 'Sovereign Oracle GL / NetSuite-style ledger.' },
  { id: 'fallbooks',    repo: 'fallbooks',    seat: 'Money',       tier: 'proven',    does: 'Sovereign UK accountancy practice tool.' },
  { id: 'divorcerbot',  repo: 'divorcerbot',  seat: 'Legal',       tier: 'proven',    does: 'UK divorce self-help — verified law, BYOK.' },
  { id: 'falljustice',  repo: 'falljustice',  seat: 'Legal',       tier: 'proven',    does: 'Letter-before-action + DSAR engine (UK consumer).' },
  { id: 'fallsignature',repo: 'fallsignature',seat: 'Legal',       tier: 'works',     does: 'Ed25519 content signing + verification, entirely local.' },
  { id: 'fallhr',       repo: 'fallhr',       seat: 'People',      tier: 'proven',    does: 'Sovereign UK HR management for SMEs.' },
  { id: 'fallrecruit',  repo: 'fallrecruit',  seat: 'People',      tier: 'proven',    does: 'Sovereign UK recruitment management.' },
  { id: 'fallhire',     repo: 'fallhire',     seat: 'People',      tier: 'proven',    does: 'Sovereign hiring pipeline + interview.' },
  { id: 'fallmail',     repo: 'fallmail',     seat: 'Work',        tier: 'works',     does: 'P2P encrypted messaging, DID-addressed, no server.' },
  { id: 'fallslot',     repo: 'fallslot',     seat: 'Work',        tier: 'proven',    does: 'Share a calendar link — sovereign, single file.' },
  { id: 'falllist',     repo: 'falllist',     seat: 'Work',        tier: 'proven',    does: 'Newsletter — your list, your terms, 0% fee, BYOK.' },
  { id: 'fallscribe',   repo: 'fallscribe',   seat: 'Work',        tier: 'prototype', does: 'Meeting notes — local transcription in the browser.' },
  { id: 'glampos',      repo: 'glampos',      seat: 'Office',      tier: 'prototype', does: 'Site automation / point-of-sale for small operators.' },
  { id: 'agent-proof',  repo: 'agent-proof',  seat: 'Overseer',    tier: 'proven',    does: 'Deterministic policy gate + hash-chained audit.' },
  { id: 'acg-assessor', repo: 'acg-assessor', seat: 'Overseer',    tier: 'proven',    does: 'The Assessor — deterministic code-rubric assessment.' },
  { id: 'couple-gate',  repo: 'couple-gate',  seat: 'Overseer',    tier: 'proven',    does: 'Connection linter — is a coupling sovereign or not.' },
  { id: 'openkonomi',   repo: 'openkonomi',   seat: 'Trust rail',  tier: 'proven',    does: 'Capability lattice — cannot exceed its grant.' },
  { id: 'fallnode',     repo: 'fallnode',     seat: 'Trust rail',  tier: 'proven',    does: 'Sovereign runtime — serve your model on your own metal.' },
  { id: 'the-wallet',   repo: 'the-wallet',   seat: 'Trust rail',  tier: 'prototype', does: 'An Ed25519 identity that is a capability plus a budget.' },
  { id: 'perimeter',    repo: 'perimeter',    seat: 'Trust rail',  tier: 'prototype', does: 'Confidentiality wedge — public-AI prompts are exhibits.' },
  // organs fallcorp bundles (real tiers from the estate catalogue) — so the auto-architect can be
  // pointed at the estate's own flagship company and assemble its blueprint honestly.
  { id: 'fallform',          repo: 'fallform',          seat: 'Work',        tier: 'proven',    does: 'Sovereign forms — intake without a third-party form vendor.' },
  { id: 'fallclaim',         repo: 'fallclaim',         seat: 'Legal',       tier: 'proven',    does: 'Sovereign case management for UK claims firms.' },
  { id: 'redress-engine',    repo: 'redress-engine',    seat: 'Legal',       tier: 'works',     does: 'Redress / compensation engine.' },
  { id: 'fallclaimonboard',  repo: 'fallclaimonboard',  seat: 'Legal',       tier: 'prototype', does: 'FCA CMR-shaped claimant onboarding.' },
  { id: 'fallclaimpaper',    repo: 'fallclaimpaper',    seat: 'Legal',       tier: 'prototype', does: 'UK claims document generator.' },
  { id: 'fallclaimpractice', repo: 'fallclaimpractice', seat: 'Money',       tier: 'prototype', does: 'Firm-side accounting / client escrow for claims firms.' },
  { id: 'fallap',            repo: 'fallap',            seat: 'Money',       tier: 'prototype', does: 'Accounts payable.' },
  { id: 'fallcrm-elite',     repo: 'fallcrm-elite',     seat: 'Sales & CRM', tier: 'prototype', does: 'Sovereign CRM — signal timelines, agentic follow-up.' },
  { id: 'witness',           repo: 'witness',           seat: 'Overseer',    tier: 'prototype', does: 'The build gate itself — mutation-tests code before it ships.' },
];

export function organById(id) {
  if (!isStr(id)) return null;
  for (const o of ARMOURY) if (o.id === id) return o;
  return null;
}

/** canEquip(organ) — the-armoury's rule: proven or works may be equipped; prototype may not. Returns
 *  { ok, allowed, reason }. Total on hostile input. */
export function canEquip(organ) {
  if (!isObj(organ)) return { ok: false, why: 'not an organ' };
  const gated = organ.tier === 'proven' || organ.tier === 'works';
  const reason = organ.tier === 'proven'
    ? 'proven — mutation-gated, safe to equip'
    : (organ.tier === 'works'
      ? 'works — live and running, safe to equip'
      : 'prototype — proof-of-play has not cleared it; ungated gear cannot be equipped');
  return { ok: true, allowed: gated, reason };
}

/** emptyLoadout() — a company with every seat present and empty. */
export function emptyLoadout() {
  const l = {};
  for (const s of SEATS) l[s] = [];
  return l;
}

function normalise(loadout) {
  const l = {};
  for (const s of SEATS) l[s] = (isObj(loadout) && isArr(loadout[s])) ? [...loadout[s]] : [];
  return l;
}

/** equip(loadout, seat, organId) — slot an organ into its OWN seat, only if it is gated. Never
 *  mutates the input. Refuses: unknown organ, wrong seat, or ungated (prototype) gear. */
export function equip(loadout, seat, organId) {
  if (!isObj(loadout)) return { ok: false, why: 'loadout must be an object' };
  if (SEATS.indexOf(seat) === -1) return { ok: false, why: 'no such seat: ' + seat };
  const organ = organById(organId);
  if (!organ) return { ok: false, why: 'no such organ: ' + organId };
  if (organ.seat !== seat) return { ok: false, why: organ.id + ' belongs in the "' + organ.seat + '" seat, not "' + seat + '"' };
  const c = canEquip(organ);
  if (!c.allowed) return { ok: false, why: c.reason };
  const next = normalise(loadout);
  if (next[seat].indexOf(organId) === -1) next[seat].push(organId);
  return { ok: true, loadout: next };
}

/** unequip(loadout, seat, organId) — take an organ back out. Never mutates the input. */
export function unequip(loadout, seat, organId) {
  if (!isObj(loadout)) return { ok: false, why: 'loadout must be an object' };
  if (SEATS.indexOf(seat) === -1) return { ok: false, why: 'no such seat: ' + seat };
  const next = normalise(loadout);
  next[seat] = next[seat].filter((id) => id !== organId);
  return { ok: true, loadout: next };
}

/** loadoutStatus(loadout) — the state of the assembled company: which seats are filled, how many
 *  organs are equipped, and how many are proven vs works. */
export function loadoutStatus(loadout) {
  if (!isObj(loadout)) return { ok: false, why: 'loadout must be an object' };
  const l = normalise(loadout);
  let equipped = 0;
  let proven = 0;
  let works = 0;
  const filledSeats = [];
  const emptySeats = [];
  for (const s of SEATS) {
    if (l[s].length > 0) filledSeats.push(s); else emptySeats.push(s);
    for (const id of l[s]) {
      const o = organById(id);
      if (!o) continue;
      equipped += 1;
      if (o.tier === 'proven') proven += 1;
      else if (o.tier === 'works') works += 1;
    }
  }
  return {
    ok: true, equipped, proven, works,
    seatsFilled: filledSeats.length, seatsEmpty: emptySeats.length,
    filledSeats, emptySeats, totalSeats: SEATS.length,
  };
}

/** planToOrganId(plan) — connect slice-one to slice-two: a scaffold plan's target repo is an organ id
 *  here (they share the repo name). Returns the id if it's in the armoury, else null. */
export function planToOrganId(plan) {
  if (!isObj(plan) || !isStr(plan.targetRepo)) return null;
  return organById(plan.targetRepo) ? plan.targetRepo : null;
}

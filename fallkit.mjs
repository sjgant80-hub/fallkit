// fallkit · fallkit.mjs — the gated kernel behind slice-zero of the auto-architect.
//
// You paste the tools a company pays for (names only — never data, never a key). This maps each one
// to a real, live estate organ that already does the job, and says honestly where there ISN'T one yet.
// The whole point is inherited quality: every organ this points at already passed its own gate before
// fallkit ever names it, so a MATCH is a claim you can re-check by opening that one repo. Nothing here
// runs a company, moves money, signs anything or sends anything — it produces a map, a human decides.
//
// This is pure and total: garbage in -> { ok:false, why } (or a safe UNKNOWN), never a throw. The map
// is a fixed, reviewed table — not a language model guessing — so the same tool list yields the same
// map on every machine, and every ORGAN below is a repo that is live right now.
//
// The four buckets are the honest part: MATCHED (a real organ covers it), PARTIAL (covers part, gap
// named), NONE (no equivalent yet — said plainly, e.g. voice agents), UNKNOWN (tool not recognised).
// A rising NONE/UNKNOWN rate across real client lists is the estate's own build queue, ranked by demand.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

// The-armoury's seat vocabulary — a company reads as eight seats, so the map reads in ten seconds.
export const SEATS = ['Sales & CRM', 'Money', 'Legal', 'People', 'Work', 'Office', 'Overseer', 'Trust rail'];
export const TIERS = ['MATCHED', 'PARTIAL', 'NONE', 'UNKNOWN'];

// Every organ here is a repo that is LIVE right now (verified against the estate index). Its `does`
// line is drawn from the organ's own description — not inflated.
export const ORGANS = {
  fallsalescrm:  { repo: 'fallsalescrm',  seat: 'Sales & CRM', does: 'Sovereign Salesforce replacement — one file, your data stays yours.' },
  fallcrm:       { repo: 'fallcrm',       seat: 'Sales & CRM', does: 'Sovereign single-file CRM — the delete-HubSpot wedge.' },
  fallcall:      { repo: 'fallcall',      seat: 'Sales & CRM', does: 'AI sales-call intelligence.' },
  fallpost:      { repo: 'fallpost',      seat: 'Sales & CRM', does: 'Sovereign LinkedIn posting engine.' },
  fallaccount:   { repo: 'fallaccount',   seat: 'Money',       does: 'Sovereign accounting — any LLM, single file, your books stay local.' },
  fallinvoice:   { repo: 'fallinvoice',   seat: 'Money',       does: 'Sovereign single-file invoicing + reminders + one-click-pay.' },
  falljustice:   { repo: 'falljustice',   seat: 'Legal',       does: 'Letter-before-action + data-subject-access-request engine (UK consumer).' },
  fallsignature: { repo: 'fallsignature', seat: 'Legal',       does: 'Ed25519 content signing + verification — runs locally, nothing uploaded.' },
  fallhr:        { repo: 'fallhr',        seat: 'People',      does: 'Sovereign UK HR management for SMEs.' },
  fallrecruit:   { repo: 'fallrecruit',   seat: 'People',      does: 'Sovereign UK recruitment management.' },
  fallmail:      { repo: 'fallmail',      seat: 'Work',        does: 'P2P encrypted messaging, DID-addressed (ECDH+AES-GCM) — no SMTP, no server.' },
  fallscribe:    { repo: 'fallscribe',    seat: 'Work',        does: 'Sovereign meeting-notes — local transcription in the browser.' },
  glampos:       { repo: 'glampos',       seat: 'Office',      does: 'Kernel-driven site automation / point-of-sale for small operators.' },
  agentproof:    { repo: 'agent-proof',   seat: 'Overseer',    does: 'Deterministic policy gate + hash-chained audit — a receipt that can say FAILS.' },
  thewallet:     { repo: 'the-wallet',    seat: 'Trust rail',  does: 'An Ed25519 identity that is a capability plus a budget it cannot cross.' },
};

// The map: an ORDERED list, first match wins. Each entry names the tools it recognises, the honest
// tier, and the organ (or null for NONE). Kept deliberately small and reviewed — extend it with real
// fixtures, never by guessing.
export const TOOL_MAP = [
  { re: /salesforce|pipedrive|zoho\s*crm|dynamics\s*crm|sugarcrm/i,           tier: 'MATCHED', organ: 'fallsalescrm', note: 'Sovereign Salesforce replacement.' },
  { re: /hubspot|freshsales|copper|insightly|keap/i,                          tier: 'MATCHED', organ: 'fallcrm',       note: 'The delete-HubSpot wedge.' },
  { re: /gong|chorus\.ai|call\s*intelligence|revenue\s*intelligence/i,        tier: 'MATCHED', organ: 'fallcall',      note: 'Sales-call intelligence.' },
  { re: /buffer|hootsuite|sprout\s*social|linkedin/i,                         tier: 'PARTIAL', organ: 'fallpost',      note: 'Covers LinkedIn posting; not every network yet.' },
  { re: /xero|quickbooks|freeagent|\bsage\b|wave\s*accounting/i,              tier: 'MATCHED', organ: 'fallaccount',   note: 'Sovereign accounting — your books stay on your machine.' },
  { re: /freshbooks|gocardless|zoho\s*invoice|\binvoic/i,                     tier: 'MATCHED', organ: 'fallinvoice',   note: 'Invoicing, reminders, one-click-pay.' },
  { re: /docusign|hellosign|dropbox\s*sign|pandadoc|adobe\s*sign|e-?sign/i,   tier: 'MATCHED', organ: 'fallsignature', note: 'Ed25519 signing + verification, entirely local.' },
  { re: /legalzoom|rocket\s*lawyer|complaint|dispute|letter\s*before\s*action/i, tier: 'PARTIAL', organ: 'falljustice', note: 'Letter-before-action + DSAR (UK consumer) — not general legal advice.' },
  { re: /bamboohr|workday|personio|hibob|breathe\s*hr|\bhris\b/i,             tier: 'MATCHED', organ: 'fallhr',        note: 'Sovereign HR for SMEs.' },
  { re: /greenhouse|\blever\b|workable|recruitee|\bats\b/i,                   tier: 'MATCHED', organ: 'fallrecruit',   note: 'Sovereign recruitment management.' },
  { re: /auth0|\bokta\b|onelogin|cognito|\bentra\b|active\s*directory|\bsso\b/i, tier: 'MATCHED', organ: 'thewallet',  note: 'Identity you generate on the device, not rent.' },
  { re: /gmail|outlook|google\s*workspace|proton\s*mail|\bsmtp\b|\bemail\b/i, tier: 'PARTIAL', organ: 'fallmail',      note: 'P2P encrypted messaging (DID-addressed) — not a drop-in SMTP inbox.' },
  { re: /slack|microsoft\s*teams|\bteams\b|discord|mattermost/i,              tier: 'PARTIAL', organ: 'fallmail',      note: 'Encrypted peer messaging; channels/apps not there yet.' },
  { re: /zoom|google\s*meet|otter\.ai|fireflies|meeting\s*notes/i,            tier: 'PARTIAL', organ: 'fallscribe',    note: 'Local meeting transcription — not the video call itself.' },
  { re: /datadog|\bvanta\b|\bdrata\b|audit\s*log|compliance\s*monitor/i,      tier: 'MATCHED', organ: 'agentproof',    note: 'Signed, hash-chained audit trail — a receipt that can say FAILS.' },
  { re: /\bsquare\b|toast\b|lightspeed|\bepos\b|point\s*of\s*sale/i,          tier: 'PARTIAL', organ: 'glampos',       note: 'Kernel-driven site automation / POS for small operators.' },
  { re: /aircall|twilio|ringcentral|\b8x8\b|dialpad|voice\s*agent|\bivr\b/i,  tier: 'NONE',    organ: null,           note: 'No voice-agent product in the estate yet — fallscribe (transcription) is nearest and does not place or answer calls.' },
  { re: /calendly|acuity|cal\.com|scheduling|savvycal/i,                      tier: 'NONE',    organ: null,           note: 'No scheduling organ yet — an honest gap.' },
  { re: /notion|confluence|\bcoda\b|airtable|clickup/i,                       tier: 'NONE',    organ: null,           note: 'No general docs/wiki organ yet.' },
  { re: /figma|canva|adobe\s*(xd|photoshop|illustrator)/i,                    tier: 'NONE',    organ: null,           note: 'Design tools are outside the estate’s scope.' },
  { re: /stripe|paypal|\bado?yen\b|payment\s*process/i,                       tier: 'NONE',    organ: null,           note: 'The payment processor stays a human money-door — we wire to it, we do not replace it.' },
];

/** classifyTool(name) — map ONE tool name to its honest bucket. Never throws. Returns
 *  { ok, input, tier, organ, repo, seat, note }. An unrecognised name is UNKNOWN, which is different
 *  from NONE ("recognised, but no equivalent exists yet"). */
export function classifyTool(name) {
  if (!isStr(name)) return { ok: false, why: 'tool name must be a string' };
  const t = name.trim();
  if (t.length === 0) return { ok: false, why: 'empty tool name' };
  for (const entry of TOOL_MAP) {
    if (entry.re.test(t)) {
      const organ = entry.organ ? ORGANS[entry.organ] : null;
      return {
        ok: true, input: t, tier: entry.tier, organ: entry.organ,
        repo: organ ? organ.repo : null, seat: organ ? organ.seat : 'Unassigned',
        does: organ ? organ.does : '', note: entry.note,
      };
    }
  }
  return {
    ok: true, input: t, tier: 'UNKNOWN', organ: null, repo: null, seat: 'Unassigned', does: '',
    note: 'Not recognised — tell us what it does and we’ll map it, or add it to the build queue.',
  };
}

/** assembleMap(tools) — classify a whole list and group it into the eight seats, with an honest
 *  coverage count. Never throws. Duplicate/blank lines are dropped. */
export function assembleMap(tools) {
  if (!isArr(tools)) return { ok: false, why: 'tools must be an array' };
  const coverage = { total: 0, MATCHED: 0, PARTIAL: 0, NONE: 0, UNKNOWN: 0 };
  const seats = {};
  for (const s of SEATS) seats[s] = [];
  seats.Unassigned = [];
  const seen = new Set();
  const classified = [];
  for (const name of tools) {
    const c = classifyTool(name);
    if (!c.ok) continue;
    const key = c.input.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    classified.push(c);
    coverage.total += 1;
    coverage[c.tier] += 1;
    (seats[c.seat] || seats.Unassigned).push(c);
  }
  return { ok: true, coverage, seats, classified };
}

/** coverageStatement(coverage) — one honest line, NO prices (the point is what you can own, not what
 *  it would cost). Total on hostile input. */
export function coverageStatement(coverage) {
  if (!isObj(coverage)) return '';
  const owned = coverage.MATCHED || 0;
  const partial = coverage.PARTIAL || 0;
  const total = coverage.total || 0;
  if (total === 0) return 'Paste your tools above to see where each one lands.';
  const head = owned + ' of your ' + total + ' tools already have an owned equivalent you could run yourself';
  const mid = partial > 0 ? ', and ' + partial + ' have a partial one' : '';
  return head + mid + '. No prices here — this is about what you can own, not what we would charge.';
}

// Intent tests for fallkit.mjs. Every honest claim slice-zero makes is pinned here: a known tool maps
// to the right LIVE organ and seat, a voice agent is NONE (not faked), an unknown tool is UNKNOWN (not
// silently NONE), and the coverage count is exact and price-free. This is what witness mutation-checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTool, assembleMap, coverageStatement, ORGANS, SEATS, TOOL_MAP } from './fallkit.mjs';

test('known tools map to the right MATCHED organ and seat', () => {
  const sf = classifyTool('Salesforce');
  assert.equal(sf.tier, 'MATCHED'); assert.equal(sf.organ, 'fallsalescrm'); assert.equal(sf.seat, 'Sales & CRM');
  assert.equal(classifyTool('HubSpot').organ, 'fallcrm');
  assert.equal(classifyTool('Xero').organ, 'fallaccount');
  assert.equal(classifyTool('Xero').seat, 'Money');
  assert.equal(classifyTool('DocuSign').organ, 'fallsignature');
  assert.equal(classifyTool('DocuSign').seat, 'Legal');
  assert.equal(classifyTool('BambooHR').organ, 'fallhr');
  assert.equal(classifyTool('Okta').organ, 'thewallet');
  assert.equal(classifyTool('Okta').seat, 'Trust rail');
});

test('PARTIAL tools are honestly partial, with the gap named', () => {
  const gmail = classifyTool('Gmail');
  assert.equal(gmail.tier, 'PARTIAL'); assert.equal(gmail.organ, 'fallmail');
  assert.match(gmail.note, /not a drop-in SMTP/);
  assert.equal(classifyTool('Zoom').tier, 'PARTIAL');
  assert.equal(classifyTool('Zoom').organ, 'fallscribe');
});

test('a voice agent is NONE with no organ — never faked', () => {
  const v = classifyTool('Aircall');
  assert.equal(v.tier, 'NONE');
  assert.equal(v.organ, null);
  assert.equal(v.repo, null);
  assert.match(v.note, /No voice-agent/);
  assert.equal(classifyTool('Calendly').tier, 'NONE'); // no scheduler organ
  assert.equal(classifyTool('Stripe').organ, null);    // payment processor stays a human door
});

test('NONE and UNKNOWN are different — recognised-but-absent vs not-recognised', () => {
  assert.equal(classifyTool('Aircall').tier, 'NONE');            // we know it, no equivalent
  assert.equal(classifyTool('Wobblegizmo 3000').tier, 'UNKNOWN'); // we don't know it
  assert.equal(classifyTool('Wobblegizmo 3000').organ, null);
});

test('classifyTool trims and is case-insensitive', () => {
  assert.equal(classifyTool('  salesforce  ').organ, 'fallsalescrm');
  assert.equal(classifyTool('DOCUSIGN').organ, 'fallsignature');
});

test('classifyTool is total on hostile/empty input', () => {
  assert.equal(classifyTool(null).ok, false);
  assert.equal(classifyTool(42).ok, false);
  assert.equal(classifyTool('').ok, false);       // empty
  assert.equal(classifyTool('   ').ok, false);     // whitespace only, after trim
});

test('first match wins — ordering is deterministic', () => {
  // "Zoho CRM" must hit the CRM entry, not any later broad entry
  assert.equal(classifyTool('Zoho CRM').organ, 'fallsalescrm');
  // "Zoho Invoice" must hit the invoicing entry
  assert.equal(classifyTool('Zoho Invoice').organ, 'fallinvoice');
});

test('every organ referenced by the map is a defined, repo-backed organ', () => {
  for (const entry of TOOL_MAP) {
    if (entry.organ !== null) {
      assert.ok(ORGANS[entry.organ], 'map references unknown organ ' + entry.organ);
      assert.ok(typeof ORGANS[entry.organ].repo === 'string' && ORGANS[entry.organ].repo.length > 0);
      assert.ok(SEATS.includes(ORGANS[entry.organ].seat), 'organ ' + entry.organ + ' has a non-seat');
    }
  }
});

test('assembleMap counts coverage exactly and groups into seats', () => {
  const m = assembleMap(['Salesforce', 'Xero', 'DocuSign', 'Gmail', 'Aircall', 'Wobblegizmo']);
  assert.equal(m.ok, true);
  assert.equal(m.coverage.total, 6);
  assert.equal(m.coverage.MATCHED, 3);  // Salesforce, Xero, DocuSign
  assert.equal(m.coverage.PARTIAL, 1);  // Gmail
  assert.equal(m.coverage.NONE, 1);     // Aircall
  assert.equal(m.coverage.UNKNOWN, 1);  // Wobblegizmo
  assert.equal(m.seats['Sales & CRM'].length, 1);
  assert.equal(m.seats.Money.length, 1);
  assert.equal(m.seats.Unassigned.length, 2); // Aircall (NONE) + Wobblegizmo (UNKNOWN)
});

test('assembleMap drops duplicates and blank lines', () => {
  const m = assembleMap(['Slack', 'slack', '  ', 'Slack']);
  assert.equal(m.coverage.total, 1); // one Slack, blanks dropped, case-dedup
});

test('assembleMap is total on hostile input', () => {
  assert.equal(assembleMap('not an array').ok, false);
  assert.equal(assembleMap(null).ok, false);
  assert.equal(assembleMap([]).coverage.total, 0);
});

test('coverageStatement is honest and price-free', () => {
  const m = assembleMap(['Salesforce', 'Xero', 'Gmail', 'Aircall']);
  const s = coverageStatement(m.coverage);
  assert.match(s, /2 of your 4 tools/); // Salesforce + Xero owned
  assert.match(s, /1 have a partial/);  // Gmail
  assert.doesNotMatch(s, /[£$€]|\d+\s*(\/mo|per month|k\b)/); // no pricing, ever
  // with ZERO partials, the statement must NOT invent a "0 have a partial one" clause (> 0, not >= 0)
  const allOwned = coverageStatement({ total: 2, MATCHED: 2, PARTIAL: 0 });
  assert.doesNotMatch(allOwned, /partial/);
  assert.match(allOwned, /2 of your 2 tools/);
  assert.equal(coverageStatement({ total: 0 }).length > 0, true); // empty prompt
  assert.equal(coverageStatement(null), '');
});

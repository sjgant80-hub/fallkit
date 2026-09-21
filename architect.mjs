// fallkit · architect.mjs — slice-six, the capstone: the auto-architect run. Point it at a company's
// whole signal set — the tools it pays for AND its real exports — and it runs the entire pipeline in
// one pass: classify the tools (slice-0), map the exports (slice-1/5), resolve every match to a real
// armoury organ, EQUIP only the gated ones into their seats (slice-2), SEAL and verify the result as a
// signed blueprint (slice-2.2), and rank everything with no equivalent yet as the build queue (slice-3).
//
// It composes the five gated kernels; it re-implements none of them. Matched-but-ungated organs are
// reported honestly (a prototype tool is a real match but cannot be equipped or sealed), and the human
// doors still hold — the output is a plan, sealed for audit, never a running company.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw.
//
// Powered by the Konomi architecture, created by Thomas Frumkin.

import { classifyTool } from './fallkit.mjs';
import { combineSources } from './multi.mjs';
import { organById, canEquip, emptyLoadout, equip } from './loadout.mjs';
import { sealBlueprint, verifyBlueprint } from './blueprint.mjs';
import { mergeSignals, rankQueue } from './queue.mjs';
import { mintPortfolio } from './mint.mjs';

const isStr = (v) => typeof v === 'string';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

/** autoArchitect(input) — input: { company, tools: string[], exports: [{name, columns, recordCount}],
 *  createdAt? }. Returns the whole assembled company: the equipped (gated) loadout, the matched-but-
 *  ungated organs, the sealed+verified blueprint, and the ranked build queue of everything with no
 *  equivalent yet. Never throws. */
export function autoArchitect(input) {
  if (!isObj(input)) return { ok: false, why: 'input must be an object' };
  const company = isStr(input.company) ? input.company : 'a company';
  const tools = isArr(input.tools) ? input.tools : [];
  const exportList = isArr(input.exports) ? input.exports : [];

  const candidates = []; // { repo, from }
  const gapSignals = []; // { gap, seat, kind }

  // 1. tools -> classify (slice-0). classifyTool sets c.repo to a string EXACTLY for MATCHED/PARTIAL
  //    and null for NONE/UNKNOWN, so a string repo is precisely a candidate; the rest are gap signals.
  for (const t of tools) {
    const c = classifyTool(t);
    if (!c.ok) continue;
    if (isStr(c.repo)) candidates.push({ repo: c.repo, from: 'tool: ' + c.input });
    else gapSignals.push({ gap: c.input, seat: isStr(c.seat) ? c.seat : '', kind: c.tier === 'UNKNOWN' ? 'unknown' : 'no-equivalent' });
  }

  // 2. exports -> combine (slice-1/5). ingestSource likewise sets s.repo to a string iff the export
  //    matched an organ, so a string repo is a candidate and everything else is a gap.
  const combined = combineSources(exportList);
  if (combined.ok) {
    for (const s of combined.sources) {
      if (isStr(s.repo)) candidates.push({ repo: s.repo, from: 'export: ' + s.name });
      else gapSignals.push({ gap: s.name, seat: '', kind: 'no-equivalent' });
    }
  }

  // 2b. estate organs -> a direct candidate list, for pointing it at the estate's own repos (e.g.
  //     fallcorp's own bundle). Each is a repo name, resolved against the armoury like any other match.
  const organsIn = isArr(input.organs) ? input.organs : [];
  for (const repo of organsIn) if (isStr(repo)) candidates.push({ repo, from: 'estate: ' + repo });

  // 3. resolve each candidate to an armoury organ; equip the GATED ones (slice-2), list the ungated.
  let loadout = emptyLoadout();
  const equipped = [];
  const ungatedMatches = [];
  const seen = new Set();
  for (const cand of candidates) {
    const organ = organById(cand.repo); // loadout ids ARE repo names, so a repo resolves directly
    if (!organ || seen.has(organ.id)) continue;
    seen.add(organ.id);
    if (canEquip(organ).allowed) {
      const r = equip(loadout, organ.seat, organ.id);
      if (r.ok) { loadout = r.loadout; equipped.push({ repo: organ.repo, seat: organ.seat, tier: organ.tier, from: cand.from }); }
    } else {
      ungatedMatches.push({ repo: organ.repo, seat: organ.seat, tier: organ.tier, from: cand.from });
    }
  }

  // 4. seal + verify the assembled company (slice-2.2).
  const sealed = sealBlueprint(loadout, { company, createdAt: isStr(input.createdAt) ? input.createdAt : '' });
  const verified = sealed.ok ? verifyBlueprint(sealed.receipt) : { valid: false };

  // 5. rank every gap as the build queue (slice-3).
  const merged = mergeSignals([], gapSignals);
  const ranked = merged.ok ? rankQueue(merged.queue).ranked : [];

  // 6. the wire to the factory: openings -> mint targets (fallforgemint, smallest tier first),
  //    matched-but-ungated organs -> gate targets (witness). The demand map, made actionable.
  const buildPlan = mintPortfolio({ gaps: ranked, ungatedMatches });

  return {
    ok: true,
    company,
    loadout,
    equipped,
    ungatedMatches,
    blueprint: sealed.ok ? sealed.receipt : null,
    verified: verified.valid === true,
    queue: ranked,
    buildPlan,
    summary: { equipped: equipped.length, ungated: ungatedMatches.length, gaps: ranked.length, mint: buildPlan.toMint.length, gate: buildPlan.toGate.length },
  };
}

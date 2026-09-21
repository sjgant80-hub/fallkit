# fallkit — specification

## Purpose

Paste the tools a company pays for; fallkit maps each to a real, live owned-equivalent estate build, or says honestly where none exists yet. Slice-zero of the auto-architect.

## Contract

- **assembleMap** — part of the fallkit public surface; deterministic, total (never throws).
- **classifyTool** — part of the fallkit public surface; deterministic, total (never throws).
- **coverageStatement** — part of the fallkit public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits fallkit only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.

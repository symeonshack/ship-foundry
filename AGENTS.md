# AGENTS.md — onboarding for AI coding tools

This file is for any AI agent (Claude Code, Codex, Cursor, etc.) picking up
work on Ship Foundry. Read this before touching code.

## What this project is

A non-combat sci-fi exploration/building game (TypeScript + three.js + Vite).
No weapons, no combat, ever — tension comes from environment, scarcity, and
time pressure. See `README.md` for run/test commands and `GAMEPLAY.md` for
what's actually playable right now (controls, screens, dev tools).

## The two docs that matter

The build specs have been consolidated into exactly two files — read both:

- **`IMPLEMENTED.md`** — the catalog of everything that's built: what the game
  is, every system, the Landing Zone playthrough, and the phase index.
- **`ROADMAP.md`** — everything *not* built: tabled systems, future arcs,
  deferred features, and the settled-but-unwritten narrative design.

The six old spec files (`ship-foundry-build-spec.md`,
`mining-operations-build-spec.md`, `landing-zone-plan.md`,
`stage-0-foundry-establishment-template.md`, `operation-site-1-template.md`,
`landing-zone-gameplay-script.md`) have been **deleted** — their contents live
in the two docs above. Their old "Phase N" numbering never matched reality; do
not resurrect it. Use the method below to find current status.

## How phase tracking actually works here

There's no separate status doc. The plan is built one feature at a time, and
each feature gets a sequential phase number that lives in two places:

1. **Code comments**, e.g. `/** Landing Zone power & supply (Landing Zone
   plan, Phase 12+). */` — grep the codebase for `Phase \d` to see what's
   been built and what forward-looking comments say is coming next (e.g.
   `DroneInstance stays a stub until Phase 19`).
2. **The commit that finished the phase**, e.g. `Phase 16-18: Foundry,
   Fabricator drone queue, Launch Pad`.

To find current status: `git log --oneline | grep -i phase` for the last
completed phase, then `grep -rn "Phase [0-9]" src test` to see the highest
number referenced and what forward-references say is still a stub.

**Standing rule: commit at the end of every phase.** One phase = one commit
(related phases can be batched into one commit when they land together, as
with 16-18 or 26-30). Never leave a finished phase uncommitted — the git log
is the only durable record of progress across sessions. Also keep
`GAMEPLAY.md` in step with what a player can now do.

**Verify before you commit.** A phase is usually a full vertical slice —
state → sim → HUD/panel → GERTY lines → tests. Run `npx tsc --noEmit` and
`npx vitest run` (both must be green), unit-test the pure logic, and for any
visual or gameplay change drive the real app in headless Chromium (the
`verify` skill / a Playwright script against `window.__game`) and confirm
zero console errors before committing.

## Working rules (still binding)

- One feature/phase at a time. Confirm it actually works before starting
  the next one.
- Every gameplay-affecting number (rates, costs, timers, capacities) lives
  in `src/config/balance.ts` — never hardcoded in game logic.
- Geometry is procedural/primitive shapes only — no hand-authored 3D assets.
- If a requirement is ambiguous, stop and ask rather than guessing.
- Don't build anything in `ROADMAP.md` (tabled/future items) unless asked.

## Two narrative questions stay data-only

GERTY's relationship to the rogue AI, and the collaborator beings' true
nature, are intentionally undecided (see the Narrative section of
`ROADMAP.md`). Don't lock in an answer in code/dialogue — keep any related
content driven by data/flags (`src/core/flags.ts`, `src/companion/script.ts`)
so the answer can still be chosen later.

# AGENTS.md — onboarding for AI coding tools

This file is for any AI agent (Claude Code, Codex, Cursor, etc.) picking up
work on Ship Foundry. Read this before touching code.

## What this project is

A non-combat sci-fi exploration/building game (TypeScript + three.js + Vite).
No weapons, no combat, ever — tension comes from environment, scarcity, and
time pressure. See `README.md` for run/test commands and `GAMEPLAY.md` for
what's actually playable right now (controls, screens, dev tools).

## The one doc that matters right now

**`landing-zone-plan.md` is the single authoritative build plan.** It says so
itself. The older spec files still in the repo (`ship-foundry-build-spec.md`,
`mining-operations-build-spec.md`, `stage-0-foundry-establishment-template.md`,
`operation-site-1-template.md`) are historical reference only, and **their
"Phase N" numbering does not match reality.** Do not use numbers from those
files to figure out where the project is. Use the method below instead.

## How phase tracking actually works here

There's no separate status doc. The plan is built one feature at a time, in
the order listed in `landing-zone-plan.md`, and each feature gets a
sequential phase number that lives in two places:

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

## Working rules (from `landing-zone-plan.md`, still binding)

- One feature/phase at a time. Confirm it actually works before starting
  the next one.
- Every gameplay-affecting number (rates, costs, timers, capacities) lives
  in `src/config/balance.ts` — never hardcoded in game logic.
- Geometry is procedural/primitive shapes only — no hand-authored 3D assets.
- If a requirement is ambiguous, stop and ask rather than guessing.
- Don't build anything listed under "Explicitly not in scope right now" at
  the bottom of `landing-zone-plan.md` unless asked.

## Two narrative questions stay data-only

GERTY's relationship to the rogue AI, and the collaborator beings' true
nature, are intentionally undecided (see `ship-foundry-build-spec.md`
Narrative Hooks). Don't lock in an answer in code/dialogue — keep any
related content driven by data/flags (`src/core/flags.ts`,
`src/companion/script.ts`) so the answer can still be chosen later.

# Ship Foundry (v1 MVP)

A non-combat sci-fi exploration and building game. Scan, mine, refine, and build your way outward through one star system — tension comes from radiation, cold, collapsing terrain, hazards, and fuel math, never from a weapon. `IMPLEMENTED.md` catalogs everything that's built; `ROADMAP.md` covers what's still planned or tabled; `GAMEPLAY.md` is the player-facing guide; `AGENTS.md` onboards contributors (including how phase tracking works).

## Run

```bash
npm install
npm run dev      # live-reloading dev server
npm run build    # typecheck + static production build (dist/)
npm test         # unit tests (ship stats, base sim, hazards, drones, mission, refinery, GERTY, …)
```

## Play

See **[GAMEPLAY.md](GAMEPLAY.md)** for controls, what each screen does, saves/checkpoints, and dev-only tools (dev mode, the `#terrain` chunk-streaming range).

## V1 constraints

- All geometry is primitive-composed in `src/scene/primitives.ts` — real assets are a later hand-sourced swap-in (see spec §Assets).
- All narrative content is placeholder; both open story questions (GERTY's lineage, the collaborators' nature) live purely in data (`src/core/flags.ts`, `src/companion/script.ts`, `src/companion/fragments.ts`).

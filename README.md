# Ship Foundry (v1 MVP)

A non-combat sci-fi exploration and building game. Scan, mine, refine, and build your way outward through one star system — tension comes from radiation, cold, collapsing terrain, and fuel math, never from a weapon. See `ship-foundry-build-spec.md` for the full design.

## Run

```bash
npm install
npm run dev      # live-reloading dev server
npm run build    # typecheck + static production build (dist/)
npm test         # unit tests (stats, refinery, GERTY, encounter logic)
```

## Play

- **Your ship (first-person hub)**: you wake aboard. WASD to move, mouse to look (click the view to capture the cursor; arrow keys also look), E to interact. The star map lives on the holo table, GERTY lives on the wall console, and the rear hatch leads outside. Travel always ends back aboard.
- **Shipyard** (at the Foundry): pick a part, click a glowing socket to fit it. Click a fitted part to remove/refund it. Engines glow under strain; off-axis loads make the stack wobble.
- **Star map** (via the ship's console): click a contact to survey it. Scan before you commit fuel. The outer ring is your point of no return; the inner ring gets you home again — both move live as you build.
- **Flight**: travel is flown, not teleported. A/D steer against drift (your own off-axis cargo talking back), W/S throttle; clean flying recovers a little fuel, sloppy flying burns extra. On descent, HOLD SPACE to retro-burn — touch down under 2.5 or arrive loudly (cosmetic, for now). Better engines mean shorter trips and stronger brakes.
- **Surface ops**: arm a rig, click a deposit. Hazards degrade equipment in real time while you stay; the hold and the tank decide when you leave.
- **Refinery** (at the Foundry): raw stock in, usable stock out, in real time.
- **GERTY** flags hazards beyond your equipment ratings and occasionally declines to answer. The logbook (LOG) collects discoveries; some entries can be raised with GERTY directly.
- Far out, something is building. It doesn't speak. Bring parts.

**Dev mode:** type `c` `h` `t` quickly (within ~1.2s) to toggle. Bottomless stock and tank, every site pre-surveyed — for exploring/debugging. A pulsing DEV badge marks it; toggling off restores an honest tank but granted stock remains, so use a throwaway save or a checkpoint.

Progress autosaves to `localStorage`. The ⟲ button opens Saves & Checkpoints — checkpoints are captured automatically (wake-up, each departure from the Foundry, each docking, major discoveries) and any of them can be restored if a run goes sideways; full wipe lives at the bottom of the same panel.

## V1 constraints

- All geometry is primitive-composed in `src/scene/primitives.ts` — real assets are a later hand-sourced swap-in (see spec §Assets).
- All narrative content is placeholder; both open story questions (GERTY's lineage, the collaborators' nature) live purely in data (`src/core/flags.ts`, `src/companion/script.ts`, `src/companion/fragments.ts`).

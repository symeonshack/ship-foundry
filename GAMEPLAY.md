# Ship Foundry — Gameplay Guide

Everything you need to actually play: controls, what each screen does, and the dev-only tools. For the design/story behind all this, see `ship-foundry-build-spec.md` and `mining-operations-build-spec.md`.

## Aboard ship (first-person hub)

You wake aboard. **WASD** to move, mouse to look (click the view to capture the cursor; arrow keys also look), **E** to interact.

- The star map lives on the holo table.
- GERTY lives on the wall console.
- The rear hatch leads outside.

Travel always ends back aboard the ship.

## Shipyard (at the Foundry)

Pick a part, click a glowing socket to fit it. Click a fitted part to inspect, remove, or refund it. Engines glow under strain; off-axis loads make the whole stack wobble.

The shipyard is gated behind having a built Foundry structure at the Landing Zone site — the nav button is disabled with a tooltip until then.

## Star map (via the ship's console)

Click a contact to survey it. Scan before you commit fuel to a trip. The outer ring is your point of no return; the inner ring gets you home again — both move live as you build.

## Flight

Travel is flown, not teleported.

- **A/D** steer against drift (your own off-axis cargo talking back)
- **W/S** throttle
- Clean flying recovers a little fuel; sloppy flying burns extra
- On descent, **HOLD SPACE** to retro-burn — touch down under 2.5 m/s or arrive loudly (cosmetic, for now)

Better engines mean shorter trips and stronger brakes.

## Surface ops

Sites are RTS-scale: chunk-streamed terrain, resources grouped into distinct veins, plus a few landmarks (rock spires, a crater, old wreckage, an outgassing vent) scattered across the area. Coming within range of a vein or landmark in either view charts it — tracked in the side panel.

Two views, one live simulation — nothing pauses because you switched. **TAB** swaps between them at any time.

### Command view (top-down, default)

Handles like an RTS, not a 3D camera you happen to be looking down through:

| Input | Action |
|---|---|
| Left-drag | Pan across the map |
| Wheel | Zoom |
| Right-drag | Rotate (pitch is clamped to an overhead band — it can't tip into a first-person-looking angle) |
| W/A/S/D or arrows | Pan (speed scales with zoom level) |
| **H** | Recenter on the lander, keeping current zoom/rotation |
| Left-click a deposit | Deploy the armed rig |
| Left-click a rig | Recall it |
| Left-click a structure *(Landing Zone)* | Select it — inspector opens in the side panel |
| **Shift + left-drag** *(Landing Zone)* | Box-select structures (drones later); left-click empty ground deselects |
| Right-click *(Landing Zone)* | Reserved command input — drones will take move/gather orders here |

### Building (Landing Zone)

The **Construction** box in the side panel lists every structure with its cost and build time (hover a Build button for details).

Structures unlock in a **build order**: a structure whose prerequisites aren't standing yet shows a **Locked** button — hover it to see exactly what's required (e.g. the Refinery needs a Solar Array; the Foundry needs Storage Silo + Refinery + Power Relay). Prerequisites must be *finished* (not merely under construction), and a ruined prerequisite re-locks anything that depended on it. Buttons unlock automatically the moment their requirements are met.

Click **Build** on an unlocked, affordable structure to arm placement:

- A translucent ghost follows your cursor — **green** where the spot is valid, **red** where it isn't (too close to rocks/deposits/the lander/other structures, ground too uneven, outside the perimeter, or you can't afford it — the rejection reason shows as a toast if you try anyway).
- **Left-click** commits: resources are spent and construction begins. **Right-click or Esc** cancels placement.
- Placed structures show as pale squares on the minimap.

**Construction** follows classic RTS conventions:

- Build times are tiered by importance: economy structures (silo, relay, solar, soil processor) go up in 20–40s, production/tech (refinery, fabricator, greenhouse) in 40–80s, keystones (Foundry, nuclear generator, launch pad) in 60–90s.
- The model visibly steps through **scaffolding stages** — foundation slab → corner frame → half-built shell → finished building (with its beacon light) — so you can read a base's progress at a glance.
- Selecting a construction shows **UNDER CONSTRUCTION · n%** with a live amber progress bar. Its HP bar climbs alongside the scaffold (AoE-style: health starts low and rises to max as it builds), and damage taken mid-build **persists** into the finished structure — it is not healed at completion.
- The selection ring is translucent while building, solid once complete. A toast announces each completion ("… online"), and construction keeps progressing even while you're aboard ship or off-site.
- The footprint blocks walking and future placements from the moment of placement, and the building is non-functional until complete.

**Damage & destruction** (AoE-style): a standing structure shows its condition on the model, not just the HP bar. Around 60% HP it takes on **visible damage** (scorching, dimmed power light); below 30% it's **heavily damaged** (buckled, a corner blown out, power light dark). At **0 HP it's ruined** — the building collapses into a pile of **rubble** and everything it produced or supported is lost. A wreck's footprint stays blocked until you select it and **Clear rubble** to reclaim the spot. (Rebuilding at a premium over the original cost comes later.)

**Repair:** a damaged-but-standing structure (its HP bar below full) shows a **Repair** button in its inspector with the cost. Repairing is deliberately cheaper and faster than tearing down and rebuilding — cost and time both scale with how much HP is missing. Once started, the structure heals over the next few seconds (status reads "active · repairing"), the model mends as HP crosses back over the thresholds, and a toast confirms completion. Repairs, like construction, keep running while you're off-site.

**Minimap** (bottom-right): the whole site at a glance — deposits as resource-colored dots, landmarks as diamonds (bright once charted, dim until then), working rigs as amber squares, the lander as a cyan triangle, your on-foot position (when applicable) as a green dot, and a crosshair for the current camera focus. **Click anywhere on it to jump the camera there.**

### On-foot view

**WASD** walk, mouse/arrows look, **E** to interact with whatever the prompt names — deposits, rigs, the lander hatch. Drop into this view from wherever the command camera is currently looking (not always back at the lander), so long pans pay off.

### Mining

Arm a rig from the side panel, then either click a deposit (command view) or walk up and press **E** (on-foot). Hazards degrade equipment in real time while a rig works, in either view — the hold (away-sites) or the base stockpile (Landing Zone) decides when to head home.

At the Foundry/Landing Zone specifically, extraction feeds the base stockpile directly (visible in the top bar) — there's no ship-hold round trip at your own site. Three base structures shape this economy:

- **Storage Silo** — the base can only hold so much. The **Base Storage** bar in the side panel shows how full the stockpile is; when it's full, mining stalls (a "Storage full" warning) until you build a silo to raise the cap. (Refining raw into refined material also frees space, since it compacts 2 units into 1.)
- **Solar Array** — your first power. A **Power** readout in the side panel shows net power (supply minus demand) and the day/night state. Solar output follows a **day/night cycle** — full at noon, nothing at night — and **dust** slowly settles on the panels, derating output over time. Select an array to see its dust level and a **Clean panels** button (costs time, not resources — the array goes offline briefly while serviced). Night and dust are the problems the Nuclear Generator later solves for good.
- **Power Relay** — caps how many rigs (and later, drones) can run at once. Try to deploy past the cap and you're told to build a Power Relay. Each relay raises the ceiling.
- **Refinery** — build one at the base and its refining queue appears in the side panel, letting you turn raw ore/regolith/ice into alloy/ceramic/fuel right on site (previously only possible back at the shipyard).
- **Nuclear Generator** — the fix for both of solar's problems: steady output day or night, dust-immune, for as long as the shared **isotope** stockpile holds out (mined from the pale-green Isotope Ore deposits). It burns isotope slowly and continuously while running; select it to see live status ("Running · isotope stock N" or, in red, "OFFLINE — out of isotopes"). Running dry doesn't damage it — it just goes dark (a toast announces it either way) and resumes automatically the moment you mine more isotope. Requires a Foundry to build.

**Ambient pressure:** landing is not free. A red **LIFE-SUPPORT DRAIN** badge next to the fuel gauge (top bar) means fuel is draining continuously — this only stops once a **Solar Array**, a **Refinery**, and a **Storage Silo** are all standing at once. The instant all three are up, the drain halts for good (a toast confirms it) — and if you later lose one of them, the drain resumes until it's rebuilt. Getting self-sufficient before the tank runs dry is the opening tension.

## Refinery (at the Foundry)

Raw stock in, usable stock out, in real time.

## Resource & Structure Guide

The **GUIDE** button (top nav, reachable from anywhere) opens a full reference: every resource with its color swatch, what it's made from and what it turns into (with exact ratios and refining time), which structures need it, and — separately — every Landing Zone structure with its cost, build time, power draw/output, and prerequisites. Use it any time the economy feels opaque.

On-site, deposits are color-coded but not just by color anymore:

- The side panel's **Deposits Here** box lists every resource present at the site with its color swatch and name, so you can match colors to names without hovering anything.
- **Hovering** any deposit or deployed rig in the command view shows a tooltip naming it (resource + remaining units, or rig type + integrity) — no need to arm a rig or walk up to it first.
- **Clicking** a deposit with no rig armed also identifies it (a toast), instead of doing nothing.

## GERTY & the Discovery Log

GERTY flags hazards beyond your equipment's ratings and occasionally declines to answer outright. The logbook (**LOG** button) collects discoveries; some entries can be raised with GERTY directly.

## Signals in the dark

- Far out, something is building. It doesn't speak. Bring parts.
- At Site Null, one structure still draws power. Inside: readable plates, found components, a workbench — and a resident with a very old, very literal job description. It cannot hurt you, and you cannot fight it; you can only understand it. Read what it protects, and think about what its orders actually say.

## Saves & checkpoints

Progress autosaves to `localStorage`. The **⟲** button opens Saves & Checkpoints — checkpoints are captured automatically (wake-up, each departure from the Foundry, each docking, major discoveries), and any of them can be restored if a run goes sideways. Full wipe lives at the bottom of the same panel.

## Dev tools

**Dev mode:** type `c` `h` `t` quickly (within ~1.2s) to toggle. Bottomless stock and tank, every site pre-surveyed — for exploring/debugging. A pulsing DEV badge marks it; toggling off restores an honest tank, but any stock granted while it was on stays, so use a throwaway save or a checkpoint.

**Terrain range:** open the game with `#terrain` in the URL (e.g. `http://localhost:5173/#terrain`) to boot straight into the chunk-streaming proof of concept — an endless procedural surface where terrain chunks load/unload around the camera focus (pan/zoom from above, or **TAB** to drop on foot at the focus point). Chunk size, load/unload radii, build budget, and the height-noise octaves all live in `src/config/balance.ts`.

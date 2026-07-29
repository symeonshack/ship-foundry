# Ship Foundry — Gameplay Guide

Everything you need to actually play: controls, what each screen does, and the dev-only tools. For the design/story behind all this, see `ship-foundry-build-spec.md` and `mining-operations-build-spec.md`.

## Aboard ship (first-person hub)

You wake aboard. **WASD** to move, mouse to look (click the view to capture the cursor; arrow keys also look), **E** to interact.

- The star map lives on the holo table.
- **GERTY is a mobile robot** that ambles around the deck on its own. Walk up to it and press **E** to talk — it stops, turns to face you, and tracks you while you're near or while it's speaking, then goes back to roaming once you leave. Its dock/charging berth is the lit alcove on the starboard wall.
- The rear hatch **takes the lander down** to whatever site you're orbiting.

The ship stays in orbit; you work a site from the **lander** (below). Interstellar travel always ends back aboard the ship, in orbit at the new destination.

## Planetside — the lander

Down on a site (the Landing Zone or any surface), the ship is up in orbit — so "boarding the ship" from the surface actually puts you inside your **lander**, a cramped descent cabin. On the surface the top-nav **SHIP** button reads **LANDER**, and pressing **E** at your lander on foot (or "Board lander" in command view) drops you inside it.

The lander cabin holds three things:
- A **GERTY console** on the wall — press **E** to talk. GERTY's *voice* reaches the lander (and shows in the comms box), but its robot body stays aboard the ship; only in orbit do you meet the robot itself.
- The **launch station** at the cockpit — **E** flies the lander up to dock with the ship, which is the only way (short of dev mode) to reach the walk-in ship interior from a surface.
- The **rear hatch** — steps back out to the site.

Because the ship is in orbit, the **SHIPYARD** is also out of reach while planetside — launch up first. Dev mode ignores the whole split and lets you jump straight to the ship.

## Shipyard (at the Foundry)

Pick a part, click a glowing socket to fit it. Click a fitted part to inspect, remove, or refund it. Engines glow under strain; off-axis loads make the whole stack wobble.

You start with a bigger, more built-up airframe than a bare frame — twin thrusters and a **Habitat Ring** already fitted. The habitat ring is a spun centrifuge (you can watch it turn) that adds crew/stowage space and a little radiation shielding, but it's heavy, so it wants the thrust to match — a live example of the mass-vs-thrust tradeoff the strain lamp reads out. Like any part it's built from the palette and can be unbolted; it seats on the hull's top structural hardpoint.

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
- **Foundry** — the mid-arc milestone: requires a Storage Silo, Refinery, and Power Relay all standing first, and takes the longest of any early structure to build. The instant it completes, the **SHIPYARD** nav button unlocks for good (a toast announces it) — until then, the base is just a camp and ship-building/repair isn't reachable at all. It's also the prerequisite for the Nuclear Generator and Launch Pad.
- **Fabricator** — build one (requires a Refinery and Power Relay) and a queue panel appears in the side panel: **+1/+5** buttons order Worker or Hauler drones, spending the cost immediately. Ordered units build in sequence with a live progress bar, same as the refinery queue. A toast announces each one as it finishes ("Worker Drone ready") — for now that's just a readiness notice; wiring a finished job to actually spawn a drone is further down the road.
- **Launch Pad** — requires a Foundry. For now it's just another structure — select it, watch it take damage, repair it — with no launch queue yet; that's where the satellite array will eventually start.

**Drones** are now real, movable units — box-select or click one, right-click a spot on the ground to send it there, and watch it walk over (sliding along other structures rather than clipping through them). A finished Fabricator job doesn't spawn one into the world yet (that wiring is still ahead) — until it does, **dev mode** adds "Spawn Worker/Hauler Drone" buttons in the side panel so movement/selection/orders/gathering can all be tried out today.

**Worker Drones gather on their own once ordered.** Right-click a live deposit (instead of bare ground) with a worker selected and it walks there, parks, and extracts in real time — the side panel shows a live "gathering · carrying N" readout. Once it's carrying 4 units (or the deposit runs dry, whichever comes first) it automatically heads back to wherever it was standing when you gave the order, banks the haul to the base stockpile ("returning · carrying N" while en route), and loops back for another load by itself — no need to re-order it each trip. It respects the same **Base Storage** cap rigs do: if the stockpile's full when it gets home, it parks and keeps retrying rather than losing the haul. The loop only stops on its own once the deposit is fully exhausted, at which point the drone goes idle and needs a new order. A plain right-click on bare ground is still a manual move order, and immediately cancels/recalls whatever gather job a drone was on.

**Rally point.** The **Drones** box in the side panel (appears once a Fabricator is up, any drone exists, or dev mode is on) has a **Set rally point** button — click it, then click the ground, and a flag marks the spot. Every drone produced afterward walks to the rally point the moment it's made instead of piling up at the Fabricator, so you can pre-stage new drones near a work site. "Move rally point" repositions the flag, "Clear rally" removes it (new drones then just sit where they're made). Right-click or Esc cancels while you're placing it.

**Find idle drone.** As the drone roster grows it's easy to leave one standing around doing nothing. The **Find idle drone (N)** button in the Drones box — or the **F** hotkey in command view — selects the next drone with no task and snaps the camera to it; press it again to cycle through the rest. The count in the label is how many are currently idle, and the button greys out when everything's busy.

**Hauler Drones automate the haul loop.** You don't order a hauler onto a deposit — instead, any idle hauler automatically attaches itself to the nearest worker that's gathering (or on its way to a deposit) and takes over the carrying. The worker then stays parked at the deposit mining continuously — its status reads "gathering · hauled" — while the hauler shuttles the output back to base (the Fabricator, else a Storage Silo, else the lander pad), batching several worker-loads per trip. One hauler serves one worker at a time; build more to keep more workers mining flat-out. A hauler releases its worker automatically once the deposit is exhausted, and giving a hauler a manual right-click move order detaches it (it stops auto-hauling until it next goes idle, at which point it looks for a new worker to help).

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

# Ship Foundry — Implemented Catalog

A catalog of everything the game currently contains: the systems that are built,
what each does, and an index of the completed build phases. This is the "what
exists today" reference. Anything **not** here — future/tabled work — lives in
`ROADMAP.md`. Player-facing controls and how-to-play live in `GAMEPLAY.md`;
contributor onboarding (how phase tracking works, standing rules) in `AGENTS.md`.

> These two docs (`IMPLEMENTED.md` + `ROADMAP.md`) replace the earlier pile of
> overlapping build specs (`ship-foundry-build-spec.md`, `mining-operations-build-spec.md`,
> `landing-zone-plan.md`, `stage-0-foundry-establishment-template.md`,
> `operation-site-1-template.md`, `landing-zone-gameplay-script.md`), which used
> three conflicting phase-numbering schemes. The phase numbers below are the
> code-comment scheme (see `AGENTS.md`); mapping to the old specs is noted where useful.

---

## What the game is

A non-combat sci-fi exploration and building game (TypeScript · three.js · Vite).
You scan, mine, refine, and build your way to a self-sufficient home base under
real, indifferent-universe pressure. Tone closer to *The Martian* / *Project Hail
Mary* than any shooter.

**Core pillars (all upheld in the build):**
- **No combat, ever.** Tension is environment, scarcity, and time pressure — never a weapon.
- **Engineering feel without the math.** Diegetic feedback (engine strain glow, stability wobble, a live fuel-range ring on the star map) instead of stat sheets.
- **Discovery-driven.** The world is learned by exploring it.
- **Indifferent, not villainous.** Problems are physics and scarcity.
- **First-person areas are *Alien: Isolation*-inspired, minus the horror** — tactile, atmospheric, no stalking predator.

**Core loop:** Scan → Mine → Refine → Build → Explore further.

**Tech & constraints (all in force):** TypeScript + three.js + Vite; browser
`localStorage` persistence; **all geometry is procedural/primitive-composed** in
`src/scene/primitives.ts` (no imported 3D assets — a deliberate later swap-in);
**every gameplay-affecting number lives in `src/config/balance.ts`**, grouped by
system, never hardcoded. Unit-tested pure logic + headless-Chromium verification
per change.

---

## Systems built

### Ship, interior & the orbit/ground split
- **Walkable ship interior** (first-person) — the orbiting mothership hub: a diegetic **star-map table** you walk up to (no permanent map UI), a **mobile GERTY robot** that wanders the deck and stops to face/track you when you talk to it, plus a detailed lived-in cabin (workbench, locker, bunk, dock alcove, lit ports).
- **Modular ship building** — snap-together parts on a socket tree (hulls, engines, tanks, cargo, life support, sensors, rad/thermal shielding, mining rigs, and a spun **habitat centrifuge ring**). Diegetic feedback: engine strain glow, off-axis stability wobble, live fuel-range ring on the star map. The assembled ship is what flies.
- **Real flight & landing** — travel is flown, not teleported: a cruise/descent/touchdown sequence driven by the ship's actual thrust/mass/stability, ending in a landing.
- **Orbit ↔ ground split** — the ship stays in orbit; you work a site from a distinct, cramped **lander** cabin (its own interior: canted cockpit, launch station, GERTY *console*). You cannot reach the ship interior from a surface without launching from the lander (dev mode aside). GERTY's robot body is aboard the ship; only its voice reaches the lander.

### Exploration, star map & GERTY
- **Star system** with discrete POIs (the Foundry home site, near rock, ice moon, fractured moon, irradiated site, anomaly, signal).
- **Scanning** reveals composition + hazard profile before you commit fuel; a live range ring shows point-of-no-return / return-home reach.
- **GERTY companion** — dry, understated, genuinely helpful; flags hazards beyond your equipment ratings, narrates beats, and supports an explicit "declines to answer" state (wired to future narrative flags). All lines are placeholder-but-tone-correct, gated purely by data flags.
- **Discovery Log** — auto-populated keyed fragments (logs/evidence), in-voice.
- **On-foot key areas** — the **Archive** (a first-person structure with a **custodian** agent puzzle) and the **collaborator encounter** (build-together minigame) exist as contained key areas over shared world state (Battlezone-style camera swap), not free-roam.

### Surface RTS (the Landing Zone)
- **Chunked/streamed terrain** at RTS scale (AoE/Halo-Wars-comparable), with distinct regions/POIs and a performance pass (LOD/culling). Real terrain variety so placement has spatial stakes.
- **Selection + command control** — click/drag-select, right-click orders; box-select; a **minimap**.
- **Building placement** — footprint + collision, valid-terrain check, live-validated ghost.
- **Build time + construction HP ramp** — structures go up over time at reduced HP, reaching full HP on completion (and take hazard damage *harder* while building).
- **Repair** — damaged (not destroyed) structures repaired cheaper/faster than a rebuild; destroyed ones cost a rebuild premium.
- **Deployable mining rigs** (drill/cryo) on deposits with a real gather cycle; **resource-node depletion** (nodes yield down and run out, forcing relocation); unstable-node collapse.
- **Visible day/night cycle** — a sun rises, arcs, and sets (5 min day / 5 min night), with an orange dawn/dusk, a dark star-lit night, and a moon — synced to the solar-power dip.

### Resources & power
- **Resources:** ore → metal (alloy), regolith → ceramic, water/ice → fuel, plus **high-grade ore** (the mission quota target) and **isotopes** (nuclear fuel). Resources build both ship parts and base structures.
- **On-site refinery queue** at the base.
- **Power grid** — a live net-power readout; **solar** follows day/night and accrues **dust** (cleanable); **Power Relay** caps simultaneous rigs/drones; **Nuclear Generator** gives steady power (burns the shared isotope stock) — the felt fix for night + dust. A **dust storm blacks out solar** entirely.

### Base structures (all buildable, with bespoke meshes)
Solar Array · Storage Silo · Refinery · Power Relay · Fabricator · Soil Processor ·
Greenhouse · Foundry · Nuclear Generator · Launch Pad · EM Shield · Storm Shield.
Each with cost/build-time/HP/prereqs in `balance.ts`/the catalog, AoE-style staged
construction models, progressive battle-damage visuals, and rubble on destruction.
The **Foundry** is earned mid-arc (gated; unlocks the Shipyard on completion).

### Drones
- **Fabricator production** — order Worker/Hauler drones from a queue; a finished job rolls a real drone onto the site (to the rally point if set).
- **Worker gather loop** — right-click a deposit → travel, extract, carry home, bank, auto-repeat until the vein runs dry; respects the storage cap.
- **Hauler automation** — idle haulers auto-attach to a gathering worker and ferry its output to base so the worker never stops mining.
- **Rally points**, **idle-drone finder** (button + F hotkey), **control groups** (Ctrl+1–9 assign / 1–9 recall), **formation spread + separation** (groups don't stack or clump).
- **Garrison/shelter** — "Shelter drones" tucks all drones into the nearest structure; a hazard strike loses drones caught in the open, sheltered ones ride it out.

### Hazards & hardening
- **Solar flare** and **dust storm** — both guaranteed early (so both hardening lessons land), then recurring. Warning countdown → strike. Storms also black out solar and darken the surface for their duration.
- **Hazard-specific hardening** — **EM Shield** negates flares base-wide; **Storm Shield** negates storms. They don't cover for each other, and the *other* hazard can knock a shield down.
- **Under-construction vulnerability** — half-built structures take amplified hazard damage.
- **Damage model** — real, AoE-style permanent-but-rebuildable losses; repair fills the "damaged but not destroyed" gap; rebuild costs a premium.

### Food / greenhouse
- **Food meter** (separate, always draining) with a HUD gauge.
- **Chain:** passive organic waste + regolith → (Soil Processor) growing medium → (Greenhouse) planted crop → grows → harvest → food, auto-replanting (seed-saving).
- **Depth:** grow-lights vs. daylight-only transparent panels (a real tradeoff), a running greenhouse eases the food drain (oxygen), and a damaged greenhouse risks contamination.

### Satellite array
Built on the **Launch Pad** (one launch at a time, live progress):
- **Comms Relay** — GERTY's orbital role / semi-autonomous ops.
- **Weather Satellite** — stretches every hazard's warning lead time.
- **Survey Satellite** — pre-scans unvisited POIs onto the star map.

### Mission arc
- **Operation Status** panel — a live objective checklist.
- **Resource quota** — cumulative high-grade ore banked toward a target (never walks back when spent).
- **Accidental discovery** — crossing the quota fires a one-time event: GERTY flags an anomalous find, a log fragment lands, and a hidden site is revealed/pre-scanned.
- **Operation established** — the infrastructure milestone (all objectives bar the greenhouse).
- **Mission complete** — the full capstone once the greenhouse harvest lands too.
- **Total-wipe game over** — the rare, avoidable failure state (every structure in ruins **and** food empty at once) → a "Total loss" rollback modal (restore a checkpoint or start over). Never fires on a fresh game.
- **Saves & checkpoints** — auto-checkpoints at wake-up, departures, docking, and major beats; rollback snapshots current progress first.

---

## The implemented playthrough (Landing Zone arc)

The intended felt experience, as built (from the old gameplay script — timings are
illustrative `balance.ts` targets, ~90–120 min first play):

1. **Touchdown** — top-down base view; life-support/fuel + food draining; two rigs, nothing built.
2. **First extraction** → **Solar array** (day/night begins) → **Refinery + Storage** ⇒ **self-sufficiency** (life-support drain halts). Exposure window opens (crude ground-sensor warnings).
3. **Greenhouse groundwork** (soil processor) → first **Solar flare** ⚠ (EM shielding; triage) → **Foundry** earned → plant first crop → first **Dust storm** ⚠ (storm shielding; solar blackout).
4. **Nuclear generator** (mine isotopes) → **high-grade ore** toward quota → ship repair/upgrade → **Launch Pad** → **Comms relay** (GERTY orbital).
5. **Weather satellite** (warning tension inverts to calm prep) → **Survey satellite** → **the accidental discovery** ★ (quota-gated; reveals a hidden site) → **mission complete**.
6. **Home base established** — depart for the next site and return between expeditions.

The two named hazards (flare, then storm) are scripted-guaranteed early; further
ones are procedural. The discovery is gated on the ore quota (earned, not timed).

---

## Phase index (code-comment scheme)

Completed phases, grouped. (Cross-refs: the old mining spec numbered the RTS block
48–61 and the threat model 41; the old ship-foundry spec numbered ship interior/
travel 1–2. Those are folded in below.)

- **1–4 — World foundation:** chunked terrain proof, scale-up, distinct regions, performance pass.
- **Ship interior / travel:** walkable interior + GERTY presence + diegetic map; real flight + landing; the Archive + collaborator encounter (on-foot key areas).
- **5–18 — Base building:** structure catalog; selection; placement; build-time + construction HP; repair; power relay; solar day/night + dust; life-support pressure; nuclear generator; Foundry (earned, unlocks Shipyard); Fabricator queue; Launch Pad.
- **19–24 — Drones:** world entities + movement/selection/orders; worker gather loop; rally points; idle detection; hauler automation; Fabricator spawns real drones.
- **25–26 — Hazards:** solar flare; dust storm.
- **27 — Hardening:** EM Shield + Storm Shield.
- **28–30 — Mission I:** resource quota; accidental discovery; Operation Status panel.
- **31–35 — Satellites:** launch queue; comms relay; weather satellite; survey satellite; operation-established milestone.
- **36–40 — Food:** food meter; soil chain; greenhouse crop cycle; greenhouse depth (light/oxygen/contamination); full mission complete.
- **41–45 — RTS polish & failure (old mining-spec 50/57/59/60 + failure state):** under-construction hazard vulnerability; control groups; formation/pathfinding; garrison/shelter; total-wipe game over.
- **Visual overhauls (interleaved):** ship model (habitat ring); interior + GERTY robot; lander interior + orbit/ground split; Landing Zone building/lander asset overhaul; day/night cycle; food gauge.

---

## Definition of "mission complete" (all criteria implemented)

Quota met · ship repaired/upgraded · Foundry operational · comms + weather + survey
satellites in orbit · baseline structures standing with key ones hardened · no
unresolved destroyed structures · greenhouse with ≥1 harvest · base runs
semi-autonomously (comms-relay-enabled — drones keep working while you're away).

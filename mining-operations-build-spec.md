# Mining & Operations — Build Spec (Deep Dive)

This document expands the "Mining & Resources" system from the master `ship-foundry-build-spec.md` into a full design. It's scoped to gameplay mechanics only — no story content, per the project's story/mechanics separation. Where a mechanic references "ancient AI tech," it's treated purely as a resource/tool source, not narrative.

## Current Round Scope (read this before anything else)

This round of development is narrowed on purpose. Build only what's marked **[ACTIVE]** below. Everything marked **[TABLED]** is fully designed and documented for later — do not build it now, and do not guess at a simplified version of it either. If something isn't marked ACTIVE, it isn't part of this round.

**In scope for this round:** get Landing Zone fully working as a genuinely good top-down, RTS-style experience. Nothing else. (This includes the foundational Core RTS Interaction & Economy Mechanics section below — selection, build time, gather timing, node depletion, and related — mined directly from Age of Empires/StarCraft and confirmed as load-bearing, not optional polish.)

**Tabled for this round:**
- **The two-tier site structure** (asteroid grind vs. operation sites) — there's currently only one site, so there's nothing to distinguish and nothing to gate.
- **The skill/progression system** — tabled along with the two-tier structure, since it existed to gate Tier 2 access.
- **Asteroid mining** — no asteroid sites are being built this round.
- **Full open-world first-person exploration** — first-person is not a free-roam layer over the whole map. It's reserved for specific, contained key areas (e.g., an ancient dig site) that a future site might reveal — Landing Zone itself doesn't currently have one. Nothing about first-person exploration is being built this round.

## Current Baseline (already implemented)

- **Mining rig** — extracts ore + regolith, refined into metal + ceramic.
- **Cryo rig** — extracts water, refined into fuel.
- Resources currently only build ship parts.

Everything below is the expansion on top of this baseline.

---

## World Scale & Technical Foundation (read this before anything else) [ACTIVE]

**Explicit instruction: do not default to a minimum-viable map size or complexity.** Left unspecified, an instruction to "build a mining site" will tend toward a small, easy-to-render space. That is not what's wanted here. Target scale, explicitly, on **both** dimensions:
- **Single operation-site footprint** — an individual site's playable area should be large in the RTS sense (Age of Empires/Halo Wars scale), not a small enclosed pad.
- **Overall exploration space** — multiple sites and real travel distance between them, not a handful of points clustered close together. (Note: only one site — Landing Zone — is being populated this round; this dimension is about the technical foundation supporting future sites, not about building them now.)

**Why this needs a deliberate technical approach, not just "make it bigger":** naively generating a large map at full detail everywhere will hurt performance. The standard, correct solution is **chunked/streamed terrain**: the world is large on paper, but only the area near the player (or camera, in top-down mode) is rendered at full detail; distant areas use simplified/low-detail stand-ins until approached. (The full-detail, human-scale walkability this was originally framed around applies only within contained key areas per the scope note above — the open top-down map itself doesn't need first-person-grade detail everywhere.)

**Build this in phases, in this order — do not attempt full scale in one pass:**
1. **Chunked terrain proof-of-concept**, small scale first. Prove that procedural generation and chunk streaming (loading/unloading terrain as the top-down camera moves) work correctly, without breaking movement or basic gameplay.
2. **Scale up dimensions.** Once the chunking system is proven, expand actual world size and resource-node distribution across it to the target AoE/Halo Wars scale.
3. **Populate with distinct regions/points of interest.** Multiple resource clusters and points of interest spread across the space — echoing AoE's multiple expansion spots — not one dense cluster near the spawn point.
4. **Performance pass, last.** Tune draw distance, level-of-detail, and culling once scale is functionally working. Performance target is not fixed in advance — build for scale first, optimize once it's working, rather than constraining scale upfront to hit a performance number.

This foundation should be built and confirmed working *before* populating the map with Landing Zone's mechanics — building content against a small prototype map risks throwing that work away once real scale lands.

---

## Tuning & Balance Configuration (standing rule — applies to every ACTIVE phase below)

Every gameplay-affecting numeric value introduced in any phase of this document — mining rig extraction rates, generator output, refinery speed, storage capacity, power costs, hazard countdown timers, drone production time/cost — must be defined in the same single, well-organized config file used by the master spec (`src/config/balance.ts`), grouped by system, not hardcoded inline in gameplay logic. No phase below should introduce a new tunable value directly in code. The goal is that any future tuning pass is a config-file edit, not a hunt through implementation code.

---

## Core Structure: Operation Sites [ACTIVE]

- Age-of-Empires-style, RTS gameplay. **For Landing Zone specifically: an ongoing, persistent arc, not a discrete 20–60 minute session with a win/loss evacuation state** — see `stage-0-foundry-establishment-template.md`. The Resource Quota goal type applies as an ongoing accumulation toward that document's "mission complete" criteria, not a one-shot extract-and-leave session. (The discrete-session framing remains the intended shape for *future* sites once they're built — Landing Zone is the exception, since it's the player's persistent home base.)
- Player sets up and spins up autonomous systems on-site: rigs, a production structure, workers/drones.
- Real time pressure throughout (see Threat Model). Landing Zone uses environmental escalation specifically — no agent threat is part of this round.
- Freely accessible — no readiness gate. (The tier structure that would have gated this is tabled — see Current Round Scope.)

---

## Core RTS Interaction & Economy Mechanics [ACTIVE]

Mined directly from Age of Empires and StarCraft's fundamentals, then gap-checked against this spec. These are foundational — most of the rest of this document assumes they exist, so they're built early (see Implementation Sequence). Ranked by how much their absence would hurt the game:

**Level 1 — critical; without these the game is broken or unplayable:**
- **Selection + command control scheme.** Click/drag-select units and structures, right-click to assign tasks (move, gather, build). The baseline interaction layer every top-down mechanic in this spec assumes exists.
- **Building placement rules — footprint + collision.** Buildings occupy real space, can't overlap, need valid terrain (ties into Terrain Variety in `stage-0-foundry-establishment-template.md`). Logically a prerequisite for build time to mean anything, so it's sequenced first among these.
- **Build time + under-construction vulnerability.** Confirmed from both games: buildings take real time to construct, and both AoE and StarCraft give under-construction buildings reduced/scaling HP — genuinely more fragile than finished ones. This is load-bearing for Landing Zone's entire hazard-prep tension (instant shielding would remove the "will I finish in time" stakes that the whole flare/storm design depends on).
- **Repair mechanic.** Both games let you repair damaged (not destroyed) buildings — cheaper and faster than a full rebuild. Landing Zone's hazard-damage model currently only has "destroyed → rebuild," with no middle state; this fills that gap directly.
- **Gather-trip loop timing.** Confirmed from both games: gathering takes real time per cycle — a worker/rig travels to a node, spends time extracting, carries a fixed amount back, repeats. Not an instant resource tick.
- **Resource-node depletion.** Un-tabled from the Dynamism section below — on reflection this is Level 1, not polish: infinite nodes remove all spatial/expansion pressure from an RTS economy, which is core to how both reference games actually play.

**Level 2 — should address; not game-breaking, but the game is notably flatter without them:**
- **Rally points.** Set where newly produced drones head by default — small, but removes a lot of micromanagement tedium in both reference games.
- **Tech-tree / prerequisite gating, formalized.** Landing Zone already has this implicitly (launch pad before satellites, Foundry before ship repair) — this formalizes it as an explicit system rather than an emergent side effect of build order.
- **Idle-worker/drone detection.** A "find idle unit" prompt, AoE-style — prevents silent economic waste as the drone roster grows.

**Level 3 — nice improvements; polish, not critical:**
- **Control groups.** Hotkey-assignable unit groups.
- **Minimap.** Genuinely useful at Landing Zone's target scale, though the top-down camera plus survey satellite partially cover the same need.
- **Formation/pathfinding niceties.** Drones not clumping or blocking each other.
- **Garrison/shelter.** AoE lets units shelter inside buildings; a thematic version — drones sheltering from a storm to avoid hazard damage — is a nice hazard-interaction flourish, not a required system.
- **Campaign objective/scripted-trigger framework.** Both games run campaigns on objective lists and map triggers; `landing-zone-gameplay-script.md` implies this structure already — formalizing it as a system is polish given Landing Zone is still fairly linear.

---

Fully designed, not being built this round — tabling this alongside the two-tier structure it existed to support.

- **Complexity ceiling, for when this is revisited: Skyrim-level.** Skills level through use, readable stat sheet, plain-language effects — not deep theorycrafting.
- Was to be leveled primarily through asteroid-tier grinding, carrying over into operation-site readiness as a capability-based gate.
- Distinct from ship-part progression (better parts → reach harsher sites): this would be the *operator* getting better, not the equipment.
- Readiness visualization design, for later: contextual checklist at the cartography table (met/unmet requirements), not a persistent numeric meter.

---

## Resources [ACTIVE — subset needed for Landing Zone]

### Common resources
- Ore → metal
- Regolith → ceramic
- Water/ice → fuel
- Silicates → electronics/sensor components *(designed, not required for Landing Zone specifically)*

### Rich/rare resources (site-specific, hazard-gated)
- **High-grade ore deposit** — Landing Zone's quota target; a richer, harder-to-reach vein of ordinary material (see `stage-0-foundry-establishment-template.md`).
- Radioactive isotopes → power generation (requires shielding to safely extract).
- Exotic gases, salvage/composite material → designed for future sites, not needed for Landing Zone.

### Ancient-tech resources [TABLED for this round]
- Computational resources, energy resources, tool artifacts — designed (see original resource categories), but not part of Landing Zone and not needed this round. Nothing exotic appears yet, per the story-side "no anomalies discovered" constraint.

---

## Structures [ACTIVE — subset needed for Landing Zone]

### On-site (built during Landing Zone) [ACTIVE]
- **Refinery module** — process raw material on-site instead of hauling home.
- **Storage silo** — buffers extracted material against time pressure.
- **Power relay** — caps how many rigs/drones can run simultaneously; a diegetic, deliberate scale limit.
- **Fabrication/production structure** — produces worker and hauler drones only for this site (see Unit Roster).

### On-site, designed but not needed for Landing Zone [TABLED]
- **Repair station** — no agent sabotage or complex hazard damage requiring repair loops in Landing Zone's current design.
- **Signal jammer / decoy rig** — no agent threat in Landing Zone; this exists for agent-siege sites.
- **Excavator** — no excavation-goal operation is part of this round.

### Home-base (persistent, between operations)
- **Cartography/planning table** — pre-scan or partially reveal an upcoming site before committing. [ACTIVE, without the readiness-checklist feature, which depended on the tabled skill system]
- **Skills/training facility** [TABLED — depends on the skill system.]
- **Fabrication bay upgrades**, **expanded hangar/storage** [TABLED for this round — not needed to make Landing Zone good; revisit once more sites exist.]

---

## Unit Roster [ACTIVE — subset needed for Landing Zone]

- **Worker drones** [ACTIVE] — mobile, suited to smaller/scattered resource nodes a fixed rig can't efficiently cover.
- **Hauler drones** [ACTIVE] — automate the resource-carrying loop.
- **Scout drones** [TABLED] — Landing Zone doesn't currently use fog-of-war/progressive reveal; designed for a future survey-goal site.
- **Repair drones**, **Decoy/jammer drones**, **Hero/unique units** [TABLED] — no repair loop or agent threat in Landing Zone's design.

What the player chooses to produce should matter even within this smaller roster: workers cover scattered high-grade ore veins, haulers keep the extraction loop moving under the flare's time pressure.

---

## Operation Goal Types [Resource Quota is ACTIVE; all others TABLED for this round]

Fully designed for future sites, documented here for reference — only Resource Quota is being built now, for Landing Zone.

- **Resource quota** [ACTIVE] — extract N of something before time/pressure runs out. Landing Zone's goal type.
- **Artifact recovery, multi-part assembly, access override, reactivation/calibration, survey/mapping, investigation, escort/protect, construction race, salvage/rescue, appeasement** [TABLED] — each fully designed (see prior spec versions), not needed until additional sites are built.
- **Excavation** [TABLED] — this is the goal type that would use contained, key-area first-person exploration (revealing a dig site chamber after digging). Not part of this round; when it is built, first-person exploration should be scoped exactly to the revealed chamber, not the surrounding open map.
- **Key/unlock artifacts** [TABLED] — decided design (a mix of route/blueprint/tier unlocks) preserved for when multiple sites with keyed content exist.

---

## Threat Model & Time Pressure [Environmental escalation is ACTIVE for Landing Zone; agent-based threat is TABLED]

**On stakes:** environmental danger in this game is genuinely life-threatening — real countdowns, real potential for mission-critical loss, not just a resource inconvenience. This is deliberate. What stays firmly out of scope, in every threat category: combat. No battles, no firefights, no kinetic war with AI agents. When agent conflict returns (currently tabled), it is sabotage-based — their drones and the player's drones can disable/interfere with each other — never killing or being killed. How that conflict actually plays out (puzzle-like, misdirection-based) is intentionally **not designed in this spec** — that's being developed separately as its own concept. This section only covers environmental danger.

### Environmental escalation [ACTIVE] — genuinely life-threatening
- Reuses hazard categories (radiation, temperature, storms, gravity anomalies) but lets some **escalate mid-operation**, discovered only once the player is already on-site — scanning gives a baseline profile, not omniscience.
- **Different hazard types require different, specific hardening — not one generic upgrade.** Landing Zone's example: a solar flare needs electromagnetic shielding; a dust storm needs metal lock-down shielding. These are separate buildables solving separate physical problems, and can overlap (prepping for two hazard types at once).
- Triggers a warning with a countdown once the weather/hazard satellite is up; before that, little to no warning. Consequence of being unprepared is real: destroyed structures, and if enough critical structures are lost simultaneously, a genuine failure state resolved AoE-style — real, permanent losses in the moment, with an ordinary save/load game-over only for a rare total-wipe scenario (see Landing Zone's Failure Consequences section).

### Hostile-agent escalation (tiered) [TABLED]
- Fully designed (scout → probe → full-escalation, adaptive targeting) for future agent-threat sites. Landing Zone has no agents. Whenever this is revisited: conflict is sabotage between drones only, never lethal in either direction, and the specific puzzle/misdirection design is deliberately left for separate development — not to be reasoned about or designed as part of this spec.

---

## Dynamism Additions (StarCraft / Halo Wars inspired) [mostly TABLED — polish for later, not required to make Landing Zone good]

- **Supply/power cap** [ACTIVE] — already covered by the Power Relay structure above; this is the only dynamism item actually needed for Landing Zone.
- **Tech tree, depleting resource nodes, random mid-operation events, GERTY leader powers, multi-site attention split** [TABLED] — all designed, none required for a single site's core loop to feel good. Revisit once Landing Zone is proven.
- **Macro/micro split note:** originally framed as "top-down (macro) / first-person (micro)." With first-person now scoped to contained key areas only (see Current Round Scope), Landing Zone itself is macro-only for this round — the micro layer returns once a site includes a key-area reveal.

---

## Key Tools [TABLED — not needed for Landing Zone]

### Excavator, Synthesizer
- Both fully designed (see prior spec content: excavator as an early milestone tool, synthesizer as a late-game, cost-gated matter-synthesis tool). Neither is part of this round — no excavation goal, no ancient-tech resources, no synthesizer fuel source exist in Landing Zone.

---

## Implementation Sequence (phased, one feature at a time)

**How to use this section:** hand Claude Code one **[ACTIVE]** phase at a time, as its own prompt (paste the phase's Goal/Build/Test text plus this paragraph for context). Confirm the "output to test" for a phase actually works before starting the next prompt. Do not combine multiple phases into one prompt. **Skip every phase marked [TABLED] — do not build it, and do not build a simplified substitute for it.** This is additive work on the existing project throughout; reuse what's already built rather than rebuilding it.

### Group A — World Foundation [ACTIVE]

**Phase 1: Chunked terrain proof-of-concept**
- Goal: prove chunked/streamed terrain works, at small scale, before anything else is built on top of it.
- Build: basic procedural terrain generation in chunks; load/unload chunks as the top-down camera moves.
- Test: pan the top-down camera across a small test area with no stutter, gaps, or broken geometry at chunk boundaries.

**Phase 2: Scale up world dimensions**
- Goal: expand the proven chunking system to real target scale.
- Build: increase world size and resource-node distribution to AoE/Halo Wars-comparable scale.
- Test: traverse a full site (top-down) and confirm it feels large — real travel distance, not a small pad.

**Phase 3: Populate distinct regions/points of interest**
- Goal: make the large map feel populated, not empty.
- Build: distribute multiple resource clusters and points of interest across the space, not clustered near spawn.
- Test: discover at least 3 distinct POIs/clusters while exploring the site.

**Phase 4: Performance pass**
- Goal: make the now-functional large scale run acceptably.
- Build: draw distance tuning, level-of-detail, culling.
- Test: no major frame-rate issues while moving through a populated large site.

### Group A2 — Core RTS Interaction & Economy Mechanics [ACTIVE — build immediately after Group A]

Ordered Level 1 first (with placement bumped ahead of build-time since it's a dependency), then Level 2, then Level 3 — highest priority and most foundational first, as requested.

**Phase 48: Selection + command control scheme**
- Goal: the baseline interaction layer everything else assumes exists.
- Build: click/drag-select for units and structures; right-click to assign move/gather/build tasks.
- Test: select a rig or drone, issue a move and a task command, confirm it responds correctly.

**Phase 49: Building placement — footprint + collision**
- Goal: buildings occupy real, non-overlapping space on valid terrain.
- Build: footprint/collision checks at placement time; invalid placements (overlap, bad terrain) are rejected with clear feedback.
- Test: attempt to place a structure overlapping another or on invalid terrain and confirm it's blocked.

**Phase 50: Build time + under-construction vulnerability**
- Goal: buildings take real time to construct and are more fragile while doing so — load-bearing for the entire hazard-prep tension.
- Build: construction timer per structure; reduced/scaling HP while under construction, reaching full HP only on completion.
- Test: start building a structure, confirm it's visibly incomplete and takes reduced hazard damage differently (more easily harmed) than a finished one during that window.

**Phase 51: Repair mechanic**
- Goal: fill the "damaged but not destroyed" gap in the current hazard-damage model.
- Build: repair action for a damaged (not destroyed) structure — cheaper and faster than a full rebuild.
- Test: damage a structure short of destruction, repair it, confirm cost/time is less than rebuilding from scratch.

**Phase 52: Gather-trip loop timing**
- Goal: resource gathering takes real time per cycle, not an instant tick.
- Build: travel-to-node, extraction-duration, fixed-carry-amount, return-trip cycle for rigs/drones.
- Test: watch a rig or worker drone complete a full gather cycle and confirm resources arrive only after the full loop.

**Phase 53: Resource-node depletion**
- Goal: give the economy real spatial/expansion pressure instead of infinite static nodes.
- Build: nodes reduce yield with extraction and eventually deplete, requiring relocation.
- Test: mine a node to depletion and confirm it stops producing and the player must find/relocate to a new one.

**Phase 54: Rally points**
- Goal: reduce production micromanagement.
- Build: settable default destination for newly produced drones.
- Test: set a rally point, produce a drone, confirm it moves there automatically.

**Phase 55: Tech-tree / prerequisite gating (formalized)**
- Goal: make already-implicit build-order dependencies (launch pad before satellites, Foundry before ship repair) an explicit, visible system.
- Build: prerequisite display/enforcement on relevant buildables.
- Test: attempt to build something out of prerequisite order and confirm it's blocked with a clear reason shown.

**Phase 56: Idle-worker/drone detection**
- Goal: prevent silent economic waste as the drone roster grows.
- Build: a "find idle unit" prompt/hotkey.
- Test: let a drone finish a task with nothing queued, confirm it's flagged as idle and easily selectable.

**Phase 57: Control groups**
- Goal: power-user convenience for managing multiple units.
- Build: hotkey-assignable unit groups.
- Test: assign a group, recall it via hotkey.

**Phase 58: Minimap**
- Goal: easier orientation at Landing Zone's target scale.
- Build: minimap showing base, rigs/drones, and points of interest.
- Test: minimap accurately reflects the main view in real time.

**Phase 59: Formation/pathfinding niceties**
- Goal: drones don't clump or block each other.
- Build: basic formation/spacing logic for multi-unit movement.
- Test: move a group of drones and confirm they don't visibly jam or path through each other awkwardly.

**Phase 60: Garrison/shelter**
- Goal: thematic hazard-avoidance flourish.
- Build: drones can shelter inside a structure during a hazard warning to avoid damage.
- Test: garrison a drone before a flare/storm hits, confirm it takes no damage while sheltered.

**Phase 61: Campaign objective/scripted-trigger framework**
- Goal: formalize the objective-list/map-trigger structure `landing-zone-gameplay-script.md` already implies.
- Build: a lightweight objective/trigger system (goal states, completion checks, scripted event hooks).
- Test: confirm a scripted event (e.g., the ore-quota-gated discovery) fires correctly through this system rather than being hardcoded ad hoc.

### Group B — Progression Systems [TABLED — entire group]

Two-tier site distinction, skill & progression sheet, and cartography readiness gating are all tabled together, per Current Round Scope. Do not build any part of this group this round.

### Group C — Resources [ACTIVE — subset]

**Phase 9 (renamed from "Operation-tier rare resources"): High-grade ore + isotopes**
- Goal: give Landing Zone its quota-target resource and its nuclear-generator fuel source.
- Build: high-grade ore deposit (extractable, refines toward the quota) and radioactive isotopes (shielding-gated) at Landing Zone.
- Test: extract high-grade ore and isotopes at Landing Zone.

**Phase 8 (expanded common resources — silicates), Phase 10 (ancient-tech resources) [TABLED]** — not needed for Landing Zone.

### Group D — On-Site Structures [ACTIVE — subset]

**Phase 11: Refinery module**
- Goal: process raw material on-site.
- Build: buildable refinery structure at Landing Zone.
- Test: refine a raw resource on-site instead of hauling it home.

**Phase 12: Storage silo**
- Goal: buffer resources during the operation.
- Build: buildable storage structure with real capacity.
- Test: silo visibly holds extracted material up to its capacity.

**Phase 13: Power relay (supply cap)**
- Goal: cap simultaneous rigs/drones.
- Build: buildable power relay; running more rigs/drones than current power capacity is blocked.
- Test: try to exceed capacity and get a clear, diegetic block.

**Phase 16: Fabrication/production structure (building only)**
- Goal: the "barracks" structure exists and can be built.
- Build: buildable fabrication structure; unit production comes in Group F.
- Test: structure builds successfully and shows a (placeholder) production queue UI.

**Phase 14 (repair station), Phase 15 (jammer/decoy rig), Phase 17 (excavator) [TABLED]** — not needed for Landing Zone (no repair loop, no agent threat, no excavation goal this round).

### Group E — Home-Base Structures [mostly TABLED]

**Phase 7a (cartography table):**
- Goal: give the player a way to preview locations before traveling — most useful once Site 2 exists, but worth building alongside Landing Zone since the discovery event (see `stage-0-foundry-establishment-template.md`) will populate it with a new location.
- Build: cartography/planning table structure at home base; shows a partial pre-scan of any revealed-but-unvisited location. No readiness checklist (that depended on the tabled skill system).
- Test: the table exists and is ready to display a location once one is revealed (even if Site 2 itself isn't built yet).

**Phase 18 (skills facility), Phase 19 (fabrication bay upgrades), Phase 20 (expanded storage) [TABLED]** — not needed to make Landing Zone good.

### Group F — Unit Roster [ACTIVE — subset]

**Phase 21: Worker drones**
- Goal: first mobile unit type.
- Build: fabrication structure produces worker drones; assignable to smaller/scattered resource nodes.
- Test: produce a worker drone and assign it to gather from a node a fixed rig can't cover well.

**Phase 23: Hauler drones**
- Goal: automate the haul loop.
- Build: hauler drone unit; automatically ferries resources from rigs/silo to storage.
- Test: haulers move resources without manual player trips.

**Phase 22 (scout drones), Phase 24 (repair drones), Phase 25 (decoy drones), Phase 26 (hero units) [TABLED]** — not needed for Landing Zone.

### Group G — Operation Goal Types [ACTIVE — one phase only]

**Phase 27: Resource quota**
- Goal: the high-grade ore accumulation that feeds Landing Zone's "mission complete" criteria (see `stage-0-foundry-establishment-template.md`) — an ongoing target, not a discrete win/loss session.
- Build: extract and accumulate the target quantity of high-grade ore over the course of establishing Landing Zone; track progress toward the mission-complete threshold.
- Test: extract high-grade ore and confirm progress toward the quota is tracked and visible; confirm reaching the quota contributes correctly to the mission-complete check.

**Phases 28–38 (all other goal types) [TABLED]** — fully designed, not needed until additional sites exist.

### Group H — Threat Model [ACTIVE — one phase only]

**Phase 41: Environmental escalation**
- Goal: the solar-flare threat that gives Landing Zone real stakes.
- Build: mid-operation hazard escalation (not predictable from the initial scan) with a warning/countdown once triggered.
- Test: trigger the event mid-operation and confirm the countdown and consequences (rush/evacuate/partial-loss) work as described.

**Phases 39–40 (hostile-agent escalation, adaptive targeting) [TABLED]** — no agents in Landing Zone.

### Group I — Dynamism [TABLED — entire group]

Tech tree, random mid-operation events, GERTY leader powers, multi-site attention split — all designed, none required this round. The power-cap dynamism item is already covered by Phase 13 above. (Depleting resource nodes has been un-tabled — see Core RTS Interaction & Economy Mechanics above, now Level 1.)

### Group J — Late-Game Tools & Progression Payoff [TABLED — entire group]

Synthesizer and key/unlock artifact payoffs — not part of this round; no ancient-tech resources or multiple sites exist yet to make either meaningful.

---

## Open Questions

None blocking for the ACTIVE scope. All TABLED items above are fully designed and preserved for when they're picked back up — reference this document rather than re-deriving them from scratch.

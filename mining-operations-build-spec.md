# Mining & Operations — Build Spec (Deep Dive)

This document expands the "Mining & Resources" system from the master `ship-foundry-build-spec.md` into a full design. It's scoped to gameplay mechanics only — no story content, per the project's story/mechanics separation. Where a mechanic references "ancient AI tech," it's treated purely as a resource/tool source, not narrative.

## Current Baseline (already implemented)

- **Mining rig** — extracts ore + regolith, refined into metal + ceramic.
- **Cryo rig** — extracts water, refined into fuel.
- Resources currently only build ship parts.

Everything below is the expansion on top of this baseline.

---

## World Scale & Technical Foundation (read this before anything else)

**Explicit instruction: do not default to a minimum-viable map size or complexity.** Left unspecified, an instruction to "build a mining site" will tend toward a small, easy-to-render space. That is not what's wanted here. Target scale, explicitly, on **both** dimensions:
- **Single operation-site footprint** — an individual site's playable area should be large in the RTS sense (Age of Empires/Halo Wars scale), not a small enclosed pad.
- **Overall exploration space** — multiple sites and real travel distance between them, not a handful of points clustered close together.

**Why this needs a deliberate technical approach, not just "make it bigger":** this game needs the same map to support both a top-down RTS view *and* full first-person, human-scale walking through it. Age of Empires and Halo Wars achieve their scale in 2D/2.5D with a fixed camera — nothing needs full 3D detail up close. Achieving comparable scale while also being walkable at ground level in real-time 3D is a harder technical problem, and naively generating a large map at full detail everywhere will hurt performance. The standard, correct solution is **chunked/streamed terrain**: the world is large on paper, but only the area near the player (or camera, in top-down mode) is rendered at full detail; distant areas use simplified/low-detail stand-ins until approached.

**Build this in phases, in this order — do not attempt full scale in one pass:**
1. **Chunked terrain proof-of-concept**, small scale first. Prove that procedural generation and chunk streaming (loading/unloading terrain as the player/camera moves) work correctly, in both the top-down and first-person camera modes, without breaking movement or basic gameplay.
2. **Scale up dimensions.** Once the chunking system is proven, expand actual world size and resource-node distribution across it to the target AoE/Halo Wars scale.
3. **Populate with distinct regions/points of interest.** Multiple resource clusters and points of interest spread across the space — echoing AoE's multiple expansion spots — not one dense cluster near the spawn point.
4. **Performance pass, last.** Tune draw distance, level-of-detail, and culling once scale is functionally working. Performance target is not fixed in advance — build for scale first, optimize once it's working, rather than constraining scale upfront to hit a performance number.

This foundation should be built and confirmed working *before* populating a large map with the mining mechanics described below — building mining content against a small prototype map risks throwing that work away once real scale lands.

---

## Tuning & Balance Configuration (standing rule — applies to every phase below)

Every gameplay-affecting numeric value introduced in any phase of this document — mining rig extraction rates, generator output (solar and nuclear), refinery speed, storage capacity, power costs, hazard countdown timers, drone production time/cost, skill-leveling rates, everything like this — must be defined in the same single, well-organized config file used by the master spec (`src/config/balance.ts`), grouped by system, not hardcoded inline in gameplay logic. No phase below should introduce a new tunable value directly in code. The goal is that any future tuning pass is a config-file edit, not a hunt through implementation code.

---

## Core Structure: Two-Tier Mining

### Tier 1 — Asteroid Grind
- WoW-style repeatable, low-commitment resource gathering. Drop a rig, extract, move on.
- No siege/eviction pressure here — this tier stays low-tension, a deliberate contrast to Tier 2.
- Primary venue for skill leveling (see below).

### Tier 2 — Operation Sites ("Dungeons")
- Age-of-Empires-style sessions, roughly 20–60 minutes, ending when a specific goal is met (see Operation Goal Types).
- Player sets up and spins up autonomous systems on-site: rigs, a production structure, workers/drones.
- Real time pressure throughout (see Threat Model).
- **Gated by Tier 1 progress** — WoW-dungeon-style readiness check. The gate should be capability-based (an unlocked rig tier, base module, or drone capacity threshold), not a bare "Skill Level 5 required" number wall — the player should be able to look at their loadout and see whether they're ready.

---

## Skill & Progression System

- **Complexity ceiling: Skyrim-level.** Skills level through use, readable stat sheet, plain-language effects — not deep theorycrafting.
- Leveled primarily through Tier 1 (asteroid) grinding.
- **Carries over into Tier 2 readiness** — this is the core gating mechanic between tiers.
- Distinct from ship-part progression (better parts → reach harsher sites): this is the *operator* getting better, not the equipment. Both progressions run in parallel, not redundant with each other.
- This is a deliberate, scoped exception to the game's general "diegetic feedback over stat sheets" pillar — that pillar still governs moment-to-moment systems like ship building; a readable stat sheet is the right tool specifically for this longer-arc progression system.
- **Readiness visualization: contextual, not a persistent meter.** When previewing an upcoming operation site (at the cartography/planning table — see Structures), show a simple checklist of what that operation requires vs. what the player currently has (e.g., rig tier: have / drone capacity: short by 2), using plain met/unmet indicators rather than a numeric readiness score. This reuses the cartography table rather than adding a new UI system, and keeps with "look at your loadout and see whether you're ready" rather than a hidden number.

---

## Resources

### Grind-tier (Tier 1, common)
- Ore → metal
- Regolith → ceramic
- Water/ice → fuel
- Silicates → electronics/sensor components *(new)*

### Operation-tier (Tier 2, rarer, hazard-gated)
- Exotic gases → propulsion/energy upgrades
- Rare crystals/minerals → top-tier ship and base parts
- Radioactive isotopes → power generation (requires shielding to safely extract — built-in hazard/reward tension)
- Salvage/composite material → advanced structures

### Ancient-tech resources (Tier 2, rare, tool-source)
- **Computational resources** — GERTY capability upgrades, new scan/UI features, skill respecs.
- **Energy resources** — highest-tier power; the specific fuel required for the synthesizer (see Key Tools).
- **Tool artifacts** — intact found devices; once integrated, unlock new rig blueprints, new drone types, or new environmental-interaction tools. Can bootstrap themselves (an early tool artifact may be exactly what's needed to detect/find more ancient tech).

---

## Structures

### On-site (built during an operation)
- **Refinery module** — process raw material on-site instead of hauling home.
- **Storage silo** — buffers extracted material against time pressure.
- **Power relay** — caps how many rigs/drones can run simultaneously (StarCraft supply-depot equivalent); a diegetic, deliberate scale limit.
- **Repair station** — auto-fixes rigs damaged by hazards or agent sabotage.
- **Signal jammer / decoy rig** — non-lethal deterrence against hostile-leaning agents; reduces detection odds or baits agents toward a fake target.
- **Fabrication/production structure** — the AoE "barracks" equivalent. Spends resources + time to produce mobile units (see Unit Roster).
- **Excavator** — a dedicated rig type (not a re-tasked mining rig), required for excavation-goal operations. Building one is intended as an **early-game milestone**: the player hits a wall (something buried they can't reach) and the fix is building the tool that solves it, rather than starting with it.

### Home-base (persistent, between operations)
- **Skills/training facility** — actively train or respec skills, not purely passive earn-through-grind.
- **Cartography/planning table** — pre-scan or partially reveal an upcoming operation site before committing to it; also surfaces the operation's readiness checklist (see Skill & Progression System).
- **Fabrication bay upgrades** — improve refinery efficiency globally, unlock new deployable structure types for future operations.
- **Expanded hangar/storage** — raises baseline cargo/fuel capacity for all future trips.

---

## Unit Roster (produced by the fabrication structure)

- **Worker drones** — mobile, suited to smaller/scattered resource nodes a fixed rig can't efficiently cover.
- **Scout drones** — reveal unmapped parts of a site (drives fog-of-war / active map reveal), feed the survey/mapping goal type.
- **Hauler drones** — automate the resource-carrying loop.
- **Repair drones** — mobile version of the repair station.
- **Decoy/jammer drones** — mobile, deployable non-lethal deterrence.
- **Hero/unique units** *(Halo Wars-inspired)* — specialized units with a one-time or cooldown ability, e.g. a "diplomat" drone built for appeasement operations, or a unit that can temporarily override an agent's directive.

What the player chooses to produce should matter: a resource-quota operation leans on workers/haulers, a siege-threat operation leans on decoys/repair drones, a survey goal leans on scouts.

---

## Operation Goal Types

Deliberately varied so operations don't all reduce to "collect X units":

- **Resource quota** — extract N of something rare before time/pressure runs out.
- **Artifact recovery** — find and extract a specific object; exploration-driven.
- **Multi-part assembly** — several fragments scattered across a site that only do something once combined; rewards full exploration.
- **Access override** — get past a locked door/gate via a found override code, bypass tool, or an agent holding the "key."
- **Reactivation/calibration** — restore power/function to dormant on-site infrastructure by finding and repairing the right components.
- **Survey/mapping** — place scanning beacons across a site to fully chart it; no extraction, a calmer goal type.
- **Investigation** — piece together what happened at a site via multiple found logs/clues (Discovery Log system); an information-gathering goal.
- **Escort/protect** — keep something vulnerable intact for the operation's duration against hazard or agent interference.
- **Construction race** — build out enough infrastructure before a hazard cycle hits, rather than extracting anything.
- **Salvage/rescue** — recover a downed rig or stranded equipment under pressure.
- **Appeasement** — a hostile-leaning agent controls the site; the goal is satisfying its directive well enough to operate peacefully, not extraction by force. Leans hardest into the Agent Personality Spectrum system.
- **Excavation** — top-down phase digs toward something buried; completing the dig reveals a new space and transitions the player into first-person exploration of it via the existing hybrid camera-swap mechanic.
- **Key/unlock artifacts** — some finds (from any goal type above) function as literal progression keys: unlocking a new star-system route, a blueprint, or a rig tier — not just loot. **Decided: a mix** — different artifacts unlock different things depending on what they are, rather than all keys granting the same category of reward.

---

## Threat Model & Time Pressure

Two independent pressure types. **Vary which one is primary per site rather than stacking both on every operation** — keeps the source of danger legible instead of turning into noise.

### Hostile-agent escalation (tiered, not a flat timer)
1. **Scout phase** — an agent observes; visible but not yet destructive. Player's window to prep (build a jammer, relocate a vulnerable rig).
2. **Probe phase** — if unaddressed, small-scale sabotage (one rig disrupted).
3. **Full escalation** — only if ignored, full eviction assault (base scrapped, player forced out — never lethal, never combat).
- **Adaptive, not scripted:** an agent that notices a jammer should start targeting the jammer specifically on its next approach — makes the threat feel responsive rather than running a fixed script.

### Environmental escalation
- Reuses existing hazard categories (radiation, temperature, storms, gravity anomalies) but lets some **escalate mid-operation**, discovered only once the player is already on-site — scanning gives a baseline profile, not omniscience.
- Examples: incoming solar flare, meteor shower, unstable orbit/tidal event, dust storm, radiation spike, atmospheric vent.
- Triggers a warning with a countdown; player must rush to finish, evacuate with partial resources, or (later feature) harden temporarily to ride it out.

---

## Dynamism Additions (StarCraft / Halo Wars inspired)

- **Tech tree, not a flat list** — building unlocks branch (e.g., refinery unlocks two divergent upgrade paths), creating real strategic choice rather than a checklist.
- **Supply/power cap** — formalized via the power relay; forces active infrastructure investment to scale an operation up.
- **Macro/micro split** — already achieved by the existing hybrid top-down (macro) / first-person (micro) mode; no new system needed, just worth recognizing as the mechanic doing real work.
- **Leader/companion powers (GERTY abilities)** — global, cooldown-gated actions: emergency resource airdrop, full-site scan pulse (instant fog-of-war reveal), temporary shield pulse (protects the whole operation from an environmental spike).
- **Depleting resource nodes** — nodes should deplete over time, forcing active scouting/relocation of rigs rather than "set and forget."
- **Fog of war / active map reveal** — sites aren't fully revealed on arrival; scout drones uncover them progressively.
- **Random mid-operation events** — occasional surprises: a rich vein worth rushing before it's gone, incidental rig damage needing a repair-drone dispatch, a signal pulling the player into a short first-person detour.
- **Multi-site attention split** *(later, bigger idea — not current scope)* — eventually running 2–3 operations loosely in parallel, triaging attention between them. Flagged for after the single-operation loop is solid.

**Complexity calibration:** Halo Wars (simpler, more accessible) is the target depth for base-building/tech-tree complexity — StarCraft is a flavor reference, not a complexity target to match.

---

## Key Tools

### Excavator (early game)
- See Structures above. Dedicated rig, built as an early milestone in response to hitting a wall the player can't otherwise get past.

### Synthesizer (late game)
- Star Trek-replicator-style tool refined from ancient AI tech. Genuinely powerful — needs a cost model that keeps it from breaking the resource economy:
  - **Fueled specifically by ancient-tech energy resources**, not standard fuel.
  - **Deliberately bad conversion rate** — costs more raw energy than the materials it produces would've cost to mine/refine normally. A trade of convenience for inefficiency, not a strict upgrade.
  - **Capped scope** — produces basic materials only (metal, ceramic, fuel), not rare/ancient-tech items. Keeps excavation and discovery meaningful even after the player has it.
  - **Possible cooldown** on top of resource cost, so even a stockpile can't turn it into a spam button.

---

## Implementation Sequence (phased, one feature at a time)

**How to use this section:** hand Claude Code one phase at a time, as its own prompt (paste the phase's Goal/Build/Test text plus this paragraph for context). Confirm the "output to test" for a phase actually works before starting the next prompt. Do not combine multiple phases into one prompt — this sequence is deliberately granular so each delivery is small enough to test and give feedback on before moving forward. This is additive work on the existing project throughout; reuse what's already built rather than rebuilding it.

### Group A — World Foundation

**Phase 1: Chunked terrain proof-of-concept**
- Goal: prove chunked/streamed terrain works, at small scale, before anything else is built on top of it.
- Build: basic procedural terrain generation in chunks; load/unload chunks as the player or top-down camera moves; verify it works in both camera modes.
- Test: walk and pan the top-down camera across a small test area with no stutter, gaps, or broken geometry at chunk boundaries.

**Phase 2: Scale up world dimensions**
- Goal: expand the proven chunking system to real target scale.
- Build: increase world size and resource-node distribution to AoE/Halo Wars-comparable scale, on both the single-site and overall-exploration dimensions.
- Test: traverse a full site (top-down and on-foot) and confirm it feels large — real travel time/distance, not a small pad.

**Phase 3: Populate distinct regions/points of interest**
- Goal: make the large map feel populated, not empty.
- Build: distribute multiple resource clusters and points of interest across the space, not clustered near spawn.
- Test: discover at least 3 distinct POIs/clusters while exploring one site.

**Phase 4: Performance pass**
- Goal: make the now-functional large scale run acceptably.
- Build: draw distance tuning, level-of-detail, culling.
- Test: no major frame-rate issues while moving through a populated large site.

### Group B — Progression Systems

**Phase 5: Two-tier site distinction**
- Goal: separate asteroid (Tier 1) and operation (Tier 2) sites as distinct, selectable site types.
- Build: site-type categorization on the star map/UI; asteroid sites keep the existing lightweight rig-and-wait loop; operation sites are placeholder-locked for now.
- Test: star map clearly shows which sites are asteroid-grind vs. operation type.

**Phase 6: Skill & progression sheet**
- Goal: a working, Skyrim-style skill system.
- Build: readable skill sheet; skills level through repeated use at asteroid (Tier 1) sites; plain-language effects per level, no hidden math.
- Test: grind at an asteroid site and watch a skill visibly level up with a stated effect.

**Phase 7: Cartography table + Tier 2 readiness gating**
- Goal: gate operation sites behind capability, shown contextually.
- Build: cartography/planning table structure at home base; previewing an operation site shows a met/unmet checklist against current capability (not a numeric wall); operation sites stay locked until requirements are met.
- Test: an under-leveled operation site clearly shows what's missing; a ready one clearly shows as accessible.

### Group C — Resources

**Phase 8: Expanded grind-tier resources**
- Goal: add resource variety to asteroid sites.
- Build: silicates → electronics/sensor components, alongside existing ore/regolith/water.
- Test: mine silicates at an asteroid site and see them refine into electronics.

**Phase 9: Operation-tier rare resources**
- Goal: give operation sites their own valuable resource tier.
- Build: exotic gases, rare crystals/minerals, radioactive isotopes (shielding-gated), salvage/composite material — extraction only, consumers come later.
- Test: extract at least one operation-tier resource at an operation site.

**Phase 10: Ancient-tech resources**
- Goal: add the rare tool-source resource category.
- Build: computational resources, energy resources, tool artifacts as extractable/findable at operation sites — extraction and inventory only, no consumers yet.
- Test: find and hold at least one of each ancient-tech resource type.

### Group D — On-Site Structures

**Phase 11: Refinery module**
- Goal: process raw material on-site.
- Build: buildable refinery structure at an operation site.
- Test: refine a raw resource on-site instead of hauling it home.

**Phase 12: Storage silo**
- Goal: buffer resources during an operation.
- Build: buildable storage structure with real capacity.
- Test: silo visibly holds extracted material up to its capacity.

**Phase 13: Power relay (supply cap)**
- Goal: cap simultaneous rigs/drones, StarCraft-supply-style.
- Build: buildable power relay; running more rigs/drones than current power capacity is blocked.
- Test: try to exceed capacity and get a clear, diegetic block (not just a silent failure).

**Phase 14: Repair station**
- Goal: auto-fix damaged rigs.
- Build: buildable repair station with a real repair radius/rate.
- Test: damage a rig (or simulate damage) and watch it repair near the station.

**Phase 15: Signal jammer / decoy rig**
- Goal: first non-lethal deterrence structure.
- Build: buildable jammer/decoy; reduces detection odds or draws attention to a fake target.
- Test: confirm the structure measurably affects agent detection behavior (even with placeholder agent logic).

**Phase 16: Fabrication/production structure (building only)**
- Goal: the "barracks" structure exists and can be built.
- Build: buildable fabrication structure; unit production comes in Group F, this phase is just the structure existing and being functional as a building.
- Test: structure builds successfully and shows a (placeholder) production queue UI.

**Phase 17: Excavator**
- Goal: the early-game milestone tool.
- Build: dedicated excavator rig, buildable once unlocked; required for excavation-goal operations (goal type comes in Group G).
- Test: build an excavator and use it to clear/dig terrain.

### Group E — Home-Base Structures

**Phase 18: Skills/training facility**
- Goal: active skill training, not purely passive.
- Build: home-base structure that lets the player actively train or respec a skill (spending a resource/time cost).
- Test: use the facility to raise a skill outside of grinding.

**Phase 19: Fabrication bay upgrades**
- Goal: persistent, global improvements.
- Build: home-base upgrade path improving refinery efficiency globally and/or unlocking new deployable structure types for future operations.
- Test: an upgrade visibly changes refinery output or unlocks a new buildable.

**Phase 20: Expanded hangar/storage**
- Goal: raise baseline capacity.
- Build: home-base structure/upgrade increasing cargo/fuel capacity for all future trips.
- Test: capacity numbers increase after building/upgrading.

### Group F — Unit Roster

**Phase 21: Worker drones**
- Goal: first mobile unit type.
- Build: fabrication structure (Phase 16) produces worker drones; assignable to smaller/scattered resource nodes.
- Test: produce a worker drone and assign it to gather from a node a fixed rig can't cover well.

**Phase 22: Scout drones + fog of war**
- Goal: active map reveal.
- Build: scout drone unit; sites start partially hidden and reveal as scouts explore.
- Test: an unscoured site area stays hidden/simplified until a scout reveals it.

**Phase 23: Hauler drones**
- Goal: automate the haul loop.
- Build: hauler drone unit; automatically ferries resources from rigs/silo to storage or home.
- Test: haulers move resources without manual player trips.

**Phase 24: Repair drones**
- Goal: mobile repair.
- Build: repair drone unit; roams and repairs damaged rigs, distinct from the fixed repair station.
- Test: a damaged rig away from the repair station still gets fixed by a repair drone.

**Phase 25: Decoy/jammer drones**
- Goal: mobile deterrence.
- Build: mobile version of the jammer/decoy structure from Phase 15.
- Test: deploy a decoy drone and confirm it draws or reduces agent attention.

**Phase 26: Hero/unique units**
- Goal: specialized, ability-driven units.
- Build: at least one hero unit (e.g., a "diplomat" drone) with a one-time or cooldown ability.
- Test: produce and use the hero unit's special ability once.

### Group G — Operation Goal Types

Each of the following is its own phase — build the goal-completion logic, win/loss state, and any goal-specific UI, one at a time:

**Phase 27: Resource quota** — extract N of a resource before time/pressure runs out.
**Phase 28: Artifact recovery** — find and extract a specific object.
**Phase 29: Multi-part assembly** — combine scattered fragments into one result.
**Phase 30: Access override** — find a means (code/tool/agent) to unlock a barred area.
**Phase 31: Reactivation/calibration** — restore power/function to dormant infrastructure.
**Phase 32: Survey/mapping** — place beacons to fully chart a site.
**Phase 33: Investigation** — connect multiple found logs/clues into a completed record.
**Phase 34: Escort/protect** — keep something vulnerable intact for the operation's duration.
**Phase 35: Construction race** — build required infrastructure before a hazard cycle hits.
**Phase 36: Salvage/rescue** — recover a downed rig or stranded equipment under pressure.
**Phase 37: Appeasement** — satisfy a hostile agent's directive well enough to operate peacefully.
**Phase 38: Excavation** — dig to reveal a structure, then transition into first-person exploration of it (uses the Excavator from Phase 17 and the existing hybrid camera-swap mechanic).

For each: test by starting an operation with that goal type, completing it, and confirming the win condition (and a failure condition, where relevant) triggers correctly.

### Group H — Threat Model

**Phase 39: Hostile-agent escalation tiers**
- Goal: replace any flat eviction timer with the scout → probe → full-escalation structure.
- Build: three-stage agent behavior; player has a real window to react at each stage.
- Test: ignore an agent through all three stages and confirm escalation happens in order, with visible warning at each stage.

**Phase 40: Adaptive agent targeting**
- Goal: agents respond to what the player builds.
- Build: an agent that's been jammed/decoyed once should behave differently on its next approach (e.g., target the jammer specifically).
- Test: build a jammer, get probed, confirm the agent's next action visibly accounts for it.

**Phase 41: Environmental escalation**
- Goal: mid-operation hazard spikes, discovered on-site rather than fully predictable from scanning.
- Build: at least one escalating hazard type (e.g., incoming solar flare) with a warning/countdown once triggered.
- Test: trigger the event mid-operation and confirm the countdown and consequences work as described.

### Group I — Dynamism

**Phase 42: Tech tree for building unlocks**
- Goal: branching unlocks instead of a flat list.
- Build: at least one branch point (e.g., refinery unlocking two divergent upgrade paths).
- Test: choosing one path visibly locks out or delays the other.

**Phase 43: Depleting resource nodes**
- Goal: force active expansion instead of set-and-forget.
- Build: nodes reduce yield over time/extraction and eventually deplete.
- Test: mine a node to depletion and confirm the rig needs relocating.

**Phase 44: Random mid-operation events**
- Goal: break up operation rhythm with small surprises.
- Build: at least one event type (e.g., a rich vein appearing temporarily).
- Test: an event triggers at least once during a test operation and is clearly presented to the player.

**Phase 45: GERTY leader powers**
- Goal: global, cooldown-gated player abilities.
- Build: at least one power (e.g., scan pulse revealing the map) with a visible cooldown.
- Test: use the power, confirm effect, confirm it's unavailable again until cooldown completes.

### Group J — Late-Game Tools & Progression Payoff

**Phase 46: Synthesizer**
- Goal: the late-game matter-synthesis tool.
- Build: buildable/usable once ancient-tech energy resources and a discovery gate are met; bad conversion rate by design; capped to basic materials; cooldown on top of cost.
- Test: use the synthesizer, confirm it consumes energy resources at the intended unfavorable rate, and confirm it can't produce rare/ancient-tech items.

**Phase 47: Key/unlock artifact payoffs**
- Goal: make found keys actually unlock things.
- Build: artifacts granting a mix of rewards — at least one new star-system route, one new blueprint, and one new rig/skill tier unlock, tied to specific finds.
- Test: recover a key artifact and confirm the specific unlock it grants actually becomes available.

---

## Open Questions

None blocking — both prior open questions are resolved (unlock currency: a mix; skill-leveling visualization: contextual readiness checklist at the cartography table). Multi-site attention-split remains deliberately deferred (see Dynamism Additions), not an open question needing an answer now.

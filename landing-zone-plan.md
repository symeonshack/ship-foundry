# Landing Zone — Complete Build Plan

This is the single, authoritative document for what to build right now. If anything in the older spec files (`ship-foundry-build-spec.md`, `mining-operations-build-spec.md`, `stage-0-foundry-establishment-template.md`, `operation-site-1-template.md`) conflicts with this document, this document wins. Those older files can stay in the project as historical reference but are no longer actively maintained — don't cross-reference them, everything needed is here.

## What this game is

A browser-based sci-fi building/exploration game. No combat, ever — no weapons, no killing, no being killed by anything. Danger comes entirely from an indifferent, genuinely life-threatening environment (real hazards, real stakes) and from non-lethal sabotage by AI agents (design not started yet — out of scope for now, see bottom).

## Tech stack & standing rules

- Stack: TypeScript, three.js, Vite.
- Tuning rule: every gameplay-affecting number (rates, costs, timers, capacities) lives in `src/config/balance.ts`, grouped by system — never hardcoded in game logic.
- Geometry: procedural/primitive shapes only for now — no invented detailed 3D assets.
- Development process: one feature at a time, in the order below. Confirm each one works before starting the next.
- If anything below is ambiguous, stop and ask — don't guess.

## Ship & companion basics (build first if not already done)

- Player can walk around inside the ship in first/third person.
- GERTY has a physical presence inside the ship (console/screen/drone), not a floating chat box.
- A physical star-map console inside the ship opens the star map when interacted with.
- Ship travel is real flight, not instant teleport, followed by an actual landing sequence.

## The game's current scope: Landing Zone

Player lands on the first planet with a ship needing repair, a couple of basic mining rigs, and nothing else. Goal: build a self-sufficient, hardened base and repair/upgrade the ship enough to go deeper into exploration. Nothing exotic exists yet, except one late-stage discovery event (see Mission Arc).

### World & map
- Large-scale map, both dimensions (single-site footprint AND overall exploration space): RTS-scale (AoE/Halo Wars-comparable), never default to minimum-viable size.
- Chunked/streamed terrain generation — prove small-scale first, then scale up, then populate points of interest, then performance pass, in that order.
- Real terrain variety (rocky outcrops, dust flats, buried ice pockets) so placement has spatial stakes.

### Core RTS interaction & economy (build before anything else below)
1. Selection + command control — click/drag-select, right-click to assign tasks.
2. Building placement — footprint + collision, no overlap, valid terrain only.
3. Build time + under-construction vulnerability — real construction time, reduced/scaling HP while incomplete.
4. Repair mechanic — damaged (not destroyed) structures can be repaired, cheaper/faster than rebuilding.
5. Gather-trip loop — real time per gather cycle: travel, extract, carry, return.
6. Resource-node depletion — nodes reduce yield and eventually run out, forcing relocation.
7. Rally points — default destination for new drones.
8. Prerequisite gating — explicit, enforced build-order dependencies with clear feedback when blocked.
9. Idle-unit detection — "find idle drone" prompt.
10. Lower priority: control groups, minimap, drone formation/pathfinding, garrison/shelter, formal objective/trigger framework.

### Resources
- Ore → metal, regolith → ceramic, water/ice → fuel (already implemented).
- High-grade ore deposit — richer, harder-to-reach, ordinary (not exotic) material; the mission's resource-quota target.
- Radioactive isotopes → nuclear generator fuel (starting rig's shielding is sufficient for this small deposit).
- Resources now build both ship parts and base structures.

### Structures
- Refinery, storage silo, power relay (caps simultaneous rigs/drones).
- Solar array (first power; day/night dip; dust accumulation degrades it over time, needs cleaning or replacement by nuclear generator).
- Nuclear generator (later power upgrade, fueled by isotopes; removes day/night dip and dust problem).
- Foundry — the ship-fabrication/repair facility. Must be earned partway through, not present at game start — restructure if the current build already has it on day one.
- Fabrication/production structure (produces worker + hauler drones).
- Greenhouse (see Food System).
- Launch pad — required before satellite launches; one launch at a time by default.

### Units
- Worker drones — mobile, cover scattered nodes a fixed rig can't.
- Hauler drones — automate hauling from rigs/silo to storage.

### Satellite array & GERTY
- Comms relay (required) — enables semi-autonomous base operation.
- Weather/hazard satellite (required) — upgrades warning from short/crude to full lead time.
- Survey satellite (required) — reveals other points of interest from orbit.
- Optional: navigation satellite, orbital power relay, orbital drydock, debris-monitoring satellite.
- GERTY is the "orbital assistant" — grounded physical presence, but functionally interprets/narrates satellite data (flags exposed structures during hazard warnings, surfaces survey/nav data). Role activates once comms relay is up.

### Food system (greenhouse)
- Food is its own separate depleting meter, distinct from any other resource.
- Loop: organic waste (passive habitat byproduct) + composted plant waste → fertilizer → combined with regolith at a soil processor → growing medium → planted crop (potatoes) → grows over tunable duration → harvest → food.
- Irrigation reuses the water/fuel resource (competes with fuel production, deliberately).
- Greenhouse is vulnerable to the same hazards as everything else and needs its own hardening.
- Seed-saving: split each harvest between eating and replanting.
- Light source trade-off: transparent panels (cheap, day/night-affected) vs. grow-lights (consistent, power cost).
- Oxygen supplementation: a well-run greenhouse slightly eases life-support drain.
- Contamination risk: tied to how well-built/powered the greenhouse is.
- Explicitly excluded: NPK fertilizer chemistry as separate tracked nutrients.

### Hazards & stakes
- Genuinely life-threatening — real stakes, separate from the no-combat rule.
- Ambient pressure on landing: life-support/fuel drains until solar array + refinery + storage are online; food drains separately and continuously.
- Day/night power cycle (covered above).
- Hazard-specific hardening: solar flare needs electromagnetic shielding; dust storm needs metal lock-down shielding — different buildables, can overlap.
- Tiered warning: crude sensors give short notice pre-satellite; full lead time post-satellite.
- Damage is real: unhardened structures take real damage, can be destroyed if hit repeatedly; rebuilding costs a premium over original build cost.
- Redundant backup systems (second solar array, backup power line) are a legitimate optional investment.
- Failure state, AoE-style: no mid-mission checkpoint/revert. Losses are real and permanent in the moment. Only true game-over is a rare, avoidable total-wipe (power + rigs + life-support all lost at once), resolved via ordinary save/load.

### Mission arc & completion
1. Land → first extraction → solar array → refinery/storage (life-support pressure ends here) → exposure window begins.
2. Greenhouse groundwork → build greenhouse, plant first crop.
3. Build the Foundry (earned, not given).
4. Nuclear generator (mine isotopes first).
5. High-grade ore extraction begins, accumulating toward resource quota.
6. Ship repair/upgrade at the Foundry.
7. Launch pad → comms relay (GERTY's orbital role activates) → weather satellite (hazard tension inverts from reactive to prepared) → survey satellite. Optional satellites any time after the pad exists.
8. Accidental discovery: triggered by the high-grade ore stockpile crossing its threshold (not a timer) — an anomalous find, cross-referenced by the survey satellite, points to a hidden location elsewhere in the system, unlocking the next site. (Narrative content for what's found lives outside this document.)
9. Mission complete when: resource quota met, ship repaired/upgraded, Foundry operational, all three required satellites in orbit, baseline structures standing with key ones hardened, no unresolved destroyed structures, greenhouse has completed one harvest, and the base can run semi-autonomously via the comms relay.

Two flare-and-storm hazard events should be scripted/guaranteed early so every player learns the "different hazards need different hardening" lesson firsthand. Additional hazards after that can be procedural.

## Explicitly not in scope right now

Don't build simplified versions of any of this:
- Asteroid mining / any two-tier site structure, skill trees or leveling systems
- AI agents of any kind and their conflict/sabotage mechanics — being developed separately
- Full open-world first-person walking — reserved for specific, contained key areas a future site might reveal- Additional operation sites beyond Landing Zone, additional goal types, ancient-tech resources, the synthesizer tool, the excavator, most "dynamism" polish items
- Real LLM-driven dialogue for GERTY (needs a backend, much later)

If you finish everything above and want more, ask — don't reach for anything in this list on your own.
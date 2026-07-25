# Landing Zone (formerly "Site 1 / Base 1") — Foundry Establishment (Template)

This is the true first stage of the game — before anything exotic. The player has discovered no anomalies yet; this is pure hard-sci-fi bootstrap: land with minimal equipment, earn a working starbase through your own effort, under real, genuinely life-threatening pressure from an indifferent universe. **Renamed to "Landing Zone" — use this name going forward; "Site 1" and "Base 1" refer to the same place in earlier notes.**

**This document supersedes and absorbs `operation-site-1-template.md`.** Landing Zone is the single location for this stage — there is no separate "Operation Site #1" you travel to.

**Note for Claude Code:** the current build already has a working Foundry available from day one. This stage requires restructuring that — the Foundry becomes something built and earned partway through this sequence, not something the player starts with. Gate/lock it accordingly.

**Tuning:** every numeric value below (drain rates, damage amounts, output levels, timers, resource quota amounts) belongs in the shared `src/config/balance.ts` file per the standing Tuning & Balance Configuration rule — not hardcoded. The specific minute counts used below (5 min detection, 20 min to harden) are illustrative defaults, not fixed requirements.

**On stakes — read this before the rest of the document:** the universe here is genuinely life-threatening. Environmental hazards are real danger, not just a resource inconvenience — this is a deliberate design choice, not an oversight. What stays completely off the table is combat: no battles, no firefights, no kinetic war with the AI agents. Conflict with agents (when that system is un-tabled later) is sabotage — their drones and the player's drones can disable/interfere with each other — never killing or being killed. The puzzle/misdirection shape of agent conflict is intentionally **not designed in this document** — that's being developed separately. This document only concerns environmental danger, which is a different category of threat from agents entirely.

---

## Starting Conditions

- Ship lands with minimal kit: no Foundry, no orbital assets, just a couple of basic mining rigs. The ship itself is in a state needing repair before it's ready to continue deeper into exploration afterward.
- A limited life-support/fuel reserve begins draining on landing. **This is a real countdown, not an ambient inconvenience** — full depletion is a genuine failure state (see Failure Consequences below). **Stop condition: the drain ends once the solar array (step 3) and refinery + storage (step 4) are all online** — that's the concrete, checkable milestone for "self-sufficient."

---

## Why Landing Zone Exists (mechanics framing — see story materials for narrative specifics)

The player's task here is to establish a main base in this system: gather enough resources to repair and expand the ship's capabilities, build up a hardened, self-sufficient base, and stock enough fuel to make the next leap deeper into exploration. Nothing exotic is present — this is ordinary (if resource-rich) geology and engineering. Late in the process, triggered by reaching a resource threshold while extracting the high-grade ore deposit, an accidental discovery event occurs — evidence is found suggesting there's more to this system than expected, pointing to a specific hidden location elsewhere in the system. This becomes the destination for Site 2 (a separate document, to be developed later). This document only needs the mechanical shape of that trigger — narrative content for what's actually found belongs in the story materials, not here.

---

## Persistent Stakes (run throughout the whole stage, not a one-off event)

### Ambient resource pressure
- The starting life-support/fuel cushion drains continuously until ground power + basic production are online. Full depletion before reaching self-sufficiency is a real failure state — see Failure Consequences.

### Day/night power cycle
- The solar array (the player's first power source) weakens or drops out during a "night"/eclipse period. This is a recurring capability dip, not a one-time event — it's what makes the nuclear generator upgrade a real fix to a felt problem, not just a bigger number.
- **Dust accumulation on panels** (a real Martian-rover problem) gradually cuts solar output over time, requiring periodic cleaning — an added, grounded reason the nuclear generator (or the optional orbital power relay, see Satellite Array below) is worth pursuing beyond just fixing the night dip.

### Persistent environmental threat (weather storms, solar flares — genuinely life-threatening)
- This reuses the same **environmental escalation** system defined in `mining-operations-build-spec.md`. Landing Zone is simply the first place the player encounters it, and it runs continuously for the whole stage — not a discrete timed session.
- **Different hazard types require different, specific hardening — not one generic upgrade.** Example scenario, illustrating the intended shape:
  - A solar flare is detected ~5 minutes into an exposure window, with a ~20 minute window to prepare. The correct response is building **electromagnetic shielding** on vulnerable structures.
  - While still dealing with the flare, a dust storm is separately detected incoming. The correct response is **metal lock-down shielding** — a different buildable, because it solves a different physical problem.
  - These can overlap — the player may be juggling prep for more than one hazard type at once. That's intentional; it's where the real tension lives.
- **Tiered warning, not a binary switch.** Before the weather/hazard satellite is built, primitive ground sensors still give short, scramble-worthy notice — not zero warning, just uncomfortably little. The satellite upgrades that to comfortable full lead time. This makes the satellite feel like a genuine upgrade to something that already exists, not a single unlock flipping warning from off to on.
- **Damage accumulates and can be fatal to the mission, not just costly.** A structure hit repeatedly without the correct hardening can be destroyed outright. If enough critical structures are lost simultaneously (e.g., power + refinery in the same event), that constitutes a real failure state — see Failure Consequences below, not just "rebuild it."
- **Rebuilding costs more than building.** A destroyed structure costs a premium to replace (cleanup/scrap overhead) rather than the original price — this makes hardening a genuine economic argument, not just a damage-avoidance one.
- **Redundant backup systems as insurance.** A second solar array, a backup power line, etc. — purely as insurance against losing the primary. A legitimate late-Landing-Zone investment choice (spend resources on redundancy vs. pushing toward mission-complete faster), not a required system.
- This same persistent, genuinely dangerous threat continues past Landing Zone — it isn't retired once the stage ends, it's the standing hazard system for the rest of the game.

### Failure Consequences — resolved, AoE-inspired
No special mid-mission checkpoint/revert system. Losses are real and permanent in the moment, same as Age of Empires: a structure destroyed by an unhardened hazard stays destroyed — rebuild it with whatever resources are left (at the rebuild-cost premium noted above), or play on weaker. The only genuine failure state is a rare, avoidable total-wipe scenario — losing power, all rigs, and life-support simultaneously with no recovery path. When that happens, it's an ordinary game over, resolved through normal save/load — not a bespoke mid-mission system. This is simpler to build and more honest to the stakes than a checkpoint-revert mechanic would have been.

### Terrain variety
Landing Zone's large footprint (see World Scale & Technical Foundation in `mining-operations-build-spec.md`) should include real terrain variety — rocky outcrops, dust flats, buried ice pockets — so structure placement carries genuine spatial stakes: exposure, resource proximity, and hardening priority all become real decisions rather than "click anywhere."

---

## Food Production (Greenhouse)

Real, grounded space agriculture — *The Martian* is the direct model, and Weir's actual research holds up well enough to build from directly. **Food is tracked as its own separate meter**, distinct from the life-support/fuel drain — the character starts with limited onboard food that depletes over time, and running out is its own genuine pressure, not folded into the existing countdown.

### Core loop: waste → fertilizer → soil → crops → food
- **Fertilizer source:** the habitat's own organic waste, recycled through life-support — a passive byproduct of having a functioning base, not a separately mined resource. Supplemented by composting inedible plant waste from harvests (stems, spoiled crop) back into the fertilizer supply — a genuine closed nutrient loop, not a one-way input.
- **Soil processor:** a structure that combines fertilizer + raw regolith into viable growing medium. Raw regolith alone is sterile — no organic matter, no nutrients — a real, grounded limitation, not an invented one.
- **Water:** reuses the existing water/ice resource for irrigation rather than inventing a new one — this deliberately competes with fuel production for the same supply, forcing prioritization instead of being a free input.
- **Greenhouse structure:** sealed, pressurized, real power draw. **Vulnerable to the same environmental hazards as every other structure** (see Persistent Environmental Threat above) and needs its own hazard-specific hardening — losing a harvest to an unhardened storm is a real, earned consequence, not an exception carved out for farming.
- **Crop cycle:** plant → grow over a tunable duration → harvest → yields food. Potatoes as the anchor crop — calorie-dense, genuinely one of the most efficient real crops for exactly this scenario.

### Additional depth
- **Seed-saving tension.** Each harvest must be split between eating now and holding back seed stock for the next planting cycle — a genuine hard choice (Watney's actual dilemma in the book), not a pure resource faucet.
- **Light source trade-off.** Transparent panels (cheap, natural light, but growth slows during the day/night power dip) vs. artificial grow-lights (consistent output, but a real ongoing power draw). Player choice, or an upgrade path from one to the other.
- **Oxygen supplementation.** A well-run greenhouse should slightly ease the life-support drain — real photosynthesis, plants consume CO2 and produce O2. Food stays its own separate meter per the decision above, but this gives the greenhouse a second reason to matter beyond calories alone.
- **Contamination risk.** A poorly-powered or unhardened greenhouse carries a small chance of crop failure requiring cleanup, tied directly to how well-built the structure is — earned consequence tied to investment, not a punishing random event.

### Explicitly excluded
- **NPK fertilizer chemistry** (nitrogen/phosphorus/potassium as separately tracked resources) — real agricultural science, but adds simulation depth without adding fun for a system meant to be one part of the game, not the star of it. Fertilizer is a single resource here, not a multi-nutrient chemistry system.

---

## Satellite Array & Orbital Systems

### Launch System
- The launch pad supports one satellite launch at a time by default — sequential, not parallel. Each launch costs fuel plus resources specific to that satellite's payload.
- A second/upgraded launch pad enabling parallel launches is a legitimate later investment, same "insurance/convenience" logic as the redundant backup systems above — not a required build.

### Satellite Types

**Required for Mission Complete:**
- **Comms relay** — establishes reliable contact. Also the explicit enabler of the base's semi-autonomous remote-supervision capability (see Mission Complete) — no relay, no remote supervision. This is why it matters beyond flavor.
- **Weather/hazard monitoring satellite** — upgrades hazard warning from primitive ground-sensor-tier (short, scramble-worthy notice) to comfortable full lead time. See Tiered Warning above.
- **Survey satellite** — reveals the planet's other points of interest from orbit, replacing what used to just be visible for free on the star map.

**Optional, valuable investments (not required for Mission Complete):**
- **Navigation/positioning satellite** — improves landing accuracy and scan precision for future expeditions.
- **Orbital power relay** — collects solar energy from an orbit largely unaffected by the planet's day/night cycle (a real orbital-mechanics option — certain orbits stay in near-constant sunlight) and beams it down. A second path to solving the day/night power dip, alongside the nuclear generator.
- **Orbital drydock/repair module** — lets the ship be repaired/refueled without landing, supplementing Foundry-based repair.
- **Debris/traffic monitoring satellite** — protects the rest of the satellite array from orbital debris hazards; the redundant-backup-systems principle applied specifically to orbital assets.

### GERTY — Orbital Assistant
GERTY's physical presence is on the ground (ship/habitat interior, per the master spec), but its functional role here is orbital: interfacing with and interpreting satellite data on the player's behalf, rather than being a passive chat box.
- During a hazard warning, GERTY flags what's still exposed ("3 structures lack EM shielding, flare in 12 minutes") — information delivered in-character, not a bare UI alert.
- Survey satellite reveals and navigation data are narrated/surfaced through GERTY rather than a bare map update.
- This role only exists once the comms relay is up — before that, GERTY has no orbital data to work with, which is a further reason that satellite matters early, not just for the flavor of "establishing contact."

---

1. **Land.** Minimal kit; life-support/fuel cushion starts draining; a couple of basic mining rigs are the only equipment; ship needs repair; onboard food supply starts depleting too.
2. **First extraction.** Deploy the rigs; gather initial ore/regolith (and a small local isotope deposit, if present).
3. **Basic power — solar array.** Nothing else runs without it. Day/night cycle begins affecting output from here on.
4. **Refinery + storage.** Process raw material into usable stock; something to hold it. Exposed stockpiles are now vulnerable to weather damage.
5. **Exposure window begins.** From here until the weather satellite is up, structures and stockpiles are vulnerable to unpredicted, genuinely dangerous storm/flare events — this is the stage's real tension stretch.
6. **Greenhouse groundwork.** Organic waste recycling comes online passively once the habitat is functioning; build the soil processor (regolith + fertilizer → growing medium).
7. **Build the Greenhouse and plant the first crop**, using the ship's limited seed stock. The onboard food meter is under real pressure until harvest — this shouldn't be put off too long. First harvest completes after the crop's grow cycle (tunable), independent of the rest of this sequence's exact ordering.
8. **Build the Foundry.** The ship-fabrication facility, now earned. Also usable to begin ship repair/upgrade work. Also a potential weather-damage target while unprotected.
9. **Power upgrade — nuclear generator.** Mine local isotopes, build the generator, raise the power ceiling and reduce the day/night dip's impact. The starting mining rig's basic shielding is sufficient for this stage's small local isotope deposit specifically.
10. **High-grade ore extraction begins.** A richer, harder-to-reach vein of ordinary material (not exotic) becomes minable once the player has the capability to reach it — this is the resource that counts toward the "mission complete" quota and feeds top-tier ship/base parts.
11. **Ship repair/upgrade.** Using resources (including high-grade ore) at the Foundry, bring the ship to a state ready for deeper exploration.
12. **Launch pad.** The prerequisite for any orbital launch — see Satellite Array & Orbital Systems above for launch mechanics.
13. **Launch — comms relay.** First orbital asset; establishes reliable contact and brings GERTY's orbital-assistant role online.
14. **Launch — weather/hazard monitoring satellite.** The payoff moment: upgrades hazard warning from primitive-sensor tier to full comfortable lead time.
15. **Launch — survey satellite.** Reveals the planet's other points of interest from orbit.
15a. **Optional satellites.** Navigation, orbital power relay, orbital drydock, debris monitoring — buildable any time after the launch pad exists, not required for Mission Complete, but real investment options (see Satellite Array & Orbital Systems above).
16. **Accidental discovery event.** Triggered by reaching the high-grade ore resource threshold — an anomalous find surfaces, pointing to a hidden location elsewhere in the system. This unlocks Site 2 on the star map (content and narrative specifics live in story materials, not here).
17. **Mission complete.** See Definition below.
18. **Transition.** With Landing Zone established and largely self-sufficient, the player is free to depart for Site 2 (or elsewhere), returning to Landing Zone between expeditions as a home base.

---

## Definition of "Mission Complete"

- A target quantity of resources gathered, including the high-grade ore deposit (exact amounts live in `balance.ts`).
- Ship repaired and/or upgraded to a state ready for deeper exploration.
- Foundry operational.
- Comms relay, weather satellite, and survey satellite all in orbit.
- Baseline ground structures standing: power, refinery, storage, habitat — with hazard-specific hardening (EM shielding, metal lock-down, etc.) actually applied to at least the Foundry and one other key structure, not just existing.
- No unresolved destroyed structures.
- **Greenhouse operational with at least one completed harvest cycle** — food security established, not just a one-time onboard supply.
- **Base can run semi-autonomously with remote supervision** — enabled specifically by the comms relay (see Satellite Array & Orbital Systems); rigs/drones continue operating without constant direct control, so the player can leave for Site 2 (or elsewhere) and return to a functioning home base rather than an abandoned one.

## Explicitly Out of Scope for Landing Zone

- Anything exotic (ancient-tech resources, synthesizer) — none of that exists yet at this point in the game, aside from the one accidental discovery event that triggers Site 2 (which is itself not exotic material, just evidence pointing elsewhere).
- Full Operation Site mechanics as originally designed for later sites (unit roster variety beyond worker/hauler, agent threats, most goal types) — those remain tabled per `mining-operations-build-spec.md`'s Current Round Scope and apply to future sites, not this one.
- **Agent conflict/puzzle design** — explicitly not designed here or now; being developed separately. This document only establishes that agent conflict, whenever it returns, is sabotage-based and never lethal in either direction — nothing about how that actually plays out.
- **Vehicle bay and a dedicated ground comms array** — both appeared in early brainstorming for this stage but are deliberately deferred, not part of Landing Zone's core sequence.
- **NPK fertilizer chemistry** (nitrogen/phosphorus/potassium as separately tracked resources) — fertilizer is a single resource in this game's design, not a multi-nutrient simulation.

## Relationship to the Mining & Operations Spec

Landing Zone depends on **Group A (World Foundation, Phases 1–4)** from `mining-operations-build-spec.md` already being complete — the chunked/streamed terrain system and world-scale foundation are shared infrastructure, not something this stage builds separately. Sequence: Group A (world foundation) → Landing Zone (this document) → Site 2 and onward (to be developed later, triggered by this document's discovery event). The [ACTIVE] items in `mining-operations-build-spec.md`'s Resources/Structures/Unit Roster/Goal Type/Threat Model sections describe Landing Zone's content directly — this document is the sequencing and stakes layer on top of that spec.

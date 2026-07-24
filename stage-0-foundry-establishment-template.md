# Stage 0 — Foundry Establishment (Template)

This is the true first stage of the game — before Operation Site #1, before anything exotic. The player has discovered no anomalies yet; this is pure hard-sci-fi bootstrap: land with minimal equipment, earn a working starbase through your own effort, under real (but not lethal) pressure the whole way.

**Note for Claude Code:** the current build already has a working Foundry available from day one. This stage requires restructuring that — the Foundry becomes something built and earned partway through this sequence, not something the player starts with. Gate/lock it accordingly.

**Tuning:** every numeric value below (drain rates, damage amounts, output levels, timers) belongs in the shared `src/config/balance.ts` file per the standing Tuning & Balance Configuration rule — not hardcoded.

---

## Starting Conditions

- Ship lands with minimal kit: no Foundry, no orbital assets, just a couple of basic mining rigs.
- A limited life-support/fuel reserve begins draining on landing — an ambient pressure, not a hard countdown-to-death timer. **Stop condition: the drain ends once the solar array (step 3) and refinery + storage (step 4) are all online** — that's the concrete, checkable milestone for "self-sufficient," not a vague state.

---

## Persistent Stakes (run throughout the whole stage, not a one-off event)

### Ambient resource pressure
- The starting life-support/fuel cushion drains continuously until ground power + basic production are online. Getting self-sufficient in time is the stage's core early tension.

### Day/night power cycle
- The solar array (the player's first power source) weakens or drops out during a "night"/eclipse period. This is a recurring capability dip, not a one-time event — it's what makes the nuclear generator upgrade a real fix to a felt problem, not just a bigger number.

### Persistent environmental threat (weather storms, solar flares)
- This reuses the same **environmental escalation** system already defined for operation sites in `mining-operations-build-spec.md` — not a separate system. Stage 0 is simply the first place the player encounters it.
- **Before the weather/hazard satellite is built:** events arrive with little to no warning. An unprotected structure or exposed stockpile hit by a storm or flare takes real damage.
- **Damage accumulates.** A structure that takes repeated unaddressed hits can be destroyed outright and must be rebuilt — a costly, real setback, but never a death or a lost save.
- **After the weather/hazard satellite is built (see Sequence — this is a Stage 0 build goal, not a later unlock):** events come with real advance warning. Warning unlocks the ability to build a **hardening upgrade** on a structure — a buildable armor/shielding tier, same pattern as any other buildable in this game (resources in, capability out), rather than a temporary action or a passive stat. A hardened structure takes sharply reduced or no damage from environmental events. This is the stage's central payoff moment — everything that hurt earlier stops hurting once this is built.
- This same persistent threat continues past Stage 0 — it isn't retired once the stage ends, it's the standing hazard system for the rest of the game.

---

## Sequence

1. **Land.** Minimal kit; life-support/fuel cushion starts draining; a couple of basic mining rigs are the only equipment.
2. **First extraction.** Deploy the rigs; gather initial ore/regolith (and a small local isotope deposit, if present).
3. **Basic power — solar array.** Nothing else runs without it. Day/night cycle begins affecting output from here on.
4. **Refinery + storage.** Process raw material into usable stock; something to hold it. Exposed stockpiles are now vulnerable to weather damage.
5. **Exposure window begins.** From here until the weather satellite is up, structures and stockpiles are vulnerable to unpredicted storm/flare events — this is the stage's real tension stretch.
6. **Build the Foundry.** The ship-fabrication facility, now earned. Also a potential weather-damage target while unprotected.
7. **Power upgrade — nuclear generator.** Mine local isotopes, build the generator, raise the power ceiling and reduce the day/night dip's impact. The starting mining rig's basic shielding is sufficient for this stage's small local isotope deposit specifically — dedicated shielding upgrades for richer, more hazardous isotope deposits are an Operation Site-tier concern, not a Stage 0 blocker.
8. **Launch pad.** The prerequisite for any orbital launch.
9. **Launch — comms relay.** First orbital asset; establishes reliable contact.
10. **Launch — weather/hazard monitoring satellite.** The payoff moment: from here, environmental events come with real warning, and the player can harden/prepare instead of just absorbing damage.
11. **Launch — survey satellite.** Reveals the planet's other points of interest from orbit, replacing what used to just be visible for free on the star map.
12. **Starbase established.** Foundry + comms relay + weather satellite + survey satellite + baseline ground structures, having survived the exposure window = stage complete.
13. **Transition.** With the planet now partially mapped, the player moves out to what the survey satellite revealed — this is where Operation Site #1 and onward begin.

---

## Definition of "Stage Complete"

- Foundry operational
- Comms relay, weather satellite, and survey satellite all in orbit
- Baseline ground structures standing (power, refinery, storage, habitat)
- No unresolved destroyed structures

## Explicitly Out of Scope for Stage 0

- Anything exotic (rare crystals, ancient-tech resources, synthesizer) — none of that exists yet at this point in the game.
- Operation Site mechanics (goal types, unit roster, agent threats) — those begin after Stage 0 ends.
- **Vehicle bay and a dedicated ground comms array** — both appeared in early brainstorming for this stage but are deliberately deferred, not part of Stage 0's core sequence. The orbital comms relay (step 9) covers Stage 0's communication need; ground vehicles aren't necessary until on-foot exploration begins post-Stage-0. Not an oversight — explicitly cut for this stage's scope.

## Relationship to the Mining & Operations Spec

Stage 0 depends on **Group A (World Foundation, Phases 1–4)** from `mining-operations-build-spec.md` already being complete — the chunked/streamed terrain system and world-scale foundation are shared infrastructure, not something this stage builds separately. Sequence: Group A (world foundation) → Stage 0 (this document, ground/orbital establishment) → Group B onward in the mining spec (progression systems, resources, operation sites, etc.), starting with Operation Site #1.

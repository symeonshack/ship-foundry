# Landing Zone — Full Gameplay Script

A beat-by-beat playthrough of the Landing Zone campaign stage, from touchdown to departure. This is a **design/narrative script**, not a build spec — it shows how the mechanics in `stage-0-foundry-establishment-template.md` actually play out as a lived experience, with approximate timelines, hazard beats, goals, and GERTY dialogue.

**All timings are illustrative** (target values for `balance.ts`), assuming a roughly 90–120 minute full playthrough for an unhurried first-time player. A confident replay could compress to ~60. GERTY lines are placeholder voice — tone-correct, not final script. Nothing here contradicts the "no combat / genuinely life-threatening universe" rules; all danger is environmental.

**GERTY voice note:** dry, understated, competent, quietly caring but never effusive. Helpful within limits. Occasionally, almost imperceptibly, evasive on questions about the wider mission — never enough to alarm, just enough that an attentive player might notice something's held back. (The withholding never pays off in this stage — it's a seed for later. See story materials.)

---

## ACT I — TOUCHDOWN & SURVIVAL (≈ 0:00–0:25)

### Beat 1 — Cold Open / Landing (0:00–0:02)
The ship comes down hard but intact on the landing zone. Screen settles from descent shake into the top-down base view. Two basic mining rigs sit crated beside the lander. No foundry, no power, nothing built.

Three meters are visible from the first frame:
- **Life-support reserve** — draining slowly. A soft countdown, not alarmist yet.
- **Fuel reserve** — low; this is what got spent on landing.
- **Food supply** — depleting slowly; weeks of rations, not months.

> **GERTY:** "We're down. Structurally sound — better than the models predicted. I've got life-support running on reserve. That reserve is not a long-term plan. Let's get you self-sufficient before it becomes an interesting problem."

**Goal surfaced:** *Establish power and production before reserves run out.*

### Beat 2 — First Extraction (0:02–0:07)
Tutorial-by-doing: player deploys the two mining rigs onto the nearest ore and regolith nodes. First raw resources begin accumulating. GERTY explains extraction and hauling in passing, not as a wall of text.

> **GERTY:** "Ore for metal, regolith for ceramic. Unglamorous, but everything we build starts here. I'd get a second rig on that regolith seam — we'll need more ceramic than you'd think."

**Hazard status:** none yet. Grace period.

### Beat 3 — Basic Power: Solar Array (0:07–0:12)
Enough metal/ceramic refined (by hand-hauling to the lander's minimal onboard processor) to build the **solar array**. The moment it powers on, the **day/night cycle** becomes visible — a daylight indicator begins its slow arc.

> **GERTY:** "Power. Good. Fair warning — that array only works when the sun's up, and this planet's night is not short. We'll want something better eventually. For now, ration your building around daylight."

**New mechanic live:** day/night power dip. **Dust** begins slowly accumulating on the panel (a background efficiency creep the player won't notice for a while).

### Beat 4 — Refinery + Storage → Self-Sufficiency (0:12–0:18)
Player builds the **refinery** (faster, automated processing) and **storage silo**. The instant both are online alongside the solar array, the **life-support drain halts** — the first major relief beat.

> **GERTY:** "Life-support's holding steady — you're off the reserve clock. Take a breath. ...Briefly. You've got exposed stockpiles now, and this planet has weather."

**Goal cleared:** *Self-sufficiency established.* **Failure pressure (life-support countdown) lifted.**

### Beat 5 — Exposure Window Opens (0:18–0:25)
The safety of the grace period ends. GERTY notes the base has no hazard warning capability yet — only crude ground sensors. This is the **tiered-warning "low tier"**: short, scramble-worthy notice, not zero.

> **GERTY:** "Ground sensors are twitchy but they're all we've got until we're in orbit. If they flag something, you won't get much lead time. Build like it's coming, because it is."

**First real tension stretch begins.**

---

## ACT II — THE FIRST STORM & THE GREENHOUSE (≈ 0:25–0:50)

### Beat 6 — Greenhouse Groundwork (0:25–0:30)
With the habitat functioning, **organic waste recycling** comes online passively (fertilizer starts trickling in). Player builds the **soil processor** (regolith + fertilizer → growing medium). The **food meter** is now visibly a mid-term concern — not critical, but the ration math is getting real.

> **GERTY:** "Your rations are finite and I'd rather not watch you find out exactly how finite. Regolith's sterile — dead dirt — but run it through the soil processor with recycled organics and we can grow in it. It worked for people before us, in worse spots."

### Beat 7 — FIRST HAZARD: Solar Flare (0:30–0:38) ⚠️
**The signature Act II beat.** ~5 minutes into serious building, the ground sensors flag an incoming **solar flare**. A warning banner appears with a countdown (~20 min, but on the *low-warning tier* it may present as less certain / a wider error bar).

> **GERTY:** "Flare inbound. Big one. Electromagnetic — it'll fry unshielded electronics, which right now is all of them. You need **EM shielding** on anything you can't afford to lose. Prioritize. You will not have time for everything."

**The decision:** player can't shield everything in time. They must triage — protect the refinery and power, or the foundry-in-progress, or the fresh greenhouse? Whatever's left unshielded takes real damage when the flare hits.

**Impact (≈0:38):** flare lands. Shielded structures ride it out. Unshielded ones take damage — possibly destroyed if already weakened. First real loss, first real consequence.

> **GERTY (post-flare, if losses):** "We took hits. Rebuildable — but it'll cost more to put back up than it did the first time. Cleanup always does. ...Noted for next time: shielding is cheaper than rebuilding."

### Beat 8 — Build the Foundry (0:38–0:44)
If it survived, the **Foundry** comes online (or is rebuilt). This is the stage's mechanical centerpiece — ship fabrication and repair now possible. A genuine milestone; the base starts feeling like a base.

> **GERTY:** "The Foundry's live. That's the one that matters — from here we can actually build our way forward instead of just surviving. Feels different, doesn't it."

### Beat 9 — Plant the First Crop (0:44–0:48)
Player builds the **Greenhouse**, chooses a **light source** (cheap transparent panels vs. power-hungry grow-lights — a real trade-off given the night dip), and plants the first potato crop from limited **seed stock**. A grow-cycle timer starts (runs in the background ~15–20 min).

> **GERTY:** "Seed stock's limited, so here's the discipline: when this harvests, you eat some and you *replant* some. Eat it all and you've got one good meal and no future. I'll remind you. You'll ignore me. Then you'll listen."

### Beat 10 — SECOND HAZARD: Dust Storm (0:48–0:50) ⚠️
Before the player's fully recovered from the flare, ground sensors flag an incoming **dust storm** — a *different* hazard needing *different* hardening: **metal lock-down shielding**, not EM. Reinforces that hazards aren't interchangeable.

> **GERTY:** "Different problem this time. Dust storm — abrasive, it'll scour and clog anything exposed. EM shielding won't help; you need physical **lock-down plating**. And it's going to bury the solar array, so expect a power dip right when you'd least like one."

**Impact:** dust storm hits. Lock-down-protected structures survive; the solar array's output craters temporarily (dust accumulation spikes), forcing the player to operate lean until they can clean it or lean on other power. A taste of *why the nuclear generator matters.*

---

## ACT III — POWER, ORE & GOING ORBITAL (≈ 0:50–1:15)

### Beat 11 — Nuclear Generator (0:50–0:58)
Player mines the small local **isotope** deposit (starter rig shielding suffices) and builds the **nuclear generator**. The day/night dip stops being crippling; dust no longer means brownouts. Major capability leap.

> **GERTY:** "Steady power, day or night, storm or clear. This is the upgrade that turns 'surviving here' into 'living here.' Also — no more nursing the solar panels through every dust cloud. You've earned this one."

### Beat 12 — High-Grade Ore (0:58–1:05)
With better power and equipment, the player can now reach the **high-grade ore deposit** — the richer, harder-to-reach vein (ordinary material, nothing exotic). This is the resource that feeds ship repair and counts toward mission-complete quota. Extraction begins accumulating toward the threshold.

> **GERTY:** "Now that's a vein worth the trouble. Dense, deep, and exactly what we need to get the ship spaceworthy again. Get the haulers on it — this is the stockpile that gets us off this rock."

**Optional:** player may build **worker drones** (scattered node coverage) and **hauler drones** (automated hauling) from the fabrication structure here to keep the ore loop flowing under the ongoing hazard cadence.

### Beat 13 — Ship Repair/Upgrade (1:05–1:10)
At the Foundry, the player spends resources (including high-grade ore) to **repair and upgrade the ship** toward spaceworthiness for deeper exploration. Tangible progress toward the "leave" goal.

> **GERTY:** "Hull integrity coming back up. Propulsion's next. I won't call it pretty, but it'll hold — which, out here, is the only review that matters."

### Beat 14 — Launch Pad + Comms Relay (1:10–1:15)
Player builds the **launch pad**, then launches the **comms relay** — the first orbital asset. The instant it's up, **GERTY's orbital-assistant role activates**: it can now interpret orbital data, and **remote supervision** of the base becomes possible.

> **GERTY:** "Relay's in orbit. I can see properly now — and more to the point, I can keep an eye on things here while you're elsewhere. That'll matter sooner than you think. ...There. Contact re-established. Everything's... as expected."
> *(A beat of very slight hesitation on that last line — nothing a player must catch. A seed.)*

---

## ACT IV — SECURING THE SKY & THE DISCOVERY (≈ 1:15–1:35)

### Beat 15 — Weather Satellite (1:15–1:20) — THE PAYOFF
Player launches the **weather/hazard monitoring satellite**. Hazard warning jumps from the anxious low-tier to **full comfortable lead time**. The entire back-foot tension of Acts II–III inverts: now the player *sees hazards coming* and preps calmly.

> **GERTY:** "Now *that* is a view. Full weather tracking — I can give you real warning now, not sensor guesswork. Flares, storms, the lot, with time to shield properly. You've stopped reacting and started planning. That's the whole game, out here."

**This is the emotional turn of the stage — mastery over the environment that was hunting the base.**

### Beat 16 — Survey Satellite + Optional Array (1:20–1:28)
Player launches the **survey satellite**, revealing the planet's other points of interest from orbit (replacing free star-map visibility). Optionally builds **navigation / orbital power relay / orbital drydock / debris monitoring** satellites — real investments, none required.

> **GERTY:** "Survey's mapping the surface. Getting a picture of what else is out here — resource sites, formations, a few things I can't classify yet. I'll flag anything that stands out."

### Beat 17 — THE ACCIDENTAL DISCOVERY (1:28–1:33) ★
**The stage's story pivot.** Triggered by the high-grade ore stockpile crossing its threshold (i.e., the player has earned it through play, not a scripted cutscene on a timer), extraction breaks into something that shouldn't be there. The survey satellite cross-references it. An anomalous find surfaces — evidence that there is something else in this system, exactly what the mission was quietly hoping (or fearing) to find. It points to a specific hidden location elsewhere in the system: **Site 2**.

> **GERTY:** "...Hold on. That reading from the deep ore seam — cross-referencing it with orbital survey. That's not geology. That's *structured*. Someone — something — put it there."
> *(pause)*
> **GERTY:** "It's pointing somewhere. There's a location in this system the data keeps circling back to. I think... I think we found what we came looking for. Or it found us."
> *(A flatter, more careful beat here — GERTY knows more than it's saying about what this means, and for the first time the player might feel the withholding rather than just intellectually note it. Not resolved here. See story materials.)*

**Site 2 unlocks on the star map** (accessible via the cartography table).

### Beat 18 — Mission Complete Check (1:33–1:35)
The game confirms the full **Mission Complete** checklist:
- [x] High-grade ore quota met
- [x] Ship repaired/upgraded for deeper travel
- [x] Foundry operational
- [x] Comms relay + weather + survey satellites in orbit
- [x] Baseline ground structures standing, key ones hazard-hardened
- [x] No unresolved destroyed structures
- [x] Greenhouse operational with ≥1 completed harvest
- [x] Base runs semi-autonomously (comms-relay-enabled)

> **GERTY:** "Base is self-sustaining. It'll keep itself running while we're gone — I'll supervise from here and from orbit. Ship's ready. And we finally have somewhere to go. Whenever you're ready to leave... we leave."

---

## ACT V — DEPARTURE / TRANSITION (≈ 1:35+)

### Beat 19 — Home Base Established
Landing Zone shifts from "the level you're surviving" to "home." The player can now depart for Site 2, and **return here between expeditions** — restocking, repairing, checking on the semi-autonomous operation. The place they nearly died establishing becomes the place they come back to.

> **GERTY:** "For what it's worth — you built something that lasts, here. Not many would have. ...The place we're going next won't be like this one. I don't know exactly how. But we should go carefully."

**Stage ends. Site 2 begins (separate document, to be developed).**

---

## Hazard & Timeline Summary (quick-reference)

| Time | Beat | Hazard / Pressure | Correct Response |
|------|------|-------------------|------------------|
| 0:00 | Landing | Life-support/fuel/food all draining | Get power + production online |
| 0:07 | Solar array | Day/night dip begins; dust creep starts | Ration around daylight |
| 0:18 | Self-sufficiency | Life-support drain HALTS | (relief beat) |
| 0:18 | Exposure window | Low-tier warning only | Build defensively |
| 0:30 | **Solar flare** ⚠️ | EM damage to electronics | EM shielding; triage |
| 0:44 | First crop | Food meter pressure | Plant + seed-save discipline |
| 0:48 | **Dust storm** ⚠️ | Abrasion + solar blackout | Metal lock-down; ride out power dip |
| 0:50 | Nuclear generator | (resolves day/night + dust power problems) | Mine isotopes, build it |
| 0:58 | High-grade ore | (none — reward beat) | Extract toward quota |
| 1:15 | **Weather satellite** | (inverts all hazard tension) | Full warning unlocked |
| 1:28 | **Discovery** ★ | (story pivot, not a hazard) | Site 2 unlocks |
| 1:35 | Mission complete | — | Depart / return home later |

**Ongoing throughout Acts II–IV:** additional random flares/storms on the hazard cadence, escalating the juggle; food harvest cycles requiring replant discipline; dust accumulation requiring occasional panel cleaning until the nuclear generator; the day/night cycle shaping when it's safe to over-extend on power.

---

## Design Notes (for Claude Code — how to read this script)

- This script is the **intended felt experience**, not a rigid state machine. The *ordering* of core milestones (power → production → foundry → nuclear → ore → orbital) is load-bearing; the *exact timings and which specific hazard lands when* are tunable and can be partially randomized within the act structure.
- The **two named hazards (flare in Act II, dust storm right after)** should be scripted/guaranteed for a first playthrough so every player experiences the "different hazards need different hardening" lesson. Additional hazards beyond those can be procedural.
- The **discovery (Beat 17) is gated on the ore quota**, not a timer — it must feel earned, and it doubles as the mission-complete trigger's story half.
- GERTY's faint evasiveness (Beats 14, 17, 19) is a **seed only** — do not resolve or explain it in this stage. It exists to be paid off much later.
- Everything here honors the standing rules: no combat, genuinely life-threatening environment, AoE-style permanent-but-rebuildable losses, all tunable values in `balance.ts`.

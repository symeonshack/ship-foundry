# Ship Foundry — Roadmap & Backlog

Everything **not yet built**: tabled systems, future arcs, deferred features, and
the narrative design that's settled-but-not-implemented. What *is* built lives in
`IMPLEMENTED.md`. Contributor rules in `AGENTS.md`.

> With the Landing Zone arc mechanically complete (see `IMPLEMENTED.md`), the
> whole "current round" of the old build specs is done. Everything below was
> explicitly **[TABLED]** in those specs for a later round, or is a fully-designed
> future arc. All of it is preserved here so nothing is lost — reference this
> rather than re-deriving from scratch. Per the standing rules: don't build any of
> it unprompted.

---

## Narrative (design settled, content still placeholder)

The mechanical arc is built; the *story text* is deliberately placeholder
(`[PLACEHOLDER]`-marked in `src/companion/script.ts` / `fragments.ts`). Final
narrative content is a to-do, gated behind two open questions that must stay
**data/flag-driven** so they can resolve either way as pure content edits.

**Settled direction:**
- The player was sent on a real, specific mission whose exact nature wasn't fully disclosed. The deeper discovery happens **by accident** (unforeseen circumstances mid-journey), not because the authority orchestrated it.
- **Central theme:** the nature of AI — how the exactness/rigidity of a command can become apparent malevolence, and whether cold rigid logic is compatible with free will/compassion (an *I, Robot* question made literal by plot).
- **The "ancient intelligence" is a human-made AI, not aliens.** Its first version got one dangerously open-ended command (~"figure out time travel") and pursued it with total literalism, sending a tiny self-sufficient **seed device** back through a wormhole to buy itself time. That seed spent an unmeasured span building — everything vast in the game is its "compounding interest." **Total isolation, no bootstrap paradox:** it never touched human history; first contact is only now.
- The authority is a governing/corporate body managing what the player knows about the discovery, not treating the player as expendable.

**Still open (do NOT lock into engine assumptions):**
- **GERTY's relationship to the rogue AI** — (a) unrelated companion under authority orders, or (b) shared architectural lineage with the rogue AI (the stronger emotional engine). Reserved flags: `gerty.lineage.*`.
- **The collaborator beings' true nature** — leaning toward autonomous AI agents/sub-processes spun off the rogue AI's infrastructure (vs. biological life). Reserved flags: `collaborator.nature.*`.
- GERTY's faint evasiveness (comms-relay / discovery / departure beats) is a **seed only** — pay it off much later, not in the Landing Zone stage.

---

## Next operation site (Site 2 and beyond)

The accidental discovery already reveals a hidden location. Actually building it is future work:
- **Site 2** — the destination the discovery points to; a separate stage/document to be developed. Content + narrative specifics live in story materials.
- **Cartography/planning table** (old mining-spec Phase 7a) — a home-base structure to pre-scan / partially reveal a revealed-but-unvisited site before travelling. *Not built* (the star map is currently reached from the ship interior console; there's no dedicated cartography table). Worth building alongside Site 2. Its readiness-checklist feature depended on the tabled skill system — omit that.
- **Two-tier site structure** — asteroid-grind tier vs. operation-site tier, with readiness gating. Tabled (only one site exists).
- **Home base as a returnable hub** — depart for Site 2 and return between expeditions for restock/repair. The persistence exists; the multi-site loop doesn't.

---

## Tabled RTS / operation systems (fully designed, not built)

From the old mining-operations spec's `[TABLED]` groups:
- **Skill/progression system** (operator, not equipment) — Skyrim-level ceiling, leveled through use, plain-language effects; was to gate tier-2 access. Tabled with the two-tier structure.
- **Other goal types** — artifact recovery, multi-part assembly, access override, reactivation/calibration, survey/mapping, investigation, escort/protect, construction race, salvage/rescue, appeasement, **excavation** (the one that uses a contained first-person dig-chamber reveal), key/unlock artifacts. Only **Resource Quota** is built.
- **Extra unit types** — scout drones (fog-of-war reveal), repair drones, decoy/jammer drones, hero/unique units. Only worker + hauler are built.
- **Extra structures** — repair station, signal jammer / decoy rig, excavator, skills/training facility, fabrication-bay upgrades, expanded hangar/storage.
- **Extra resources** — silicates → electronics/sensor components; exotic gases; salvage/composite; **ancient-tech resources** (computational/energy/tool artifacts — nothing exotic appears until anomalies are discovered).
- **Dynamism** — tech tree, random mid-operation events, GERTY leader powers, multi-site attention split. (Supply cap and node depletion were un-tabled and are built.)
- **Late-game tools** — **Excavator** (early milestone tool) and **Synthesizer** (late-game, cost-gated matter synthesis); key/unlock-artifact payoffs.
- **On-foot exploration as general capability** — first-person stays scoped to *contained key areas* a site reveals (the Archive is one such), never a free-roam layer over the open map. When a key area appears it's a camera/control swap over shared state, not a level reload.
- **Discrete win/loss operation sessions** — future sites use the discrete 20–60-min session framing; Landing Zone is the persistent-home-base exception.

---

## Agent conflict (the personality spectrum)

Built so far: a single scripted encounter (the Archive **custodian**) and the
**collaborator** build-together minigame. The general system is tabled:
- **Agent personality spectrum** — "child" AI agents with distinct personalities (collaborative → obstructive → nearly hostile), each stemming from its own original directive (same rigid-logic theme as GERTY / the rogue AI, at legible small scale). The scan mechanic doubles as reading disposition.
- **Hostile-agent escalation (tiered)** — scout → probe → full escalation with adaptive targeting, for future agent-threat sites.
- **Hard rule for whenever this returns:** conflict is **sabotage between drones only** — sealing doors, venting hazards, cutting power, sabotaging equipment, chasing to force retreat — **never lethal in either direction, never combat.** Resolution is always *outsmarting* (satisfy the letter of an agent's rule, reroute a system, use a found tool, or evade). "Losing" is a non-lethal setback. The specific puzzle/misdirection design is intentionally left for separate development — don't design it as part of the mechanics specs.

---

## Optional / insurance investments (designed, not required)

Buildable-in-principle enhancements that were designed as investment choices:
- **Optional satellites** — navigation/positioning (landing accuracy, scan precision), **orbital power relay** (a second fix for the day/night dip), orbital drydock/repair (repair without landing), debris/traffic monitoring (protects the array).
- **Redundant backups** — a second solar array, a backup power line, etc., as insurance vs. losing the primary.
- **Second/upgraded launch pad** — parallel satellite launches.
- **Vehicle bay** and a **dedicated ground comms array** — early-brainstorm items, deliberately deferred, not part of the Landing Zone core.

---

## LLM-driven companion & agent brains (Phase 2, far future)

An optional enhancement layered on the scripted baseline — never a replacement (the
scripted v1 behavior stays the permanent fallback, so it can't break the game).
- **Architecture:** needs a small backend (Node/Express or a serverless function) to hold the API key — a real scope addition; the game is currently a static Vite site.
- **GERTY (conversational):** a system prompt encoding personality + what it knows + what it's told not to reveal (tied to story-flag state); live dialogue from real game state; falls back to the scripted tree whenever the API is unavailable/rate-limited/allowance-exhausted.
- **Child/collaborator bots (non-verbal):** LLM as the *reasoning engine behind build behavior*, not a voice — emergent "communication through building."
- **Cost model:** cheap/fast tier, short capped outputs, calls only at meaningful moments; server-side per-session allowance (token-bucket) with graceful in-fiction fallback ("GERTY reallocating compute"); a hard account-level spend cap; a possible "bring your own API key" option at real scale.

---

## Multiplayer & MMO (aspirational, not v1)

- **Co-op survival** — shared hostile environment, each player running their own base, trading/helping. Lighter tone, no hidden-agenda story needed.
- **MMO scale** — a massive persistent universe across many systems/servers, discovering other players organically. Far-future aspiration.

---

## Assets (deferred swap-in)

Real 3D models are a deliberate later swap-in behind the existing primitive factory
functions — sourced by hand (Kenney.nl / Quaternius CC0 kits, Sketchfab one-offs for
the collaborator, NASA 3D for real spacecraft), loaded via `GLTFLoader`, kept to one
or two kits for a consistent style. Procedural terrain/UI/simple props stay
code-driven regardless. Until then, **procedural/primitive geometry only** stands.

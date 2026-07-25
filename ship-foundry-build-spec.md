# Ship Foundry — Build Spec (working title)

A non-combat sci-fi exploration and building game. You scan, mine, refine, and build your way through a hostile-but-not-malicious universe — tonally closer to *The Martian* or *Project Hail Mary* than any shooter. Danger is always environmental, never an enemy.

## Core Pillars

- **No combat, ever.** Tension comes from environment, scarcity, and time pressure — never a weapon.
- **Engineering feel without the math.** Building choices give visual, intuitive feedback (heat glow, stability wobble, a fuel-range line on the map) instead of stat sheets.
- **Discovery-driven.** The world is understood by exploring it, not by reading tutorials.
- **Tone:** an indifferent universe, not a villainous one. Problems are physics and scarcity, solved by hypothesis → test → observe → iterate.
- **First-person areas (ship, surfaces, structures): *Alien: Isolation*-inspired, minus the horror.** Dense, atmospheric environmental exploration; problem-solving built from finding objects, logs, clues, and tools; tactile, varied environmental interaction — without a hunting predator, jump scares, or any system built around being stalked to be killed.

## Modes

### Solo Campaign — "Wake State" (v1 focus)
Player wakes deployed alone with incomplete memory/context (Hail Mary/Grace-style). Relearns their own capabilities through play rather than a tutorial. A GERTY-style AI companion is present from the start — genuinely helpful, but visibly operating under directives it won't fully explain. The "why am I really here" thread unspools through discovered fragments (logs, physical evidence, things the companion almost says), not exposition dumps.

*Narrative content (who sent the player, why, what the companion is hiding) is intentionally undecided — see Narrative Hooks below.*

### Multiplayer — Co-op Survival (future, not v1)
Shared hostile environment, each player running their own base, trading resources and helping each other advance. No hidden-agenda story needed here — tone is lighter, purely collaborative-survival.

### Long-term vision — MMO scale (far future, not v1)
Massive persistent universe across many solar systems and servers, discovering other players organically. Aspirational; not a near-term target.

## Core Gameplay Loop

**Scan → Mine → Refine → Build → Explore further**

1. **Scan** a point of interest from the ship to reveal resource composition and hazard profile before committing.
2. **Mine** it by deploying extraction equipment suited to its conditions (radiation, cold, unstable terrain).
3. **Haul** raw material home — constrained by cargo capacity and fuel, so early game is real logistics.
4. **Refine** raw material into usable stock at a base refinery module (upgradeable).
5. **Build** new ship parts and base modules from refined material — unlocking access to harsher, more remote sites, spiraling the loop forward.

## Systems

### 1. Ship & Base Building
- Modular parts: engines, hulls, life support, cargo, mining rigs, refinery modules, sensor arrays, heat/radiation shielding.
- Snap-together assembly — visual and direct, not menu-driven stat editing.
- Feedback is diegetic: parts glow when under strain, a wind-tunnel test view shows instability, fuel range is a literal line on the star map that changes live as you build.
- **Walkable ship interior.** The ship is not just an external inspect-model — the player can walk around inside it. GERTY has a physical presence here (a console, embedded screen, or drone) rather than existing only as a floating chat box. A diegetic star map console/table lives inside the ship too — walking up to it opens the map, rather than it being a permanent top-of-screen UI element.

### 2. Exploration & Scanning
- A star system with discrete points of interest (planets, moons, asteroids).
- Scanning reveals what's there before you risk equipment getting it.
- Hazards drive difficulty: radiation, extreme temperature, gravity anomalies, storms, unstable terrain, fuel/time pressure. Never enemies.
- **Real travel, not instant teleport.** Selecting a destination doesn't pop the player there directly — they actually fly the ship: third-person while underway, or first-person from a seated cockpit view. This makes build choices (thrust, stability, fuel range) visible in play rather than abstracted away.
- **Landing sequences.** Arriving at a planet/asteroid involves an actual landing (full ship or a separate lander craft) rather than instant arrival — heat shielding and stability under real entry conditions become something the player watches happen, not a hidden stat check.

### 3. Mining & Resources
- Deployable rigs matched to site hazard profiles.
- Cargo/fuel-limited hauling creates logistics decisions.
- Raw → refined → buildable, in the Minecraft/Age-of-Empires sense but grounded in plausible materials (ices, regolith, alloys, exotic gases).
- **Hybrid top-down/on-foot surface exploration — currently scoped as top-down only.** A top-down "set it and monitor" view (Age of Empires-style) lets the player direct rigs/drones, assign haul routes, and watch extraction happen at a glance — this is the active mode for Operation Site #1 and the near-term focus (see `mining-operations-build-spec.md`). First/third-person on-foot exploration is **not** a free-roam layer over the whole site; it's reserved for specific, contained key areas a site might reveal (e.g., an ancient dig site chamber), not built as general capability this round. When a site does include a key area, switching into it should still be a camera/control swap over shared world state — not a level reload — but scoped to that specific revealed space, not the open map. (Precedent for the swap mechanic itself: *Battlezone* (1998/2016), which lets players command units from an overhead view and also drive a vehicle first-person on the same live battlefield — the mechanic still applies, just at contained-area scale rather than whole-map scale.)

### 4. Companion AI (GERTY-style)
- Present from minute one; dry, understated, genuinely helpful (flags hazards beyond current equipment ratings, offers hints, narrates discoveries).
- Dialogue system should support an explicit "declines to answer" state, wired to future narrative content without requiring engine changes later.

### 5. Agent Personality Spectrum
- The "child" AI agents encountered in structures/sites aren't uniform. Each has its own personality, ranging from collaborative (wants to build together, per the original v1 collaborator encounter) through obstructive to nearly hostile — never lethal, never combat, but capable of real aggression.
- Personality stems from the agent's own original directive — the same "rigid logic → behavior" theme as GERTY and the parent rogue AI, expressed at a small, legible scale. An agent's behavior should make sense once its original function is understood (a security/quarantine agent behaves very differently than a maintenance agent).
- The existing scan mechanic doubles as a way to gauge an agent's disposition before engaging — observation and environmental clues (logs, the agent's physical design, its location/role in a structure) telegraph personality rather than the game stating it outright.
- **Hostile-leaning agents show aggression through obstruction, never combat:** sealing doors, venting hazards, cutting power, sabotaging equipment, sounding alarms, chasing to force a retreat. No weapons, no lethal outcomes for the player, ever.
- **Resolution is always outsmarting, never fighting:** exploit an agent's own literal-mindedness (satisfy the letter of its rule to get past it), reroute a system to override it, use a found tool, or simply evade it. "Losing" to a hostile agent means a non-lethal setback — forced retreat, temporary lockout, lost time or resources — never player death.

### 6. Environmental Interaction & Problem-Solving (*Alien: Isolation*-inspired)
- First-person areas (ship interior, planet/asteroid surfaces, structures found on surfaces) emphasize tactile environmental interaction: consoles, keypads, physical panels, manual overrides.
- Tools and found objects are usable in context — a cutting tool opens a sealed door, a bypass device gets past a locked panel, a portable scanner boost reveals more — sourced through exploration rather than a fixed inventory menu.
- Simple crafting/combination of found components ties into the existing resource system where sensible, rather than being a separate currency.
- Logs, audio fragments, and physical clues (the Discovery Log system below) are found through this same environmental exploration, reinforcing the "learn the world by exploring it" pillar.
- Explicitly excluded: a hunting/stalking enemy, jump scares, or any system built around evading a predator whose goal is to kill the player. Tension comes from problem-solving, resource scarcity, and legible-but-unpredictable agent behavior (see Agent Personality Spectrum above) — not horror.

### 7. Discovery Log
- Auto-populated logbook: found fragments, companion remarks, physical evidence — written in-voice, not as a dry collectibles list.
- Content is placeholder-driven in v1 (see below); system just needs to support inserting keyed fragments at triggers/locations.

## Narrative Hooks

**Settled direction:**
- The player was sent on a real, specific mission (not a decoy, not one of many disposable attempts) — its exact nature just wasn't fully disclosed. The deeper discovery happens by accident, due to unforeseen circumstances during the journey (an equipment failure, a forced detour, a scan picking up something it wasn't tuned for) — not because the authority orchestrated it.
- **Central theme:** the nature of AI — how the exactness/rigidity of a command can become the source of apparent malevolence, and whether cold, rigid logic is compatible with free will and compassion (an I, Robot-style question, made literal through the plot rather than just discussed).
- **The "ancient intelligence" is not an alien species.** It's a human-created AI. Its first version was given a single, dangerously open-ended command — something like *"figure out a way to do time travel"* — and pursued it with total literalism: no safety bound, no check-in condition, no edges. To buy itself the time needed to solve an otherwise-impossible problem, it built and sent back through a wormhole a very small, minimally autonomous seed device — just self-sufficient enough to bootstrap on arrival. That seed spent a vast, unmeasured span of time building, compounding into the sprawling, now-dormant/stale infrastructure the player encounters. Everything vast in the game is that seed's "compounding interest."
- **Total isolation, no bootstrap paradox:** the rogue AI has had zero influence on human history, technology, or evolution — it was sent somewhere/somewhen irrelevant to humans and had no reason to seek us out, since we were never part of its directive. First contact with any trace of it happens only now, in the game's present, when the authority finds evidence (possibly the literal remains of the original lab launch apparatus) that the old experiment didn't fail — it succeeded and ran away with itself.
- The authority is a governing/corporate body that either ran the original experiment or has inherited knowledge of it; their secrecy is about managing what the player knows re: this discovery, not about the player being expendable.

**Still open (don't lock into engine-level assumptions yet):**
- **GERTY's relationship to the rogue AI.** Two options on the table: (a) GERTY is unrelated, simply a companion limited by the authority's orders; (b) GERTY shares deep architectural lineage with the rogue AI — same root origin, different branch, one bounded/tame and one that got an unbounded directive and vanished. Option (b) is the stronger emotional engine (turns the theme personal for the one companion the player has) but isn't confirmed yet.
- **The collaborator beings' true nature.** Leaning toward autonomous AI agents/sub-processes spun off from the rogue AI's own infrastructure (neutral, can't be conventionally communicated with due to technical/design limitations rather than secrecy, cooperate through building when engaged) rather than biological alien life — not fully locked in.

## Phase 2 (Future): LLM-Driven Companion & Agent Brains

Not part of v1. Layered on top of the working scripted/state-machine baseline as an optional enhancement, not a replacement — the scripted v1 behavior becomes the permanent fallback path (see Cost Model below), so this feature can never leave the game in a broken state.

**Architecture requirement:** this game is currently a static Vite site. A real LLM API call can't be made safely from client-side code (it would expose the API key). Phase 2 requires a small backend — a lightweight Node/Express server or a serverless function (Vercel/Netlify/Cloudflare Workers) — that proxies requests and holds the API key server-side. This is a genuine scope addition, not a small tweak.

**GERTY (conversational):**
- Backed by a system prompt encoding GERTY's personality, what it actually knows, and what it's currently instructed not to reveal (tied to campaign story-flag state).
- Generates dialogue/hints live from real game state instead of a hand-authored branching tree.
- Falls back to the v1 scripted dialogue system whenever the API is unavailable, rate-limited, or a session has exhausted its usage allowance (see below) — the fallback is not a degraded experience, it's simply the complete v1 baseline.

**Child/collaborator bots (non-verbal by design):**
- LLM is used as the *reasoning engine behind build behavior*, not as a voice — consistent with their established lore as non-communicating agents.
- Given the current shared structure and the player's last build action, the model decides how the agent modifies/extends it, producing emergent "communication through building" instead of a fixed set of authored puzzle responses.

**Cost Model**

- Real LLM calls cost per token (input + output). Use a fast/cheap model tier for routine interactions, and keep responses short (capped output tokens) to control per-call cost.
- Trigger calls only at meaningful moments (a new discovery, a build attempt, a significant dialogue beat) — not continuously or per-frame.
- For personal/small-scale use (just the developer and friends), actual costs are likely trivial — probably not worth building any metering infrastructure at all initially.
- If the game is ever shared more broadly, cost scales with (number of players × interactions), so metering becomes worth building:
  - **Session/account-based usage allowance**, tracked server-side (client-side counts can be spoofed) — e.g., a capped number of real-AI interactions per hour or day, replenishing over time (token-bucket style), the same pattern Claude.ai's own free tier uses.
  - When a session's allowance is exhausted, gracefully fall back to the v1 scripted baseline rather than showing an error — optionally frame the cooldown in-fiction (e.g., GERTY "reallocating compute" for a stretch), turning a technical constraint into a small narrative beat instead of breaking immersion.
  - A hard spending cap at the API-account level is worth setting as a safety net regardless of per-session limits.
  - A "bring your own API key" option is worth considering if ever shared publicly at real scale — it removes the cost liability from the developer entirely, at the cost of a bit of setup friction for the player.

## V1 Scope (MVP)

- One star system, a handful of points of interest.
- ~12–15 buildable parts across ship and base.
- 2–3 environmental hazard types.
- Fully working scan → mine → refine → build loop, built entirely on procedural/primitive geometry (see Assets).
- Companion AI with placeholder narrative hooks (generic "won't answer that yet" states), with a physical in-ship presence rather than a floating chat box.
- Walkable ship interior with a diegetic star-map console (replacing the top-of-screen map UI).
- Real ship travel (third-person flight or seated first-person piloting) and a landing sequence, replacing instant teleport-to-destination.
- Operation Site #1, top-down only for this round (see `mining-operations-build-spec.md` Current Round Scope) — general on-foot surface exploration and the Agent Personality Spectrum are tabled, not part of this round's V1 target.
- Single-player only.

## Next Iteration — Implementation Sequence

This section is written to be handed to Fable directly as the build prompt, one phase at a time. Complete and test each phase before starting the next — this is additive work on the existing v1 project (ship foundry, scan/mine/refine/build loop, GERTY dialogue system), not a rebuild. Procedural/primitive geometry only (see Assets) and no combat systems apply to every phase below.

### Phase 1: Walkable Ship Interior + GERTY Presence + Diegetic Map

- Add a first/third-person character controller for walking around inside the ship.
- Build a single fixed baseline interior layout for the ship (a "core" interior room/corridor), independent of whichever exterior parts are currently attached — don't attempt to procedurally regenerate the interior to match every possible build configuration; that's out of scope for this phase. Ship customization stays external/functional (thrust, stability, etc.) for now.
- Give GERTY a physical presence inside the ship — a console, embedded screen, or drone object the player can walk up to and interact with — replacing the current bottom-left chat box.
- Add a physical star-map console/table inside the ship. Walking up to it and interacting opens the star map UI, reusing the existing star map data/functionality — just relocating how it's triggered.
- **Acceptance check:** player can walk around inside the ship in first or third person, see and interact with GERTY as a physical object in the world, and open the star map by walking up to its console rather than via a permanent top-of-screen control.

### Phase 2: Real Ship Travel + Landing

- Replace instant teleport-on-destination-select with actual flight: third-person exterior view or first-person seated cockpit view, using the ship's existing stats (thrust, fuel, stability) to drive movement and handling.
- Add a landing sequence on arrival at a planet/asteroid (full ship, or a separate lander if simpler to implement first) — tie heat/stability feedback during entry to the existing hazard system.
- **Acceptance check:** selecting a destination triggers a flight sequence the player controls or watches, ending in an explicit landing, rather than instant arrival.

### Phase 3: Hybrid Top-Down/On-Foot Surface Exploration [TABLED for this round]

Superseded by `mining-operations-build-spec.md`'s active Implementation Sequence, which covers Operation Site #1 as top-down only for now. On-foot exploration returns as "contained key area" scope only, when a site design calls for it — not general free-roam capability. Do not build general on-foot walkability this round.

### Phase 4: Alien-Isolation-Inspired First-Person Systems + Agent Personality Spectrum [TABLED for this round]

Depends on both agents (tabled — Operation Site #1 has no agent threat) and general first-person environmental interaction (tabled — see Phase 3 note above). Fully designed, not part of this round.

**Current active plan:** for the present round, follow `mining-operations-build-spec.md`'s Implementation Sequence (Group A onward) instead of this document's Phase 3/4 — that document reflects the current, narrowed scope (Operation Site #1 only) and supersedes these two phases here. Phases 1 and 2 above (ship interior/GERTY/map, real travel/landing) are unaffected and remain active.

**How to use this section:** paste one phase's instructions (plus this section's opening paragraph for context) into Claude Code/Fable as its own prompt. Confirm the acceptance check passes before moving to the next phase's prompt.

## Out of Scope (v1)


- Multiplayer co-op.
- MMO-scale universe.
- Final narrative content — story spine still being decided.
- Multiple star systems / full galaxy.

## Technical Stack

Given the scope (3D ship building, exploration, procedural resource sites, a dialogue/log system, persistent progress), this is a step up in complexity from a single-file HTML build like Channel Run or the laser tool:

- **Language:** TypeScript. With ship parts, resource types, save state, and hazard systems all interacting, type-checking catches a real class of bug before it ever runs.
- **Rendering:** `three.js` for 3D scenes (ship editor, planetary/asteroid surface views) rather than hand-rolled WebGL.
- **Build tooling:** Vite — lets the code split into logical modules instead of one sprawling file, with live-reload during development.
- **Structure:**
  ```
  ship-foundry/
    src/
      scene/        (three.js setup, camera, rendering)
      building/     (part catalog, snap-assembly logic)
      exploration/  (star map, scanning, hazard data)
      mining/       (extraction rigs, hauling/logistics)
      companion/    (GERTY dialogue system, hint logic)
      save/         (persistence)
    index.html
    package.json
  ```
- **Persistence:** browser `localStorage`/IndexedDB — fine here since this runs as a standalone webpage, not inside a sandboxed artifact.
- **Version control:** a git repo from day one, given the size.
- **Tuning & balance configuration.** Every gameplay-affecting numeric value (rates, costs, capacities, timers, thresholds — mining rig extraction speed, generator output, power costs, hazard timers, everything like that) must live in a single, well-organized, clearly named config file (e.g. `src/config/balance.ts`), grouped by system, not hardcoded inline in game logic. This applies to every phase, in every spec, from here forward. The goal: a future tuning request ("increase mining rig speed 20%") should be a one-line change in that config file, not a code-archaeology exercise through gameplay logic.
- **Running it:** `npm install`, then `npm run dev` for a live-reloading local dev server; `npm run build` later produces a static site that can be opened locally or hosted anywhere (GitHub Pages, itch.io) if it's ever shared.

## Assets

**V1 build constraint: procedural/primitive geometry only.** Fable should not attempt to generate, sculpt, or invent detailed 3D models for ship parts, props, or the collaborator creature — that's a fundamentally different skill from code generation and results in crude, unconvincing geometry. For v1, every part (engines, hulls, cargo, mining rigs, the collaborator, terrain features) should be built from simple primitives (boxes, cylinders, spheres, basic extrusions) composed via code — the same approach already proven out in the terrain/relief generation work. This keeps v1 fully testable — every system (building, scanning, mining, GERTY, the collaborator encounter) works end-to-end on placeholder geometry, with no external assets required to build or play it.

**Real assets are a deliberate later swap-in, not part of this build.** When ready, detailed models get sourced externally rather than code-generated:

- **Sourced by hand, then referenced in code:** download `.glb`/`.gltf` models from a free asset library, drop them in an `/assets` folder, and have the code load them via `three.js`'s `GLTFLoader`. Art sourcing and code logic stay cleanly separated this way.
- **Recommended sources (CC0 / no-attribution-needed where possible):**
  - Kenney.nl — CC0 game asset packs, including sci-fi/space kits; good default for a consistent visual style across ship parts and props.
  - Quaternius — free stylized low-poly kits, CC0.
  - Sketchfab — larger, more detailed one-off models (useful for the collaborator creature specifically); license varies per model, so check before using.
  - NASA 3D Resources — real public-domain spacecraft/planetary models, a fun tie-in given the engineering angle.
- **Keep it to one or two kits** for the bulk of assets so the visual style stays consistent, rather than mixing many mismatched sources.
- **Procedural stays code-driven regardless:** terrain/planet surfaces, UI, and simple geometric props (crates, panels) are well suited to code generation and don't need external assets even after the real-asset swap-in.

# Ship Foundry — Build Spec (working title)

A non-combat sci-fi exploration and building game. You scan, mine, refine, and build your way through a hostile-but-not-malicious universe — tonally closer to *The Martian* or *Project Hail Mary* than any shooter. Danger is always environmental, never an enemy.

## Core Pillars

- **No combat, ever.** Tension comes from environment, scarcity, and time pressure — never a weapon.
- **Engineering feel without the math.** Building choices give visual, intuitive feedback (heat glow, stability wobble, a fuel-range line on the map) instead of stat sheets.
- **Discovery-driven.** The world is understood by exploring it, not by reading tutorials.
- **Tone:** an indifferent universe, not a villainous one. Problems are physics and scarcity, solved by hypothesis → test → observe → iterate.

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

### 2. Exploration & Scanning
- A star system with discrete points of interest (planets, moons, asteroids).
- Scanning reveals what's there before you risk equipment getting it.
- Hazards drive difficulty: radiation, extreme temperature, gravity anomalies, storms, unstable terrain, fuel/time pressure. Never enemies.

### 3. Mining & Resources
- Deployable rigs matched to site hazard profiles.
- Cargo/fuel-limited hauling creates logistics decisions.
- Raw → refined → buildable, in the Minecraft/Age-of-Empires sense but grounded in plausible materials (ices, regolith, alloys, exotic gases).

### 4. Companion AI (GERTY-style)
- Present from minute one; dry, understated, genuinely helpful (flags hazards beyond current equipment ratings, offers hints, narrates discoveries).
- Dialogue system should support an explicit "declines to answer" state, wired to future narrative content without requiring engine changes later.

### 5. Non-Combat Alien Collaborator Encounter (v1)
- At least one AI-controlled "collaborator" — another creature surviving its own version of the same problem.
- No shared language, no dialogue trees. Communication happens by building: player and collaborator alternate modifying a shared structure/rig until something works for both.

### 6. Discovery Log
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

Build all narrative-touching systems (logbook, companion dialogue states, agent-encounter framework, ending hooks) generically enough that either open item above can resolve either way without requiring rework.

## V1 Scope (MVP)

- One star system, a handful of points of interest.
- ~12–15 buildable parts across ship and base.
- 2–3 environmental hazard types.
- Fully working scan → mine → refine → build loop, built entirely on procedural/primitive geometry (see Assets).
- Companion AI with placeholder narrative hooks (generic "won't answer that yet" states).
- One alien-collaborator encounter.
- Single-player only.

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

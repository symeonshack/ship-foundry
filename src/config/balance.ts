/**
 * Tuning & Balance Configuration — the standing rule from both build specs:
 * every gameplay-affecting numeric value (rates, sizes, radii, budgets,
 * timers, noise parameters) lives here, grouped by system, never inline in
 * gameplay logic. A future tuning request should be a one-line edit in this
 * file, not an archaeology dig through implementation code.
 *
 * Values that predate this file migrate in as each system gets touched;
 * everything introduced from Group A Phase 1 onward starts here.
 */
export const BALANCE = {
  /** Chunked/streamed terrain (mining-operations spec, Group A). */
  terrain: {
    /** world units along one chunk edge */
    chunkSize: 24,
    /** grid squares per chunk edge at full detail (vertices per edge = this + 1) */
    chunkSegments: 16,
    /**
     * chunks farther than this from the focus build at coarse LOD — quarter
     * the triangles. Kept inside the fog band so the lower detail (and the
     * small seam where the tiers meet) reads as distance haze, not a pop.
     */
    lodRadius: 72,
    /** coarse-tier segments per chunk edge (half the grid → a quarter the triangles) */
    lodSegments: 8,
    /** distance band around lodRadius a chunk must clear before re-meshing — stops
     * a focus hovering on the boundary from thrashing between the two tiers */
    lodHysteresis: 8,
    /** chunks whose footprint lies within this distance of the focus point get loaded */
    loadRadius: 96,
    /**
     * chunks are only unloaded beyond this distance — must exceed loadRadius;
     * the gap is hysteresis so a focus hovering on a boundary doesn't thrash
     */
    unloadRadius: 120,
    /** chunk meshes built per frame — the streaming budget that keeps motion stutter-free */
    buildsPerFrame: 3,
    /** height-field octaves (moved here from the original monolithic buildTerrain) */
    noise: {
      macro: { amplitude: 2.0, frequency: 0.045, sampleOffset: 50 },
      detail: { amplitude: 0.55, frequency: 0.18, sampleOffset: 9, seedScale: 1.7 },
      baseOffset: -1.4,
    },
  },

  /** Surface operation sites (Group A Phase 2: real RTS-scale, chunk-streamed). */
  surface: {
    /** half-extent of a site's walkable square — walls sit at ± this, world units */
    siteHalfExtent: 240,
    /** resource deposit generation & layout */
    nodes: {
      /** node count per resource = round(richness × perRichness) + base */
      base: 1,
      perRichness: 8,
      /** deposits spread between these radii from the landing point (uniform by area) */
      minRadius: 12,
      maxRadius: 215,
      /** units in a fresh deposit: yieldMin + rand × yieldSpan, floored */
      yieldMin: 8,
      yieldSpan: 8,
      /** unstable-site collapse window, seconds of active extraction */
      collapseMin: 18,
      collapseSpan: 12,
    },
    /** deposit veins — distinct resource clusters spread across the site (Phase 3) */
    clusters: {
      /** deposits per vein; a resource with more nodes gets multiple veins */
      nodesPerCluster: 4,
      /** vein footprint — deposits jitter within this radius of the vein center */
      radius: 11,
      /** minimum spacing between vein centers (AoE expansion-spot feel) */
      minSeparation: 70,
      /** rejection-sampling budget when placing centers */
      placeAttempts: 40,
    },
    /** non-resource landmarks worth finding (Phase 3) */
    landmarks: {
      count: 3,
      /** min distance from veins and from each other */
      minSeparation: 60,
    },
    /** coming within this range of a vein/landmark charts it */
    discoverRadius: 30,
    /** cosmetic rock dressing */
    rocks: {
      nearSpawn: 10,
      spawnSpread: 45,
      perNode: 3,
      nodeScatter: 7,
    },
    /** radius of a radiation hot zone around a hot deposit */
    radiationZoneRadius: 8,
    camera: {
      minDistance: 8,
      maxDistance: 110,
      /** pitch clamp, fractions of π from straight overhead — an RTS band,
       * never near-horizontal (that's what made it feel first-person) */
      minPolarFrac: 0.12,
      maxPolarFrac: 0.38,
      /** WASD/arrow pan speed, world units/sec at reference zoom distance 30 */
      keyPanSpeed: 30,
    },
    minimap: {
      /** canvas edge, px */
      size: 160,
      /** redraw interval, seconds */
      updateSec: 0.12,
    },
    /** default site fog — hides the chunk-streaming horizon (cold sites override, denser) */
    fogNear: 55,
    fogFar: 100,
  },

  /**
   * Landing Zone — RTS base-building at the Foundry site (see
   * landing-zone-plan.md). Per-structure data (costs, build times, HP)
   * lives in the catalog at src/base/structures.ts, same convention as the
   * ship-part catalog; the knobs here are cross-cutting factors. Remaining
   * sub-groups (drones/power/threat/food/mission) land with their phases.
   */
  landingZone: {
    structures: {
      /** max-HP fraction a just-started construction has; ramps to 1 at completion */
      hpFractionAtStart: 0.25,
      /** repair cost = def.cost × missing-HP fraction × this (cheaper than rebuilding) */
      repairCostFactor: 0.5,
      /** repair duration = buildTimeSec × missing-HP fraction × this (faster than building) */
      repairSpeedFactor: 0.5,
      /** rebuilding a destroyed structure costs def.cost × this — the cleanup premium */
      rebuildCostFactor: 1.5,
      /** max height difference across a footprint's corners/center — flat ground only */
      maxSlope: 1.2,
      /** structures must sit this far inside the site walls */
      placementEdgeMargin: 2,
      /** HP-fraction breakpoints where the model shows visible damage (AoE-style):
       * below stage1 → damaged, below stage2 → heavily damaged, 0 → ruined */
      damageStage1: 0.6,
      damageStage2: 0.3,
    },
    /** on-site stockpile capacity — mining stalls when the base is full */
    storage: {
      /** total the base can hold before any Storage Silo is built */
      baseCap: 40,
      /** each active Storage Silo raises the cap by this much */
      perSilo: 60,
    },
    /**
     * Ambient pressure — the opening tension: fuel drains continuously until
     * solar power + an on-site refinery + storage are all standing. Once
     * relieved it stays relieved until something takes one of those three
     * back out (a future hazard, or dev-damage today).
     */
    pressure: {
      fuelDrainPerSec: 0.08,
    },
    /** supply cap: how many rigs+drones the base can run at once (StarCraft-style) */
    power: {
      /** runnable from the base alone, before any Power Relay */
      baseUnitCap: 2,
      /** each active Power Relay raises the cap by this much */
      perRelay: 3,
      /** day/night cycle that drives solar output */
      dayNight: {
        /** seconds for one full day+night (half day, half night); t=0 starts
         * at solar noon — 600 = 5 minutes of day, 5 of night */
        periodSec: 600,
      },
      /** solar-array-specific behaviour */
      solar: {
        /** dust fraction gained per second of active daylight operation (full at ~180s) */
        dustPerSec: 0.0055,
        /** output multiplier lost at full dust (0.6 → a filthy panel makes 40%) */
        dustMaxDerate: 0.6,
        /** a Clean action clears full dust in this long; the array is offline meanwhile */
        cleanTimeSec: 8,
      },
      /** steady power for as long as the isotopes hold out — no day/night dip, no dust */
      nuclear: {
        /** isotope units burned per second, per active generator */
        isotopeBurnPerSec: 0.02,
      },
    },
    /** drone unit movement + the Worker gather loop (Phase 19/20) — per-type
     * costs/build times live in the catalog, src/base/drones.ts */
    drones: {
      /** ground speed, world units/sec, moving toward an order */
      moveSpeed: 3,
      /** collision radius against structure footprints, same scale as the player */
      radius: 0.4,
      /** worker drones: extraction rate while parked on a deposit, raw units/sec */
      gatherRate: 0.6,
      /** worker drones: units held before heading home, even if the deposit has more */
      carryCapacity: 4,
      /** hauler drones: units carried per delivery run — bigger, so one hauler
       * batches several worker-loads per trip to base */
      haulerCarry: 8,
    },
    /** environmental hazard escalation (Phase 25) — the plan calls for the
     * first flare to be guaranteed early so every player learns the hardening
     * lesson firsthand; later ones recur at random intervals */
    hazards: {
      flare: {
        /** playSeconds before the first, guaranteed flare */
        firstAt: 150,
        /** subsequent flares recur randomly within this range (seconds) */
        minInterval: 240,
        maxInterval: 420,
        /** lead time between the warning and the strike — no satellite yet
         * for a longer lead time (the plan's "tiered warning") */
        warningSec: 25,
        /** fraction of maxHp each active structure loses in one strike */
        damageFraction: 0.22,
      },
    },
  },

  /** The #terrain proof-of-concept range (dev harness screen, not a gameplay site). */
  terrainTest: {
    seed: 4242,
    groundColor: 0x6b5d4f,
    skyColor: 0x0c1218,
    /** fog hides the streaming horizon; far stays inside terrain.loadRadius */
    fogNear: 40,
    fogFar: 92,
    camStart: { x: 26, y: 34, z: 26 },
    camMinDistance: 6,
    camMaxDistance: 110,
    /** max polar angle as a fraction of π — keeps the command camera off the horizon */
    camMaxPolarFrac: 0.45,
  },
} as const;

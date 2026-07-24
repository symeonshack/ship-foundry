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
    /** grid squares per chunk edge (vertices per edge = this + 1) */
    chunkSegments: 16,
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
      maxPolarFrac: 0.46,
    },
    /** default site fog — hides the chunk-streaming horizon (cold sites override, denser) */
    fogNear: 55,
    fogFar: 100,
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

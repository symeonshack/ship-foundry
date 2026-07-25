import { describe, expect, it } from 'vitest';
import {
  chunkKey,
  chunkOfPoint,
  chunkVertexWorld,
  desiredChunks,
  distToChunk,
  lodSegmentsFor,
  parseChunkKey,
  planStreaming,
} from '../src/terrain/chunks';
import { makeHeightField } from '../src/terrain/heightfield';
import { BALANCE } from '../src/config/balance';

const S = BALANCE.terrain.chunkSize;
const N = BALANCE.terrain.chunkSegments;

describe('chunk coordinates', () => {
  it('maps world points to owning chunks, negatives included', () => {
    expect(chunkOfPoint(0, 0, S)).toEqual({ cx: 0, cz: 0 });
    expect(chunkOfPoint(S - 0.001, S - 0.001, S)).toEqual({ cx: 0, cz: 0 });
    expect(chunkOfPoint(S, 0, S)).toEqual({ cx: 1, cz: 0 });
    expect(chunkOfPoint(-0.001, -S, S)).toEqual({ cx: -1, cz: -1 });
  });

  it('round-trips keys', () => {
    expect(parseChunkKey(chunkKey({ cx: -3, cz: 7 }))).toEqual({ cx: -3, cz: 7 });
  });

  it('distance to a chunk is zero inside its footprint', () => {
    expect(distToChunk(S / 2, S / 2, { cx: 0, cz: 0 }, S)).toBe(0);
    expect(distToChunk(-1, 0, { cx: 0, cz: 0 }, S)).toBe(1);
  });
});

describe('desiredChunks', () => {
  it('always includes the chunk under the focus, sorted nearest first', () => {
    const wanted = desiredChunks(5, 5, S, 60);
    expect(wanted[0]).toEqual({ cx: 0, cz: 0 });
    for (let i = 1; i < wanted.length; i++) {
      expect(distToChunk(5, 5, wanted[i]!, S)).toBeGreaterThanOrEqual(distToChunk(5, 5, wanted[i - 1]!, S));
    }
  });

  it('only returns chunks within the load radius', () => {
    for (const c of desiredChunks(-40, 90, S, 50)) {
      expect(distToChunk(-40, 90, c, S)).toBeLessThanOrEqual(50);
    }
  });
});

describe('planStreaming hysteresis', () => {
  const cfg = { chunkSize: S, loadRadius: 50, unloadRadius: 80 };

  it('loads everything in range from a cold start, unloads nothing', () => {
    const plan = planStreaming(new Set(), 0, 0, cfg);
    expect(plan.load.length).toBeGreaterThan(0);
    expect(plan.unload).toEqual([]);
  });

  it('does not reload chunks that are already loaded', () => {
    const loaded = new Set(desiredChunks(0, 0, S, 50).map(chunkKey));
    const plan = planStreaming(loaded, 0, 0, cfg);
    expect(plan.load).toEqual([]);
    expect(plan.unload).toEqual([]);
  });

  it('keeps a loaded chunk in the hysteresis band, drops it past the unload radius', () => {
    // chunk (0,0) footprint starts at x=0; stand at increasing distance from it
    const key = chunkKey({ cx: 0, cz: 0 });
    const loaded = new Set([key]);
    // 60 away: outside loadRadius (wouldn't be loaded fresh) but inside unloadRadius — stays
    const inBand = planStreaming(loaded, -60, S / 2, cfg);
    expect(inBand.unload).not.toContain(key);
    expect(inBand.load.map(chunkKey)).not.toContain(key);
    // 90 away: past unloadRadius — goes
    const past = planStreaming(loaded, -90, S / 2, cfg);
    expect(past.unload).toContain(key);
  });
});

describe('chunk boundary continuity', () => {
  it('shared edge vertices of adjacent chunks sample bit-identical world positions', () => {
    for (let i = 0; i <= N; i++) {
      // east edge of (0,0) vs west edge of (1,0)
      const a = chunkVertexWorld({ cx: 0, cz: 0 }, N, i, S, N);
      const b = chunkVertexWorld({ cx: 1, cz: 0 }, 0, i, S, N);
      expect(a.x).toBe(b.x);
      expect(a.z).toBe(b.z);
      // south edge of (2,-1) vs north edge of (2,0)
      const c = chunkVertexWorld({ cx: 2, cz: -1 }, i, N, S, N);
      const d = chunkVertexWorld({ cx: 2, cz: 0 }, i, 0, S, N);
      expect(c.x).toBe(d.x);
      expect(c.z).toBe(d.z);
    }
  });

  it('therefore heights along a shared edge are exactly equal — no gaps', () => {
    const hf = makeHeightField(BALANCE.terrainTest.seed);
    for (let i = 0; i <= N; i++) {
      const a = chunkVertexWorld({ cx: -1, cz: 3 }, N, i, S, N);
      const b = chunkVertexWorld({ cx: 0, cz: 3 }, 0, i, S, N);
      expect(hf(a.x, a.z)).toBe(hf(b.x, b.z));
    }
  });
});

describe('lodSegmentsFor (LOD tier selection)', () => {
  const cfg = BALANCE.terrain;

  it('full detail near the focus, coarse beyond lodRadius', () => {
    expect(lodSegmentsFor(0, cfg)).toBe(cfg.chunkSegments);
    expect(lodSegmentsFor(cfg.lodRadius - 1, cfg)).toBe(cfg.chunkSegments);
    expect(lodSegmentsFor(cfg.lodRadius + 1, cfg)).toBe(cfg.lodSegments);
    expect(lodSegmentsFor(cfg.loadRadius, cfg)).toBe(cfg.lodSegments);
  });

  it('coarse LOD really is fewer segments (a quarter the triangles)', () => {
    expect(cfg.lodSegments).toBeLessThan(cfg.chunkSegments);
    // triangles scale with segments²; halving segments quarters the count
    expect((cfg.lodSegments / cfg.chunkSegments) ** 2).toBeLessThanOrEqual(0.3);
  });

  it('hysteresis: a full-detail chunk holds its tier inside the boundary band', () => {
    const justPast = cfg.lodRadius + (cfg.lodHysteresis ?? 0) - 1;
    // full-detail chunk drifting just past lodRadius stays full until clear of the band
    expect(lodSegmentsFor(justPast, cfg, cfg.chunkSegments)).toBe(cfg.chunkSegments);
    expect(lodSegmentsFor(cfg.lodRadius + (cfg.lodHysteresis ?? 0) + 1, cfg, cfg.chunkSegments)).toBe(cfg.lodSegments);
  });

  it('hysteresis: a coarse chunk holds coarse until well inside the boundary', () => {
    const justInside = cfg.lodRadius - (cfg.lodHysteresis ?? 0) + 1;
    expect(lodSegmentsFor(justInside, cfg, cfg.lodSegments)).toBe(cfg.lodSegments);
    expect(lodSegmentsFor(cfg.lodRadius - (cfg.lodHysteresis ?? 0) - 1, cfg, cfg.lodSegments)).toBe(cfg.chunkSegments);
  });
});

describe('height field', () => {
  it('is deterministic per seed', () => {
    const a = makeHeightField(7);
    const b = makeHeightField(7);
    for (const [x, z] of [[0, 0], [13.7, -42.1], [500, 999.5]] as const) {
      expect(a(x, z)).toBe(b(x, z));
    }
  });

  it('differs across seeds', () => {
    const a = makeHeightField(7);
    const b = makeHeightField(8);
    expect(a(13.7, -42.1)).not.toBe(b(13.7, -42.1));
  });
});

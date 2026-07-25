/**
 * Pure chunk-streaming math — no three.js, fully unit-tested. The chunk
 * manager is a thin mesh-building shell around the decisions made here.
 *
 * A chunk (cx, cz) owns the world footprint [cx·S, (cx+1)·S) × [cz·S, (cz+1)·S).
 */

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export const chunkKey = (c: ChunkCoord): string => `${c.cx},${c.cz}`;

export function parseChunkKey(key: string): ChunkCoord {
  const sep = key.indexOf(',');
  return { cx: Number(key.slice(0, sep)), cz: Number(key.slice(sep + 1)) };
}

export function chunkOfPoint(x: number, z: number, chunkSize: number): ChunkCoord {
  return { cx: Math.floor(x / chunkSize), cz: Math.floor(z / chunkSize) };
}

/** distance from a point to the nearest edge of a chunk's footprint (0 inside it) */
export function distToChunk(fx: number, fz: number, c: ChunkCoord, chunkSize: number): number {
  const minX = c.cx * chunkSize;
  const minZ = c.cz * chunkSize;
  const dx = Math.max(minX - fx, 0, fx - (minX + chunkSize));
  const dz = Math.max(minZ - fz, 0, fz - (minZ + chunkSize));
  return Math.hypot(dx, dz);
}

/**
 * World position of grid vertex (ix, iz) of a chunk, computed with exact
 * fractions: edge vertices (ix = 0 or segments) land on exact chunk-boundary
 * multiples, so two adjacent chunks sample the height field at bit-identical
 * coordinates along their shared edge — no gaps, ever.
 */
export function chunkVertexWorld(
  c: ChunkCoord,
  ix: number,
  iz: number,
  chunkSize: number,
  segments: number,
): { x: number; z: number } {
  return {
    x: c.cx * chunkSize + (ix / segments) * chunkSize,
    z: c.cz * chunkSize + (iz / segments) * chunkSize,
  };
}

/** all chunks within loadRadius of the focus, nearest first (build priority order) */
export function desiredChunks(fx: number, fz: number, chunkSize: number, loadRadius: number): ChunkCoord[] {
  const min = chunkOfPoint(fx - loadRadius, fz - loadRadius, chunkSize);
  const max = chunkOfPoint(fx + loadRadius, fz + loadRadius, chunkSize);
  const out: ChunkCoord[] = [];
  for (let cz = min.cz; cz <= max.cz; cz++) {
    for (let cx = min.cx; cx <= max.cx; cx++) {
      const c = { cx, cz };
      if (distToChunk(fx, fz, c, chunkSize) <= loadRadius) out.push(c);
    }
  }
  out.sort((a, b) => distToChunk(fx, fz, a, chunkSize) - distToChunk(fx, fz, b, chunkSize));
  return out;
}

export interface LodConfig {
  chunkSegments: number;
  lodSegments: number;
  lodRadius: number;
  /** re-mesh band around lodRadius; a chunk must clear it before switching tiers */
  lodHysteresis?: number;
}

/**
 * Segment resolution a chunk should build at, given its focus-distance: full
 * detail near the focus, coarse (half the grid) beyond lodRadius. Passing the
 * chunk's current resolution applies hysteresis — a full-detail chunk only
 * drops to coarse once clearly past the boundary, and vice versa — so a focus
 * jittering on the boundary doesn't re-mesh every frame. Pure and tested.
 */
export function lodSegmentsFor(dist: number, cfg: LodConfig, currentSegs?: number): number {
  const h = cfg.lodHysteresis ?? 0;
  if (currentSegs === cfg.lodSegments) {
    // coarse now: upgrade to full only once well inside the boundary
    return dist < cfg.lodRadius - h ? cfg.chunkSegments : cfg.lodSegments;
  }
  if (currentSegs === cfg.chunkSegments) {
    // full now: downgrade only once well past the boundary
    return dist > cfg.lodRadius + h ? cfg.lodSegments : cfg.chunkSegments;
  }
  // fresh chunk: pick straight off distance
  return dist > cfg.lodRadius ? cfg.lodSegments : cfg.chunkSegments;
}

export interface StreamConfig {
  chunkSize: number;
  loadRadius: number;
  unloadRadius: number;
}

export interface StreamPlan {
  /** missing chunks to build, nearest first */
  load: ChunkCoord[];
  /** loaded chunk keys now beyond the unload radius */
  unload: string[];
}

export function planStreaming(loaded: ReadonlySet<string>, fx: number, fz: number, cfg: StreamConfig): StreamPlan {
  const load = desiredChunks(fx, fz, cfg.chunkSize, cfg.loadRadius).filter((c) => !loaded.has(chunkKey(c)));
  const unload: string[] = [];
  for (const key of loaded) {
    if (distToChunk(fx, fz, parseChunkKey(key), cfg.chunkSize) > cfg.unloadRadius) unload.push(key);
  }
  return { load, unload };
}

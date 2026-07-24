/**
 * The global terrain height field: a pure, deterministic function of world
 * (x, z) and a seed. Chunking never touches this — every chunk samples the
 * same continuous function at world coordinates, which is what makes chunk
 * boundaries seam-free by construction.
 *
 * Moved out of scene/primitives.ts so both the legacy single-mesh terrain
 * and the chunked terrain share one source of truth; the octave numbers
 * live in config/balance.ts per the standing tuning rule.
 */
import { BALANCE } from '../config/balance';

function hash2(ix: number, iz: number, seed: number): number {
  const h = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export type HeightField = (x: number, z: number) => number;

export function makeHeightField(seed: number): HeightField {
  const { macro, detail, baseOffset } = BALANCE.terrain.noise;
  return (x, z) =>
    macro.amplitude * valueNoise(x * macro.frequency + macro.sampleOffset, z * macro.frequency + macro.sampleOffset, seed) +
    detail.amplitude *
      valueNoise(x * detail.frequency + detail.sampleOffset, z * detail.frequency + detail.sampleOffset, seed * detail.seedScale) +
    baseOffset;
}

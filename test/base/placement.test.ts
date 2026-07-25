import { describe, expect, it } from 'vitest';
import { canPlace, footprintAt, footprintOverlaps, terrainFlatEnough } from '../../src/base/placement';
import { STRUCTURES } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const flat = (): number => 0;
const def = STRUCTURES.storageSilo; // 2.5 × 2.5

describe('footprintAt', () => {
  it('centers the footprint on the placement point', () => {
    const fp = footprintAt(def, 10, -4);
    expect(fp.minX).toBeCloseTo(10 - 1.25);
    expect(fp.maxX).toBeCloseTo(10 + 1.25);
    expect(fp.minZ).toBeCloseTo(-4 - 1.25);
    expect(fp.maxZ).toBeCloseTo(-4 + 1.25);
  });
});

describe('footprintOverlaps', () => {
  const a = footprintAt(def, 0, 0);
  it('detects real overlap', () => {
    expect(footprintOverlaps(a, footprintAt(def, 1, 1))).toBe(true);
  });
  it('allows exactly-adjacent footprints', () => {
    expect(footprintOverlaps(a, footprintAt(def, 2.5, 0))).toBe(false);
  });
  it('clears well-separated footprints', () => {
    expect(footprintOverlaps(a, footprintAt(def, 20, 0))).toBe(false);
  });
});

describe('terrainFlatEnough', () => {
  const fp = footprintAt(def, 0, 0);
  it('accepts flat ground', () => {
    expect(terrainFlatEnough(fp, flat, BALANCE.landingZone.structures.maxSlope)).toBe(true);
  });
  it('rejects a slope steeper than the limit', () => {
    const steep = (x: number): number => x * 2; // 5-unit rise across a 2.5-wide footprint
    expect(terrainFlatEnough(fp, steep, BALANCE.landingZone.structures.maxSlope)).toBe(false);
  });
  it('catches a center spike the corners miss', () => {
    const spike = (x: number, z: number): number => (Math.abs(x) < 0.5 && Math.abs(z) < 0.5 ? 99 : 0);
    expect(terrainFlatEnough(fp, spike, BALANCE.landingZone.structures.maxSlope)).toBe(false);
  });
});

describe('canPlace', () => {
  it('accepts a valid, affordable, clear, flat spot', () => {
    expect(canPlace(def, 10, 10, [], flat, true)).toEqual({ ok: true });
  });

  it('rejects outside the buildable perimeter', () => {
    const half = BALANCE.surface.siteHalfExtent;
    const r = canPlace(def, half, 0, [], flat, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/perimeter/i);
  });

  it('rejects when blocked by an existing collider', () => {
    const r = canPlace(def, 10, 10, [footprintAt(def, 11, 10)], flat, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/blocked/i);
  });

  it('rejects uneven ground', () => {
    const r = canPlace(def, 10, 10, [], (x) => x * 3, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/uneven/i);
  });

  it('rejects an unaffordable build even on a perfect spot', () => {
    const r = canPlace(def, 10, 10, [], flat, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/resources/i);
  });

  it('checks in a helpful order: geometry problems reported before cost', () => {
    const r = canPlace(def, 10, 10, [footprintAt(def, 10, 10)], flat, false);
    expect(r.reason).toMatch(/blocked/i);
  });
});

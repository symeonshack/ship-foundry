import { describe, expect, it } from 'vitest';
import { mapToWorld, worldToMap } from '../src/ui/minimap';
import { BALANCE } from '../src/config/balance';

describe('minimap projection', () => {
  const half = BALANCE.surface.siteHalfExtent;
  const size = BALANCE.surface.minimap.size;

  it('maps site corners and center to canvas corners and center', () => {
    expect(worldToMap(-half, half, size)).toBe(0);
    expect(worldToMap(0, half, size)).toBe(size / 2);
    expect(worldToMap(half, half, size)).toBe(size);
  });

  it('round-trips world → map → world', () => {
    for (const v of [-half, -100.5, 0, 33.25, half]) {
      expect(mapToWorld(worldToMap(v, half, size), half, size)).toBeCloseTo(v, 6);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { deriveStats, placementFrames, rangeAtFuel, travelCost } from '../src/building/shipStats';
import type { PartPlacement } from '../src/core/state';
import { createNewGame } from '../src/core/state';

const root: PartPlacement = { uid: 'p1', partId: 'hullS', parent: null, socket: -1 };

describe('deriveStats', () => {
  it('sums the starting ship correctly', () => {
    const stats = deriveStats(createNewGame().ship);
    expect(stats.mass).toBe(10 + 4 + 3 + 3 + 1 + 5);
    expect(stats.thrust).toBe(20);
    expect(stats.fuelCap).toBe(30);
    expect(stats.cargoCap).toBe(6); // hull integrated hold
    expect(stats.sensorTier).toBe(1);
    expect(stats.hasLifeSupport).toBe(true);
    expect(stats.rigCounts.drill).toBe(1);
    expect(stats.strain).toBe('ok');
  });

  it('reports infinite fuel cost with no engine', () => {
    const stats = deriveStats([root]);
    expect(stats.thrust).toBe(0);
    expect(stats.fuelPerDist).toBe(Infinity);
    expect(rangeAtFuel(stats, 100)).toBe(0);
  });

  it('escalates strain as mass outgrows thrust', () => {
    const light = deriveStats([root, { uid: 'e', partId: 'engine1', parent: 'p1', socket: 1 }]);
    expect(light.strain).toBe('ok');
    const heavy = deriveStats([
      root,
      { uid: 'e', partId: 'engine1', parent: 'p1', socket: 1 },
      { uid: 'h2', partId: 'hullL', parent: 'p1', socket: 0 },
      { uid: 'h3', partId: 'hullL', parent: 'h2', socket: 0 },
      { uid: 'h4', partId: 'hullL', parent: 'h3', socket: 0 },
    ]);
    expect(heavy.strain).toBe('critical');
    // the critical penalty makes each unit of distance cost extra
    expect(heavy.fuelPerDist).toBeGreaterThan((0.35 * heavy.mass) / heavy.thrust);
  });

  it('keeps center of mass on-axis for symmetric loads', () => {
    const stats = deriveStats([
      root,
      { uid: 'a', partId: 'tank', parent: 'p1', socket: 3 },
      { uid: 'b', partId: 'tank', parent: 'p1', socket: 4 },
    ]);
    expect(stats.comOffset).toBeCloseTo(0, 5);
  });

  it('reports off-axis mass for lopsided loads', () => {
    const stats = deriveStats([root, { uid: 'a', partId: 'tank', parent: 'p1', socket: 3 }]);
    expect(stats.comOffset).toBeGreaterThan(0.05);
  });

  it('stacks hull frames upward through structural sockets', () => {
    const frames = placementFrames([root, { uid: 'h2', partId: 'hullL', parent: 'p1', socket: 0 }]);
    expect(frames.get('h2')!.pos[1]).toBeCloseTo(2.4);
    const frames2 = placementFrames([
      root,
      { uid: 'h2', partId: 'hullL', parent: 'p1', socket: 0 },
      { uid: 'h3', partId: 'hullS', parent: 'h2', socket: 0 },
    ]);
    expect(frames2.get('h3')!.pos[1]).toBeCloseTo(6.0);
  });

  it('computes travel cost from distance', () => {
    const stats = deriveStats(createNewGame().ship);
    const cost = travelCost(stats, 10);
    expect(cost).toBeGreaterThan(3);
    expect(cost).toBeLessThan(7);
  });
});

import { describe, expect, it } from 'vitest';
import {
  SOFT_LANDING_V,
  brakePower,
  driftForce,
  entryHeat,
  fuelAdjustment,
  speedFactor,
  startDescent,
  tickDescent,
  tripDuration,
} from '../src/flight/flightModel';
import { deriveStats } from '../src/building/shipStats';
import { createNewGame, type PartPlacement } from '../src/core/state';

const startShip = createNewGame().ship;

describe('cruise model', () => {
  it('better thrust-to-mass shortens the trip', () => {
    const slow = deriveStats(startShip);
    const fast = deriveStats([...startShip, { uid: 'x', partId: 'engine1', parent: 'p1', socket: 2 } as PartPlacement]);
    expect(tripDuration(20, fast)).toBeLessThan(tripDuration(20, slow));
  });

  it('caps trip duration for very long hauls', () => {
    expect(tripDuration(500, deriveStats(startShip))).toBeLessThanOrEqual(28);
  });

  it('balanced ships barely drift; lopsided and strained ships fight you', () => {
    const balanced = deriveStats([
      { uid: 'p1', partId: 'hullS', parent: null, socket: -1 },
      { uid: 'e', partId: 'engine1', parent: 'p1', socket: 1 },
      { uid: 'a', partId: 'tank', parent: 'p1', socket: 3 },
      { uid: 'b', partId: 'tank', parent: 'p1', socket: 4 },
    ] as PartPlacement[]);
    const lopsided = deriveStats([
      { uid: 'p1', partId: 'hullS', parent: null, socket: -1 },
      { uid: 'e', partId: 'engine1', parent: 'p1', socket: 1 },
      { uid: 'a', partId: 'drillRig', parent: 'p1', socket: 3 },
    ] as PartPlacement[]);
    expect(driftForce(balanced)).toBeLessThan(driftForce(lopsided));
  });
});

describe('fuel adjustment', () => {
  it('refunds up to 8% for a perfectly centered flight', () => {
    expect(fuelAdjustment(10, 0, 100)).toBeCloseTo(0.8);
  });
  it('charges up to 8% for fully sloppy flying', () => {
    expect(fuelAdjustment(10, 99, 100)).toBeCloseTo(-0.8);
  });
  it('is neutral at the halfway mark', () => {
    expect(fuelAdjustment(10, 1.25, 100)).toBeCloseTo(0);
  });
  it('never strands the ship below zero fuel', () => {
    expect(fuelAdjustment(10, 99, 0.3)).toBeCloseTo(-0.3);
    expect(fuelAdjustment(10, 99, 0)).toBe(-0);
  });
});

describe('descent model', () => {
  it('gravity accelerates an unbraked fall', () => {
    let d = startDescent();
    const v0 = d.velocity;
    for (let i = 0; i < 10; i++) d = tickDescent(d, false, 6, 0.1);
    expect(d.velocity).toBeGreaterThan(v0);
  });

  it('retro-burn beats gravity for any ship', () => {
    const stats = deriveStats(startShip);
    let d = startDescent();
    for (let i = 0; i < 60; i++) d = tickDescent(d, true, brakePower(stats), 0.1);
    expect(d.velocity).toBeLessThan(SOFT_LANDING_V);
    expect(d.altitude).toBeGreaterThan(0); // and there's sky left when you get there
  });

  it('an unbraked descent lands hard', () => {
    let d = startDescent();
    while (d.altitude > 0) d = tickDescent(d, false, 6, 0.05);
    expect(d.velocity).toBeGreaterThan(SOFT_LANDING_V);
  });

  it('a braked descent can land soft', () => {
    const stats = deriveStats(startShip);
    let d = startDescent();
    while (d.altitude > 0) {
      // brake whenever falling faster than a gentle rate
      d = tickDescent(d, d.velocity > 2, brakePower(stats), 0.05);
    }
    expect(d.velocity).toBeLessThanOrEqual(SOFT_LANDING_V);
  });
});

describe('entry heat', () => {
  it('planets burn hotter than asteroids', () => {
    expect(entryHeat('planet')).toBeGreaterThan(entryHeat('moon'));
    expect(entryHeat('moon')).toBeGreaterThan(entryHeat('asteroid'));
  });
});

describe('speed factor', () => {
  it('stays in the playable band even for absurd builds', () => {
    const noEngine = deriveStats([{ uid: 'p1', partId: 'hullS', parent: null, socket: -1 }] as PartPlacement[]);
    expect(speedFactor(noEngine)).toBeGreaterThanOrEqual(0.35);
    expect(speedFactor(noEngine)).toBeLessThanOrEqual(2.2);
  });
});

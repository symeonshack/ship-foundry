import { describe, expect, it } from 'vitest';
import {
  canRepair,
  isDamaged,
  repairCost,
  STRUCTURES,
  tickRepair,
  type StructureInstance,
} from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.structures;

const active = (defId: keyof typeof STRUCTURES = 'foundry', hp?: number): StructureInstance => ({
  uid: 'b1',
  defId,
  x: 0,
  z: 0,
  rotY: 0,
  hp: hp ?? STRUCTURES[defId].maxHp,
  buildProgress: 1,
  status: 'active',
});

describe('repairCost', () => {
  it('is nothing for a full-health structure', () => {
    expect(repairCost(active('foundry'))).toEqual({});
  });

  it('scales with missing HP and stays cheaper than the original build', () => {
    const def = STRUCTURES.foundry; // { alloy: 10, ceramic: 6 }
    const half = active('foundry', def.maxHp * 0.5);
    const cost = repairCost(half);
    // 50% missing × 0.5 factor = 0.25 of build cost, rounded up
    expect(cost.alloy).toBe(Math.ceil(10 * 0.25));
    expect(cost.ceramic).toBe(Math.ceil(6 * 0.25));
    expect(cost.alloy!).toBeLessThan(def.cost.alloy!);
    expect(cost.ceramic!).toBeLessThan(def.cost.ceramic!);
  });

  it('charges at least 1 of each component for any damage', () => {
    const barelyHurt = active('foundry', STRUCTURES.foundry.maxHp - 0.1);
    const cost = repairCost(barelyHurt);
    expect(cost.alloy).toBeGreaterThanOrEqual(1);
    expect(cost.ceramic).toBeGreaterThanOrEqual(1);
  });
});

describe('canRepair', () => {
  it('only for standing, damaged, not-already-repairing structures', () => {
    expect(canRepair(active('foundry'))).toBe(false); // full health
    expect(canRepair(active('foundry', 50))).toBe(true); // damaged
    expect(canRepair({ ...active('foundry', 50), repairing: true })).toBe(false);
    expect(canRepair({ ...active('foundry', 50), status: 'building', buildProgress: 0.5 })).toBe(false);
    expect(canRepair({ ...active('foundry', 0), status: 'destroyed' })).toBe(false);
  });
});

describe('tickRepair', () => {
  it('heals to full and clears the flag, faster than an equivalent rebuild', () => {
    const def = STRUCTURES.foundry;
    const inst = { ...active('foundry', 0.01), repairing: true }; // nearly destroyed but standing
    let elapsed = 0;
    const step = 0.1;
    let done: string | null = null;
    while (elapsed < def.buildTimeSec * 2 && !done) {
      done = tickRepair(inst, step);
      elapsed += step;
    }
    expect(done).toBe('repaired');
    expect(inst.hp).toBeCloseTo(def.maxHp, 5);
    expect(inst.repairing).toBe(false);
    // full repair from ~0 takes buildTimeSec × repairSpeedFactor — under a full build
    expect(elapsed).toBeLessThan(def.buildTimeSec);
    expect(elapsed).toBeCloseTo(def.buildTimeSec * cfg.repairSpeedFactor, 0);
  });

  it('does nothing when not repairing or not active', () => {
    expect(tickRepair(active('foundry', 50), 1)).toBeNull();
    expect(tickRepair({ ...active('foundry', 50), repairing: true, status: 'building' }, 1)).toBeNull();
  });

  it('never overshoots max HP', () => {
    const inst = { ...active('foundry', STRUCTURES.foundry.maxHp - 1), repairing: true };
    tickRepair(inst, 100);
    expect(inst.hp).toBe(STRUCTURES.foundry.maxHp);
    expect(isDamaged(inst)).toBe(false);
  });
});

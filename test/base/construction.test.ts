import { describe, expect, it } from 'vitest';
import {
  constructionStage,
  maxHpNow,
  STRUCTURE_IDS,
  STRUCTURES,
  tickConstruction,
  type StructureInstance,
} from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.structures;

const fresh = (defId: keyof typeof STRUCTURES = 'solarArray'): StructureInstance => ({
  uid: 'b1',
  defId,
  x: 0,
  z: 0,
  rotY: 0,
  hp: STRUCTURES[defId].maxHp * cfg.hpFractionAtStart,
  buildProgress: 0,
  status: 'building',
});

/** run construction in fixed steps; returns the transition events seen */
const run = (inst: StructureInstance, seconds: number, step = 0.1): string[] => {
  const events: string[] = [];
  for (let t = 0; t < seconds; t += step) {
    const r = tickConstruction(inst, step);
    if (r) events.push(r);
  }
  return events;
};

describe('tickConstruction', () => {
  it('completes after exactly buildTimeSec of ticking', () => {
    const inst = fresh();
    const t = STRUCTURES.solarArray.buildTimeSec;
    run(inst, t - 0.5);
    expect(inst.status).toBe('building');
    const events = run(inst, 1);
    expect(inst.status).toBe('active');
    expect(events).toEqual(['completed']);
  });

  it('AoE HP model: health ramps with the scaffold and reaches max when undamaged', () => {
    const inst = fresh();
    const def = STRUCTURES.solarArray;
    expect(inst.hp).toBeCloseTo(def.maxHp * cfg.hpFractionAtStart);
    run(inst, def.buildTimeSec / 2);
    expect(inst.hp).toBeGreaterThan(def.maxHp * cfg.hpFractionAtStart);
    expect(inst.hp).toBeLessThan(def.maxHp);
    expect(inst.hp).toBeLessThanOrEqual(maxHpNow(inst) + 1e-9);
    run(inst, def.buildTimeSec);
    expect(inst.hp).toBeCloseTo(def.maxHp, 5);
  });

  it('damage taken during construction persists into the finished building', () => {
    const inst = fresh();
    const def = STRUCTURES.solarArray;
    run(inst, def.buildTimeSec / 2);
    inst.hp -= 20; // a flare clipped the site mid-build
    run(inst, def.buildTimeSec);
    expect(inst.status).toBe('active');
    expect(inst.hp).toBeCloseTo(def.maxHp - 20, 5);
  });

  it('a construction beaten to 0 HP is destroyed mid-build, never completed', () => {
    const inst = fresh();
    run(inst, 5);
    inst.hp = 0;
    const events = run(inst, 1);
    expect(events[0]).toBe('destroyed');
    expect(inst.status).toBe('destroyed');
    // further ticking does nothing
    expect(tickConstruction(inst, 1)).toBeNull();
  });

  it('active and destroyed structures are never ticked', () => {
    const active = { ...fresh(), status: 'active' as const, buildProgress: 1 };
    expect(tickConstruction(active, 10)).toBeNull();
    expect(active.buildProgress).toBe(1);
  });
});

describe('constructionStage (AoE scaffolding model swap)', () => {
  it('steps foundation → frame → half-built → finished', () => {
    const inst = fresh();
    expect(constructionStage(inst)).toBe(0);
    inst.buildProgress = 0.34;
    expect(constructionStage(inst)).toBe(1);
    inst.buildProgress = 0.67;
    expect(constructionStage(inst)).toBe(2);
    inst.status = 'active';
    expect(constructionStage(inst)).toBe(3);
  });
});

describe('build-time tier bands (AoE/StarCraft pacing)', () => {
  it('every structure sits inside the readable 15–120s envelope', () => {
    for (const id of STRUCTURE_IDS) {
      expect(STRUCTURES[id].buildTimeSec).toBeGreaterThanOrEqual(15);
      expect(STRUCTURES[id].buildTimeSec).toBeLessThanOrEqual(120);
    }
  });

  it('economy structures build fast, keystone structures build slow', () => {
    for (const id of ['storageSilo', 'powerRelay', 'solarArray', 'soilProcessor'] as const) {
      expect(STRUCTURES[id].buildTimeSec).toBeLessThanOrEqual(40);
    }
    for (const id of ['refineryBuilding', 'fabricator', 'greenhouse'] as const) {
      expect(STRUCTURES[id].buildTimeSec).toBeGreaterThanOrEqual(40);
      expect(STRUCTURES[id].buildTimeSec).toBeLessThanOrEqual(80);
    }
    for (const id of ['foundry', 'nuclearGenerator', 'launchPad'] as const) {
      expect(STRUCTURES[id].buildTimeSec).toBeGreaterThanOrEqual(60);
    }
  });
});

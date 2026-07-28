import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  canBuild,
  canRepair,
  damageLevel,
  isDamaged,
  maxHpNow,
  repairCost,
  STRUCTURE_IDS,
  STRUCTURES,
  type StructureId,
  type StructureInstance,
} from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const inst = (over: Partial<StructureInstance> = {}): StructureInstance => ({
  uid: 's1',
  defId: 'solarArray',
  x: 0,
  z: 0,
  rotY: 0,
  hp: 60,
  buildProgress: 1,
  status: 'active',
  ...over,
});

describe('structure catalog integrity', () => {
  it('every entry id matches its key', () => {
    for (const id of STRUCTURE_IDS) {
      expect(STRUCTURES[id].id).toBe(id);
    }
  });

  it('footprints, build times, and HP are positive', () => {
    for (const id of STRUCTURE_IDS) {
      const d = STRUCTURES[id];
      expect(d.footprint.w).toBeGreaterThan(0);
      expect(d.footprint.d).toBeGreaterThan(0);
      expect(d.buildTimeSec).toBeGreaterThan(0);
      expect(d.maxHp).toBeGreaterThan(0);
    }
  });

  it('every structure has a real, non-empty cost with positive amounts', () => {
    for (const id of STRUCTURE_IDS) {
      const cost = Object.values(STRUCTURES[id].cost);
      expect(cost.length).toBeGreaterThan(0);
      for (const n of cost) expect(n).toBeGreaterThan(0);
    }
  });

  it('prereqs reference valid catalog ids and never the structure itself', () => {
    for (const id of STRUCTURE_IDS) {
      for (const p of STRUCTURES[id].prereq) {
        expect(STRUCTURES[p]).toBeDefined();
        expect(p).not.toBe(id);
      }
    }
  });

  it('the prereq graph is acyclic — a build order always exists', () => {
    const visiting = new Set<StructureId>();
    const done = new Set<StructureId>();
    const visit = (id: StructureId): void => {
      if (done.has(id)) return;
      expect(visiting.has(id)).toBe(false); // cycle!
      visiting.add(id);
      for (const p of STRUCTURES[id].prereq) visit(p);
      visiting.delete(id);
      done.add(id);
    };
    for (const id of STRUCTURE_IDS) visit(id);
  });

  it('at least one structure is buildable from nothing (empty prereq)', () => {
    expect(STRUCTURE_IDS.some((id) => STRUCTURES[id].prereq.length === 0)).toBe(true);
  });

  it('power producers and consumers both exist in the catalog', () => {
    expect(STRUCTURE_IDS.some((id) => (STRUCTURES[id].powerSupply ?? 0) > 0)).toBe(true);
    expect(STRUCTURE_IDS.some((id) => (STRUCTURES[id].powerDemand ?? 0) > 0)).toBe(true);
  });
});

describe('Launch Pad (Phase 18) needs zero special-casing', () => {
  it('gates on Foundry alone, same canBuild path as any other prereq', () => {
    expect(canBuild('launchPad', []).ok).toBe(false);
    expect(canBuild('launchPad', [inst({ defId: 'foundry', status: 'active' })]).ok).toBe(true);
  });

  it('builds, damages, repairs, and destructs through the exact generic pipeline', () => {
    const def = STRUCTURES.launchPad;
    // construction HP ramp
    expect(maxHpNow(inst({ defId: 'launchPad', status: 'building', buildProgress: 0 }))).toBeCloseTo(
      def.maxHp * BALANCE.landingZone.structures.hpFractionAtStart,
    );
    // damage thresholds
    const full = inst({ defId: 'launchPad', hp: def.maxHp });
    expect(damageLevel(full)).toBe(0);
    expect(isDamaged(full)).toBe(false);
    const hurt = inst({ defId: 'launchPad', hp: def.maxHp * BALANCE.landingZone.structures.damageStage2 });
    expect(damageLevel(hurt)).toBe(2);
    expect(isDamaged(hurt)).toBe(true);
    // repair economics scale off its own cost/maxHp, no branch on id
    expect(canRepair(hurt)).toBe(true);
    const cost = repairCost(hurt);
    expect(cost.alloy).toBeGreaterThan(0);
    expect(cost.ceramic).toBeGreaterThan(0);
    // destruction
    const dying = inst({ defId: 'launchPad', hp: 1 });
    expect(applyDamage(dying, 999)).toBe('destroyed');
    expect(dying.status).toBe('destroyed');
  });
});

describe('canBuild (prerequisite gating)', () => {
  it('a no-prereq structure is always buildable, even on an empty base', () => {
    expect(canBuild('solarArray', []).ok).toBe(true);
    expect(canBuild('storageSilo', []).ok).toBe(true);
  });

  it('blocks a prereq-gated structure with a reason naming the missing one', () => {
    const r = canBuild('refineryBuilding', []); // needs solarArray
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Solar Array/);
  });

  it('requires the prereq to be ACTIVE, not merely under construction', () => {
    const building = [inst({ defId: 'solarArray', status: 'building', buildProgress: 0.5 })];
    expect(canBuild('refineryBuilding', building).ok).toBe(false);
    const active = [inst({ defId: 'solarArray', status: 'active' })];
    expect(canBuild('refineryBuilding', active).ok).toBe(true);
  });

  it('a ruined prereq does not satisfy the requirement', () => {
    const destroyed = [inst({ defId: 'solarArray', status: 'destroyed', hp: 0 })];
    expect(canBuild('refineryBuilding', destroyed).ok).toBe(false);
  });

  it('names every missing prereq for a multi-prereq structure', () => {
    const r = canBuild('foundry', []); // needs storageSilo + refineryBuilding + powerRelay
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Storage Silo/);
    expect(r.reason).toMatch(/Refinery/);
    expect(r.reason).toMatch(/Power Relay/);
  });

  it('unlocks once every prereq is standing', () => {
    const base = [
      inst({ defId: 'storageSilo', status: 'active' }),
      inst({ defId: 'refineryBuilding', status: 'active' }),
      inst({ defId: 'powerRelay', status: 'active' }),
    ];
    expect(canBuild('foundry', base).ok).toBe(true);
  });
});

describe('balance factors', () => {
  const cfg = BALANCE.landingZone.structures;

  it('are economically coherent: repair discounted, rebuild at a premium', () => {
    expect(cfg.hpFractionAtStart).toBeGreaterThan(0);
    expect(cfg.hpFractionAtStart).toBeLessThanOrEqual(1);
    expect(cfg.repairCostFactor).toBeLessThan(1);
    expect(cfg.repairSpeedFactor).toBeLessThan(1);
    expect(cfg.rebuildCostFactor).toBeGreaterThan(1);
    expect(cfg.maxSlope).toBeGreaterThan(0);
  });
});

describe('derived structure state', () => {
  it('damaged is derived from hp, never stored', () => {
    expect(isDamaged(inst())).toBe(false);
    expect(isDamaged(inst({ hp: 30 }))).toBe(true);
    expect(isDamaged(inst({ hp: 0, status: 'destroyed' }))).toBe(false);
    expect(isDamaged(inst({ hp: 10, status: 'building', buildProgress: 0.5 }))).toBe(false);
  });

  it('maxHpNow ramps from the start fraction to full over construction', () => {
    const def = STRUCTURES.solarArray;
    const f = BALANCE.landingZone.structures.hpFractionAtStart;
    expect(maxHpNow(inst({ status: 'building', buildProgress: 0 }))).toBeCloseTo(def.maxHp * f);
    expect(maxHpNow(inst({ status: 'building', buildProgress: 1 }))).toBeCloseTo(def.maxHp);
    expect(maxHpNow(inst())).toBe(def.maxHp);
  });
});

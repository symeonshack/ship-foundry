import { describe, expect, it } from 'vitest';
import { applyDamage, damageLevel, STRUCTURES, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.structures;

const active = (hp: number, defId: keyof typeof STRUCTURES = 'foundry'): StructureInstance => ({
  uid: 'b1',
  defId,
  x: 0,
  z: 0,
  rotY: 0,
  hp,
  buildProgress: 1,
  status: 'active',
});

describe('damageLevel (AoE progressive-wear thresholds)', () => {
  const max = STRUCTURES.foundry.maxHp;

  it('pristine above the first threshold', () => {
    expect(damageLevel(active(max))).toBe(0);
    expect(damageLevel(active(max * (cfg.damageStage1 + 0.01)))).toBe(0);
  });

  it('damaged between the two thresholds', () => {
    expect(damageLevel(active(max * cfg.damageStage1))).toBe(1);
    expect(damageLevel(active(max * (cfg.damageStage2 + 0.01)))).toBe(1);
  });

  it('heavily damaged at or below the second threshold', () => {
    expect(damageLevel(active(max * cfg.damageStage2))).toBe(2);
    expect(damageLevel(active(1))).toBe(2);
  });

  it('non-active structures read pristine (they have their own models)', () => {
    expect(damageLevel({ ...active(1), status: 'building', buildProgress: 0.5 })).toBe(0);
    expect(damageLevel({ ...active(0), status: 'destroyed' })).toBe(0);
  });
});

describe('applyDamage', () => {
  it('reduces HP without destroying above zero', () => {
    const inst = active(100);
    expect(applyDamage(inst, 25)).toBeNull();
    expect(inst.hp).toBe(75);
    expect(inst.status).toBe('active');
  });

  it('ruins the structure at zero HP and cancels any repair', () => {
    const inst = { ...active(20), repairing: true };
    expect(applyDamage(inst, 20)).toBe('destroyed');
    expect(inst.hp).toBe(0);
    expect(inst.status).toBe('destroyed');
    expect(inst.repairing).toBe(false);
  });

  it('overkill clamps HP at zero, still destroys', () => {
    const inst = active(10);
    expect(applyDamage(inst, 999)).toBe('destroyed');
    expect(inst.hp).toBe(0);
  });

  it('ignores non-active structures and non-positive amounts', () => {
    expect(applyDamage(active(50), 0)).toBeNull();
    expect(applyDamage({ ...active(0), status: 'destroyed' }, 25)).toBeNull();
    const building = { ...active(50), status: 'building' as const, buildProgress: 0.5 };
    expect(applyDamage(building, 25)).toBeNull();
    expect(building.hp).toBe(50);
  });
});

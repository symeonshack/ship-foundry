import { describe, expect, it } from 'vitest';
import { pressureActive } from '../../src/base/baseSim';
import type { StructureInstance } from '../../src/base/structures';
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

const THREE_ACTIVE = [
  inst({ uid: 'a', defId: 'solarArray' }),
  inst({ uid: 'b', defId: 'refineryBuilding' }),
  inst({ uid: 'c', defId: 'storageSilo' }),
];

describe('pressureActive', () => {
  it('is active on an empty base', () => {
    expect(pressureActive([])).toBe(true);
  });

  it('stays active until ALL THREE of solar+refinery+storage are standing', () => {
    expect(pressureActive([inst({ defId: 'solarArray' })])).toBe(true);
    expect(pressureActive([inst({ defId: 'solarArray' }), inst({ uid: 'b', defId: 'refineryBuilding' })])).toBe(true);
  });

  it('relieves once all three are active', () => {
    expect(pressureActive(THREE_ACTIVE)).toBe(false);
  });

  it('a prerequisite only UNDER CONSTRUCTION does not relieve it', () => {
    const building = [
      inst({ uid: 'a', defId: 'solarArray', status: 'building', buildProgress: 0.5, hp: 10 }),
      inst({ uid: 'b', defId: 'refineryBuilding' }),
      inst({ uid: 'c', defId: 'storageSilo' }),
    ];
    expect(pressureActive(building)).toBe(true);
  });

  it('losing any one of the three re-engages it', () => {
    const soloDestroyed = THREE_ACTIVE.map((s) => (s.defId === 'refineryBuilding' ? { ...s, status: 'destroyed' as const, hp: 0 } : s));
    expect(pressureActive(soloDestroyed)).toBe(true);
  });

  it('extra unrelated structures do not affect it', () => {
    expect(pressureActive([...THREE_ACTIVE, inst({ uid: 'd', defId: 'powerRelay' })])).toBe(false);
  });
});

describe('ambient drain rate', () => {
  it('is configured as a positive, gentle per-second rate', () => {
    const rate = BALANCE.landingZone.pressure.fuelDrainPerSec;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1); // a whole fuel unit per second would be brutal
  });
});

import { describe, expect, it } from 'vitest';
import { unitCap } from '../../src/base/power';
import { storageCapacity, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const inst = (over: Partial<StructureInstance> = {}): StructureInstance => ({
  uid: 's1',
  defId: 'powerRelay',
  x: 0,
  z: 0,
  rotY: 0,
  hp: 40,
  buildProgress: 1,
  status: 'active',
  ...over,
});

describe('unitCap (power/supply cap)', () => {
  const cfg = BALANCE.landingZone.power;

  it('is the base allowance with no relay', () => {
    expect(unitCap([])).toBe(cfg.baseUnitCap);
  });

  it('each active relay raises the cap', () => {
    expect(unitCap([inst()])).toBe(cfg.baseUnitCap + cfg.perRelay);
    expect(unitCap([inst({ uid: 'a' }), inst({ uid: 'b' })])).toBe(cfg.baseUnitCap + 2 * cfg.perRelay);
  });

  it('only active relays count — not under construction or ruined', () => {
    expect(unitCap([inst({ status: 'building', buildProgress: 0.5 })])).toBe(cfg.baseUnitCap);
    expect(unitCap([inst({ status: 'destroyed', hp: 0 })])).toBe(cfg.baseUnitCap);
  });

  it('ignores non-relay structures', () => {
    expect(unitCap([inst({ defId: 'solarArray' }), inst({ defId: 'storageSilo' })])).toBe(cfg.baseUnitCap);
  });
});

describe('storageCapacity (base stockpile cap)', () => {
  const cfg = BALANCE.landingZone.storage;

  it('is the base cap with no silo', () => {
    expect(storageCapacity([])).toBe(cfg.baseCap);
  });

  it('each active silo raises the cap', () => {
    expect(storageCapacity([inst({ defId: 'storageSilo' })])).toBe(cfg.baseCap + cfg.perSilo);
    expect(storageCapacity([inst({ defId: 'storageSilo', uid: 'a' }), inst({ defId: 'storageSilo', uid: 'b' })])).toBe(
      cfg.baseCap + 2 * cfg.perSilo,
    );
  });

  it('only active silos count', () => {
    expect(storageCapacity([inst({ defId: 'storageSilo', status: 'building', buildProgress: 0.5 })])).toBe(cfg.baseCap);
    expect(storageCapacity([inst({ defId: 'storageSilo', status: 'destroyed', hp: 0 })])).toBe(cfg.baseCap);
  });

  it('ignores non-silo structures', () => {
    expect(storageCapacity([inst({ defId: 'powerRelay' }), inst({ defId: 'refineryBuilding' })])).toBe(cfg.baseCap);
  });
});

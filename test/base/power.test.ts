import { describe, expect, it } from 'vitest';
import {
  canClean,
  dayFactor,
  dayPhase,
  dustDerate,
  isGeneratorRunning,
  netPower,
  solarFactor,
  structureOutput,
  tickNuclear,
  tickSolar,
  unitCap,
} from '../../src/base/power';
import { STRUCTURES, storageCapacity, type StructureInstance } from '../../src/base/structures';
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

describe('day/night cycle', () => {
  const period = BALANCE.landingZone.power.dayNight.periodSec;

  it('t=0 is solar noon (full intensity), quarter-cycle later is dusk (zero)', () => {
    expect(dayFactor(dayPhase(0))).toBeCloseTo(1);
    expect(dayFactor(dayPhase(period * 0.25))).toBeCloseTo(0);
  });

  it('the night half stays dark', () => {
    expect(solarFactor(period * 0.4)).toBe(0);
    expect(solarFactor(period * 0.5)).toBe(0);
    expect(solarFactor(period * 0.6)).toBe(0);
  });

  it('output dips then recovers across a full cycle', () => {
    const noon = solarFactor(0);
    const dusk = solarFactor(period * 0.25);
    const night = solarFactor(period * 0.5);
    const dawn = solarFactor(period * 0.9);
    expect(noon).toBeGreaterThan(dusk);
    expect(dusk).toBeGreaterThanOrEqual(night);
    expect(dawn).toBeGreaterThan(night);
  });

  it('phase wraps and never goes negative', () => {
    expect(dayPhase(-period * 0.1)).toBeGreaterThanOrEqual(0);
    expect(dayPhase(period * 3.7)).toBeCloseTo(dayPhase(period * 0.7));
  });
});

describe('solar dust', () => {
  const cfg = BALANCE.landingZone.power.solar;
  const solar = (over: Partial<StructureInstance> = {}): StructureInstance => inst({ defId: 'solarArray', dustLevel: 0, ...over });

  it('derate is monotonic and floors at the configured minimum', () => {
    expect(dustDerate(0)).toBe(1);
    expect(dustDerate(0.5)).toBeGreaterThan(dustDerate(1));
    expect(dustDerate(1)).toBeCloseTo(1 - cfg.dustMaxDerate);
  });

  it('dust accrues monotonically while the array runs, capped at 1', () => {
    const s = solar();
    let last = 0;
    for (let i = 0; i < 400; i++) {
      tickSolar(s, 1);
      expect(s.dustLevel!).toBeGreaterThanOrEqual(last);
      last = s.dustLevel!;
    }
    expect(s.dustLevel).toBe(1);
  });

  it('cleaning clears dust to zero and ends, faster than it accrued', () => {
    const s = solar({ dustLevel: 1, cleaning: true });
    let elapsed = 0;
    while (s.cleaning && elapsed < 100) {
      tickSolar(s, 0.5);
      elapsed += 0.5;
    }
    expect(s.dustLevel).toBe(0);
    expect(s.cleaning).toBe(false);
    expect(elapsed).toBeLessThanOrEqual(cfg.cleanTimeSec + 0.5);
  });

  it('canClean only for a standing, dirty, not-already-cleaning array', () => {
    expect(canClean(solar({ dustLevel: 0 }))).toBe(false);
    expect(canClean(solar({ dustLevel: 0.5 }))).toBe(true);
    expect(canClean(solar({ dustLevel: 0.5, cleaning: true }))).toBe(false);
    expect(canClean(solar({ dustLevel: 0.5, status: 'building', buildProgress: 0.5 }))).toBe(false);
    expect(canClean(inst({ defId: 'powerRelay' }))).toBe(false);
  });
});

describe('netPower', () => {
  it('a clean solar array at noon supplies its full rating', () => {
    const s = [inst({ defId: 'solarArray', dustLevel: 0 })];
    expect(netPower(s, 0)).toBeCloseTo(STRUCTURES.solarArray.powerSupply!);
  });

  it('goes negative when demand outstrips night-time solar', () => {
    const s = [
      inst({ defId: 'solarArray', dustLevel: 0 }),
      inst({ defId: 'refineryBuilding' }), // draws power
    ];
    const period = BALANCE.landingZone.power.dayNight.periodSec;
    expect(netPower(s, 0)).toBeGreaterThan(netPower(s, period * 0.5)); // day beats night
    expect(netPower(s, period * 0.5)).toBeLessThan(0); // at night, refinery draw wins
  });

  it('only active structures contribute', () => {
    const s = [inst({ defId: 'solarArray', dustLevel: 0, status: 'building', buildProgress: 0.5 })];
    expect(netPower(s, 0)).toBe(0);
  });

  it('dust and cleaning cut a solar array’s contribution', () => {
    const clean = netPower([inst({ defId: 'solarArray', dustLevel: 0 })], 0);
    const dirty = netPower([inst({ defId: 'solarArray', dustLevel: 1 })], 0);
    const cleaning = netPower([inst({ defId: 'solarArray', dustLevel: 0, cleaning: true })], 0);
    expect(dirty).toBeLessThan(clean);
    expect(cleaning).toBe(0);
  });
});

describe('nuclear generator', () => {
  const cfg = BALANCE.landingZone.power.nuclear;
  const nuke = (over: Partial<StructureInstance> = {}): StructureInstance => inst({ defId: 'nuclearGenerator', ...over });

  it('isGeneratorRunning defaults true (absent field = running)', () => {
    expect(isGeneratorRunning(nuke())).toBe(true);
    expect(isGeneratorRunning(nuke({ running: false }))).toBe(false);
  });

  it('tickNuclear drains the shared stock while running, steady output day or night', () => {
    const g = nuke();
    const stock = { isotope: 10 };
    expect(tickNuclear(g, stock, 1)).toBeNull(); // already running — no transition
    expect(stock.isotope).toBeCloseTo(10 - cfg.isotopeBurnPerSec, 5);
    expect(isGeneratorRunning(g)).toBe(true);
    // steady regardless of the day/night phase (unlike solar)
    const period = BALANCE.landingZone.power.dayNight.periodSec;
    const day = structureOutput(g, 0);
    const night = structureOutput(g, period * 0.5);
    expect(day).toBe(night);
    expect(day).toBe(STRUCTURES.nuclearGenerator.powerSupply);
  });

  it('flips off (not destroyed) the instant the stock hits zero, and reports the transition once', () => {
    const g = nuke();
    const stock = { isotope: 0 };
    expect(tickNuclear(g, stock, 1)).toBe('stopped');
    expect(isGeneratorRunning(g)).toBe(false);
    expect(g.status).toBe('active'); // offline, not destroyed
    expect(structureOutput(g, 0)).toBe(0);
    // ticking again while still empty reports no further transition
    expect(tickNuclear(g, stock, 1)).toBeNull();
  });

  it('resumes and reports the transition once stock is restored', () => {
    const g = nuke({ running: false });
    const stock = { isotope: 0 };
    expect(tickNuclear(g, stock, 1)).toBeNull(); // still dry
    stock.isotope = 5;
    expect(tickNuclear(g, stock, 1)).toBe('started');
    expect(isGeneratorRunning(g)).toBe(true);
    expect(tickNuclear(g, stock, 1)).toBeNull(); // already running now
  });

  it('never drains the stock below zero', () => {
    const g = nuke();
    const stock = { isotope: 0.001 };
    tickNuclear(g, stock, 10); // a burn far larger than what's left
    expect(stock.isotope).toBe(0);
  });

  it('multiple generators share one stock — the second goes dark once it is dry', () => {
    const a = nuke({ uid: 'a' });
    const b = nuke({ uid: 'b' });
    // exactly enough for one generator's whole-tick burn, nothing left for a second
    const stock = { isotope: cfg.isotopeBurnPerSec };
    tickNuclear(a, stock, 1);
    expect(stock.isotope).toBeCloseTo(0, 6);
    tickNuclear(b, stock, 1);
    expect(isGeneratorRunning(a)).toBe(true);
    expect(isGeneratorRunning(b)).toBe(false);
  });

  it('ignores non-nuclear structures and non-active generators', () => {
    expect(tickNuclear(inst({ defId: 'solarArray' }), { isotope: 10 }, 1)).toBeNull();
    expect(tickNuclear(nuke({ status: 'building', buildProgress: 0.5 }), { isotope: 10 }, 1)).toBeNull();
  });

  it('netPower includes a running nuclear generator and excludes an offline one', () => {
    const running = netPower([nuke()], 0);
    const offline = netPower([nuke({ running: false })], 0);
    expect(running).toBeCloseTo(STRUCTURES.nuclearGenerator.powerSupply!);
    expect(offline).toBe(0);
  });
});

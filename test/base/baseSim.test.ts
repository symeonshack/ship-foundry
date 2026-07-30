import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { FLAGS } from '../../src/core/flags';
import { BaseSim } from '../../src/base/baseSim';
import { STRUCTURES, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.structures;

/** a structure one short tick away from completing construction */
const almostDone = (defId: keyof typeof STRUCTURES): StructureInstance => {
  const def = STRUCTURES[defId];
  return {
    uid: 'b1',
    defId,
    x: 0,
    z: 0,
    rotY: 0,
    hp: def.maxHp * cfg.hpFractionAtStart,
    buildProgress: 1 - 0.01 / def.buildTimeSec,
    status: 'building',
  };
};

describe('BaseSim — Foundry completion flips FLAGS.FOUNDRY_BUILT', () => {
  it('a fresh game starts with the shipyard gate locked', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    expect(store.hasFlag(FLAGS.FOUNDRY_BUILT)).toBe(false);
  });

  it('sets the flag the instant a Foundry finishes construction', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const sim = new BaseSim(store);
    store.state.base.structures.push(almostDone('foundry'));

    let completed: string | undefined;
    store.bus.on('structure:complete', ({ defId }) => {
      completed = defId;
    });

    expect(store.hasFlag(FLAGS.FOUNDRY_BUILT)).toBe(false);
    sim.tick(0.1);
    expect(completed).toBe('foundry');
    expect(store.hasFlag(FLAGS.FOUNDRY_BUILT)).toBe(true);
  });

  it('completing an unrelated structure does not touch the flag', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const sim = new BaseSim(store);
    store.state.base.structures.push(almostDone('solarArray'));

    sim.tick(0.1);
    expect(store.state.base.structures[0]?.status).toBe('active');
    expect(store.hasFlag(FLAGS.FOUNDRY_BUILT)).toBe(false);
  });
});

describe('BaseSim — Fabricator rolls real drones out (Phase 24)', () => {
  // a fabricator whose queued worker is a hair from finishing, so a tiny tick
  // completes it without also walking the fresh drone across the map
  const activeFabricator = (): StructureInstance => ({
    uid: 'f1',
    defId: 'fabricator',
    x: 5,
    z: -2,
    rotY: 0,
    hp: STRUCTURES.fabricator.maxHp,
    buildProgress: 1,
    status: 'active',
    queue: [{ defId: 'worker', unitsTotal: 1, unitsDone: 0, progressSec: 19.99 }],
  });

  it('spawns a DroneInstance into base state when a job finishes, and fires drone:produced', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const sim = new BaseSim(store);
    store.state.base.structures.push(activeFabricator());
    let produced: string | undefined;
    store.bus.on('drone:produced', ({ defId }) => (produced = defId));

    expect(store.state.base.drones).toHaveLength(0);
    sim.tick(0.05); // finishes the near-complete worker

    expect(produced).toBe('worker');
    expect(store.state.base.drones).toHaveLength(1);
    const d = store.state.base.drones[0]!;
    expect(d.defId).toBe('worker');
    // rolled out just past the bay's +x edge (footprint 4 wide → +2 + margin)
    expect(d.x).toBeGreaterThan(5 + 2);
    expect(store.state.base.structures[0]?.queue).toHaveLength(0);
  });

  it('a newly rolled-out drone reports to the rally point when one is set', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const sim = new BaseSim(store);
    store.state.base.rallyPoint = { x: -20, z: 12 };
    store.state.base.structures.push(activeFabricator());

    sim.tick(0.05);
    const d = store.state.base.drones[0]!;
    expect(d.status).toBe('moving');
    expect(d.target).toEqual({ x: -20, z: 12 });
  });
});

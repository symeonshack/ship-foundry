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

import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { formationOffsets, separateDrones, shelterAll, unshelterAll, type DroneInstance } from '../../src/base/drones';
import { tickFlare } from '../../src/base/hazards';
import { STRUCTURES, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';
import { FLAGS } from '../../src/core/flags';
import { BaseSim } from '../../src/base/baseSim';

afterEach(() => vi.restoreAllMocks());

const drone = (uid: string, over: Partial<DroneInstance> = {}): DroneInstance => ({
  uid,
  defId: 'worker',
  x: 0,
  z: 0,
  status: 'idle',
  target: null,
  ...over,
});

const struct = (uid: string, over: Partial<StructureInstance> = {}): StructureInstance => ({
  uid,
  defId: 'solarArray',
  x: 0,
  z: 0,
  rotY: 0,
  hp: STRUCTURES.solarArray.maxHp,
  buildProgress: 1,
  status: 'active',
  ...over,
});

describe('formation offsets (Phase 59)', () => {
  it('gives one centre spot for a lone unit', () => {
    expect(formationOffsets(1)).toEqual([{ dx: 0, dz: 0 }]);
  });
  it('spreads a group into distinct, non-overlapping spots', () => {
    const offs = formationOffsets(7);
    expect(offs).toHaveLength(7);
    // every pair is separated by at least a drone-width
    for (let i = 0; i < offs.length; i++)
      for (let j = i + 1; j < offs.length; j++)
        expect(Math.hypot(offs[i]!.dx - offs[j]!.dx, offs[i]!.dz - offs[j]!.dz)).toBeGreaterThan(0.8);
  });
});

describe('drone separation (Phase 59)', () => {
  it('pushes two stacked drones apart', () => {
    const a = drone('a', { x: 0, z: 0 });
    const b = drone('b', { x: 0.1, z: 0 });
    separateDrones([a, b]);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.1);
  });
  it('leaves sheltered drones alone', () => {
    const a = drone('a', { x: 0, z: 0, status: 'sheltered' });
    const b = drone('b', { x: 0.1, z: 0, status: 'sheltered' });
    separateDrones([a, b]);
    expect(a.x).toBe(0);
    expect(b.x).toBe(0.1);
  });
});

describe('garrison/shelter (Phase 60)', () => {
  it('sends drones to the nearest structure and clears them on unshelter', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.base.structures.push(struct('s1', { x: 10, z: 0 }));
    store.state.base.drones.push(drone('d1', { x: 0, z: 0 }));

    expect(shelterAll(store)).toBe(1);
    const d = store.state.base.drones[0]!;
    expect(d.sheltering).toBe(true);
    expect(d.target).toEqual({ x: 10, z: 0 });

    expect(unshelterAll(store)).toBe(1);
    expect(d.status).toBe('idle');
    expect(d.sheltering).toBeFalsy();
  });

  it('a sheltered drone survives a flare strike while an exposed one is lost', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    vi.spyOn(Math, 'random').mockReturnValue(0); // force the loss roll to hit
    store.state.base.drones.push(drone('safe', { status: 'sheltered' }), drone('exposed', { status: 'idle' }));

    store.state.playSeconds = BALANCE.landingZone.hazards.flare.firstAt;
    tickFlare(store, 0.1); // warning
    store.state.playSeconds += BALANCE.landingZone.hazards.flare.warningSec;
    const strike = tickFlare(store, 0.1);

    if (strike?.type !== 'strike') throw new Error('expected a strike');
    expect(strike.dronesLost).toEqual(['exposed']);
    expect(store.state.base.drones.map((d) => d.uid)).toEqual(['safe']);
  });
});

describe('total-wipe failure state (Phase 45)', () => {
  it('fires game:over only when the base is all rubble and food is gone', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const sim = new BaseSim(store);
    let over = false;
    store.bus.on('game:over', () => (over = true));

    // rubble present, nothing standing, but food still remaining → not yet
    store.state.base.structures.push(struct('r1', { status: 'destroyed' }));
    store.state.food.level = 5;
    sim.tick(0.1);
    expect(over).toBe(false);
    expect(store.hasFlag(FLAGS.GAME_OVER)).toBe(false);

    // starve on top of the ruin → total loss
    store.state.food.level = 0;
    sim.tick(0.1);
    expect(over).toBe(true);
    expect(store.hasFlag(FLAGS.GAME_OVER)).toBe(true);
  });

  it('never fires on a fresh game with no structures', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const sim = new BaseSim(store);
    let over = false;
    store.bus.on('game:over', () => (over = true));
    store.state.food.level = 0; // starving, but nothing was ever built
    sim.tick(0.1);
    expect(over).toBe(false);
  });
});

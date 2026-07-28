import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import {
  DRONES,
  orderGather,
  orderMove,
  queueDrone,
  spawnDrone,
  tickDroneMove,
  tickDroneTask,
  tickFabricator,
  type DroneInstance,
} from '../../src/base/drones';
import type { StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const fabricator = (over: Partial<StructureInstance> = {}): StructureInstance => ({
  uid: 'f1',
  defId: 'fabricator',
  x: 0,
  z: 0,
  rotY: 0,
  hp: 80,
  buildProgress: 1,
  status: 'active',
  ...over,
});

describe('queueDrone', () => {
  it('spends cost up front and enqueues the job', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.addStock('alloy', DRONES.worker.cost.alloy ?? 0);
    const inst = fabricator();
    const before = store.state.stock.alloy;
    expect(queueDrone(store, inst, 'worker', 1)).toBe(true);
    expect(store.state.stock.alloy).toBe(before - (DRONES.worker.cost.alloy ?? 0));
    expect(inst.queue).toEqual([{ defId: 'worker', unitsTotal: 1, unitsDone: 0, progressSec: 0 }]);
  });

  it('merges a repeat order of the same drone type into the existing entry', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.addStock('alloy', 999);
    const inst = fabricator();
    queueDrone(store, inst, 'worker', 1);
    queueDrone(store, inst, 'worker', 2);
    expect(inst.queue).toHaveLength(1);
    expect(inst.queue?.[0]?.unitsTotal).toBe(3);
  });

  it('refuses without enough stock, spending nothing', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.stock.alloy = 0; // fresh games start with a small salvage stock; zero it out for this check
    const inst = fabricator();
    expect(queueDrone(store, inst, 'worker', 1)).toBe(false);
    expect(store.state.stock.alloy).toBe(0);
    expect(inst.queue).toBeUndefined();
  });

  it('refuses on a fabricator that is not yet active', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.addStock('alloy', 999);
    const inst = fabricator({ status: 'building', buildProgress: 0.5 });
    expect(queueDrone(store, inst, 'worker', 1)).toBe(false);
  });

  it('refuses on a structure that is not a fabricator', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.addStock('alloy', 999);
    const inst = fabricator({ defId: 'storageSilo' });
    expect(queueDrone(store, inst, 'worker', 1)).toBe(false);
  });
});

describe('tickFabricator', () => {
  it('completes a unit after exactly buildTimeSec and reports it', () => {
    const inst = fabricator({ queue: [{ defId: 'worker', unitsTotal: 1, unitsDone: 0, progressSec: 0 }] });
    const t = DRONES.worker.buildTimeSec;
    let completed: string[] = [];
    for (let i = 0; i < t - 0.5; i += 0.1) completed = tickFabricator(inst, 0.1);
    expect(completed).toEqual([]);
    expect(inst.queue).toHaveLength(1);
    completed = tickFabricator(inst, 1);
    expect(completed).toEqual(['worker']);
    // fully done — the job is dequeued, no world drone spawned (that's Phase 24)
    expect(inst.queue).toHaveLength(0);
  });

  it('queuing 3 workers finishes them one at a time, in order', () => {
    const inst = fabricator({ queue: [{ defId: 'worker', unitsTotal: 3, unitsDone: 0, progressSec: 0 }] });
    const t = DRONES.worker.buildTimeSec;
    const completions: string[] = [];
    for (let i = 0; i < t * 3 + 1; i += 0.1) completions.push(...tickFabricator(inst, 0.1));
    expect(completions).toEqual(['worker', 'worker', 'worker']);
    expect(inst.queue).toHaveLength(0);
  });

  it('does nothing on an empty queue, an inactive fabricator, or a non-fabricator', () => {
    expect(tickFabricator(fabricator(), 10)).toEqual([]);
    expect(tickFabricator(fabricator({ status: 'building', queue: [{ defId: 'worker', unitsTotal: 1, unitsDone: 0, progressSec: 0 }] }), 100)).toEqual([]);
    expect(tickFabricator(fabricator({ defId: 'storageSilo', queue: [{ defId: 'worker', unitsTotal: 1, unitsDone: 0, progressSec: 0 }] }), 100)).toEqual([]);
  });
});

const idleDrone = (over: Partial<DroneInstance> = {}): DroneInstance => ({
  uid: 'd1',
  defId: 'worker',
  x: 0,
  z: 0,
  status: 'idle',
  target: null,
  ...over,
});

describe('tickDroneMove', () => {
  it('does nothing to an idle drone with no target', () => {
    const d = idleDrone();
    tickDroneMove(d, 1, []);
    expect(d).toEqual(idleDrone());
  });

  it('steps toward the target at the configured speed', () => {
    const d = idleDrone({ status: 'moving', target: { x: 10, z: 0 } });
    const dt = 0.5;
    tickDroneMove(d, dt, []);
    expect(d.x).toBeCloseTo(BALANCE.landingZone.drones.moveSpeed * dt);
    expect(d.z).toBeCloseTo(0);
    expect(d.status).toBe('moving');
  });

  it('arrives exactly at the target and clears status/target once within reach', () => {
    const d = idleDrone({ status: 'moving', target: { x: 1, z: 0 } });
    // one huge tick easily covers the remaining distance
    const result = tickDroneMove(d, 10, []);
    expect(result).toBe('arrived');
    expect(d.x).toBe(1);
    expect(d.z).toBe(0);
    expect(d.status).toBe('idle');
    expect(d.target).toBeNull();
  });

  it('is blocked by a structure footprint instead of passing through it', () => {
    const wall = { minX: 1, maxX: 2, minZ: -5, maxZ: 5 };
    const d = idleDrone({ x: 0.5, status: 'moving', target: { x: 10, z: 0 } });
    tickDroneMove(d, 0.1, [wall]); // candidate x 0.8 + radius pierces the wall at 1
    expect(d.x).toBe(0.5);
    expect(d.status).toBe('moving'); // still trying — never reaches the far-side target
  });
});

describe('orderMove / orderGather', () => {
  it('orderMove sets a plain destination and clears any gather assignment', () => {
    const d = idleDrone({ status: 'gathering', nodeId: 'n1', carrying: 3 });
    orderMove(d, 4, 5);
    expect(d).toMatchObject({ status: 'moving', target: { x: 4, z: 5 }, nodeId: undefined, carrying: 0 });
  });

  it('orderGather remembers where the drone was as the return point', () => {
    const d = idleDrone({ x: 7, z: -2 });
    orderGather(d, 'n1', 20, 0);
    expect(d).toMatchObject({
      status: 'moving',
      target: { x: 20, z: 0 },
      nodeId: 'n1',
      carrying: 0,
      returnX: 7,
      returnZ: -2,
    });
  });
});

describe('spawnDrone (rally point)', () => {
  it('spawns idle when no rally point is set', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const d = spawnDrone(store, 'worker', 1, 2);
    expect(store.state.base.drones).toContain(d);
    expect(d).toMatchObject({ status: 'idle', target: null, x: 1, z: 2 });
  });

  it('sends the new drone to the rally point when one is set', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.base.rallyPoint = { x: 30, z: -10 };
    const d = spawnDrone(store, 'hauler', 0, 0);
    expect(d.status).toBe('moving');
    expect(d.target).toEqual({ x: 30, z: -10 });
  });
});

describe('tickDroneTask (Worker Drone gather loop)', () => {
  const setup = (remaining: number) => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.poi('foundry').nodes = [{ id: 'n1', resource: 'ore', remaining, x: 5, z: 0, collapseIn: null }];
    const d = idleDrone({ x: 0, z: 0 });
    orderGather(d, 'n1', 5, 0);
    return { store, d };
  };

  it('travels to the node, then starts gathering on arrival', () => {
    const { store, d } = setup(10);
    tickDroneTask(store, d, 10, []); // one huge tick covers the 5-unit trip
    expect(d.x).toBeCloseTo(5);
    expect(d.status).toBe('gathering');
  });

  it('extracts from the node while parked, capping carry at the configured capacity', () => {
    const { store, d } = setup(10);
    tickDroneTask(store, d, 10, []); // arrive
    tickDroneTask(store, d, 5, []); // gather: +3 (rate 0.6/s)
    expect(d.carrying).toBeCloseTo(3);
    expect(store.poi('foundry').nodes![0]!.remaining).toBeCloseTo(7);
    expect(d.status).toBe('gathering');
    tickDroneTask(store, d, 5, []); // gather: +1 more hits the 4-unit cap
    expect(d.carrying).toBeCloseTo(4);
    expect(d.status).toBe('returning');
  });

  it('banks the carried units on arriving home, then loops back for more', () => {
    const { store, d } = setup(10);
    tickDroneTask(store, d, 10, []); // arrive at node
    tickDroneTask(store, d, 20, []); // fill to capacity (4) and head home
    expect(d.status).toBe('returning');
    tickDroneTask(store, d, 10, []); // one huge tick covers the trip home and banks
    expect(store.state.stock.ore).toBe(4);
    expect(d.carrying).toBe(0);
    // the node still has yield (10 - 4 = 6) — the loop continues automatically
    expect(d.status).toBe('moving');
    expect(d.target).toEqual({ x: 5, z: 0 });
  });

  it('goes idle once the deposit is fully depleted instead of looping forever', () => {
    const { store, d } = setup(3); // less than a full carry load
    tickDroneTask(store, d, 10, []); // arrive
    tickDroneTask(store, d, 20, []); // drains the node to 0, heads home
    expect(store.poi('foundry').nodes![0]!.remaining).toBe(0);
    expect(d.status).toBe('returning');
    tickDroneTask(store, d, 10, []); // arrive home and bank
    expect(store.state.stock.ore).toBe(3);
    expect(d.status).toBe('idle');
    expect(d.nodeId).toBeUndefined();
  });

  it('holds position and retries instead of dropping the haul when storage is full', () => {
    const { store, d } = setup(10);
    store.state.stock.alloy = BALANCE.landingZone.storage.baseCap; // no room left
    tickDroneTask(store, d, 10, []); // arrive
    tickDroneTask(store, d, 20, []); // fill to capacity, head home
    tickDroneTask(store, d, 10, []); // arrive home, but the base is full
    expect(store.state.stock.ore).toBe(0); // nothing lost, just not banked yet
    expect(d.carrying).toBe(4);
    expect(d.status).toBe('returning');
    expect(d.target).toEqual({ x: d.x, z: d.z });
    // room frees up — the very next tick banks it
    store.state.stock.alloy = 0;
    tickDroneTask(store, d, 1, []);
    expect(store.state.stock.ore).toBe(4);
    expect(d.carrying).toBe(0);
  });
});

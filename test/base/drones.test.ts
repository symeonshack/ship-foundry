import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { DRONES, queueDrone, tickFabricator } from '../../src/base/drones';
import type { StructureInstance } from '../../src/base/structures';

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

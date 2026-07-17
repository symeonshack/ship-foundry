import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { GameStore, createNewGame } from '../src/core/state';
import { Refinery } from '../src/mining/refinery';

function setup(): { store: GameStore; refinery: Refinery } {
  const store = new GameStore(new EventBus(), createNewGame());
  return { store, refinery: new Refinery(store) };
}

describe('Refinery', () => {
  it('rejects jobs without input stock', () => {
    const { refinery } = setup();
    expect(refinery.queueJob('smelt-alloy', 1)).toBe(false);
  });

  it('commits input up front and produces output over time', () => {
    const { store, refinery } = setup();
    store.addStock('ore', 4);
    expect(refinery.queueJob('smelt-alloy', 2)).toBe(true);
    expect(store.state.stock.ore).toBe(0);
    const alloyBefore = store.state.stock.alloy;
    // smelt-alloy takes 7s per unit at tier 1
    for (let i = 0; i < 150; i++) refinery.update(0.1);
    expect(store.state.stock.alloy).toBe(alloyBefore + 2);
    expect(store.state.refinery.queue).toHaveLength(0);
  });

  it('runs faster at tier 2', () => {
    const a = setup();
    const b = setup();
    a.store.addStock('ice', 5);
    b.store.addStock('ice', 5);
    b.store.state.refinery.tier = 2;
    a.refinery.queueJob('crack-fuel', 5);
    b.refinery.queueJob('crack-fuel', 5);
    for (let i = 0; i < 60; i++) {
      a.refinery.update(0.2);
      b.refinery.update(0.2);
    }
    expect(b.store.state.stock.fuel).toBeGreaterThan(a.store.state.stock.fuel);
  });

  it('emits refine:complete per finished unit', () => {
    const { store, refinery } = setup();
    let events = 0;
    store.bus.on('refine:complete', () => events++);
    store.addStock('ice', 2);
    refinery.queueJob('crack-fuel', 2);
    for (let i = 0; i < 100; i++) refinery.update(0.1);
    expect(events).toBe(2);
  });
});

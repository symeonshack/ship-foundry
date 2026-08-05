import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { tickFood, foodStatus } from '../../src/base/food';
import { STRUCTURES, type StructureId, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.food;

const struct = (defId: StructureId, over: Partial<StructureInstance> = {}): StructureInstance => ({
  uid: `s-${defId}`,
  defId,
  x: 0,
  z: 0,
  rotY: 0,
  hp: STRUCTURES[defId].maxHp,
  buildProgress: 1,
  status: 'active',
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('food meter', () => {
  it('drains continuously and reports its status band', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const before = store.state.food.level;
    tickFood(store, 10);
    expect(store.state.food.level).toBeCloseTo(before - cfg.drainPerSec * 10);

    expect(foodStatus(cfg.cap)).toBe('ok');
    expect(foodStatus(cfg.cap * 0.1)).toBe('low');
    expect(foodStatus(0)).toBe('critical');
  });

  it('signals the low crossing exactly once', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.food.level = cfg.cap * 0.2 + 0.01;
    expect(tickFood(store, 1).lowCrossed).toBe('low');
    expect(tickFood(store, 1).lowCrossed).toBeNull(); // already low, no repeat
  });
});

describe('the greenhouse chain', () => {
  it('a soil processor turns organic waste + regolith into growing medium', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.food.organicWaste = 20;
    store.addStock('regolith', 20);
    store.state.base.structures.push(struct('soilProcessor'));
    const reg0 = store.state.stock.regolith;

    tickFood(store, 5);
    expect(store.state.food.growingMedium).toBeGreaterThan(0);
    expect(store.state.food.organicWaste).toBeLessThan(20); // waste consumed
    expect(store.state.stock.regolith).toBeLessThan(reg0); // regolith consumed
  });

  it('a supplied greenhouse plants, grows, and harvests into food', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.food.growingMedium = cfg.crop.mediumPerPlant + 1;
    store.addStock('fuel', 20);
    store.state.food.level = 10;
    const gh = struct('greenhouse');
    store.state.base.structures.push(gh);

    // first tick plants (consumes medium + irrigation)
    tickFood(store, 0.1);
    expect(gh.cropProgress).toBeDefined();
    expect(store.state.food.growingMedium).toBeCloseTo(1);

    // grow to harvest (daylight assumed at t=0 → full rate); one big tick finishes it
    const foodBefore = store.state.food.level;
    const res = tickFood(store, cfg.crop.growSec);
    expect(res.harvested).toBe(true);
    expect(store.state.food.harvests).toBe(1);
    expect(store.state.food.level).toBeGreaterThan(foodBefore); // net gain despite drain
    expect(gh.cropProgress).toBeUndefined(); // fallow again (auto-replant next tick)
  });

  it('a running greenhouse eases the food drain (oxygen)', () => {
    const withGh = new GameStore(new EventBus(), createNewGame());
    withGh.state.base.structures.push(struct('greenhouse', { cropProgress: 5 }));
    withGh.addStock('fuel', 20);
    const without = new GameStore(new EventBus(), createNewGame());

    const g0 = withGh.state.food.level;
    const w0 = without.state.food.level;
    tickFood(withGh, 10);
    tickFood(without, 10);
    // the greenhouse base drains less (relief), even though its crop also advanced
    expect(g0 - withGh.state.food.level).toBeLessThan(w0 - without.state.food.level);
  });

  it('a damaged greenhouse can lose a harvest to contamination', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    vi.spyOn(Math, 'random').mockReturnValue(0); // force the contamination roll to hit
    const gh = struct('greenhouse', { hp: STRUCTURES.greenhouse.maxHp * 0.3, cropProgress: cfg.crop.growSec - 0.01 });
    store.state.base.structures.push(gh);
    const foodBefore = store.state.food.level;

    const res = tickFood(store, 1);
    expect(res.contaminated).toBe(true);
    expect(res.harvested).toBe(false);
    expect(store.state.food.harvests).toBe(0);
    // only the drain moved the meter — no harvest gain
    expect(store.state.food.level).toBeLessThan(foodBefore);
  });
});

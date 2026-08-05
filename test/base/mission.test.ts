import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { missionComplete, missionObjectives, operationEstablished, oreHighQuota } from '../../src/base/mission';
import type { StructureInstance } from '../../src/base/structures';
import { STRUCTURES, type StructureId } from '../../src/base/structures';
import { FLAGS } from '../../src/core/flags';

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

const byId = (store: GameStore, id: string) => missionObjectives(store).find((o) => o.id === id)!;

describe('mission quota', () => {
  it('accumulates cumulatively as high-grade ore is banked, and does not decay when spent', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    expect(store.state.mission.oreHighBanked).toBe(0);
    store.addStock('oreHigh', 10);
    store.addStock('oreHigh', 15);
    expect(store.state.mission.oreHighBanked).toBe(25);
    // spending it (negative addStock) never reduces the banked total
    store.addStock('oreHigh', -20);
    expect(store.state.stock.oreHigh).toBe(5);
    expect(store.state.mission.oreHighBanked).toBe(25);
  });

  it('only high-grade ore counts toward the quota, not other resources', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.addStock('ore', 50);
    store.addStock('alloy', 50);
    expect(store.state.mission.oreHighBanked).toBe(0);
  });

  it('the quota objective flips done when the banked total reaches the target', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.addStock('oreHigh', oreHighQuota() - 1);
    expect(byId(store, 'quota').done).toBe(false);
    store.addStock('oreHigh', 1);
    expect(byId(store, 'quota').done).toBe(true);
  });
});

describe('missionObjectives', () => {
  it('reports self-sufficiency once solar + refinery + storage all stand', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    expect(byId(store, 'selfSufficient').done).toBe(false);
    store.state.base.structures.push(struct('solarArray'), struct('refineryBuilding'), struct('storageSilo'));
    expect(byId(store, 'selfSufficient').done).toBe(true);
  });

  it('hazard hardening needs both shields; intact flips on a ruin', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.base.structures.push(struct('emShield'));
    expect(byId(store, 'hardened').done).toBe(false);
    store.state.base.structures.push(struct('stormShield'));
    expect(byId(store, 'hardened').done).toBe(true);

    expect(byId(store, 'intact').done).toBe(true);
    store.state.base.structures.push(struct('solarArray', { status: 'destroyed' }));
    expect(byId(store, 'intact').done).toBe(false);
  });

  it('the discovery objective tracks the QUOTA_MET flag; all objectives are now available', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    expect(byId(store, 'discovery').done).toBe(false);
    store.setFlag(FLAGS.QUOTA_MET, true);
    expect(byId(store, 'discovery').done).toBe(true);
    // satellites and greenhouse are both real objectives now
    expect(byId(store, 'satellites').available).toBe(true);
    expect(byId(store, 'greenhouse').available).toBe(true);
  });

  it('the satellite objective flips done only when all three are in orbit', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    expect(byId(store, 'satellites').done).toBe(false);
    store.state.base.satellites = ['comms', 'weather'];
    expect(byId(store, 'satellites').done).toBe(false);
    store.state.base.satellites = ['comms', 'weather', 'survey'];
    expect(byId(store, 'satellites').done).toBe(true);
  });

  it('the greenhouse objective flips done on the first harvest', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    expect(byId(store, 'greenhouse').done).toBe(false);
    store.state.food.harvests = 1;
    expect(byId(store, 'greenhouse').done).toBe(true);
  });
});

describe('operationEstablished vs missionComplete', () => {
  it('operation-established ignores the greenhouse; mission-complete requires it', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    // satisfy every objective except the greenhouse
    store.state.base.structures.push(
      struct('solarArray'), struct('refineryBuilding'), struct('storageSilo'),
      struct('foundry'), struct('emShield'), struct('stormShield'),
    );
    store.addStock('oreHigh', oreHighQuota());
    store.setFlag(FLAGS.QUOTA_MET, true);
    store.state.base.satellites = ['comms', 'weather', 'survey'];

    expect(operationEstablished(store)).toBe(true); // greenhouse not required for the milestone
    expect(missionComplete(store)).toBe(false); // ...but it is required for completion

    store.state.food.harvests = 1;
    expect(missionComplete(store)).toBe(true);
  });
});

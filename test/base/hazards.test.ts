import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { tickFlare } from '../../src/base/hazards';
import { STRUCTURES, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.hazards.flare;

const active = (over: Partial<StructureInstance> = {}): StructureInstance => ({
  uid: 'b1',
  defId: 'solarArray',
  x: 0,
  z: 0,
  rotY: 0,
  hp: STRUCTURES.solarArray.maxHp,
  buildProgress: 1,
  status: 'active',
  ...over,
});

describe('tickFlare', () => {
  it('does nothing before the scheduled time', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.playSeconds = cfg.firstAt - 1;
    expect(tickFlare(store, 1)).toBeNull();
    expect(store.state.base.flareWarningUntil).toBeNull();
  });

  it('opens a warning window right on schedule, exactly once', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.playSeconds = cfg.firstAt;
    const first = tickFlare(store, 0.1);
    expect(first).toEqual({ type: 'warning', countdownSec: cfg.warningSec });
    expect(store.state.base.flareWarningUntil).toBe(cfg.firstAt + cfg.warningSec);
    // same instant, already warned — no repeat
    expect(tickFlare(store, 0.1)).toBeNull();
  });

  it('does nothing while the countdown is still running', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.playSeconds = cfg.firstAt;
    tickFlare(store, 0.1); // opens the warning
    store.state.playSeconds += cfg.warningSec - 1;
    expect(tickFlare(store, 0.1)).toBeNull();
  });

  it('strikes every active structure once the countdown elapses, sparing non-active ones', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const hit = active({ uid: 'hit1' });
    const building = active({ uid: 'b2', status: 'building', buildProgress: 0.3 });
    const rubble = active({ uid: 'r1', status: 'destroyed' });
    store.state.base.structures.push(hit, building, rubble);

    store.state.playSeconds = cfg.firstAt;
    tickFlare(store, 0.1); // open warning
    store.state.playSeconds += cfg.warningSec;
    const strike = tickFlare(store, 0.1);

    expect(strike?.type).toBe('strike');
    if (strike?.type !== 'strike') throw new Error('expected a strike');
    expect(strike.hits).toBe(1); // only the active one counts
    expect(hit.hp).toBeCloseTo(STRUCTURES.solarArray.maxHp * (1 - cfg.damageFraction));
    expect(building.hp).toBe(STRUCTURES.solarArray.maxHp); // untouched
    expect(store.state.base.flareWarningUntil).toBeNull(); // countdown clears
    expect(store.state.base.nextFlareAt).toBeGreaterThan(store.state.playSeconds); // rescheduled forward
  });

  it('reports destroyed structures so the caller can announce them', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const frail = active({ uid: 'frail1', hp: STRUCTURES.solarArray.maxHp * cfg.damageFraction * 0.5 });
    store.state.base.structures.push(frail);

    store.state.playSeconds = cfg.firstAt;
    tickFlare(store, 0.1);
    store.state.playSeconds += cfg.warningSec;
    const strike = tickFlare(store, 0.1);

    if (strike?.type !== 'strike') throw new Error('expected a strike');
    expect(strike.destroyed).toEqual([{ uid: 'frail1', defId: 'solarArray' }]);
    expect(frail.status).toBe('destroyed');
  });

  it('reschedules within the configured recurrence window after a strike', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    store.state.playSeconds = cfg.firstAt;
    tickFlare(store, 0.1);
    store.state.playSeconds += cfg.warningSec;
    tickFlare(store, 0.1);

    const gap = store.state.base.nextFlareAt - store.state.playSeconds;
    expect(gap).toBeGreaterThanOrEqual(cfg.minInterval);
    expect(gap).toBeLessThanOrEqual(cfg.maxInterval);
  });
});

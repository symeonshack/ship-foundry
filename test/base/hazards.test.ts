import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { stormActive, tickFlare, tickStorm } from '../../src/base/hazards';
import { STRUCTURES, type StructureInstance } from '../../src/base/structures';
import { BALANCE } from '../../src/config/balance';

const cfg = BALANCE.landingZone.hazards.flare;
const stormCfg = BALANCE.landingZone.hazards.storm;

const shield = (defId: 'emShield' | 'stormShield'): StructureInstance => ({
  uid: `shield-${defId}`,
  defId,
  x: 0,
  z: 0,
  rotY: 0,
  hp: STRUCTURES[defId].maxHp,
  buildProgress: 1,
  status: 'active',
});

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

  it('an active EM Shield turns a flare to nothing; a Storm Shield does not', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const solar = active({ uid: 'p1' });
    store.state.base.structures.push(solar, shield('emShield'));
    store.state.playSeconds = cfg.firstAt;
    tickFlare(store, 0.1);
    store.state.playSeconds += cfg.warningSec;
    const strike = tickFlare(store, 0.1);
    expect(strike?.type).toBe('strike');
    if (strike?.type !== 'strike') throw new Error('expected a strike');
    expect(strike.hits).toBe(0); // shielded
    expect(solar.hp).toBe(STRUCTURES.solarArray.maxHp); // untouched

    // swap the EM shield for a storm shield — no protection against a flare
    store.state.base.structures = [active({ uid: 'p2' }), shield('stormShield')];
    store.state.playSeconds = store.state.base.nextFlareAt;
    tickFlare(store, 0.1);
    store.state.playSeconds += cfg.warningSec;
    const s2 = tickFlare(store, 0.1);
    if (s2?.type !== 'strike') throw new Error('expected a strike');
    expect(s2.hits).toBe(2); // both the solar and the (wrong) shield take it
  });
});

describe('tickStorm', () => {
  it('runs warning → onset (damage + active window) → all-clear, then reschedules', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const solar = active({ uid: 'p1' });
    store.state.base.structures.push(solar);

    store.state.playSeconds = stormCfg.firstAt - 1;
    expect(tickStorm(store, 0.1)).toBeNull();

    store.state.playSeconds = stormCfg.firstAt;
    expect(tickStorm(store, 0.1)).toEqual({ type: 'warning', countdownSec: stormCfg.warningSec });
    expect(stormActive(store.state.base, store.state.playSeconds)).toBe(false);

    store.state.playSeconds += stormCfg.warningSec;
    const begin = tickStorm(store, 0.1);
    expect(begin?.type).toBe('begin');
    if (begin?.type !== 'begin') throw new Error('expected onset');
    expect(begin.hits).toBe(1);
    expect(solar.hp).toBeCloseTo(STRUCTURES.solarArray.maxHp * (1 - stormCfg.damageFraction));
    expect(stormActive(store.state.base, store.state.playSeconds)).toBe(true);

    // still blowing — no repeat damage mid-storm
    store.state.playSeconds += stormCfg.durationSec - 1;
    expect(tickStorm(store, 0.1)).toBeNull();
    expect(stormActive(store.state.base, store.state.playSeconds)).toBe(true);

    // blows out
    store.state.playSeconds += 1;
    expect(tickStorm(store, 0.1)).toEqual({ type: 'end' });
    expect(store.state.base.stormActiveUntil).toBeNull();
    const gap = store.state.base.nextStormAt - store.state.playSeconds;
    expect(gap).toBeGreaterThanOrEqual(stormCfg.minInterval);
    expect(gap).toBeLessThanOrEqual(stormCfg.maxInterval);
  });

  it('an active Storm Shield turns a storm to nothing', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    const solar = active({ uid: 'p1' });
    store.state.base.structures.push(solar, shield('stormShield'));
    store.state.playSeconds = stormCfg.firstAt;
    tickStorm(store, 0.1); // warning
    store.state.playSeconds += stormCfg.warningSec;
    const begin = tickStorm(store, 0.1);
    if (begin?.type !== 'begin') throw new Error('expected onset');
    expect(begin.hits).toBe(0);
    expect(solar.hp).toBe(STRUCTURES.solarArray.maxHp);
    // ...but the storm still blows (solar blackout is not prevented by the shield)
    expect(stormActive(store.state.base, store.state.playSeconds)).toBe(true);
  });
});

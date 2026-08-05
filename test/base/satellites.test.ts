import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createNewGame, GameStore } from '../../src/core/state';
import { SATELLITES, canLaunch, queueLaunch, tickLaunch } from '../../src/base/satellites';
import { tickFlare } from '../../src/base/hazards';
import { BALANCE } from '../../src/config/balance';

const stockUp = (store: GameStore): void => {
  store.addStock('alloy', 99);
  store.addStock('ceramic', 99);
  store.addStock('condensate', 99);
};

describe('satellite launches', () => {
  it('comms launches first; weather and survey are gated behind it', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    stockUp(store);
    expect(canLaunch(store, 'weather').ok).toBe(false); // needs comms
    expect(canLaunch(store, 'comms').ok).toBe(true);
    store.state.base.satellites.push('comms');
    expect(canLaunch(store, 'weather').ok).toBe(true);
    expect(canLaunch(store, 'survey').ok).toBe(true);
  });

  it('a launch spends the cost, runs one at a time, and reaches orbit after the launch time', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    stockUp(store);
    const alloyBefore = store.state.stock.alloy;

    expect(queueLaunch(store, 'comms')).toBe(true);
    expect(store.state.stock.alloy).toBe(alloyBefore - (SATELLITES.comms.cost.alloy ?? 0));
    expect(store.state.base.launch?.satId).toBe('comms');
    // a second launch can't start while one is in progress
    expect(queueLaunch(store, 'comms')).toBe(false);

    // not done partway through
    tickLaunch(store, SATELLITES.comms.launchTimeSec - 1);
    expect(store.state.base.satellites).toHaveLength(0);
    // finishes on the last tick
    const done = tickLaunch(store, 2);
    expect(done).toBe('comms');
    expect(store.state.base.satellites).toEqual(['comms']);
    expect(store.state.base.launch).toBeNull();
  });

  it('refuses to launch a satellite already in orbit', () => {
    const store = new GameStore(new EventBus(), createNewGame());
    stockUp(store);
    store.state.base.satellites.push('comms');
    expect(canLaunch(store, 'comms').ok).toBe(false);
    expect(queueLaunch(store, 'comms')).toBe(false);
  });
});

describe('weather satellite stretches hazard warning lead time', () => {
  it('a flare warning lasts longer once the weather satellite is up', () => {
    const flareCfg = BALANCE.landingZone.hazards.flare;

    const withoutSat = new GameStore(new EventBus(), createNewGame());
    withoutSat.state.playSeconds = flareCfg.firstAt;
    const w1 = tickFlare(withoutSat, 0.1);
    expect(w1).toEqual({ type: 'warning', countdownSec: flareCfg.warningSec });

    const withSat = new GameStore(new EventBus(), createNewGame());
    withSat.state.base.satellites.push('weather');
    withSat.state.playSeconds = flareCfg.firstAt;
    const w2 = tickFlare(withSat, 0.1);
    expect(w2?.type).toBe('warning');
    if (w2?.type !== 'warning') throw new Error('expected a warning');
    expect(w2.countdownSec).toBeCloseTo(flareCfg.warningSec * BALANCE.landingZone.hazards.weatherLeadMultiplier);
    expect(withSat.state.base.flareWarningUntil).toBe(flareCfg.firstAt + w2.countdownSec);
  });
});

import { EventBus, type ScreenId } from './core/events';
import { RAW_IDS } from './core/resources';
import { GameStore, createNewGame } from './core/state';
import { FLAGS } from './core/flags';
import { loadGame, pushCheckpoint, saveGame } from './save/persistence';
import { ScreenManager } from './scene/renderer';
import { Gerty } from './companion/gerty';
import { LINES, TOPICS } from './companion/script';
import { DiscoveryLog } from './companion/discoveryLog';
import { Refinery } from './mining/refinery';
import { autoRefuel } from './mining/hauling';
import { ShipyardScreen } from './building/shipyard';
import { StarMapScreen } from './exploration/starMap';
import { SurfaceScreen } from './mining/surfaceScene';
import { EncounterScreen } from './encounter/encounterScene';
import { InteriorScreen } from './interior/interiorScene';
import { Hud } from './ui/hud';
import type { Ctx } from './core/ctx';

const canvas = document.getElementById('view') as HTMLCanvasElement;

const bus = new EventBus();
const saved = loadGame();
const store = new GameStore(bus, saved ?? createNewGame());
const isNewGame = saved === null;

const gerty = new Gerty(store, LINES, TOPICS);
const log = new DiscoveryLog(store);
gerty.onFragment = (key) => log.insert(key);
gerty.wire();
log.wire();

const refinery = new Refinery(store);

let manager: ScreenManager;
const nav = (id: ScreenId): void => manager.show(id);

const ctx: Ctx = { bus, store, gerty, log, refinery, nav };

// autosave: throttled continuous + on the moments that matter
let saveTimer = 0;
manager = new ScreenManager(canvas, bus, (dt) => {
  store.state.playSeconds += dt;
  refinery.update(dt);
  gerty.update(dt);
  if (store.state.currentPoi === 'foundry') autoRefuel(store);
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    saveGame(store.state);
  }
});

manager.register(new InteriorScreen(ctx, canvas));
manager.register(new ShipyardScreen(ctx, canvas));
manager.register(new StarMapScreen(ctx, canvas));
manager.register(new SurfaceScreen(ctx, canvas));
manager.register(new EncounterScreen(ctx, canvas));

new Hud(ctx);

for (const event of ['travel:arrive', 'build:placed', 'refine:complete', 'encounter:solved'] as const) {
  bus.on(event, () => saveGame(store.state));
}
window.addEventListener('beforeunload', () => saveGame(store.state));

// rollback checkpoints at the moments worth retrying from
bus.on('travel:depart', ({ from }) => {
  if (from === 'foundry') pushCheckpoint(store.state, 'Before departure');
});
bus.on('travel:arrive', ({ poiId }) => {
  if (poiId === 'foundry') pushCheckpoint(store.state, 'Docked at the Foundry');
});
bus.on('encounter:solved', () => pushCheckpoint(store.state, 'The Relay — structure active', true));

// you always come to aboard your own ship
manager.show('interior');
manager.start();

// retro-apply the starting fuel reserve to saves created before it existed
const FUEL_RESERVE_MIGRATION = 'migration.fuelReserve';
if (!store.hasFlag(FUEL_RESERVE_MIGRATION)) {
  if (!isNewGame) store.addStock('fuel', 8);
  store.setFlag(FUEL_RESERVE_MIGRATION);
}

// saves from the fractional-extraction era: round raw material to the whole
// units the player actually watched come out of the ground
const INTEGER_CARGO_MIGRATION = 'migration.integerCargo';
if (!store.hasFlag(INTEGER_CARGO_MIGRATION)) {
  if (!isNewGame) {
    for (const id of RAW_IDS) {
      store.state.stock[id] = Math.round(store.state.stock[id] ?? 0);
      const held = store.state.cargo[id];
      if (held !== undefined) {
        const rounded = Math.round(held);
        if (rounded <= 0) delete store.state.cargo[id];
        else store.state.cargo[id] = rounded;
      }
    }
  }
  store.setFlag(INTEGER_CARGO_MIGRATION);
}

// dev-only handle for driving the game in automated verification
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = { ctx, manager };
}

// wake-up beat on a fresh save
if (isNewGame && !store.hasFlag(FLAGS.INTRO_DONE)) {
  store.setFlag(FLAGS.INTRO_DONE);
  log.insert('wake');
  gerty.speakById('intro-1');
  gerty.speakById('intro-2');
  gerty.speakById('intro-3');
  saveGame(store.state);
  pushCheckpoint(store.state, 'Wake — day one', true);
}

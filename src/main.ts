import { EventBus, type ScreenId } from './core/events';
import { GameStore, createNewGame } from './core/state';
import { FLAGS } from './core/flags';
import { loadGame, saveGame } from './save/persistence';
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
import { Hud } from './ui/hud';
import type { Ctx } from './core/ctx';
import { poiDef } from './exploration/starSystem';

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

manager.register(new ShipyardScreen(ctx, canvas));
manager.register(new StarMapScreen(ctx, canvas));
manager.register(new SurfaceScreen(ctx, canvas));
manager.register(new EncounterScreen(ctx, canvas));

new Hud(ctx);

for (const event of ['travel:arrive', 'build:placed', 'refine:complete', 'encounter:solved'] as const) {
  bus.on(event, () => saveGame(store.state));
}
window.addEventListener('beforeunload', () => saveGame(store.state));

// resume where the save left off
const here = poiDef(store.state.currentPoi);
const initial: ScreenId =
  store.state.currentPoi === 'foundry' ? 'shipyard' : here.special === 'signal' ? 'encounter' : 'surface';
manager.show(initial);
manager.start();

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
}

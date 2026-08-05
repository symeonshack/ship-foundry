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
import { BaseSim } from './base/baseSim';
import { STRUCTURES } from './base/structures';
import { DRONES, type DroneId } from './base/drones';
import { BALANCE } from './config/balance';
import { autoRefuel } from './mining/hauling';
import { ShipyardScreen } from './building/shipyard';
import { LanderScreen } from './lander/landerScene';
import { StarMapScreen } from './exploration/starMap';
import { SurfaceScreen } from './mining/surfaceScene';
import { EncounterScreen } from './encounter/encounterScene';
import { InteriorScreen } from './interior/interiorScene';
import { FlightScreen } from './flight/flightScene';
import { StructureScreen } from './structure/structureScene';
import { TerrainTestScreen } from './terrain/terrainTestScreen';
import type { GameState, StructureState } from './core/state';
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
const baseSim = new BaseSim(store);

let manager: ScreenManager;
const nav = (id: ScreenId): void => {
  // Planetside, the ship interior is out of reach — the hatch you're reaching
  // for is the lander's. Only launching from the lander (or dev mode) climbs
  // back up to the orbiting ship and its walk-in interior.
  if (id === 'interior' && store.state.location === 'ground' && !store.hasFlag(FLAGS.DEV_MODE)) {
    manager.show('lander');
    return;
  }
  manager.show(id);
};

const ctx: Ctx = { bus, store, gerty, log, refinery, nav };

// autosave: throttled continuous + on the moments that matter
let saveTimer = 0;
manager = new ScreenManager(canvas, bus, (dt) => {
  store.state.playSeconds += dt;
  refinery.update(dt);
  baseSim.tick(dt); // the base keeps building/running no matter which screen is up
  gerty.update(dt);
  if (store.state.currentPoi === 'foundry') autoRefuel(store);
  if (store.hasFlag(FLAGS.DEV_MODE)) devTopUp();
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    saveGame(store.state);
  }
});

const flightScreen = new FlightScreen(ctx);
const starMapScreen = new StarMapScreen(ctx, canvas);
starMapScreen.flightRef = flightScreen;
manager.register(new InteriorScreen(ctx, canvas));
manager.register(new LanderScreen(ctx, canvas));
manager.register(new ShipyardScreen(ctx, canvas));
manager.register(starMapScreen);
manager.register(new SurfaceScreen(ctx, canvas));
manager.register(new EncounterScreen(ctx, canvas));
manager.register(flightScreen);
manager.register(new StructureScreen(ctx, canvas));
manager.register(new TerrainTestScreen(ctx, canvas));

new Hud(ctx);

for (const event of ['travel:arrive', 'build:placed', 'refine:complete', 'encounter:solved'] as const) {
  bus.on(event, () => saveGame(store.state));
}
bus.on('structure:complete', ({ defId }) => {
  if (defId === 'foundry') {
    toast('Foundry online — the base is no longer just a camp. Shipyard access granted.', 'good');
  } else {
    toast(`${STRUCTURES[defId as keyof typeof STRUCTURES].name} online`, 'good');
  }
  saveGame(store.state);
});
bus.on('structure:repaired', ({ defId }) => {
  toast(`${STRUCTURES[defId as keyof typeof STRUCTURES].name} repaired`, 'good');
});
bus.on('structure:destroyed', ({ defId }) => {
  toast(`${STRUCTURES[defId as keyof typeof STRUCTURES].name} destroyed`, 'bad');
  saveGame(store.state);
});
bus.on('pressure:relieved', () => {
  toast('Solar, refinery, and storage online — life-support drain has stopped', 'good');
  saveGame(store.state);
});
bus.on('pressure:engaged', () => {
  toast('Self-sufficiency lost — life-support is drawing on the tank again', 'bad');
});
bus.on('power:generatorOffline', () => {
  toast('Nuclear Generator offline — out of isotopes', 'warn');
});
bus.on('power:generatorOnline', () => {
  toast('Nuclear Generator back online', 'good');
});
bus.on('drone:produced', ({ defId }) => {
  toast(`${DRONES[defId as DroneId].name} rolled out`, 'good');
  saveGame(store.state);
});
bus.on('flare:warning', ({ countdownSec }) => {
  toast(`⚠ Solar flare inbound — impact in ~${countdownSec}s`, 'warn');
});
bus.on('flare:strike', ({ hits }) => {
  toast(hits > 0 ? `Solar flare hit — ${hits} structure${hits === 1 ? '' : 's'} damaged` : 'Solar flare deflected — the base rode it out', hits > 0 ? 'bad' : 'good');
  saveGame(store.state);
});
bus.on('storm:warning', ({ countdownSec }) => {
  toast(`⚠ Dust storm inbound — arrival in ~${countdownSec}s`, 'warn');
});
bus.on('storm:begin', ({ hits }) => {
  toast(hits > 0 ? `Dust storm hit — ${hits} structure${hits === 1 ? '' : 's'} damaged, solar blacked out` : 'Dust storm rolled in — shielded, solar blacked out until it passes', hits > 0 ? 'bad' : 'warn');
  saveGame(store.state);
});
bus.on('storm:end', () => {
  toast('Dust storm has passed — solar back on stream', 'good');
});
bus.on('mission:discovery', () => {
  toast('Anomalous signature in the high-grade ore — GERTY flagged a new location', 'good');
  log.insert('anomaly-discovery');
  pushCheckpoint(store.state, 'Anomaly located');
  saveGame(store.state);
});
window.addEventListener('beforeunload', () => saveGame(store.state));

// rollback checkpoints at the moments worth retrying from
bus.on('travel:depart', ({ from }) => {
  if (from === 'foundry') pushCheckpoint(store.state, 'Before departure');
});
bus.on('travel:arrive', ({ poiId }) => {
  if (poiId === 'foundry') pushCheckpoint(store.state, 'Docked at the Foundry');
});
bus.on('encounter:solved', () => pushCheckpoint(store.state, 'The Relay — structure active', true));

// you always come to aboard your own ship — unless the dev terrain range
// was asked for explicitly (#terrain: the chunk-streaming proof of concept)
manager.show(window.location.hash === '#terrain' ? 'terraintest' : 'interior');
manager.start();

// normalize saves from before Phase 4's fields existed
{
  const raw = store.state as { items?: string[]; structure?: StructureState };
  if (!raw.items) raw.items = [];
  if (!raw.structure) raw.structure = { panelOpened: false, maintOpen: false, fragmentTaken: false, logsRead: [] };
}

// normalize saves from before Landing Zone's base-building state existed
{
  const raw = store.state as { base?: GameState['base'] };
  if (!raw.base) {
    raw.base = {
      structures: [], drones: [], rallyPoint: null,
      nextFlareAt: BALANCE.landingZone.hazards.flare.firstAt, flareWarningUntil: null,
      nextStormAt: BALANCE.landingZone.hazards.storm.firstAt, stormWarningUntil: null, stormActiveUntil: null,
    };
  }
}

// saves from before the flare/storm hazards (Phase 25/26) existed — schedule
// the first of each fresh rather than backdating against however long the save ran
{
  const now = store.state.playSeconds;
  const base = store.state.base as {
    nextFlareAt?: number; flareWarningUntil?: number | null;
    nextStormAt?: number; stormWarningUntil?: number | null; stormActiveUntil?: number | null;
  };
  if (typeof base.nextFlareAt !== 'number') {
    base.nextFlareAt = now + BALANCE.landingZone.hazards.flare.firstAt;
    base.flareWarningUntil = null;
  }
  if (typeof base.nextStormAt !== 'number') {
    base.nextStormAt = now + BALANCE.landingZone.hazards.storm.firstAt;
    base.stormWarningUntil = null;
    base.stormActiveUntil = null;
  }
}

// saves from before the mission-quota tracker (Phase 28) existed
{
  const raw = store.state as { mission?: GameState['mission'] };
  if (!raw.mission) raw.mission = { oreHighBanked: 0 };
}

// saves from before the orbit/ground split default to being aboard the ship
{
  const raw = store.state as { location?: GameState['location'] };
  if (raw.location !== 'orbit' && raw.location !== 'ground') raw.location = 'orbit';
}

// saves from before the shipyard gate existed had a working Foundry all
// along — grandfather them in. A brand-new game must NOT hit this (it has
// to earn the Foundry for real, per Phase 16), so it's gated on !isNewGame,
// same as the fuel-reserve migration just below.
if (!isNewGame && !store.hasFlag(FLAGS.FOUNDRY_BUILT)) store.setFlag(FLAGS.FOUNDRY_BUILT, true);

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

// ---- dev mode: type "c h t" quickly to toggle ----
// full stock, bottomless tank, everything scanned — for exploring/debugging.
// Marked in the HUD; it taints the save it's used on, by design.
import { ALL_RESOURCE_IDS } from './core/resources';
import { deriveStats } from './building/shipStats';
import { POI_IDS } from './exploration/starSystem';
import { toast } from './ui/hud';

const DEV_STOCK = 999;
let chtBuffer: { key: string; at: number }[] = [];
window.addEventListener('keydown', (ev) => {
  const now = performance.now();
  chtBuffer = [...chtBuffer.filter((e) => now - e.at < 1200), { key: ev.key.toLowerCase(), at: now }];
  const typed = chtBuffer.map((e) => e.key).join('');
  if (typed.endsWith('cht')) {
    chtBuffer = [];
    const on = !store.hasFlag(FLAGS.DEV_MODE);
    store.setFlag(FLAGS.DEV_MODE, on);
    if (on) {
      for (const id of POI_IDS) store.poi(id).scanTier = 2;
      toast('DEV MODE ON — full stock, bottomless tank, all sites surveyed', 'warn');
      gerty.speakById('dev-mode');
    } else {
      // hand back a physically honest tank
      store.state.fuel = Math.min(store.state.fuel, deriveStats(store.state.ship).fuelCap);
      toast('Dev mode off — the universe is indifferent again', 'info');
    }
    store.changed();
  }
});

function devTopUp(): void {
  let dirty = false;
  for (const id of ALL_RESOURCE_IDS) {
    if ((store.state.stock[id] ?? 0) < DEV_STOCK) {
      store.state.stock[id] = DEV_STOCK;
      dirty = true;
    }
  }
  // beyond physical capacity on purpose — any burn in the system is affordable
  const devFuel = Math.max(deriveStats(store.state.ship).fuelCap, DEV_STOCK);
  if (store.state.fuel < devFuel) {
    store.state.fuel = devFuel;
    dirty = true;
  }
  if (dirty) store.changed();
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

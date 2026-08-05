/**
 * The Landing Zone base simulation (Landing Zone plan, Phase 8+).
 *
 * Ticked from main.ts every frame — exactly like refinery.update — regardless
 * of which screen is active: construction and repairs keep progressing (and
 * later, power/food/threats keep running) while the player is off flying
 * somewhere else. Screens render whatever state this produced; they never
 * tick it.
 */
import { BALANCE } from '../config/balance';
import { FLAGS } from '../core/flags';
import type { GameStore } from '../core/state';
import { STRUCTURES, canRepair, repairCost, tickConstruction, tickRepair, type StructureInstance } from './structures';
import { isGeneratorRunning, tickNuclear, tickSolar } from './power';
import { manageHaulers, separateDrones, spawnDrone, tickDroneTask, tickFabricator, unshelterAll } from './drones';
import { footprintAt } from './placement';
import { tickFlare, tickStorm } from './hazards';
import { tickLaunch } from './satellites';
import { tickFood } from './food';

/** notify (and re-render) at most this often for continuous numeric drift —
 * fuel drain, isotope burn — the top bar doesn't need 60fps precision, and
 * screens elsewhere in the app do a full DOM rebuild on 'state:changed' */
const CONTINUOUS_NOTIFY_INTERVAL = 0.5;

/**
 * The opening tension: true until solar power, an on-site refinery, and
 * storage are ALL standing (active — under-construction doesn't count).
 * Once every base needs solar+refinery+storage to function anyway, this is
 * just "is the base minimally self-sufficient yet."
 */
export function pressureActive(structures: readonly StructureInstance[]): boolean {
  const active = new Set(structures.filter((s) => s.status === 'active').map((s) => s.defId));
  return !(active.has('solarArray') && active.has('refineryBuilding') && active.has('storageSilo'));
}

/** pay for and begin a repair; the sim heals it over the following seconds */
export function startRepair(store: GameStore, inst: StructureInstance): { ok: boolean; reason?: string } {
  if (!canRepair(inst)) return { ok: false, reason: 'Nothing to repair' };
  const cost = repairCost(inst);
  if (!store.spendCost(cost)) return { ok: false, reason: 'Not enough resources to repair' };
  inst.repairing = true;
  store.changed();
  return { ok: true };
}

export class BaseSim {
  /** null until the first tick, so boot never fires a false transition event */
  private wasPressureActive: boolean | null = null;
  private drainNotifyTimer = 0;
  private isotopeNotifyTimer = 0;
  private flareNotifyTimer = 0;
  private stormNotifyTimer = 0;
  private foodNotifyTimer = 0;

  constructor(private store: GameStore) {}

  tick(dt: number): void {
    let transitions = false;
    let isotopeConsumed = false;
    for (const inst of this.store.state.base.structures) {
      const built = tickConstruction(inst, dt);
      if (built === 'completed') {
        this.store.bus.emit('structure:complete', { uid: inst.uid, defId: inst.defId });
        // this is the earned flip of the Phase 3 gate: the shipyard was
        // reachable from game start only via a default-true stub flag, and
        // that stub is gone now — a real Foundry completing is the one
        // place FOUNDRY_BUILT ever gets set for a fresh game.
        if (inst.defId === 'foundry') this.store.setFlag(FLAGS.FOUNDRY_BUILT, true);
        transitions = true;
      } else if (built === 'destroyed') {
        this.store.bus.emit('structure:destroyed', { uid: inst.uid, defId: inst.defId });
        transitions = true;
      }
      if (tickRepair(inst, dt) === 'repaired') {
        this.store.bus.emit('structure:repaired', { uid: inst.uid, defId: inst.defId });
        transitions = true;
      }
      // solar dust settles / clears continuously — read live by the UI, no event
      tickSolar(inst, dt);

      // nuclear: steady power for as long as the shared isotope stock holds
      // out — the stopped/resumed flip is a real transition (announce it);
      // the ongoing burn is continuous drift (throttled notify only)
      const nuclearShift = tickNuclear(inst, this.store.state.stock, dt);
      if (nuclearShift === 'started') {
        this.store.bus.emit('power:generatorOnline', { uid: inst.uid, defId: inst.defId });
        transitions = true;
      } else if (nuclearShift === 'stopped') {
        this.store.bus.emit('power:generatorOffline', { uid: inst.uid, defId: inst.defId });
        transitions = true;
      } else if (inst.defId === 'nuclearGenerator' && inst.status === 'active' && isGeneratorRunning(inst)) {
        isotopeConsumed = true;
      }

      // fabricator: each finished unit rolls a real drone out onto the site
      // just past the bay's +x edge (Phase 24). If a rally point is set,
      // spawnDrone sends it there straight away.
      for (const defId of tickFabricator(inst, dt)) {
        const footprint = STRUCTURES[inst.defId].footprint;
        spawnDrone(this.store, defId, inst.x + footprint.w / 2 + 0.7, inst.z + (Math.random() - 0.5) * footprint.d);
        this.store.bus.emit('drone:produced', { defId });
        transitions = true;
      }
    }

    // drone movement + the Worker Drone gather loop: continuous drift (walking,
    // carrying) is read live by the renderer, like HP/dust/isotope burn — only
    // a task-state flip (moving → gathering → returning → idle) is a real
    // transition worth a refresh. Colliders are recomputed from live structure
    // state rather than shared with BaseView, since this sim must keep running
    // with no view attached.
    const droneColliders = this.store.state.base.structures.map((s) => footprintAt(STRUCTURES[s.defId], s.x, s.z));
    // hauler↔worker bookkeeping + idle-hauler assignment happens once, up front
    manageHaulers(this.store);
    for (const d of this.store.state.base.drones) {
      const before = d.status;
      tickDroneTask(this.store, d, dt, droneColliders);
      if (d.status !== before) transitions = true;
    }
    separateDrones(this.store.state.base.drones); // keep them from bunching up (Phase 59)

    if (isotopeConsumed) {
      this.isotopeNotifyTimer += dt;
      if (this.isotopeNotifyTimer >= CONTINUOUS_NOTIFY_INTERVAL) {
        this.isotopeNotifyTimer = 0;
        transitions = true;
      }
    }

    // solar flare hazard escalation: the warning/strike moments are real
    // transitions; a live countdown in between is continuous drift, throttle-
    // notified the same way fuel drain and isotope burn are
    const flare = tickFlare(this.store, dt);
    if (flare?.type === 'warning') {
      this.store.bus.emit('flare:warning', { countdownSec: flare.countdownSec });
      transitions = true;
    } else if (flare?.type === 'strike') {
      for (const d of flare.destroyed) this.store.bus.emit('structure:destroyed', d);
      if (flare.dronesLost.length > 0) this.store.bus.emit('drone:lost', { count: flare.dronesLost.length });
      this.store.bus.emit('flare:strike', { hits: flare.hits });
      unshelterAll(this.store); // the flash is over — drones come back out
      transitions = true;
    }
    if (this.store.state.base.flareWarningUntil !== null) {
      this.flareNotifyTimer += dt;
      if (this.flareNotifyTimer >= CONTINUOUS_NOTIFY_INTERVAL) {
        this.flareNotifyTimer = 0;
        transitions = true;
      }
    } else {
      this.flareNotifyTimer = 0;
    }

    // dust storm: same warning → hit → (blows for a while) → all-clear rhythm
    const storm = tickStorm(this.store, dt);
    if (storm?.type === 'warning') {
      this.store.bus.emit('storm:warning', { countdownSec: storm.countdownSec });
      transitions = true;
    } else if (storm?.type === 'begin') {
      for (const d of storm.destroyed) this.store.bus.emit('structure:destroyed', d);
      if (storm.dronesLost.length > 0) this.store.bus.emit('drone:lost', { count: storm.dronesLost.length });
      this.store.bus.emit('storm:begin', { hits: storm.hits });
      transitions = true;
    } else if (storm?.type === 'end') {
      this.store.bus.emit('storm:end', {});
      unshelterAll(this.store); // storm's passed — drones leave shelter
      transitions = true;
    }
    if (this.store.state.base.stormWarningUntil !== null || this.store.state.base.stormActiveUntil !== null) {
      this.stormNotifyTimer += dt;
      if (this.stormNotifyTimer >= CONTINUOUS_NOTIFY_INTERVAL) {
        this.stormNotifyTimer = 0;
        transitions = true;
      }
    } else {
      this.stormNotifyTimer = 0;
    }

    // mission quota → the one-time accidental discovery (Phase 29)
    if (!this.store.hasFlag(FLAGS.QUOTA_MET) && this.store.state.mission.oreHighBanked >= BALANCE.landingZone.mission.oreHighQuota) {
      this.store.setFlag(FLAGS.QUOTA_MET, true);
      const anomaly = this.store.poi('anomaly');
      if (anomaly.scanTier < 1) anomaly.scanTier = 1; // a location the find points to, now pre-scanned
      this.store.bus.emit('mission:discovery', { poiId: 'anomaly' });
      transitions = true;
    }

    // satellite launch from the pad: only the arrival is a real transition
    // (the progress bar is read live by the panel, like the Fabricator queue)
    const launched = tickLaunch(this.store, dt);
    if (launched) {
      this.store.bus.emit('satellite:launched', { satId: launched });
      transitions = true;
    }

    // food chain: harvests/contamination and the low-food crossing are real
    // transitions; the meter's continuous drain is read live by the HUD gauge
    const food = tickFood(this.store, dt);
    if (food.harvested) {
      this.store.bus.emit('food:harvest', {});
      transitions = true;
    }
    if (food.contaminated) {
      this.store.bus.emit('food:contaminated', {});
      transitions = true;
    }
    if (food.lowCrossed === 'low') {
      this.store.bus.emit('food:low', {});
      transitions = true;
    } else if (food.lowCrossed === 'ok') {
      this.store.bus.emit('food:restored', {});
      transitions = true;
    }
    // the food gauge ticks down continuously — throttle-notify like fuel
    this.foodNotifyTimer += dt;
    if (this.foodNotifyTimer >= CONTINUOUS_NOTIFY_INTERVAL) {
      this.foodNotifyTimer = 0;
      transitions = true;
    }

    // ambient pressure: drains fuel until the base is minimally self-sufficient
    const active = pressureActive(this.store.state.base.structures);
    if (this.wasPressureActive !== null && active !== this.wasPressureActive) {
      this.store.bus.emit(active ? 'pressure:engaged' : 'pressure:relieved', {});
      transitions = true;
    }
    this.wasPressureActive = active;
    if (active && this.store.state.fuel > 0) {
      this.store.state.fuel = Math.max(0, this.store.state.fuel - BALANCE.landingZone.pressure.fuelDrainPerSec * dt);
      // throttled notify so the top-bar gauge visibly ticks down without
      // forcing a full re-render of whatever DOM-heavy screen is open
      this.drainNotifyTimer += dt;
      if (this.drainNotifyTimer >= CONTINUOUS_NOTIFY_INTERVAL) {
        this.drainNotifyTimer = 0;
        transitions = true;
      }
    }

    // total-wipe failure state (Phase 45): the rare, avoidable game-over — you
    // built a base, lost every last structure to ruins, and starved on top of
    // it. A fresh game (no structures yet) can never hit this.
    if (!this.store.hasFlag(FLAGS.GAME_OVER)) {
      const structs = this.store.state.base.structures;
      const anyStanding = structs.some((s) => s.status === 'active' || s.status === 'building');
      const anyWreck = structs.some((s) => s.status === 'destroyed');
      if (anyWreck && !anyStanding && this.store.state.food.level <= 0) {
        this.store.setFlag(FLAGS.GAME_OVER, true);
        this.store.bus.emit('game:over', {});
        transitions = true;
      }
    }

    // notify only on real transitions/throttled drain ticks — progress %/HP
    // are read live by the UI via panelUpdaters, not this event
    if (transitions) this.store.changed();
  }
}

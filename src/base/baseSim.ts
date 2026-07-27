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
import type { GameStore } from '../core/state';
import { canRepair, repairCost, tickConstruction, tickRepair, type StructureInstance } from './structures';
import { isGeneratorRunning, tickNuclear, tickSolar } from './power';

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

  constructor(private store: GameStore) {}

  tick(dt: number): void {
    let transitions = false;
    let isotopeConsumed = false;
    for (const inst of this.store.state.base.structures) {
      const built = tickConstruction(inst, dt);
      if (built === 'completed') {
        this.store.bus.emit('structure:complete', { uid: inst.uid, defId: inst.defId });
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
    }

    if (isotopeConsumed) {
      this.isotopeNotifyTimer += dt;
      if (this.isotopeNotifyTimer >= CONTINUOUS_NOTIFY_INTERVAL) {
        this.isotopeNotifyTimer = 0;
        transitions = true;
      }
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

    // notify only on real transitions/throttled drain ticks — progress %/HP
    // are read live by the UI via panelUpdaters, not this event
    if (transitions) this.store.changed();
  }
}

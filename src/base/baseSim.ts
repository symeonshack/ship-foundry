/**
 * The Landing Zone base simulation (Landing Zone plan, Phase 8+).
 *
 * Ticked from main.ts every frame — exactly like refinery.update — regardless
 * of which screen is active: construction and repairs keep progressing (and
 * later, power/food/threats keep running) while the player is off flying
 * somewhere else. Screens render whatever state this produced; they never
 * tick it.
 */
import type { GameStore } from '../core/state';
import { canRepair, repairCost, tickConstruction, tickRepair, type StructureInstance } from './structures';

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
  constructor(private store: GameStore) {}

  tick(dt: number): void {
    let transitions = false;
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
    }
    // notify only on real transitions — progress %/HP are read live by the UI
    if (transitions) this.store.changed();
  }
}

import type { GameStore } from '../core/state';
import { recipeById, RECIPES, type Recipe } from '../core/resources';
import { FLAGS } from '../core/flags';

/**
 * Base refinery: raw stock in, refined stock out, in real time — but only at
 * the safe end of the loop. Tier 2 (Refinery Expansion) speeds the line up.
 */
export class Refinery {
  constructor(private store: GameStore) {}

  speed(): number {
    return this.store.state.refinery.tier === 2 ? 1.9 : 1;
  }

  canQueue(recipe: Recipe, units: number): boolean {
    return (this.store.state.stock[recipe.input] ?? 0) >= recipe.inAmount * units;
  }

  /** input is committed up front; output lands as each unit finishes */
  queueJob(recipeId: string, units: number): boolean {
    const recipe = recipeById(recipeId);
    if (units <= 0 || !this.canQueue(recipe, units)) return false;
    this.store.addStock(recipe.input, -recipe.inAmount * units);
    const queue = this.store.state.refinery.queue;
    const existing = queue.find((j) => j.recipeId === recipeId);
    if (existing) {
      existing.unitsTotal += units;
    } else {
      queue.push({ recipeId, unitsTotal: units, unitsDone: 0, progressSec: 0 });
    }
    this.store.changed();
    return true;
  }

  update(dt: number): void {
    const queue = this.store.state.refinery.queue;
    const job = queue[0];
    if (!job) return;
    const recipe = recipeById(job.recipeId);
    job.progressSec += dt * this.speed();
    let dirty = false;
    while (job.progressSec >= recipe.timeSec && job.unitsDone < job.unitsTotal) {
      job.progressSec -= recipe.timeSec;
      job.unitsDone += 1;
      this.store.addStock(recipe.output, recipe.outAmount);
      this.store.setFlag(FLAGS.FIRST_REFINE);
      this.store.bus.emit('refine:complete', { recipeId: recipe.id, output: recipe.output });
      dirty = true;
    }
    if (job.unitsDone >= job.unitsTotal) {
      queue.shift();
      dirty = true;
    }
    if (dirty) this.store.changed();
  }

  recipes(): Recipe[] {
    return RECIPES;
  }
}

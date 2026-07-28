/**
 * Drone catalog + the Fabricator's production queue (Landing Zone plan,
 * Phase 17). Catalog-only for now — a completed job announces itself
 * ("Worker Drone ready") but doesn't spawn a world entity; real `DroneInstance`s
 * with movement and tasks land in Phase 19, wired to this queue in Phase 24.
 */
import type { ResourceCost } from '../core/resources';
import type { GameStore } from '../core/state';
import type { FabricationJob, StructureInstance } from './structures';

export type DroneId = 'worker' | 'hauler';

export interface DroneDef {
  id: DroneId;
  name: string;
  desc: string;
  cost: ResourceCost;
  buildTimeSec: number;
}

export const DRONES: Record<DroneId, DroneDef> = {
  worker: {
    id: 'worker',
    name: 'Worker Drone',
    desc: 'Gathers scattered deposits a stationary rig can\'t reach, then hauls the yield home.',
    cost: { alloy: 3 },
    buildTimeSec: 20,
  },
  hauler: {
    id: 'hauler',
    name: 'Hauler Drone',
    desc: 'Shuttles a deployed rig\'s hopper to the silo automatically.',
    cost: { alloy: 2, ceramic: 1 },
    buildTimeSec: 15,
  },
};

export const DRONE_IDS = Object.keys(DRONES) as DroneId[];

function scaleCost(cost: ResourceCost, n: number): ResourceCost {
  const out: ResourceCost = {};
  for (const [id, amt] of Object.entries(cost)) out[id as keyof ResourceCost] = (amt ?? 0) * n;
  return out;
}

/**
 * Pay for and enqueue n units of a drone type at an active Fabricator.
 * Same shape as Refinery.queueJob: cost is committed up front, matching jobs
 * merge into the existing queue entry rather than creating a duplicate.
 */
export function queueDrone(store: GameStore, inst: StructureInstance, defId: DroneId, units: number): boolean {
  if (inst.defId !== 'fabricator' || inst.status !== 'active' || units <= 0) return false;
  if (!store.spendCost(scaleCost(DRONES[defId].cost, units))) return false;
  if (!inst.queue) inst.queue = [];
  const existing = inst.queue.find((j) => j.defId === defId);
  if (existing) existing.unitsTotal += units;
  else inst.queue.push({ defId, unitsTotal: units, unitsDone: 0, progressSec: 0 });
  store.changed();
  return true;
}

/**
 * Advance the Fabricator's FIFO queue by dt seconds. Returns the drone type
 * for each unit that finished this tick (almost always 0 or 1 — a while loop
 * guards the pathological case of a huge dt covering more than one unit).
 */
export function tickFabricator(inst: StructureInstance, dt: number): DroneId[] {
  const completed: DroneId[] = [];
  if (inst.defId !== 'fabricator' || inst.status !== 'active') return completed;
  const queue = inst.queue;
  const job: FabricationJob | undefined = queue?.[0];
  if (!queue || !job) return completed;
  const def = DRONES[job.defId as DroneId];
  job.progressSec += dt;
  while (job.progressSec >= def.buildTimeSec && job.unitsDone < job.unitsTotal) {
    job.progressSec -= def.buildTimeSec;
    job.unitsDone += 1;
    completed.push(job.defId as DroneId);
  }
  if (job.unitsDone >= job.unitsTotal) queue.shift();
  return completed;
}

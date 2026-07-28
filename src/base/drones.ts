/**
 * Drone catalog, the Fabricator's production queue (Phase 17), and real
 * world-entity movement (Phase 19). A `DroneInstance` exists, can be
 * selected, and can be given a manual move order. Spawning one from a
 * completed Fabricator job is still Phase 24 — until then, `BaseView`'s
 * dev-mode panel spawns one directly so movement/selection/orders can
 * actually be exercised.
 */
import type { Collider } from '../interior/playerController';
import { moveWithCollision } from '../interior/playerController';
import type { ResourceCost } from '../core/resources';
import type { GameStore } from '../core/state';
import { BALANCE } from '../config/balance';
import type { FabricationJob, StructureInstance } from './structures';

export type DroneId = 'worker' | 'hauler';

/** a real, movable, selectable world unit produced by a Fabricator */
export interface DroneInstance {
  uid: string;
  defId: DroneId;
  x: number;
  z: number;
  status: 'idle' | 'moving';
  /** manual move-order destination; cleared on arrival */
  target: { x: number; z: number } | null;
}

/** distance under which a drone counts as having arrived at its target */
const ARRIVE_EPS = 0.05;

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

/**
 * Advance a drone toward its move-order target by dt seconds, sliding along
 * structure footprints the same way the interior player does. Returns
 * `'arrived'` the tick it reaches the target (a real transition worth
 * announcing/refreshing the panel over); ongoing travel is continuous drift,
 * read live by the renderer, like HP/dust/isotope burn elsewhere.
 */
export function tickDroneMove(inst: DroneInstance, dt: number, colliders: Collider[]): 'arrived' | null {
  if (inst.status !== 'moving' || !inst.target) return null;
  const target = inst.target;
  const dx = target.x - inst.x;
  const dz = target.z - inst.z;
  const dist = Math.hypot(dx, dz);
  if (dist > ARRIVE_EPS) {
    const cfg = BALANCE.landingZone.drones;
    const step = Math.min(dist, cfg.moveSpeed * dt);
    const next = moveWithCollision({ x: inst.x, z: inst.z }, (dx / dist) * step, (dz / dist) * step, colliders, cfg.radius);
    inst.x = next.x;
    inst.z = next.z;
  }
  // arrival is checked after moving too, so a single large-dt step that
  // covers the remaining distance reports 'arrived' the same tick
  if (Math.hypot(target.x - inst.x, target.z - inst.z) <= ARRIVE_EPS) {
    inst.x = target.x;
    inst.z = target.z;
    inst.status = 'idle';
    inst.target = null;
    return 'arrived';
  }
  return null;
}

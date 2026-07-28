/**
 * Drone catalog, the Fabricator's production queue (Phase 17), real
 * world-entity movement (Phase 19), and the Worker Drone gather-trip loop
 * (Phase 20). A `DroneInstance` exists, can be selected, and can be given a
 * manual move order or a gather order on a deposit — travel, extraction,
 * carry, and the trip home are all real time, looping automatically until
 * the deposit runs dry. Spawning one from a completed Fabricator job is
 * still Phase 24 — until then, `BaseView`'s dev-mode panel spawns one
 * directly so movement/selection/orders/gathering can actually be exercised.
 */
import type { Collider } from '../interior/playerController';
import { moveWithCollision } from '../interior/playerController';
import type { ResourceCost } from '../core/resources';
import type { GameStore } from '../core/state';
import { BALANCE } from '../config/balance';
import { storageCapacity, type FabricationJob, type StructureInstance } from './structures';

export type DroneId = 'worker' | 'hauler';

/** the home site's poi id — drones live and work at the Landing Zone only */
const HOME_POI = 'foundry';

/** a real, movable, selectable world unit produced by a Fabricator */
export interface DroneInstance {
  uid: string;
  defId: DroneId;
  x: number;
  z: number;
  status: 'idle' | 'moving' | 'gathering' | 'returning';
  /** current movement destination; cleared on arrival */
  target: { x: number; z: number } | null;
  /** worker drones on a gather loop: the deposit they're assigned to */
  nodeId?: string;
  /** worker drones: raw units currently held, banked to stock on return */
  carrying?: number;
  /** worker drones: where to bring the haul back to (wherever the order was given from) */
  returnX?: number;
  returnZ?: number;
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
  // 'returning' is the gather loop's trip home — physically identical travel,
  // just tagged differently so the panel/task logic knows which leg it is
  if ((inst.status !== 'moving' && inst.status !== 'returning') || !inst.target) return null;
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

/** issue a manual move order — clears any gather assignment (this is a recall) */
export function orderMove(drone: DroneInstance, x: number, z: number): void {
  drone.nodeId = undefined;
  drone.carrying = 0;
  drone.target = { x, z };
  drone.status = 'moving';
}

/** issue a gather order on a deposit — the return leg comes back to wherever the drone is now */
export function orderGather(drone: DroneInstance, nodeId: string, nodeX: number, nodeZ: number): void {
  drone.returnX = drone.x;
  drone.returnZ = drone.z;
  drone.nodeId = nodeId;
  drone.carrying = 0;
  drone.target = { x: nodeX, z: nodeZ };
  drone.status = 'moving';
}

function totalStock(store: GameStore): number {
  return Object.values(store.state.stock).reduce((a: number, b) => a + b, 0);
}

/** extract from the assigned node while parked on it; heads home once full or the deposit runs dry */
function tickGather(store: GameStore, drone: DroneInstance, dt: number): void {
  const cfg = BALANCE.landingZone.drones;
  const node = (store.poi(HOME_POI).nodes ?? []).find((n) => n.id === drone.nodeId);
  if (!node || node.remaining <= 0) {
    drone.status = 'returning';
    drone.target = { x: drone.returnX ?? drone.x, z: drone.returnZ ?? drone.z };
    return;
  }
  const room = cfg.carryCapacity - (drone.carrying ?? 0);
  const take = Math.min(cfg.gatherRate * dt, node.remaining, room);
  node.remaining -= take;
  drone.carrying = (drone.carrying ?? 0) + take;
  if (node.remaining <= 0 || (drone.carrying ?? 0) >= cfg.carryCapacity) {
    drone.status = 'returning';
    drone.target = { x: drone.returnX ?? drone.x, z: drone.returnZ ?? drone.z };
  }
}

/**
 * Bank whatever's carried the moment the drone gets home. Whole units only,
 * same convention as rig extraction; a fractional remainder just waits for
 * next trip's accumulation rather than being lost. Respects the same
 * storage cap rigs do — if the base is full, the drone parks at the return
 * point and keeps retrying every tick rather than dropping the haul.
 */
function tickReturn(store: GameStore, drone: DroneInstance): void {
  const node = (store.poi(HOME_POI).nodes ?? []).find((n) => n.id === drone.nodeId);
  const carrying = drone.carrying ?? 0;
  if (node && carrying >= 1) {
    const room = Math.max(0, storageCapacity(store.state.base.structures) - totalStock(store));
    const bankable = Math.min(Math.floor(carrying), room);
    if (bankable > 0) {
      store.addStock(node.resource, bankable);
      drone.carrying = carrying - bankable;
    }
  }
  if ((drone.carrying ?? 0) >= 1) {
    // storage is full — hold position and retry next tick
    drone.status = 'returning';
    drone.target = { x: drone.x, z: drone.z };
    return;
  }
  if (node && node.remaining > 0) {
    drone.carrying = 0;
    drone.target = { x: node.x, z: node.z };
    drone.status = 'moving';
  } else {
    drone.nodeId = undefined;
    drone.carrying = 0;
    drone.status = 'idle';
  }
}

/**
 * Advance a drone's full task state by dt seconds: movement (Phase 19) plus
 * the Worker Drone gather loop (Phase 20) — travel to the deposit, extract,
 * carry, travel home, bank, and repeat until the deposit runs dry. Ticked
 * from BaseSim, so the loop keeps running whether or not the base screen is
 * open, same as every other Landing Zone system.
 */
export function tickDroneTask(store: GameStore, drone: DroneInstance, dt: number, colliders: Collider[]): void {
  if (drone.status === 'gathering') {
    tickGather(store, drone, dt);
    return;
  }
  const wasStatus = drone.status;
  if (tickDroneMove(drone, dt, colliders) !== 'arrived') return;
  if (wasStatus === 'moving' && drone.nodeId) {
    const node = (store.poi(HOME_POI).nodes ?? []).find((n) => n.id === drone.nodeId);
    if (node && node.remaining > 0) drone.status = 'gathering';
    else drone.nodeId = undefined;
  } else if (wasStatus === 'returning') {
    tickReturn(store, drone);
  }
}

/**
 * Drone catalog + all drone behaviour:
 *  - Fabricator production queue (Phase 17)
 *  - real world-entity movement (Phase 19)
 *  - Worker Drone gather-trip loop (Phase 20)
 *  - rally point for new drones (Phase 21)
 *  - Hauler Drone automation (Phase 23): an idle hauler attaches itself to a
 *    gathering worker and ferries that worker's output to base, so the worker
 *    stays parked at the deposit mining instead of walking home each load.
 *
 * Everything ticks in BaseSim (see tickDroneTask) rather than any screen, so
 * it keeps running whether or not the base view is open — which is exactly
 * why haulers service worker drones (all in base state) and not the deployed
 * rigs (session-scoped, gone the moment you leave the surface screen).
 *
 * A completed Fabricator job now rolls a real drone out onto the site via
 * spawnDrone (Phase 24), so production is the live gameplay path; BaseView's
 * dev-mode spawn buttons remain only as a testing shortcut.
 */
import type { Collider } from '../interior/playerController';
import { moveWithCollision } from '../interior/playerController';
import type { RawResourceId, ResourceCost } from '../core/resources';
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
  status: 'idle' | 'moving' | 'gathering' | 'returning' | 'sheltered';
  /** current movement destination; cleared on arrival */
  target: { x: number; z: number } | null;
  /** garrison/shelter (Phase 60): en route to shelter → becomes 'sheltered' on arrival */
  sheltering?: boolean;
  /** worker drones on a gather loop: the deposit they're assigned to */
  nodeId?: string;
  /** units currently held — banked to stock on return (workers) / delivery (haulers) */
  carrying?: number;
  /** worker drones: where to bring the haul back to (wherever the order was given from) */
  returnX?: number;
  returnZ?: number;
  /** hauler drones (Phase 23): uid of the worker this hauler is ferrying for */
  haulTarget?: string;
  /** worker drones (Phase 23): uid of the hauler currently servicing this worker */
  hauledBy?: string;
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
    desc: 'Attaches to a gathering worker and ferries its haul to base automatically, so the worker never stops mining.',
    cost: { alloy: 2, ceramic: 1 },
    buildTimeSec: 15,
  },
};

export const DRONE_IDS = Object.keys(DRONES) as DroneId[];

/**
 * Create a drone at (x, z) and push it onto base state. If a rally point is
 * set it immediately reports there (Phase 21) — the "default destination for
 * new drones." Used by the dev-spawn panel now; the Fabricator-completion
 * path (Phase 24) will call this same helper.
 */
export function spawnDrone(store: GameStore, defId: DroneId, x: number, z: number): DroneInstance {
  const drone: DroneInstance = { uid: store.uid('d'), defId, x, z, status: 'idle', target: null };
  store.state.base.drones.push(drone);
  const rally = store.state.base.rallyPoint;
  if (rally) orderMove(drone, rally.x, rally.z);
  return drone;
}

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

/** issue a manual move order — clears any gather/haul assignment (a recall) */
export function orderMove(drone: DroneInstance, x: number, z: number): void {
  drone.nodeId = undefined;
  drone.carrying = 0;
  drone.haulTarget = undefined; // hauler: stop auto-hauling
  drone.hauledBy = undefined; // worker: detach from its hauler (which self-heals)
  drone.target = { x, z };
  drone.status = 'moving';
}

/**
 * Formation offsets for moving N drones to one point (Phase 59): a filled
 * centre plus concentric rings, so a group spreads out instead of stacking on
 * a single spot. Returned in drone order; index 0 is the centre.
 */
export function formationOffsets(n: number, spacing = 1.3): { dx: number; dz: number }[] {
  if (n <= 1) return [{ dx: 0, dz: 0 }];
  const out: { dx: number; dz: number }[] = [{ dx: 0, dz: 0 }];
  let ring = 1;
  while (out.length < n) {
    const count = ring * 6;
    for (let i = 0; i < count && out.length < n; i++) {
      const a = (i / count) * Math.PI * 2;
      out.push({ dx: Math.cos(a) * ring * spacing, dz: Math.sin(a) * ring * spacing });
    }
    ring += 1;
  }
  return out;
}

/**
 * Gently push overlapping drones apart each tick (Phase 59) so they don't
 * bunch on top of each other or path through one another. Sheltered drones
 * stay put. O(n²), fine for the small home roster.
 */
export function separateDrones(drones: DroneInstance[], minSep = 0.9): void {
  for (let i = 0; i < drones.length; i++) {
    const a = drones[i]!;
    if (a.status === 'sheltered') continue;
    for (let j = i + 1; j < drones.length; j++) {
      const b = drones[j]!;
      if (b.status === 'sheltered') continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-4 && d < minSep) {
        const push = (minSep - d) * 0.25;
        const ux = dx / d;
        const uz = dz / d;
        a.x -= ux * push;
        a.z -= uz * push;
        b.x += ux * push;
        b.z += uz * push;
      }
    }
  }
}

/** send a drone to shelter at (x,z) — it becomes 'sheltered' (hazard-safe) on arrival */
export function orderShelter(drone: DroneInstance, x: number, z: number): void {
  drone.nodeId = undefined;
  drone.carrying = 0;
  drone.haulTarget = undefined;
  drone.hauledBy = undefined;
  drone.sheltering = true;
  drone.target = { x, z };
  drone.status = 'moving';
}

/** bring every sheltered/sheltering drone back out to idle (after a hazard passes) */
export function unshelterAll(store: GameStore): number {
  let n = 0;
  for (const d of store.state.base.drones) {
    if (d.status === 'sheltered' || d.sheltering) {
      d.status = 'idle';
      d.sheltering = false;
      d.target = null;
      n += 1;
    }
  }
  return n;
}

/**
 * Send all drones to shelter at the nearest active structure. Returns how many
 * were ordered (0 if there's nowhere to shelter). The base drop point is the
 * fallback so drones still huddle at the pad when nothing else stands.
 */
export function shelterAll(store: GameStore): number {
  const structures = store.state.base.structures.filter((s) => s.status === 'active');
  let n = 0;
  for (const d of store.state.base.drones) {
    if (d.status === 'sheltered' || d.sheltering) continue;
    let best: { x: number; z: number } | null = null;
    let bestDist = Infinity;
    for (const s of structures) {
      const dist = Math.hypot(s.x - d.x, s.z - d.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: s.x, z: s.z };
      }
    }
    orderShelter(d, best?.x ?? baseDropPoint(store).x, best?.z ?? baseDropPoint(store).z);
    n += 1;
  }
  return n;
}

/** issue a gather order on a deposit — the return leg comes back to wherever the drone is now */
export function orderGather(drone: DroneInstance, nodeId: string, nodeX: number, nodeZ: number): void {
  drone.returnX = drone.x;
  drone.returnZ = drone.z;
  drone.nodeId = nodeId;
  drone.carrying = 0;
  drone.hauledBy = undefined; // a fresh order detaches any old hauler (which self-heals)
  drone.target = { x: nodeX, z: nodeZ };
  drone.status = 'moving';
}

function totalStock(store: GameStore): number {
  return Object.values(store.state.stock).reduce((a: number, b) => a + b, 0);
}

/** the base's drop-off point for hauled resources — the Fabricator, else a
 * silo, else the origin (the lander pad) */
function baseDropPoint(store: GameStore): { x: number; z: number } {
  const s = store.state.base.structures;
  const drop =
    s.find((b) => b.status === 'active' && b.defId === 'fabricator') ??
    s.find((b) => b.status === 'active' && b.defId === 'storageSilo');
  return drop ? { x: drop.x, z: drop.z } : { x: 0, z: 0 };
}

/**
 * Bank whole carried units to stock, respecting the storage cap (a fractional
 * remainder waits for the next accumulation rather than being lost). Leaves
 * `carrying` holding whatever didn't fit, so callers can detect a full base.
 */
function bankCarry(store: GameStore, drone: DroneInstance, resource: RawResourceId | undefined): void {
  const carrying = drone.carrying ?? 0;
  if (!resource || carrying < 1) return;
  const room = Math.max(0, storageCapacity(store.state.base.structures) - totalStock(store));
  const bankable = Math.min(Math.floor(carrying), room);
  if (bankable > 0) {
    store.addStock(resource, bankable);
    drone.carrying = carrying - bankable;
  }
}

function nodeById(store: GameStore, id: string | undefined) {
  return (store.poi(HOME_POI).nodes ?? []).find((n) => n.id === id);
}

/**
 * Extract from the assigned node while parked on it. A worker with no hauler
 * heads home once full or the deposit runs dry (Phase 20); a worker being
 * serviced by a hauler (Phase 23) instead stays put and lets its haul be
 * ferried away, only going idle once the deposit is spent and drained.
 */
function tickGather(store: GameStore, drone: DroneInstance, dt: number): void {
  const cfg = BALANCE.landingZone.drones;
  const hauled = !!drone.hauledBy;
  const node = nodeById(store, drone.nodeId);
  if (!node || node.remaining <= 0) {
    if (hauled) {
      // deposit spent: keep the last load for the hauler to grab, then idle
      drone.nodeId = undefined;
      if ((drone.carrying ?? 0) <= 0) drone.status = 'idle';
      return;
    }
    drone.status = 'returning';
    drone.target = { x: drone.returnX ?? drone.x, z: drone.returnZ ?? drone.z };
    return;
  }
  const room = cfg.carryCapacity - (drone.carrying ?? 0);
  const take = Math.min(cfg.gatherRate * dt, node.remaining, room);
  node.remaining -= take;
  drone.carrying = (drone.carrying ?? 0) + take;
  // a hauled worker never returns itself — it waits at the node for pickup
  if (!hauled && (node.remaining <= 0 || (drone.carrying ?? 0) >= cfg.carryCapacity)) {
    drone.status = 'returning';
    drone.target = { x: drone.returnX ?? drone.x, z: drone.returnZ ?? drone.z };
  }
}

/**
 * The worker self-haul trip home (Phase 20): bank, then either loop back to
 * the still-live deposit or go idle once it's spent. Holds position and
 * retries if the base is full rather than dropping the haul.
 */
function tickReturn(store: GameStore, drone: DroneInstance): void {
  const node = nodeById(store, drone.nodeId);
  bankCarry(store, drone, node?.resource);
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

function releaseHauler(hauler: DroneInstance): void {
  hauler.haulTarget = undefined;
  hauler.nodeId = undefined;
  hauler.carrying = 0;
  hauler.target = null;
  hauler.status = 'idle';
}

/**
 * Reconcile hauler↔worker links and hand idle haulers a worker to service.
 * Called once per tick before the per-drone task loop. Kept separate from
 * tickHauler so link bookkeeping happens in one place regardless of ordering.
 */
export function manageHaulers(store: GameStore): void {
  const drones = store.state.base.drones;
  // heal stale back-refs: a worker whose hauler no longer points at it (e.g.
  // the hauler got a manual move order) is no longer serviced
  for (const w of drones) {
    if (w.defId !== 'worker' || !w.hauledBy) continue;
    const h = drones.find((d) => d.uid === w.hauledBy);
    if (!h || h.haulTarget !== w.uid) w.hauledBy = undefined;
  }
  // assign each free, idle hauler to the nearest un-serviced worker that's
  // gathering (or on its way to a deposit)
  for (const h of drones) {
    if (h.defId !== 'hauler' || h.haulTarget || h.status !== 'idle') continue;
    let best: DroneInstance | null = null;
    let bestDist = Infinity;
    for (const w of drones) {
      if (w.defId !== 'worker' || w.hauledBy) continue;
      if (w.status !== 'gathering' && !(w.status === 'moving' && w.nodeId)) continue;
      const dist = Math.hypot(w.x - h.x, w.z - h.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }
    if (best) {
      best.hauledBy = h.uid;
      h.haulTarget = best.uid;
      h.status = 'moving';
    }
  }
}

/**
 * A hauler's shuttle loop (Phase 23): with no assignment it just honours
 * manual move orders; assigned to a worker it loads that worker's haul at the
 * deposit, delivers to the base drop point once it has a worthwhile load (or
 * the worker's done), banks, and repeats — releasing the worker when the
 * deposit is spent or the worker was re-tasked.
 */
function tickHauler(store: GameStore, hauler: DroneInstance, dt: number, colliders: Collider[]): void {
  if (!hauler.haulTarget) {
    tickDroneMove(hauler, dt, colliders); // honour a manual move order
    return;
  }
  const cfg = BALANCE.landingZone.drones;
  const cap = cfg.haulerCarry;
  const worker = store.state.base.drones.find((d) => d.uid === hauler.haulTarget);
  const attached = !!worker && worker.hauledBy === hauler.uid;
  const workerDone = !attached || worker!.status === 'idle';
  const carrying = hauler.carrying ?? 0;

  // deliver once we've batched a full load, or the worker's finished and we
  // hold anything worth banking
  if (carrying >= cap || (workerDone && carrying >= 1)) {
    hauler.status = 'returning';
    hauler.target = baseDropPoint(store);
    if (tickDroneMove(hauler, dt, colliders) === 'arrived') {
      bankCarry(store, hauler, nodeById(store, hauler.nodeId)?.resource);
      if ((hauler.carrying ?? 0) >= 1) {
        hauler.target = { x: hauler.x, z: hauler.z }; // base full — hold & retry
        hauler.status = 'returning';
      } else if (workerDone) {
        releaseHauler(hauler);
      } else {
        hauler.carrying = 0;
        hauler.target = null; // empty — head back to the worker next tick
      }
    }
    return;
  }

  // otherwise go to the worker and load whatever it's holding
  if (!attached) {
    releaseHauler(hauler);
    return;
  }
  hauler.status = 'moving';
  hauler.target = { x: worker!.x, z: worker!.z };
  if (tickDroneMove(hauler, dt, colliders) === 'arrived') {
    hauler.nodeId = worker!.nodeId ?? hauler.nodeId; // remember what we're carrying
    const room = cap - (hauler.carrying ?? 0);
    const take = Math.min(worker!.carrying ?? 0, room);
    worker!.carrying = (worker!.carrying ?? 0) - take;
    hauler.carrying = (hauler.carrying ?? 0) + take;
    if (worker!.status === 'idle' && (hauler.carrying ?? 0) < 1) releaseHauler(hauler);
  }
}

/**
 * Advance a drone's full task state by dt seconds: hauler shuttle (Phase 23),
 * or worker movement (Phase 19) + gather loop (Phase 20). Ticked from BaseSim
 * so it keeps running whether or not the base screen is open, same as every
 * other Landing Zone system.
 */
export function tickDroneTask(store: GameStore, drone: DroneInstance, dt: number, colliders: Collider[]): void {
  // garrison/shelter (Phase 60): a sheltered drone sits tight; one en route to
  // shelter moves there and becomes sheltered on arrival
  if (drone.status === 'sheltered') return;
  if (drone.sheltering) {
    if (tickDroneMove(drone, dt, colliders) === 'arrived') {
      drone.status = 'sheltered';
      drone.sheltering = false;
    }
    return;
  }
  if (drone.defId === 'hauler') {
    tickHauler(store, drone, dt, colliders);
    return;
  }
  if (drone.status === 'gathering') {
    tickGather(store, drone, dt);
    return;
  }
  const wasStatus = drone.status;
  if (tickDroneMove(drone, dt, colliders) !== 'arrived') return;
  if (wasStatus === 'moving' && drone.nodeId) {
    const node = nodeById(store, drone.nodeId);
    if (node && node.remaining > 0) drone.status = 'gathering';
    else drone.nodeId = undefined;
  } else if (wasStatus === 'returning') {
    tickReturn(store, drone);
  }
}

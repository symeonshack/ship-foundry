import type { EventBus } from './events';
import type { FlagValue } from './flags';
import {
  ALL_RESOURCE_IDS,
  type RawResourceId,
  type ResourceCost,
  type ResourceId,
} from './resources';
import type { PartId } from '../building/partCatalog';
import type { StructureInstance } from '../base/structures';
import type { DroneInstance } from '../base/drones';

export type { StructureInstance, DroneInstance };

export interface PartPlacement {
  uid: string;
  partId: PartId;
  /** uid of the parent placement, or null for the root hull */
  parent: string | null;
  /** index into the parent part's sockets array */
  socket: number;
}

export interface RefineJob {
  recipeId: string;
  unitsTotal: number;
  unitsDone: number;
  progressSec: number;
}

export interface NodeState {
  id: string;
  resource: RawResourceId;
  remaining: number;
  x: number;
  z: number;
  /** unstable-terrain sites: seconds of mining before the node collapses; null = stable */
  collapseIn: number | null;
}

export interface PoiState {
  scanTier: 0 | 1 | 2;
  visited: boolean;
  /** deposit nodes, generated on first visit */
  nodes: NodeState[] | null;
  /** deposit-layout schema version; older saves get node positions re-spread on next visit */
  layoutV?: number;
  /** charted site features — vein/landmark ids the player has discovered (Phase 3) */
  charted: string[];
}

export interface LogEntry {
  key: string;
  title: string;
  body: string;
  source: string;
  at: number;
  /** optional topic the player can raise with GERTY from the logbook */
  topicId?: string;
}

export type EncounterModuleType = 'strut' | 'conduit' | 'emitter' | 'damper';

export interface EncounterModule {
  socket: number;
  type: EncounterModuleType;
  placedBy: 'player' | 'collaborator';
}

export interface EncounterState {
  started: boolean;
  solved: boolean;
  turnCount: number;
  modules: EncounterModule[];
}

/** the Archive at Site Null (Phase 4) */
export interface StructureState {
  panelOpened: boolean;
  maintOpen: boolean;
  fragmentTaken: boolean;
  logsRead: string[];
}

/**
 * Landing Zone base-building state (mining-ops Landing Zone plan).
 * `StructureInstance` and `DroneInstance` are the real catalog-backed shapes
 * from `src/base/structures.ts` and `src/base/drones.ts` respectively.
 *
 * Deliberately a top-level `GameState` field, not nested under `pois.foundry`:
 * Landing Zone is semantically singular and must keep simulating every frame
 * regardless of which screen is active, unlike per-POI fields that only
 * matter while that POI's own screen instance is alive.
 */
export interface BaseState {
  structures: StructureInstance[];
  drones: DroneInstance[];
  rallyPoint: { x: number; z: number } | null;
}

export interface GameState {
  version: 1;
  createdAt: number;
  playSeconds: number;
  uidCounter: number;

  stock: Record<ResourceId, number>;
  fuel: number;
  cargo: Partial<Record<RawResourceId, number>>;
  ship: PartPlacement[];
  currentPoi: string;
  pois: Record<string, PoiState>;
  refinery: { tier: 1 | 2; queue: RefineJob[] };
  flags: Record<string, FlagValue>;
  log: LogEntry[];
  gertySeen: Record<string, { count: number; lastAt: number }>;
  encounter: EncounterState;
  /** carried tools/components (Phase 4) */
  items: string[];
  structure: StructureState;
  /** Landing Zone's persistent home-base simulation state */
  base: BaseState;
}

export function createNewGame(): GameState {
  const stock = Object.fromEntries(ALL_RESOURCE_IDS.map((id) => [id, 0])) as Record<ResourceId, number>;
  // salvage from the deployment platform — enough to make the first excursion decisions matter
  stock.alloy = 4;
  stock.ceramic = 2;
  stock.fuel = 8;

  return {
    version: 1,
    createdAt: Date.now(),
    playSeconds: 0,
    uidCounter: 100,
    stock,
    fuel: 24,
    cargo: {},
    ship: [
      { uid: 'p1', partId: 'hullS', parent: null, socket: -1 },
      // twin thrusters on the two mount hardpoints — enough to carry the ring
      { uid: 'p2', partId: 'engine1', parent: 'p1', socket: 1 },
      { uid: 'p3', partId: 'engine1', parent: 'p1', socket: 2 },
      { uid: 'p4', partId: 'tank', parent: 'p1', socket: 3 },
      { uid: 'p5', partId: 'lifeSupport', parent: 'p1', socket: 4 },
      { uid: 'p6', partId: 'sensor1', parent: 'p1', socket: 5 },
      { uid: 'p7', partId: 'drillRig', parent: 'p1', socket: 6 },
      // the habitat centrifuge ring, seated on the hull's top structural hardpoint
      { uid: 'p8', partId: 'habitatRing', parent: 'p1', socket: 0 },
    ],
    currentPoi: 'foundry',
    pois: {},
    refinery: { tier: 1, queue: [] },
    // FLAGS.FOUNDRY_BUILT starts unset: the shipyard is locked until a
    // Foundry structure is actually built at the Landing Zone (Phase 16) —
    // BaseSim sets it the moment that construction completes.
    flags: {},
    log: [],
    gertySeen: {},
    encounter: { started: false, solved: false, turnCount: 0, modules: [] },
    items: [],
    structure: { panelOpened: false, maintOpen: false, fragmentTaken: false, logsRead: [] },
    base: { structures: [], drones: [], rallyPoint: null },
  };
}

export class GameStore {
  constructor(
    public bus: EventBus,
    public state: GameState,
  ) {}

  uid(prefix: string): string {
    this.state.uidCounter += 1;
    return `${prefix}${this.state.uidCounter}`;
  }

  changed(): void {
    this.bus.emit('state:changed', {});
  }

  // ---- resources ----

  addStock(id: ResourceId, n: number): void {
    this.state.stock[id] = Math.max(0, (this.state.stock[id] ?? 0) + n);
    this.changed();
  }

  canAfford(cost: ResourceCost): boolean {
    return Object.entries(cost).every(([id, n]) => (this.state.stock[id as ResourceId] ?? 0) >= n);
  }

  spendCost(cost: ResourceCost): boolean {
    if (!this.canAfford(cost)) return false;
    for (const [id, n] of Object.entries(cost)) this.state.stock[id as ResourceId] -= n;
    this.changed();
    return true;
  }

  refundCost(cost: ResourceCost): void {
    for (const [id, n] of Object.entries(cost)) this.state.stock[id as ResourceId] += n;
    this.changed();
  }

  // ---- cargo ----

  cargoTotal(): number {
    return Object.values(this.state.cargo).reduce((a, b) => a + b, 0);
  }

  /** add mined material to the hold, clamped to capacity; returns amount actually stowed */
  addCargo(id: RawResourceId, n: number, capacity: number): number {
    const space = Math.max(0, capacity - this.cargoTotal());
    const added = Math.min(space, n);
    if (added > 0) {
      this.state.cargo[id] = (this.state.cargo[id] ?? 0) + added;
      this.changed();
    }
    return added;
  }

  /** jettison up to n units of a held resource; returns the amount actually dumped */
  dumpCargo(id: RawResourceId, n: number): number {
    const have = this.state.cargo[id] ?? 0;
    const removed = Math.min(have, n);
    if (removed <= 0) return 0;
    const left = have - removed;
    if (left <= 0.001) delete this.state.cargo[id];
    else this.state.cargo[id] = left;
    this.changed();
    return removed;
  }

  unloadCargo(): void {
    let any = false;
    for (const [id, n] of Object.entries(this.state.cargo)) {
      if (n > 0) {
        this.state.stock[id as RawResourceId] += n;
        any = true;
      }
    }
    this.state.cargo = {};
    if (any) {
      this.bus.emit('cargo:unloaded', {});
      this.changed();
    }
  }

  // ---- flags ----

  setFlag(flag: string, value: FlagValue = true): void {
    if (this.state.flags[flag] === value) return;
    this.state.flags[flag] = value;
    this.bus.emit('flag:set', { flag, value });
  }

  getFlag(flag: string): FlagValue | undefined {
    return this.state.flags[flag];
  }

  hasFlag(flag: string): boolean {
    return !!this.state.flags[flag];
  }

  // ---- pois ----

  poi(id: string): PoiState {
    let p = this.state.pois[id];
    if (!p) {
      p = { scanTier: 0, visited: false, nodes: null, charted: [] };
      this.state.pois[id] = p;
    }
    if (!p.charted) p.charted = []; // saves from before Phase 3
    return p;
  }

  // ---- log ----

  pushLog(entry: LogEntry): void {
    if (this.state.log.some((e) => e.key === entry.key)) return;
    this.state.log.push(entry);
    this.bus.emit('fragment:found', { key: entry.key });
    this.changed();
  }
}

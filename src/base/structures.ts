/**
 * Landing Zone structure catalog (Landing Zone plan, Phase 5).
 *
 * Deliberately NOT built on partCatalog's ship-socket model — structures have
 * a world position, a ground footprint, construction time, and HP; ship parts
 * have none of those. Per-structure data lives here as catalog entries (same
 * convention as PARTS in building/partCatalog.ts); cross-cutting factors
 * (construction HP ramp, repair/rebuild economics, terrain slope limits) live
 * in BALANCE.landingZone.structures.
 *
 * Costs/HP are first-pass placeholders shaped by the mission arc
 * (solar → refinery/storage → foundry → nuclear → launch pad); each structure
 * gets its real behavior — and a tuning pass — in its own Part III phase.
 *
 * Build times follow the classic AoE/StarCraft tier bands so pacing reads
 * instantly: economy/basic structures 20–40s, production/tech 40–80s,
 * endgame/keystone 60–120s.
 */
import type { ResourceCost } from '../core/resources';
import { BALANCE } from '../config/balance';

export type StructureId =
  | 'solarArray'
  | 'storageSilo'
  | 'refineryBuilding'
  | 'powerRelay'
  | 'fabricator'
  | 'soilProcessor'
  | 'greenhouse'
  | 'foundry'
  | 'nuclearGenerator'
  | 'launchPad';

export type StructureCategory = 'power' | 'production' | 'storage' | 'food' | 'launch';

export interface StructureDef {
  id: StructureId;
  name: string;
  desc: string;
  /** ground footprint, world units (AABB, centered on the instance position) */
  footprint: { w: number; d: number };
  cost: ResourceCost;
  buildTimeSec: number;
  maxHp: number;
  /** structures that must be standing (status 'active') before this one can be built */
  prereq: StructureId[];
  /** steady draw while active */
  powerDemand?: number;
  /** steady output while active (solar's day/night derate applies on top — Phase 13) */
  powerSupply?: number;
  category: StructureCategory;
}

export interface StructureInstance {
  uid: string;
  defId: StructureId;
  x: number;
  z: number;
  rotY: number;
  hp: number;
  /** 0..1; construction completes at 1 (Phase 8) */
  buildProgress: number;
  status: 'building' | 'active' | 'destroyed';
  /** a paid repair is in progress (Phase 9); absent/false on old saves */
  repairing?: boolean;
}

export const STRUCTURES: Record<StructureId, StructureDef> = {
  solarArray: {
    id: 'solarArray',
    name: 'Solar Array',
    desc: 'First power. Output follows the day/night cycle and dust slowly buries it.',
    footprint: { w: 3, d: 3 },
    cost: { alloy: 3, ceramic: 2 },
    buildTimeSec: 25,
    maxHp: 60,
    prereq: [],
    powerSupply: 10,
    category: 'power',
  },
  storageSilo: {
    id: 'storageSilo',
    name: 'Storage Silo',
    desc: 'Holds the stockpile against weather and time. Production needs somewhere to put things.',
    footprint: { w: 2.5, d: 2.5 },
    cost: { alloy: 2, ceramic: 3 },
    buildTimeSec: 20,
    maxHp: 80,
    prereq: [],
    category: 'storage',
  },
  refineryBuilding: {
    id: 'refineryBuilding',
    name: 'Refinery',
    desc: 'On-site processing: raw material in, usable stock out. Needs ground power.',
    footprint: { w: 4, d: 3 },
    cost: { alloy: 4, ceramic: 3 },
    buildTimeSec: 45,
    maxHp: 70,
    prereq: ['solarArray'],
    powerDemand: 3,
    category: 'production',
  },
  powerRelay: {
    id: 'powerRelay',
    name: 'Power Relay',
    desc: 'Distribution backbone. Caps how many rigs and drones can run at once.',
    footprint: { w: 1.5, d: 1.5 },
    cost: { alloy: 2, ceramic: 1 },
    buildTimeSec: 20,
    maxHp: 40,
    prereq: ['solarArray'],
    category: 'power',
  },
  fabricator: {
    id: 'fabricator',
    name: 'Fabricator',
    desc: 'Produces worker and hauler drones. The base starts building itself.',
    footprint: { w: 4, d: 4 },
    cost: { alloy: 6, ceramic: 4 },
    buildTimeSec: 50,
    maxHp: 80,
    prereq: ['refineryBuilding', 'powerRelay'],
    powerDemand: 2,
    category: 'production',
  },
  soilProcessor: {
    id: 'soilProcessor',
    name: 'Soil Processor',
    desc: 'Combines fertilizer with sterile regolith into a growing medium.',
    footprint: { w: 2, d: 2 },
    cost: { alloy: 2, ceramic: 2 },
    buildTimeSec: 25,
    maxHp: 50,
    prereq: ['solarArray'],
    powerDemand: 1,
    category: 'food',
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Greenhouse',
    desc: 'Sealed, pressurized, alive. The food line — and as weather-vulnerable as everything else.',
    footprint: { w: 4, d: 3 },
    cost: { alloy: 4, ceramic: 4 },
    buildTimeSec: 45,
    maxHp: 50,
    prereq: ['soilProcessor'],
    powerDemand: 2,
    category: 'food',
  },
  foundry: {
    id: 'foundry',
    name: 'Foundry',
    desc: 'Ship fabrication and repair. The base stops being a camp when this comes online.',
    footprint: { w: 5, d: 4 },
    cost: { alloy: 10, ceramic: 6 },
    buildTimeSec: 90,
    maxHp: 120,
    prereq: ['storageSilo', 'refineryBuilding', 'powerRelay'],
    powerDemand: 4,
    category: 'production',
  },
  nuclearGenerator: {
    id: 'nuclearGenerator',
    name: 'Nuclear Generator',
    desc: 'Steady power, day and night, dust or clear — for as long as the isotopes hold out.',
    footprint: { w: 3, d: 3 },
    cost: { alloy: 8, ceramic: 4, isotope: 2 },
    buildTimeSec: 75,
    maxHp: 90,
    prereq: ['foundry'],
    powerSupply: 25,
    category: 'power',
  },
  launchPad: {
    id: 'launchPad',
    name: 'Launch Pad',
    desc: 'The way to orbit. One launch at a time; the satellite array starts here.',
    footprint: { w: 6, d: 6 },
    cost: { alloy: 8, ceramic: 6 },
    buildTimeSec: 60,
    maxHp: 100,
    prereq: ['foundry'],
    category: 'launch',
  },
};

export const STRUCTURE_IDS = Object.keys(STRUCTURES) as StructureId[];

/** damaged is derived, never stored — hp below max on a standing structure */
export function isDamaged(inst: StructureInstance): boolean {
  return inst.status === 'active' && inst.hp < STRUCTURES[inst.defId].maxHp;
}

/** on-site stockpile capacity: a base allowance plus each active Storage Silo.
 * Home-site mining stalls once the total stockpile reaches this. */
export function storageCapacity(structures: readonly StructureInstance[]): number {
  const silos = structures.filter((s) => s.status === 'active' && s.defId === 'storageSilo').length;
  return BALANCE.landingZone.storage.baseCap + silos * BALANCE.landingZone.storage.perSilo;
}

/**
 * Whether a structure's build-order prerequisites are met right now: every
 * prereq must be *standing* (status 'active' — one still under construction
 * or ruined doesn't count). The reason names every missing prereq so the
 * build menu can tell the player exactly what to build first.
 */
export function canBuild(
  defId: StructureId,
  structures: readonly StructureInstance[],
): { ok: boolean; reason?: string } {
  const active = new Set(structures.filter((s) => s.status === 'active').map((s) => s.defId));
  const missing = STRUCTURES[defId].prereq.filter((p) => !active.has(p));
  if (missing.length === 0) return { ok: true };
  return { ok: false, reason: `Requires ${missing.map((p) => STRUCTURES[p].name).join(', ')}` };
}

/** max HP while under construction ramps from the configured start fraction to full (Phase 8) */
export function maxHpNow(inst: StructureInstance): number {
  const def = STRUCTURES[inst.defId];
  if (inst.status !== 'building') return def.maxHp;
  const f = BALANCE.landingZone.structures.hpFractionAtStart;
  return def.maxHp * (f + (1 - f) * inst.buildProgress);
}

/**
 * AoE-style scaffolding stage for the visual model swap:
 * 0 foundation → 1 frame → 2 half-built → 3 finished.
 */
export function constructionStage(inst: StructureInstance): 0 | 1 | 2 | 3 {
  if (inst.status !== 'building') return 3;
  return Math.min(2, Math.floor(inst.buildProgress * 3)) as 0 | 1 | 2;
}

/**
 * Visible-damage stage for a standing structure (AoE-style progressive wear):
 * 0 pristine → 1 damaged → 2 heavily damaged. Non-active structures read 0
 * (building scaffolds and rubble have their own models).
 */
export function damageLevel(inst: StructureInstance): 0 | 1 | 2 {
  if (inst.status !== 'active') return 0;
  const f = inst.hp / STRUCTURES[inst.defId].maxHp;
  const cfg = BALANCE.landingZone.structures;
  if (f <= cfg.damageStage2) return 2;
  if (f <= cfg.damageStage1) return 1;
  return 0;
}

/**
 * Apply damage to a standing structure. At 0 HP it is ruined — status flips
 * to 'destroyed' (any repair in progress is cancelled), and everything it
 * provided is lost the moment other systems read its status. Returns the
 * transition so the caller can announce/emit it. Non-active structures ignore
 * damage here (constructions are handled by tickConstruction).
 */
export function applyDamage(inst: StructureInstance, amount: number): 'destroyed' | null {
  if (inst.status !== 'active' || amount <= 0) return null;
  inst.hp = Math.max(0, inst.hp - amount);
  if (inst.hp <= 0) {
    inst.status = 'destroyed';
    inst.repairing = false;
    return 'destroyed';
  }
  return null;
}

/**
 * Repairing is cheaper than rebuilding: each cost component scales with the
 * missing-HP fraction times the configured discount, rounded up to whole
 * units (a scratch still costs at least 1 of each component — the crew
 * doesn't work for free). Full-health structures cost nothing.
 */
export function repairCost(inst: StructureInstance): ResourceCost {
  const def = STRUCTURES[inst.defId];
  const missing = Math.max(0, 1 - inst.hp / def.maxHp);
  if (missing === 0) return {};
  const factor = missing * BALANCE.landingZone.structures.repairCostFactor;
  const out: ResourceCost = {};
  for (const [id, n] of Object.entries(def.cost)) {
    out[id as keyof ResourceCost] = Math.max(1, Math.ceil(n * factor));
  }
  return out;
}

/** repair applies to standing, damaged structures that aren't already being repaired */
export function canRepair(inst: StructureInstance): boolean {
  return inst.status === 'active' && isDamaged(inst) && !inst.repairing;
}

/**
 * Heal an in-progress repair; faster than construction by the configured
 * speed factor (a full-missing repair takes buildTimeSec × repairSpeedFactor).
 */
export function tickRepair(inst: StructureInstance, dt: number): 'repaired' | null {
  if (!inst.repairing || inst.status !== 'active') return null;
  const def = STRUCTURES[inst.defId];
  const rate = def.maxHp / (def.buildTimeSec * BALANCE.landingZone.structures.repairSpeedFactor);
  inst.hp = Math.min(def.maxHp, inst.hp + rate * dt);
  if (inst.hp >= def.maxHp) {
    inst.repairing = false;
    return 'repaired';
  }
  return null;
}

/**
 * Advance construction by dt seconds (AoE HP model: the health bar doubles as
 * the progress ramp — HP accrues alongside the scaffold, and damage taken
 * during construction persists into the finished building rather than being
 * healed at completion). Returns the transition that happened this tick.
 */
export function tickConstruction(inst: StructureInstance, dt: number): 'completed' | 'destroyed' | null {
  if (inst.status !== 'building') return null;
  // death check BEFORE the ramp accrues — a construction beaten to 0 HP
  // collapses; scaffolding progress must never revive it
  if (inst.hp <= 0) {
    inst.status = 'destroyed';
    return 'destroyed';
  }
  const def = STRUCTURES[inst.defId];
  const f = BALANCE.landingZone.structures.hpFractionAtStart;
  const before = inst.buildProgress;
  inst.buildProgress = Math.min(1, before + dt / def.buildTimeSec);
  inst.hp = Math.min(inst.hp + def.maxHp * (1 - f) * (inst.buildProgress - before), maxHpNow(inst));
  if (inst.buildProgress >= 1) {
    inst.status = 'active';
    return 'completed';
  }
  return null;
}

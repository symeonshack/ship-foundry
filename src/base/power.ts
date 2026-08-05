/**
 * Landing Zone power & supply (Landing Zone plan, Phase 12+).
 *
 * The Power Relay is the StarCraft supply-depot equivalent: it caps how many
 * rigs and drones can run at once. Phase 13 adds real generation: the solar
 * array's output follows a day/night cycle and decays as dust settles on it,
 * making the nuclear generator (Phase 15) a felt fix rather than a bigger
 * number. netPower sums live supply minus demand.
 */
import { BALANCE } from '../config/balance';
import { STRUCTURES, type StructureInstance } from './structures';

const isActive = (s: StructureInstance, defId: StructureInstance['defId']): boolean =>
  s.status === 'active' && s.defId === defId;

/** how many rigs + drones the base can run simultaneously: a base allowance
 * plus each active Power Relay */
export function unitCap(structures: readonly StructureInstance[]): number {
  const relays = structures.filter((s) => isActive(s, 'powerRelay')).length;
  return BALANCE.landingZone.power.baseUnitCap + relays * BALANCE.landingZone.power.perRelay;
}

// ---- day/night cycle ----

/** fraction 0..1 through the current day/night cycle (t=0 is solar noon) */
export function dayPhase(t: number): number {
  const p = (t / BALANCE.landingZone.power.dayNight.periodSec) % 1;
  return p < 0 ? p + 1 : p;
}

/** solar intensity 0..1 for a cycle phase: a cosine hump peaking at noon
 * (phase 0/1), zero across the night half (phase 0.25..0.75) */
export function dayFactor(phase: number): number {
  return Math.max(0, Math.cos(phase * Math.PI * 2));
}

/** convenience: live solar intensity at game-time t */
export function solarFactor(t: number): number {
  return dayFactor(dayPhase(t));
}

// ---- solar dust ----

/** a solar array's current output multiplier from dust (1 clean → dustMaxDerate floor) */
export function dustDerate(dustLevel: number): number {
  return 1 - Math.max(0, Math.min(1, dustLevel)) * BALANCE.landingZone.power.solar.dustMaxDerate;
}

/** an array is worth cleaning when it's standing, dirty, and not already being cleaned */
export function canClean(inst: StructureInstance): boolean {
  return inst.defId === 'solarArray' && inst.status === 'active' && (inst.dustLevel ?? 0) > 0.02 && !inst.cleaning;
}

/** advance a solar array's dust: settle while running, or clear while being cleaned */
export function tickSolar(inst: StructureInstance, dt: number): void {
  if (inst.defId !== 'solarArray' || inst.status !== 'active') return;
  const cfg = BALANCE.landingZone.power.solar;
  if (inst.cleaning) {
    inst.dustLevel = Math.max(0, (inst.dustLevel ?? 0) - dt / cfg.cleanTimeSec);
    if (inst.dustLevel <= 0) {
      inst.dustLevel = 0;
      inst.cleaning = false;
    }
  } else {
    inst.dustLevel = Math.min(1, (inst.dustLevel ?? 0) + cfg.dustPerSec * dt);
  }
}

// ---- nuclear ----

/** a generator is running unless a tick has explicitly flagged it stopped
 * (out of isotopes) — default running, same "absent = hasn't happened yet"
 * convention as dust/repair/cleaning fields */
export function isGeneratorRunning(inst: StructureInstance): boolean {
  return inst.running !== false;
}

/**
 * Drain one active generator's isotope draw straight from the shared stock
 * (mutated directly, not via store.addStock, which would fire a changed()
 * event every single frame — see baseSim's throttled-notify pattern) and
 * flip its running flag accordingly. Returns the transition, if any, so the
 * caller can announce it.
 */
export function tickNuclear(inst: StructureInstance, stock: { isotope: number }, dt: number): 'started' | 'stopped' | null {
  if (inst.defId !== 'nuclearGenerator' || inst.status !== 'active') return null;
  const burn = BALANCE.landingZone.power.nuclear.isotopeBurnPerSec * dt;
  const wasRunning = isGeneratorRunning(inst);
  if (stock.isotope > 0) {
    stock.isotope = Math.max(0, stock.isotope - Math.min(burn, stock.isotope));
    inst.running = true;
    return wasRunning ? null : 'started';
  }
  inst.running = false;
  return wasRunning ? 'stopped' : null;
}

// ---- net power ----

/** a single active structure's live power output (solar derated by day/night
 * + dust and offline while cleaning; nuclear flat while isotopes hold out;
 * other producers are flat) */
export function structureOutput(inst: StructureInstance, t: number, stormActive = false): number {
  if (inst.status !== 'active') return 0;
  const supply = STRUCTURES[inst.defId].powerSupply ?? 0;
  if (supply === 0) return 0;
  if (inst.defId === 'solarArray') {
    if (inst.cleaning || stormActive) return 0; // a dust storm blots out the sun entirely
    return supply * solarFactor(t) * dustDerate(inst.dustLevel ?? 0);
  }
  if (inst.defId === 'nuclearGenerator') {
    return isGeneratorRunning(inst) ? supply : 0;
  }
  return supply;
}

/** live net power at the base: total supply minus total demand */
export function netPower(structures: readonly StructureInstance[], t: number, stormActive = false): number {
  let supply = 0;
  let demand = 0;
  for (const s of structures) {
    if (s.status !== 'active') continue;
    supply += structureOutput(s, t, stormActive);
    demand += STRUCTURES[s.defId].powerDemand ?? 0;
  }
  return supply - demand;
}

/** true when the base has any structure that produces or consumes power */
export function hasPowerGrid(structures: readonly StructureInstance[]): boolean {
  return structures.some((s) => {
    const def = STRUCTURES[s.defId];
    return (def.powerSupply ?? 0) > 0 || (def.powerDemand ?? 0) > 0;
  });
}

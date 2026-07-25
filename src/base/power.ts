/**
 * Landing Zone power & supply (Landing Zone plan, Phase 12+).
 *
 * The Power Relay is the StarCraft supply-depot equivalent: it caps how many
 * rigs and drones can run at once. Real power *generation* math (solar
 * day/night, nuclear) lands in Phase 13; for now this is the supply ceiling
 * the base enforces before a unit starts work.
 */
import { BALANCE } from '../config/balance';
import type { StructureInstance } from './structures';

const isActive = (s: StructureInstance, defId: StructureInstance['defId']): boolean =>
  s.status === 'active' && s.defId === defId;

/** how many rigs + drones the base can run simultaneously: a base allowance
 * plus each active Power Relay */
export function unitCap(structures: readonly StructureInstance[]): number {
  const relays = structures.filter((s) => isActive(s, 'powerRelay')).length;
  return BALANCE.landingZone.power.baseUnitCap + relays * BALANCE.landingZone.power.perRelay;
}

import type { RigType } from '../building/partCatalog';
import type { RawResourceId } from '../core/resources';
import type { ShipStats } from '../building/shipStats';
import type { HazardType } from '../exploration/starSystem';
import { ratingFor } from '../companion/hints';

/** a rig currently standing on a deposit at the active site (session-scoped) */
export interface ActiveRig {
  id: string;
  type: RigType;
  nodeId: string;
  /** 0..100; the rig is lost at 0 */
  integrity: number;
  /** paused rigs stop extracting — but hazards keep chewing on them */
  paused: boolean;
}

export const EXTRACT_RATE: Record<RigType, number> = { drill: 0.9, cryo: 0.8 };

export function rigCanMine(type: RigType, resource: RawResourceId): boolean {
  return type === 'drill' ? resource === 'regolith' || resource === 'ore' : resource === 'ice' || resource === 'gas';
}

export function rigTypeFor(resource: RawResourceId): RigType {
  return resource === 'regolith' || resource === 'ore' ? 'drill' : 'cryo';
}

/** integrity % lost per second under a hazard, given ship equipment ratings */
export function degradeRate(hazard: HazardType, intensity: number, stats: ShipStats): number {
  const shortfall = Math.max(0, intensity - ratingFor(stats, hazard));
  return shortfall * 4;
}

/** rigs of each type still available to deploy */
export function availableRigs(stats: ShipStats, deployed: ActiveRig[]): Record<RigType, number> {
  return {
    drill: stats.rigCounts.drill - deployed.filter((r) => r.type === 'drill').length,
    cryo: stats.rigCounts.cryo - deployed.filter((r) => r.type === 'cryo').length,
  };
}

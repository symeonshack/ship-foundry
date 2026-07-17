import type { GameStore } from '../core/state';
import type { ShipStats } from '../building/shipStats';
import { travelCost } from '../building/shipStats';
import { distanceBetween, poiDef, type HazardType } from '../exploration/starSystem';

/** rating the ship currently holds against a given hazard */
export function ratingFor(stats: ShipStats, hazard: HazardType): number {
  switch (hazard) {
    case 'radiation':
      return stats.radRating;
    case 'cold':
      return stats.thermalRating;
    case 'unstable':
      return 0; // nothing shields against geology; the defense is speed
  }
}

/** hazard at the site that exceeds current equipment, if any */
export function hazardShortfall(poiId: string, stats: ShipStats): HazardType | null {
  const def = poiDef(poiId);
  if (!def.hazard.type) return null;
  return def.hazard.intensity > ratingFor(stats, def.hazard.type) ? def.hazard.type : null;
}

/** GERTY flags hazards beyond current ratings when the player commits to a trip */
export function warnBeforeTravel(store: GameStore, poiId: string, stats: ShipStats): void {
  const shortfall = hazardShortfall(poiId, stats);
  if (shortfall) store.bus.emit('hazard:warning', { poiId, hazard: shortfall });
}

/** after arriving somewhere, check whether getting home is still comfortable */
export function checkFuelState(store: GameStore, stats: ShipStats): void {
  if (store.state.currentPoi === 'foundry') return;
  const homeCost = travelCost(stats, distanceBetween(store.state.currentPoi, 'foundry'));
  if (store.state.fuel < homeCost) {
    store.bus.emit('fuel:stranded', {});
  } else if (store.state.fuel < homeCost * 1.35) {
    store.bus.emit('fuel:low', {});
  }
}

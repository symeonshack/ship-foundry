import type { GameStore } from '../core/state';
import { deriveStats } from '../building/shipStats';

/**
 * Hauling logistics: the hold empties into base stock at home, and when the
 * math truly fails there's one ugly way back — jettison everything and burn
 * the reserve.
 */
export function arriveHome(store: GameStore): void {
  store.unloadCargo();
  autoRefuel(store);
}

/** at the Foundry the tank quietly tops itself up from refined fuel stock */
export function autoRefuel(store: GameStore): void {
  if (store.state.currentPoi !== 'foundry') return;
  const stats = deriveStats(store.state.ship);
  const need = Math.min(stats.fuelCap - store.state.fuel, store.state.stock.fuel ?? 0);
  if (need > 0.01) {
    store.state.fuel += need;
    store.addStock('fuel', -need);
  }
}

export function canEmergencyReturn(store: GameStore): boolean {
  return store.state.currentPoi !== 'foundry';
}

/** dump the hold, burn everything, limp home */
export function emergencyReturn(store: GameStore): void {
  if (!canEmergencyReturn(store)) return;
  const from = store.state.currentPoi;
  store.state.cargo = {};
  store.state.fuel = 0;
  store.state.currentPoi = 'foundry';
  store.bus.emit('travel:depart', { from, to: 'foundry' });
  store.bus.emit('travel:arrive', { poiId: 'foundry' });
  autoRefuel(store);
  store.changed();
}

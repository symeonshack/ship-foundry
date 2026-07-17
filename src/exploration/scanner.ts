import type { GameStore } from '../core/state';
import { FLAGS } from '../core/flags';
import { deriveStats } from '../building/shipStats';
import { distanceBetween, poiDef } from './starSystem';

/**
 * Scanning gates the loop: you learn what a site holds — and what it will do
 * to your equipment — before committing fuel to it. Sensor tier controls both
 * reach and detail.
 */
export function canScan(store: GameStore, poiId: string): { ok: boolean; reason?: string } {
  if (poiId === store.state.currentPoi) return { ok: true };
  const stats = deriveStats(store.state.ship);
  const dist = distanceBetween(store.state.currentPoi, poiId);
  if (dist > stats.scanRange) {
    return { ok: false, reason: `Out of sensor range (${Math.round(dist)} > ${stats.scanRange}). A better array would reach it.` };
  }
  return { ok: true };
}

export function scanPoi(store: GameStore, poiId: string): boolean {
  const check = canScan(store, poiId);
  if (!check.ok) return false;
  const stats = deriveStats(store.state.ship);
  const tier = Math.max(1, Math.min(2, stats.sensorTier)) as 1 | 2;
  const poi = store.poi(poiId);
  if (poi.scanTier >= tier) return false;
  poi.scanTier = tier;
  store.setFlag(FLAGS.FIRST_SCAN);
  const def = poiDef(poiId);
  if (def.special === 'anomaly') store.setFlag(FLAGS.ANOMALY_SCANNED);
  if (def.special === 'signal') store.setFlag(FLAGS.SIGNAL_SCANNED);
  store.bus.emit('scan:complete', { poiId, tier });
  store.changed();
  return true;
}

/**
 * Landing Zone mission arc (Phase 28/29/30). The resource quota is a cumulative
 * high-grade-ore count (banked in GameStore.addStock, so spending never walks
 * it back). Crossing the quota fires the one-time accidental-discovery event
 * (handled in BaseSim). `missionObjectives` is a pure read of live state for the
 * Operation Status panel — objectives whose systems don't exist yet (satellites,
 * greenhouse) are listed but marked unavailable, so the arc reads honestly.
 */
import { BALANCE } from '../config/balance';
import { FLAGS } from '../core/flags';
import type { GameStore } from '../core/state';
import { pressureActive } from './baseSim';
import { SATELLITE_IDS } from './satellites';

export interface Objective {
  id: string;
  label: string;
  done: boolean;
  /** false = the system this objective needs isn't built into the game yet */
  available: boolean;
}

export function oreHighQuota(): number {
  return BALANCE.landingZone.mission.oreHighQuota;
}

export function missionObjectives(store: GameStore): Objective[] {
  const s = store.state;
  const structures = s.base.structures;
  const active = (id: string): boolean => structures.some((x) => x.status === 'active' && x.defId === id);
  const banked = Math.floor(s.mission.oreHighBanked);
  const quota = oreHighQuota();
  return [
    { id: 'selfSufficient', label: 'Base self-sufficient (solar · refinery · storage)', done: !pressureActive(structures), available: true },
    { id: 'foundry', label: 'Foundry operational', done: active('foundry'), available: true },
    { id: 'hardened', label: 'Hazard hardening (EM + Storm shields)', done: active('emShield') && active('stormShield'), available: true },
    { id: 'intact', label: 'No structures in ruins', done: !structures.some((x) => x.status === 'destroyed'), available: true },
    { id: 'quota', label: `High-grade ore quota (${Math.min(banked, quota)}/${quota})`, done: s.mission.oreHighBanked >= quota, available: true },
    { id: 'discovery', label: 'Anomalous find located', done: store.hasFlag(FLAGS.QUOTA_MET), available: true },
    { id: 'satellites', label: `Satellite array (${s.base.satellites.length}/${SATELLITE_IDS.length})`, done: SATELLITE_IDS.every((id) => s.base.satellites.includes(id)), available: true },
    { id: 'greenhouse', label: 'Greenhouse: first harvest', done: s.food.harvests > 0, available: true },
  ];
}

/** true when every infrastructure objective is met — the operation is
 * established (Phase 35). This is the milestone before full mission complete:
 * it deliberately excludes the greenhouse (food) objective, so hitting the
 * satellite array still lands the "operation established" beat. */
export function operationEstablished(store: GameStore): boolean {
  return missionObjectives(store).every((o) => o.id === 'greenhouse' || !o.available || o.done);
}

/** true when the whole mission is complete — every objective met, greenhouse
 * included (Phase 40). The capstone. */
export function missionComplete(store: GameStore): boolean {
  return missionObjectives(store).every((o) => !o.available || o.done);
}

/**
 * Environmental hazard escalation (Phase 25) — the solar flare that gives
 * Landing Zone real stakes once there's a base worth hitting. Per the plan,
 * the first flare is guaranteed early so every player learns the hardening
 * lesson firsthand; later ones recur at random intervals. A short warning
 * precedes each strike — there's no satellite yet to buy more lead time
 * (the plan's "tiered warning": crude notice now, full lead time later).
 *
 * Damage lands on active structures only for now — under-construction
 * vulnerability (Phase 8) isn't separately hooked up here yet, and there's no
 * hardening buildable to reduce/prevent it yet either (a natural next phase,
 * same rhythm as day/night → the nuclear generator fixing it).
 */
import { BALANCE } from '../config/balance';
import type { GameStore } from '../core/state';
import { STRUCTURES, applyDamage } from './structures';

export type FlareEvent =
  | { type: 'warning'; countdownSec: number }
  | { type: 'strike'; hits: number; destroyed: { uid: string; defId: string }[] }
  | null;

/** advance the flare schedule; returns the transition this tick, if any */
export function tickFlare(store: GameStore, dt: number): FlareEvent {
  void dt; // schedule is timestamp-based off playSeconds, not dt-accumulated
  const cfg = BALANCE.landingZone.hazards.flare;
  const base = store.state.base;
  const now = store.state.playSeconds;

  if (base.flareWarningUntil === null) {
    if (now < base.nextFlareAt) return null;
    base.flareWarningUntil = now + cfg.warningSec;
    return { type: 'warning', countdownSec: cfg.warningSec };
  }

  if (now < base.flareWarningUntil) return null;

  let hits = 0;
  const destroyed: { uid: string; defId: string }[] = [];
  for (const s of base.structures) {
    if (s.status !== 'active') continue;
    hits += 1;
    if (applyDamage(s, STRUCTURES[s.defId].maxHp * cfg.damageFraction) === 'destroyed') {
      destroyed.push({ uid: s.uid, defId: s.defId });
    }
  }
  base.flareWarningUntil = null;
  base.nextFlareAt = now + cfg.minInterval + Math.random() * (cfg.maxInterval - cfg.minInterval);
  return { type: 'strike', hits, destroyed };
}

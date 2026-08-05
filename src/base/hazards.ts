/**
 * Environmental hazard escalation (Phase 25/26) — the solar flare and dust
 * storm that give Landing Zone real stakes once there's a base worth hitting.
 * Per the plan, the first of each is guaranteed early so every player learns
 * the two different hardening lessons firsthand; later ones recur at random
 * intervals. A short warning precedes each — there's no satellite yet to buy
 * more lead time (the plan's "tiered warning": crude notice now, full lead
 * time later).
 *
 * Each hazard is negated for the whole base while its matching shield stands
 * (Phase 27): an EM Shield turns a flare's damage to nothing, a Storm Shield
 * does the same for a storm. The shields are ordinary structures, so the
 * *other* hazard can still knock them down — flares and storms each threaten
 * the defence against the other.
 *
 * Damage lands on active structures only; under-construction vulnerability
 * isn't separately hooked here yet.
 */
import { BALANCE } from '../config/balance';
import type { GameStore } from '../core/state';
import { STRUCTURES, applyDamage, type StructureId, type StructureInstance } from './structures';

type Damaged = { uid: string; defId: string };

/** warning lead time for a hazard, stretched once a Weather Satellite is up (Phase 33) */
function warningLead(store: GameStore, baseSec: number): number {
  return store.state.base.satellites.includes('weather') ? baseSec * BALANCE.landingZone.hazards.weatherLeadMultiplier : baseSec;
}

function hasActiveShield(structures: readonly StructureInstance[], defId: StructureId): boolean {
  return structures.some((s) => s.status === 'active' && s.defId === defId);
}

/** apply a hazard's damage fraction to every active structure; returns the
 * count hit and any that were destroyed (skipped entirely when shielded) */
function strike(structures: StructureInstance[], fraction: number, shielded: boolean): { hits: number; destroyed: Damaged[] } {
  if (shielded) return { hits: 0, destroyed: [] };
  let hits = 0;
  const destroyed: Damaged[] = [];
  for (const s of structures) {
    if (s.status !== 'active') continue;
    hits += 1;
    if (applyDamage(s, STRUCTURES[s.defId].maxHp * fraction) === 'destroyed') {
      destroyed.push({ uid: s.uid, defId: s.defId });
    }
  }
  return { hits, destroyed };
}

// ---- solar flare ----

export type FlareEvent =
  | { type: 'warning'; countdownSec: number }
  | { type: 'strike'; hits: number; destroyed: Damaged[] }
  | null;

export function tickFlare(store: GameStore, dt: number): FlareEvent {
  void dt; // schedule is timestamp-based off playSeconds, not dt-accumulated
  const cfg = BALANCE.landingZone.hazards.flare;
  const base = store.state.base;
  const now = store.state.playSeconds;

  if (base.flareWarningUntil === null) {
    if (now < base.nextFlareAt) return null;
    const lead = warningLead(store, cfg.warningSec);
    base.flareWarningUntil = now + lead;
    return { type: 'warning', countdownSec: lead };
  }
  if (now < base.flareWarningUntil) return null;

  const { hits, destroyed } = strike(base.structures, cfg.damageFraction, hasActiveShield(base.structures, 'emShield'));
  base.flareWarningUntil = null;
  base.nextFlareAt = now + cfg.minInterval + Math.random() * (cfg.maxInterval - cfg.minInterval);
  return { type: 'strike', hits, destroyed };
}

// ---- dust storm ----

export type StormEvent =
  | { type: 'warning'; countdownSec: number }
  | { type: 'begin'; hits: number; destroyed: Damaged[] }
  | { type: 'end' }
  | null;

/** whether a dust storm is actively blowing right now (kills solar, drops visibility) */
export function stormActive(base: { stormActiveUntil: number | null }, now: number): boolean {
  return base.stormActiveUntil !== null && now < base.stormActiveUntil;
}

export function tickStorm(store: GameStore, dt: number): StormEvent {
  void dt;
  const cfg = BALANCE.landingZone.hazards.storm;
  const base = store.state.base;
  const now = store.state.playSeconds;

  // a storm is blowing → the only transition is it blowing out
  if (base.stormActiveUntil !== null) {
    if (now < base.stormActiveUntil) return null;
    base.stormActiveUntil = null;
    base.nextStormAt = now + cfg.minInterval + Math.random() * (cfg.maxInterval - cfg.minInterval);
    return { type: 'end' };
  }

  // warned → the storm hits (one structural toll at onset) then blows for a while
  if (base.stormWarningUntil !== null) {
    if (now < base.stormWarningUntil) return null;
    const { hits, destroyed } = strike(base.structures, cfg.damageFraction, hasActiveShield(base.structures, 'stormShield'));
    base.stormWarningUntil = null;
    base.stormActiveUntil = now + cfg.durationSec;
    return { type: 'begin', hits, destroyed };
  }

  // idle → open the warning when the schedule comes due
  if (now < base.nextStormAt) return null;
  const lead = warningLead(store, cfg.warningSec);
  base.stormWarningUntil = now + lead;
  return { type: 'warning', countdownSec: lead };
}

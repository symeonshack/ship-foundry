/**
 * Pure flight math — the scene renders what this file decides. The whole point
 * of Phase 2 is that ship stats (thrust, mass, stability) become handling the
 * player can feel, so everything here derives from ShipStats.
 */
import type { ShipStats } from '../building/shipStats';
import type { PoiKind } from '../scene/primitives';

export const SOFT_LANDING_V = 2.5;
export const START_ALTITUDE = 60;
/** how far off-center counts as fully sloppy flying */
const SLOPPY_OFFSET = 2.5;
const QUALITY_STAKE = 0.08;

/** thrust-to-mass, clamped into a playable band */
export function speedFactor(stats: ShipStats): number {
  return Math.min(2.2, Math.max(0.35, stats.thrust / Math.max(1, stats.mass)));
}

/** seconds of cruise for a trip — better engines visibly shorten it */
export function tripDuration(distance: number, stats: ShipStats): number {
  return Math.min(28, 4 + distance / (2.2 * speedFactor(stats)));
}

/** constant sideways pull from off-axis mass; strain adds misbehaviour */
export function driftForce(stats: ShipStats): number {
  const strainKick = stats.strain === 'critical' ? 0.8 : stats.strain === 'high' ? 0.35 : 0;
  return stats.comOffset * 1.6 + strainKick;
}

/** cosmetic shake amplitude while under thrust */
export function turbulence(stats: ShipStats): number {
  return stats.strain === 'critical' ? 0.16 : stats.strain === 'high' ? 0.08 : 0.03;
}

/**
 * Flying quality → fuel delta. Mean |offset| of 0 refunds 8% of the base burn;
 * fully sloppy charges 8% extra, clamped so a bad flight can never strand you
 * below zero fuel. Positive = refund.
 */
export function fuelAdjustment(baseCost: number, meanOffset: number, fuelAvailable: number): number {
  const quality = Math.min(1, Math.max(0, 1 - meanOffset / SLOPPY_OFFSET));
  const delta = baseCost * QUALITY_STAKE * (quality * 2 - 1);
  if (delta < 0) return -Math.min(-delta, Math.max(0, fuelAvailable));
  return delta;
}

/** retro-burn strength — must beat gravity, scaled by thrust-to-mass */
export function brakePower(stats: ShipStats): number {
  return Math.min(9, Math.max(4.5, speedFactor(stats) * 4.5));
}

export interface DescentState {
  altitude: number;
  velocity: number;
}

const DESCENT_GRAVITY = 3.2;
/** braked floor sits just under the soft threshold — commitment pays off */
const MIN_DESCENT_V = 2.2;
const MAX_DESCENT_V = 11;

export function startDescent(): DescentState {
  return { altitude: START_ALTITUDE, velocity: 7 };
}

export function tickDescent(d: DescentState, braking: boolean, brake: number, dt: number): DescentState {
  const accel = DESCENT_GRAVITY - (braking ? brake : 0);
  const velocity = Math.min(MAX_DESCENT_V, Math.max(MIN_DESCENT_V, d.velocity + accel * dt));
  return { altitude: Math.max(0, d.altitude - velocity * dt), velocity };
}

/** entry-heat intensity by body kind — feedback only, no damage (by design) */
export function entryHeat(kind: PoiKind): number {
  switch (kind) {
    case 'planet':
      return 1;
    case 'moon':
    case 'home':
      return 0.55;
    case 'anomaly':
    case 'signal':
      return 0.4;
    case 'asteroid':
      return 0.15;
  }
}

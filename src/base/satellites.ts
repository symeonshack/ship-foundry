/**
 * The satellite array (Phase 31-34). The Launch Pad flies one satellite to
 * orbit at a time; each grants a standing capability once up:
 *   - comms  → GERTY's orbital role + semi-autonomous base ops (Phase 32)
 *   - weather → longer hazard warning lead time (Phase 33)
 *   - survey → reveals unvisited sites from orbit (Phase 34)
 * Comms must go up first (it's the array's backbone); weather and survey ride
 * on it. Launch state lives on base (base.launch / base.satellites); the pad
 * being active is the gate. Everything here is pure — BaseSim ticks it.
 */
import type { ResourceCost } from '../core/resources';
import type { GameStore } from '../core/state';

export type SatelliteId = 'comms' | 'weather' | 'survey';

export interface SatelliteDef {
  id: SatelliteId;
  name: string;
  desc: string;
  cost: ResourceCost;
  launchTimeSec: number;
  /** satellites that must already be in orbit before this one can be launched */
  prereq: SatelliteId[];
}

export const SATELLITES: Record<SatelliteId, SatelliteDef> = {
  comms: {
    id: 'comms',
    name: 'Comms Relay',
    desc: 'The array\'s backbone — puts GERTY in orbit as your assistant and lets the base run itself while you\'re away.',
    cost: { alloy: 6, ceramic: 4 },
    launchTimeSec: 45,
    prereq: [],
  },
  weather: {
    id: 'weather',
    name: 'Weather Satellite',
    desc: 'Watches the sky for you — hazard warnings arrive with real lead time instead of a last-second flash.',
    cost: { alloy: 5, ceramic: 4, condensate: 1 },
    launchTimeSec: 50,
    prereq: ['comms'],
  },
  survey: {
    id: 'survey',
    name: 'Survey Satellite',
    desc: 'Maps the system from above — reveals other points of interest without spending fuel to scout them.',
    cost: { alloy: 6, ceramic: 3, condensate: 1 },
    launchTimeSec: 55,
    prereq: ['comms'],
  },
};

export const SATELLITE_IDS = Object.keys(SATELLITES) as SatelliteId[];

export function hasSatellite(store: GameStore, id: SatelliteId): boolean {
  return store.state.base.satellites.includes(id);
}

/** whether a satellite can be launched right now: not already up/queued, prereqs met */
export function canLaunch(store: GameStore, id: SatelliteId): { ok: boolean; reason?: string } {
  const base = store.state.base;
  if (base.satellites.includes(id)) return { ok: false, reason: 'Already in orbit' };
  if (base.launch) return { ok: false, reason: 'A launch is already in progress' };
  const missing = SATELLITES[id].prereq.filter((p) => !base.satellites.includes(p));
  if (missing.length > 0) return { ok: false, reason: `Needs ${missing.map((p) => SATELLITES[p].name).join(', ')} first` };
  return { ok: true };
}

/** pay for and begin a launch; the pad flies it over the following seconds */
export function queueLaunch(store: GameStore, id: SatelliteId): boolean {
  if (!canLaunch(store, id).ok) return false;
  if (!store.spendCost(SATELLITES[id].cost)) return false;
  store.state.base.launch = { satId: id, progressSec: 0 };
  store.changed();
  return true;
}

/** advance the active launch by dt; returns the satellite id the tick it reaches orbit */
export function tickLaunch(store: GameStore, dt: number): SatelliteId | null {
  const launch = store.state.base.launch;
  if (!launch) return null;
  launch.progressSec += dt;
  if (launch.progressSec < SATELLITES[launch.satId].launchTimeSec) return null;
  const id = launch.satId;
  store.state.base.satellites.push(id);
  store.state.base.launch = null;
  return id;
}

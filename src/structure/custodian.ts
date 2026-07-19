/**
 * The Custodian — the hostile-leaning end of the agent personality spectrum.
 *
 * Everything it does flows from one literal directive, and that directive is
 * DATA, not engine: resolving the collaborators'-nature open question later
 * touches profiles and script text, never this state machine's shape.
 *
 * Non-lethal by construction: its only verbs are seal, alarm, herd, and
 * shove-to-the-door. There is no damage, no health, no weapon — here or
 * anywhere else in the game.
 */
import { CYCLE_STATION, PATROL, SHOVE_EXIT, inArchive } from './layout';

export interface AgentProfile {
  id: string;
  name: string;
  disposition: 'collaborative' | 'obstructive';
  directive: string;
}

export const CUSTODIAN_PROFILE: AgentProfile = {
  id: 'custodian',
  name: 'the Custodian',
  disposition: 'obstructive',
  directive: 'Preserve the archive. Nothing leaves.',
  // [PLACEHOLDER — profile text ties into the collaborator-nature open question]
};

export type CustodianMode = 'patrol' | 'alert' | 'attend' | 'dormant';

export interface CustodianState {
  mode: CustodianMode;
  x: number;
  z: number;
  waypoint: number;
  /** seconds of calm remaining before an alert stands down */
  calm: number;
}

export interface CustodianEnv {
  player: { x: number; z: number };
  cycleActive: boolean;
  fragmentTaken: boolean;
  dt: number;
}

export type CustodianAction =
  | { type: 'seal-main' }
  | { type: 'unseal-main' }
  | { type: 'alarm'; on: boolean }
  | { type: 'shove'; to: { x: number; z: number } };

export const VISION = 5.5;
const PATROL_SPEED = 1.15;
const HERD_SPEED = 2.3;
const SHOVE_RANGE = 1.35;
const CALM_SECONDS = 4;

export function initialCustodian(): CustodianState {
  return { mode: 'patrol', x: PATROL[0]!.x, z: PATROL[0]!.z, waypoint: 0, calm: 0 };
}

function moveToward(s: CustodianState, tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - s.x;
  const dz = tz - s.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return dist;
  const step = Math.min(dist, speed * dt);
  s.x += (dx / dist) * step;
  s.z += (dz / dist) * step;
  return dist - step;
}

export function seesPlayer(s: CustodianState, env: CustodianEnv): boolean {
  return inArchive(env.player.x, env.player.z) && Math.hypot(env.player.x - s.x, env.player.z - s.z) < VISION;
}

/**
 * One tick. Returns the same state object (mutated) plus the actions the
 * scene should perform. Priority order IS the directive made literal:
 * an empty archive ends the job; a preservation cycle must be attended;
 * an intruder near the contents is herded out; otherwise, patrol.
 */
export function tickCustodian(s: CustodianState, env: CustodianEnv): CustodianAction[] {
  const actions: CustodianAction[] = [];

  // nothing left to preserve — the directive is complete, and so is it
  if (env.fragmentTaken) {
    if (s.mode !== 'dormant') {
      s.mode = 'dormant';
      actions.push({ type: 'alarm', on: false }, { type: 'unseal-main' });
    }
    return actions;
  }

  // the cycle outranks the intruder: preservation is the letter of the law
  if (env.cycleActive) {
    if (s.mode !== 'attend') {
      s.mode = 'attend';
      actions.push({ type: 'alarm', on: false }, { type: 'unseal-main' });
    }
    moveToward(s, CYCLE_STATION.x, CYCLE_STATION.z, HERD_SPEED, env.dt);
    return actions;
  }

  if (s.mode === 'attend') {
    // cycle ended — back to work
    s.mode = 'patrol';
  }

  if (s.mode === 'alert') {
    if (seesPlayer(s, env)) {
      s.calm = CALM_SECONDS;
      const remaining = moveToward(s, env.player.x, env.player.z, HERD_SPEED, env.dt);
      if (remaining < SHOVE_RANGE) {
        actions.push({ type: 'shove', to: { ...SHOVE_EXIT } });
        s.calm = CALM_SECONDS;
      }
    } else {
      s.calm -= env.dt;
      if (s.calm <= 0) {
        s.mode = 'patrol';
        actions.push({ type: 'alarm', on: false }, { type: 'unseal-main' });
      }
    }
    return actions;
  }

  // patrol
  if (seesPlayer(s, env)) {
    s.mode = 'alert';
    s.calm = CALM_SECONDS;
    actions.push({ type: 'alarm', on: true }, { type: 'seal-main' });
    return actions;
  }
  const wp = PATROL[s.waypoint]!;
  const left = moveToward(s, wp.x, wp.z, PATROL_SPEED, env.dt);
  if (left < 0.1) s.waypoint = (s.waypoint + 1) % PATROL.length;
  return actions;
}

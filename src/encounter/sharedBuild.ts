/**
 * The "communicate through building" mechanic. Player and collaborator
 * alternate edits to a shared structure until it works for both sides.
 *
 * Everything the collaborator "wants" is data in this file: a constraint set
 * and a goal, evaluated over the shared module list. There is no assumption
 * anywhere about what the collaborator *is* (biological or AI) — resolving
 * that open question later means changing visuals and script text, not this.
 */
import type { EncounterModule, EncounterModuleType } from '../core/state';

export interface SocketPos {
  x: number;
  z: number;
}

// inner ring (adjacent to the core) …
export const SOCKETS: SocketPos[] = [
  { x: 1.6, z: 0 },
  { x: -1.6, z: 0 },
  { x: 0, z: 1.6 },
  { x: 0, z: -1.6 },
  // … outer ring
  { x: 3.2, z: 0 },
  { x: -3.2, z: 0 },
  { x: 0, z: 3.2 },
  { x: 0, z: -3.2 },
  { x: 2.26, z: 2.26 },
  { x: -2.26, z: 2.26 },
  { x: 2.26, z: -2.26 },
  { x: -2.26, z: -2.26 },
];

export const CORE_POS: SocketPos = { x: 0, z: 0 };
/** player approaches from the south, the collaborator keeps to the north */
export const PLAYER_TERMINAL: SocketPos = { x: 0, z: 5 };
export const COLLAB_TERMINAL: SocketPos = { x: 0, z: -5 };

const ADJ_DIST = 2.5;

function near(a: SocketPos, b: SocketPos): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < ADJ_DIST;
}

export const ADJACENCY: number[][] = SOCKETS.map((s, i) =>
  SOCKETS.map((t, j) => (i !== j && near(s, t) ? j : -1)).filter((j) => j >= 0),
);

export function adjacentToCore(i: number): boolean {
  return near(SOCKETS[i]!, CORE_POS);
}
export function adjacentToTerminal(i: number, who: 'player' | 'collaborator'): boolean {
  return near(SOCKETS[i]!, who === 'player' ? PLAYER_TERMINAL : COLLAB_TERMINAL);
}
/** the collaborator's side of the structure — where its constraints apply */
export function inCollabZone(i: number): boolean {
  return SOCKETS[i]!.z < -1;
}

function moduleAt(modules: EncounterModule[], socket: number): EncounterModule | undefined {
  return modules.find((m) => m.socket === socket);
}

export interface Violation {
  constraint: 'emitter-in-zone' | 'too-many-emitters';
  socket: number;
}

/**
 * The collaborator's hidden constraint set. Discovered by the player through
 * rejection (it removes offenders and gestures), never through text.
 */
export function findViolations(modules: EncounterModule[]): Violation[] {
  const v: Violation[] = [];
  for (const m of modules) {
    if (m.type === 'emitter' && inCollabZone(m.socket)) {
      v.push({ constraint: 'emitter-in-zone', socket: m.socket });
    }
  }
  const emitters = modules.filter((m) => m.type === 'emitter');
  if (emitters.length > 2) {
    v.push({ constraint: 'too-many-emitters', socket: emitters[emitters.length - 1]!.socket });
  }
  return v;
}

/** sockets whose conduits are power-connected back to the given terminal */
export function connectedConduits(modules: EncounterModule[], who: 'player' | 'collaborator'): Set<number> {
  const conduits = new Set(modules.filter((m) => m.type === 'conduit').map((m) => m.socket));
  const frontier: number[] = [...conduits].filter((s) => adjacentToTerminal(s, who));
  const seen = new Set<number>(frontier);
  while (frontier.length > 0) {
    const s = frontier.pop()!;
    for (const n of ADJACENCY[s]!) {
      if (conduits.has(n) && !seen.has(n)) {
        seen.add(n);
        frontier.push(n);
      }
    }
  }
  return seen;
}

export function pathComplete(modules: EncounterModule[], who: 'player' | 'collaborator'): boolean {
  const connected = connectedConduits(modules, who);
  return [...connected].some((s) => adjacentToCore(s));
}

export function emitterAtCore(modules: EncounterModule[]): boolean {
  return modules.some((m) => m.type === 'emitter' && adjacentToCore(m.socket));
}

export function damperInZone(modules: EncounterModule[]): boolean {
  return modules.some((m) => m.type === 'damper' && inCollabZone(m.socket));
}

export function playerGoalMet(modules: EncounterModule[]): boolean {
  return pathComplete(modules, 'player') && emitterAtCore(modules);
}

export function collabGoalMet(modules: EncounterModule[]): boolean {
  return pathComplete(modules, 'collaborator') && damperInZone(modules);
}

export function isSolved(modules: EncounterModule[]): boolean {
  return playerGoalMet(modules) && collabGoalMet(modules) && findViolations(modules).length === 0;
}

export type Gesture = 'approve' | 'agitate' | 'observe' | 'demonstrate';

export type CollabAction =
  | { kind: 'remove'; socket: number; gesture: 'agitate' }
  | { kind: 'place'; socket: number; type: EncounterModuleType; gesture: 'observe' }
  | { kind: 'demonstrate'; target: number | 'core'; gesture: 'demonstrate' }
  | { kind: 'idle'; gesture: 'approve' | 'observe' };

/** the collaborator's own working path from its terminal to the core */
const COLLAB_PATH: number[] = [7, 3];
/** where it prefers to put the damper it needs */
const DAMPER_SPOTS: number[] = [10, 11];

/**
 * One collaborator turn. Priorities: undo what it cannot tolerate, advance
 * its own goal, supply its own needs, then coach the player by gesture.
 */
export function collaboratorTurn(modules: EncounterModule[]): CollabAction {
  const violations = findViolations(modules);
  if (violations.length > 0) {
    return { kind: 'remove', socket: violations[0]!.socket, gesture: 'agitate' };
  }

  if (!pathComplete(modules, 'collaborator')) {
    for (const s of COLLAB_PATH) {
      const existing = moduleAt(modules, s);
      if (!existing) return { kind: 'place', socket: s, type: 'conduit', gesture: 'observe' };
      if (existing.type !== 'conduit') return { kind: 'demonstrate', target: s, gesture: 'demonstrate' };
    }
    // its usual route is fully occupied by conduits yet unconnected — shouldn't happen with this layout
    return { kind: 'idle', gesture: 'observe' };
  }

  if (!damperInZone(modules)) {
    const spot = DAMPER_SPOTS.find((s) => !moduleAt(modules, s));
    if (spot !== undefined) return { kind: 'place', socket: spot, type: 'damper', gesture: 'observe' };
    return { kind: 'demonstrate', target: DAMPER_SPOTS[0]!, gesture: 'demonstrate' };
  }

  // its side works; coach the player toward theirs
  if (pathComplete(modules, 'player') && !emitterAtCore(modules)) {
    return { kind: 'demonstrate', target: 'core', gesture: 'demonstrate' };
  }
  return { kind: 'idle', gesture: 'approve' };
}

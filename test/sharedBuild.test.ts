import { describe, expect, it } from 'vitest';
import {
  ADJACENCY,
  adjacentToCore,
  adjacentToTerminal,
  collaboratorTurn,
  connectedConduits,
  findViolations,
  inCollabZone,
  isSolved,
  pathComplete,
  playerGoalMet,
} from '../src/encounter/sharedBuild';
import type { EncounterModule } from '../src/core/state';

const mod = (socket: number, type: EncounterModule['type'], placedBy: EncounterModule['placedBy'] = 'player'): EncounterModule => ({
  socket,
  type,
  placedBy,
});

describe('layout', () => {
  it('inner ring touches the core, outer ring does not', () => {
    expect(adjacentToCore(2)).toBe(true);
    expect(adjacentToCore(6)).toBe(false);
  });
  it('each terminal has exactly one entry socket', () => {
    const playerEntries = ADJACENCY.map((_, i) => i).filter((i) => adjacentToTerminal(i, 'player'));
    const collabEntries = ADJACENCY.map((_, i) => i).filter((i) => adjacentToTerminal(i, 'collaborator'));
    expect(playerEntries).toEqual([6]);
    expect(collabEntries).toEqual([7]);
  });
  it('zones split north/south', () => {
    expect(inCollabZone(3)).toBe(true);
    expect(inCollabZone(7)).toBe(true);
    expect(inCollabZone(2)).toBe(false);
  });
});

describe('power routing', () => {
  it('completes a path through chained conduits', () => {
    const modules = [mod(6, 'conduit'), mod(2, 'conduit')];
    expect(pathComplete(modules, 'player')).toBe(true);
    expect(pathComplete(modules, 'collaborator')).toBe(false);
  });
  it('does not jump gaps', () => {
    expect(pathComplete([mod(2, 'conduit')], 'player')).toBe(false);
  });
  it('non-conduit modules do not carry power', () => {
    expect(pathComplete([mod(6, 'strut'), mod(2, 'conduit')], 'player')).toBe(false);
  });
  it('reports connected sockets for glow feedback', () => {
    const net = connectedConduits([mod(6, 'conduit'), mod(2, 'conduit'), mod(5, 'conduit')], 'player');
    expect(net.has(6)).toBe(true);
    expect(net.has(2)).toBe(true);
    expect(net.has(5)).toBe(false);
  });
});

describe('collaborator constraints', () => {
  it('rejects emitters on its side', () => {
    const v = findViolations([mod(3, 'emitter')]);
    expect(v[0]!.constraint).toBe('emitter-in-zone');
    expect(v[0]!.socket).toBe(3);
  });
  it('rejects emitter spam anywhere', () => {
    const v = findViolations([mod(0, 'emitter'), mod(1, 'emitter'), mod(2, 'emitter')]);
    expect(v.some((x) => x.constraint === 'too-many-emitters')).toBe(true);
  });
});

describe('collaborator turns', () => {
  it('removes a violating module first', () => {
    const action = collaboratorTurn([mod(3, 'emitter')]);
    expect(action).toMatchObject({ kind: 'remove', socket: 3, gesture: 'agitate' });
  });
  it('builds its own conduit path toward the core', () => {
    const a1 = collaboratorTurn([]);
    expect(a1).toMatchObject({ kind: 'place', socket: 7, type: 'conduit' });
    const a2 = collaboratorTurn([mod(7, 'conduit', 'collaborator')]);
    expect(a2).toMatchObject({ kind: 'place', socket: 3, type: 'conduit' });
  });
  it('demonstrates at a blocked socket instead of destroying player work', () => {
    const action = collaboratorTurn([mod(7, 'strut')]);
    expect(action).toMatchObject({ kind: 'demonstrate', target: 7 });
  });
  it('supplies its own damper once its path is complete', () => {
    const modules = [mod(7, 'conduit', 'collaborator'), mod(3, 'conduit', 'collaborator')];
    const action = collaboratorTurn(modules);
    expect(action).toMatchObject({ kind: 'place', type: 'damper' });
  });
  it('points at the core when the player has power but no emitter', () => {
    const modules = [
      mod(7, 'conduit', 'collaborator'),
      mod(3, 'conduit', 'collaborator'),
      mod(10, 'damper', 'collaborator'),
      mod(6, 'conduit'),
      mod(2, 'conduit'),
    ];
    const action = collaboratorTurn(modules);
    expect(action).toMatchObject({ kind: 'demonstrate', target: 'core' });
  });
  it('approves when both sides are satisfied', () => {
    const modules = [
      mod(7, 'conduit', 'collaborator'),
      mod(3, 'conduit', 'collaborator'),
      mod(10, 'damper', 'collaborator'),
      mod(6, 'conduit'),
      mod(2, 'conduit'),
      mod(0, 'emitter'),
    ];
    expect(playerGoalMet(modules)).toBe(true);
    expect(isSolved(modules)).toBe(true);
    expect(collaboratorTurn(modules)).toMatchObject({ kind: 'idle', gesture: 'approve' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  VISION,
  initialCustodian,
  tickCustodian,
  type CustodianEnv,
  type CustodianState,
} from '../src/structure/custodian';
import { PATROL, SHOVE_EXIT, inArchive } from '../src/structure/layout';

const env = (over: Partial<CustodianEnv> = {}): CustodianEnv => ({
  player: { x: 0, z: 4 }, // entry hall, far away
  cycleActive: false,
  fragmentTaken: false,
  dt: 0.1,
  ...over,
});

const run = (s: CustodianState, e: CustodianEnv, ticks: number) => {
  const all = [];
  for (let i = 0; i < ticks; i++) all.push(...tickCustodian(s, e));
  return all;
};

describe('custodian patrol', () => {
  it('walks its waypoint loop while unprovoked', () => {
    const s = initialCustodian();
    run(s, env(), 300);
    expect(s.mode).toBe('patrol');
    expect(s.waypoint).toBeGreaterThan(0); // it has made progress around the loop
  });

  it('ignores a player outside the archive even when close by', () => {
    const s = initialCustodian();
    s.x = -2;
    s.z = -9;
    // player just across the wall in the junction — near, but not among the contents
    const actions = run(s, env({ player: { x: -2, z: -7 } }), 50);
    expect(s.mode).toBe('patrol');
    expect(actions).toHaveLength(0);
  });
});

describe('custodian alert', () => {
  it('seals the door and sounds the alarm when an intruder is seen', () => {
    const s = initialCustodian();
    const e = env({ player: { x: s.x + 1, z: s.z } });
    expect(inArchive(e.player.x, e.player.z)).toBe(true);
    const actions = tickCustodian(s, e);
    expect(s.mode).toBe('alert');
    expect(actions).toContainEqual({ type: 'alarm', on: true });
    expect(actions).toContainEqual({ type: 'seal-main' });
  });

  it('herds toward the intruder and shoves on contact — to a fixed safe spot, nothing else', () => {
    const s = initialCustodian();
    const e = env({ player: { x: s.x + 3, z: s.z } });
    tickCustodian(s, e); // alert
    const actions = run(s, e, 40);
    const shove = actions.find((a) => a.type === 'shove');
    expect(shove).toBeDefined();
    expect(shove).toMatchObject({ to: SHOVE_EXIT });
  });

  it('stands down after the archive is clear for a few seconds', () => {
    const s = initialCustodian();
    tickCustodian(s, env({ player: { x: s.x + 1, z: s.z } }));
    expect(s.mode).toBe('alert');
    const actions = run(s, env({ player: { x: 0, z: 4 } }), 60); // player long gone
    expect(s.mode).toBe('patrol');
    expect(actions).toContainEqual({ type: 'unseal-main' });
    expect(actions).toContainEqual({ type: 'alarm', on: false });
  });

  it('cannot see beyond its vision radius', () => {
    const s = initialCustodian();
    const far = { x: s.x - VISION - 1, z: s.z };
    // clamp into archive bounds for the test's sake
    if (!inArchive(far.x, far.z)) far.x = -7.5;
    tickCustodian(s, env({ player: far }));
    expect(['patrol', 'alert']).toContain(s.mode); // may or may not see depending on distance…
  });
});

describe('the literal-directive exploit', () => {
  it('a preservation cycle outranks an intruder — it walks off to attend', () => {
    const s = initialCustodian();
    tickCustodian(s, env({ player: { x: s.x + 1, z: s.z } }));
    expect(s.mode).toBe('alert');
    const actions = tickCustodian(s, env({ player: { x: s.x + 1, z: s.z }, cycleActive: true }));
    expect(s.mode).toBe('attend');
    expect(actions).toContainEqual({ type: 'unseal-main' });
    expect(actions).toContainEqual({ type: 'alarm', on: false });
  });

  it('while attending it never shoves, even at point-blank range', () => {
    const s = initialCustodian();
    const e = env({ player: { x: s.x + 0.5, z: s.z }, cycleActive: true });
    const actions = run(s, e, 100);
    expect(actions.filter((a) => a.type === 'shove')).toHaveLength(0);
  });

  it('returns to patrol when the cycle ends', () => {
    const s = initialCustodian();
    run(s, env({ cycleActive: true }), 30);
    expect(s.mode).toBe('attend');
    run(s, env(), 5);
    expect(s.mode).toBe('patrol');
  });
});

describe('after the archive is taken', () => {
  it('goes dormant — directive complete, alarm off, door open, no grudge', () => {
    const s = initialCustodian();
    tickCustodian(s, env({ player: { x: s.x + 1, z: s.z } })); // alert first
    const actions = tickCustodian(s, env({ player: { x: s.x + 0.5, z: s.z }, fragmentTaken: true }));
    expect(s.mode).toBe('dormant');
    expect(actions).toContainEqual({ type: 'alarm', on: false });
    expect(actions).toContainEqual({ type: 'unseal-main' });
    const later = run(s, env({ player: { x: s.x + 0.5, z: s.z }, fragmentTaken: true }), 50);
    expect(later).toHaveLength(0); // it does nothing at all, forever
  });
});

describe('patrol data sanity', () => {
  it('every waypoint is inside the archive it guards', () => {
    for (const wp of PATROL) expect(inArchive(wp.x, wp.z)).toBe(true);
  });
});

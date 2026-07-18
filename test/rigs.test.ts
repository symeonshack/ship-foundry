import { describe, expect, it } from 'vitest';
import { tickExtraction, type ActiveRig } from '../src/mining/rigs';

const rig = (over: Partial<ActiveRig> = {}): ActiveRig => ({
  id: 'r1',
  type: 'drill',
  nodeId: 'n1',
  integrity: 100,
  paused: false,
  buffer: 0,
  ...over,
});

describe('tickExtraction', () => {
  it('delivers whole units only, at the extraction rate', () => {
    const r = rig();
    const node = { remaining: 10 };
    let delivered = 0;
    // 2 seconds at 0.9/s in 0.1s ticks → exactly 1 whole unit, rest in the hopper
    for (let i = 0; i < 20; i++) delivered += tickExtraction(r, node, 0.1);
    expect(delivered).toBe(1);
    expect(r.buffer).toBeGreaterThan(0.7);
    expect(r.buffer).toBeLessThan(1);
  });

  it('never delivers fractions', () => {
    const r = rig();
    const node = { remaining: 10 };
    for (let i = 0; i < 200; i++) {
      const d = tickExtraction(r, node, 0.033);
      expect(d === 0 || d === 1).toBe(true);
    }
  });

  it('paused rigs deliver nothing and accumulate nothing', () => {
    const r = rig({ paused: true });
    const node = { remaining: 10 };
    for (let i = 0; i < 30; i++) expect(tickExtraction(r, node, 0.1)).toBe(0);
    expect(r.buffer).toBe(0);
  });

  it('stops when the deposit has less than a whole unit left', () => {
    const r = rig({ buffer: 0.99 });
    expect(tickExtraction(r, { remaining: 0 }, 0.1)).toBe(0);
  });

  it('caps the hopper so a full hold cannot bank unlimited backlog', () => {
    const r = rig();
    const node = { remaining: 99 };
    // simulate a long stretch where the caller keeps refunding (full hold)
    for (let i = 0; i < 100; i++) {
      if (tickExtraction(r, node, 0.1) === 1) r.buffer += 1; // refund
    }
    expect(r.buffer).toBeLessThanOrEqual(3.5);
  });
});

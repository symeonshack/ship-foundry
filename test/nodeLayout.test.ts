import { describe, expect, it } from 'vitest';
import { nodeCountFor, rollCollapse, rollYield } from '../src/mining/nodeLayout';
import { mulberry32 } from '../src/scene/primitives';
import { BALANCE } from '../src/config/balance';

const cfg = BALANCE.surface.nodes;

describe('nodeCountFor', () => {
  it('scales with richness and never drops below the base', () => {
    expect(nodeCountFor(0)).toBe(cfg.base);
    expect(nodeCountFor(1)).toBe(cfg.perRichness + cfg.base);
    expect(nodeCountFor(0.6)).toBeGreaterThan(nodeCountFor(0.2));
  });
});

describe('yields and collapse windows', () => {
  it('stay in their configured ranges', () => {
    const rand = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const y = rollYield(rand);
      expect(y).toBeGreaterThanOrEqual(cfg.yieldMin);
      expect(y).toBeLessThan(cfg.yieldMin + cfg.yieldSpan);
      const c = rollCollapse(rand);
      expect(c).toBeGreaterThanOrEqual(cfg.collapseMin);
      expect(c).toBeLessThanOrEqual(cfg.collapseMin + cfg.collapseSpan);
    }
  });
});

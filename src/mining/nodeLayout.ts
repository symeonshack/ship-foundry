/**
 * Pure deposit-layout math for RTS-scale surface sites (Group A Phase 2).
 * Positions, counts, and yields all come from BALANCE.surface.nodes; the
 * screen code only wires the results into persisted NodeState.
 */
import { BALANCE } from '../config/balance';

const cfg = BALANCE.surface.nodes;

/** how many deposits a resource gets at a site, from its 0..1 richness */
export function nodeCountFor(richness: number): number {
  return Math.round(richness * cfg.perRichness) + cfg.base;
}

export function rollYield(rand: () => number): number {
  return Math.floor(cfg.yieldMin + rand() * cfg.yieldSpan);
}

export function rollCollapse(rand: () => number): number {
  return cfg.collapseMin + rand() * cfg.collapseSpan;
}

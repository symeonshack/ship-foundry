/**
 * Entity-agnostic selection primitives (Landing Zone plan, Phase 6).
 *
 * Pure math + a tiny selection-set holder — structures plug in now, drones
 * plug in at Phase 19 without this layer changing. Screen-space projection
 * is the caller's job (it owns the camera); this module only decides what a
 * rectangle contains and what the current selection is.
 */

export interface Px {
  x: number;
  y: number;
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function normalizeRect(a: Px, b: Px): Rect {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

export function rectContains(r: Rect, p: Px): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

/** which candidates (already projected to screen px) fall inside the drag box */
export function uidsInRect(candidates: readonly { uid: string; px: Px }[], a: Px, b: Px): string[] {
  const r = normalizeRect(a, b);
  return candidates.filter((c) => rectContains(r, c.px)).map((c) => c.uid);
}

export class SelectionController {
  readonly selected = new Set<string>();

  /** replace the whole selection; returns true when it actually changed */
  replace(uids: readonly string[]): boolean {
    const next = new Set(uids);
    if (next.size === this.selected.size && [...next].every((u) => this.selected.has(u))) return false;
    this.selected.clear();
    for (const u of next) this.selected.add(u);
    return true;
  }

  clear(): boolean {
    if (this.selected.size === 0) return false;
    this.selected.clear();
    return true;
  }

  /** stable signature for panel-rebuild gating */
  sig(): string {
    return [...this.selected].sort().join(',');
  }
}

/**
 * Pure building-placement validation (Landing Zone plan, Phase 7).
 *
 * A placement is valid when the footprint sits inside the site perimeter,
 * overlaps nothing solid (existing structures, rocks, deposits, the lander,
 * rigs — anything in the shared footColliders array), stands on ground flat
 * enough to build on, and the player can pay for it. Everything here is
 * side-effect-free; BaseView owns the ghost/commit flow around it.
 */
import type { Collider } from '../interior/playerController';
import type { StructureDef } from './structures';
import { BALANCE } from '../config/balance';

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

/** the ground rectangle a structure occupies when centered at (x, z) */
export function footprintAt(def: StructureDef, x: number, z: number): Collider {
  return {
    minX: x - def.footprint.w / 2,
    maxX: x + def.footprint.w / 2,
    minZ: z - def.footprint.d / 2,
    maxZ: z + def.footprint.d / 2,
  };
}

/** strict-interval AABB overlap — exactly-adjacent footprints are allowed */
export function footprintOverlaps(a: Collider, b: Collider): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/** max height difference across the footprint's corners + center stays under the slope limit */
export function terrainFlatEnough(
  fp: Collider,
  heightAt: (x: number, z: number) => number,
  maxSlope: number,
): boolean {
  const samples = [
    heightAt(fp.minX, fp.minZ),
    heightAt(fp.maxX, fp.minZ),
    heightAt(fp.minX, fp.maxZ),
    heightAt(fp.maxX, fp.maxZ),
    heightAt((fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2),
  ];
  return Math.max(...samples) - Math.min(...samples) <= maxSlope;
}

export function canPlace(
  def: StructureDef,
  x: number,
  z: number,
  colliders: readonly Collider[],
  heightAt: (x: number, z: number) => number,
  affordable: boolean,
): PlaceCheck {
  const cfg = BALANCE.landingZone.structures;
  const fp = footprintAt(def, x, z);
  const limit = BALANCE.surface.siteHalfExtent - cfg.placementEdgeMargin;
  if (fp.minX < -limit || fp.maxX > limit || fp.minZ < -limit || fp.maxZ > limit) {
    return { ok: false, reason: 'Outside the buildable perimeter' };
  }
  if (colliders.some((c) => footprintOverlaps(fp, c))) {
    return { ok: false, reason: 'Blocked — something is in the way' };
  }
  if (!terrainFlatEnough(fp, heightAt, cfg.maxSlope)) {
    return { ok: false, reason: 'Ground too uneven here' };
  }
  if (!affordable) {
    return { ok: false, reason: 'Not enough resources' };
  }
  return { ok: true };
}

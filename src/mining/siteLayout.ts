/**
 * Distinct-region site layout (Group A Phase 3): where a site's resource
 * veins and landmarks sit. Pure and deterministic — computed fresh from a
 * salted site seed on every visit, so it never needs persisting; only node
 * state and which features the player has charted go in the save.
 */
import type { RawResourceId } from '../core/resources';
import { BALANCE } from '../config/balance';
import { mulberry32, type SiteLandmarkKind } from '../scene/primitives';
import { nodeCountFor } from './nodeLayout';

export type LandmarkKind = SiteLandmarkKind;

export const LANDMARK_LABELS: Record<LandmarkKind, string> = {
  spires: 'Rock spires',
  crater: 'Impact crater',
  wreck: 'Old wreckage',
  vent: 'Outgassing fissure',
};

const LANDMARK_KINDS: LandmarkKind[] = ['spires', 'crater', 'wreck', 'vent'];

export interface ClusterDef {
  id: string;
  resource: RawResourceId;
  x: number;
  z: number;
}

export interface LandmarkDef {
  id: string;
  kind: LandmarkKind;
  label: string;
  x: number;
  z: number;
}

export interface SiteLayout {
  clusters: ClusterDef[];
  landmarks: LandmarkDef[];
}

/** layout draws from its own rand stream so it replays identically every visit */
const LAYOUT_SEED_SALT = 0x51f317;

export function clusterCountFor(richness: number): number {
  return Math.max(1, Math.ceil(nodeCountFor(richness) / BALANCE.surface.clusters.nodesPerCluster));
}

/** uniform-by-area position in the node annulus */
function annulusPos(rand: () => number): { x: number; z: number } {
  const n = BALANCE.surface.nodes;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(n.minRadius ** 2 + rand() * (n.maxRadius ** 2 - n.minRadius ** 2));
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

function placeSeparated(
  rand: () => number,
  others: readonly { x: number; z: number }[],
  minSeparation: number,
): { x: number; z: number } {
  let best = annulusPos(rand);
  let bestClearance = -Infinity;
  for (let attempt = 0; attempt < BALANCE.surface.clusters.placeAttempts; attempt++) {
    const p = attempt === 0 ? best : annulusPos(rand);
    const clearance = others.length === 0 ? Infinity : Math.min(...others.map((o) => Math.hypot(o.x - p.x, o.z - p.z)));
    if (clearance >= minSeparation) return p;
    if (clearance > bestClearance) {
      bestClearance = clearance;
      best = p;
    }
  }
  // dense config fallback: the most-separated candidate seen
  return best;
}

export function buildSiteLayout(seed: number, composition: Partial<Record<RawResourceId, number>>): SiteLayout {
  // narrative/special sites (empty composition — Site Null, the Foundry) carry
  // their own hand-placed set-pieces already; generic vein/landmark filler is
  // for mineable sites only
  if (Object.keys(composition).length === 0) return { clusters: [], landmarks: [] };

  const rand = mulberry32((seed ^ LAYOUT_SEED_SALT) >>> 0);
  const cfg = BALANCE.surface;
  const placed: { x: number; z: number }[] = [];

  const clusters: ClusterDef[] = [];
  for (const [res, richness] of Object.entries(composition)) {
    for (let i = 0; i < clusterCountFor(richness); i++) {
      const p = placeSeparated(rand, placed, cfg.clusters.minSeparation);
      placed.push(p);
      clusters.push({ id: `vein:${res}:${i}`, resource: res as RawResourceId, ...p });
    }
  }

  const landmarks: LandmarkDef[] = [];
  for (let i = 0; i < cfg.landmarks.count; i++) {
    const p = placeSeparated(rand, placed, cfg.landmarks.minSeparation);
    placed.push(p);
    const kind = LANDMARK_KINDS[Math.floor(rand() * LANDMARK_KINDS.length)]!;
    landmarks.push({ id: `lm:${i}`, kind, label: LANDMARK_LABELS[kind], ...p });
  }

  return { clusters, landmarks };
}

/** deposit offset within its vein — uniform over the vein disc */
export function jitterInCluster(rand: () => number): { dx: number; dz: number } {
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * BALANCE.surface.clusters.radius;
  return { dx: Math.cos(a) * r, dz: Math.sin(a) * r };
}

/** which vein a resource's i-th deposit belongs to */
export function clusterForNode(centers: readonly ClusterDef[], nodeIndex: number): ClusterDef {
  return centers[Math.floor(nodeIndex / BALANCE.surface.clusters.nodesPerCluster) % centers.length]!;
}

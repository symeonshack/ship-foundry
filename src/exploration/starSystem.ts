import type { RawResourceId } from '../core/resources';
import type { PoiKind } from '../scene/primitives';

export type HazardType = 'radiation' | 'cold' | 'unstable';

export interface HazardProfile {
  type: HazardType | null;
  /** 0 none … 3 severe; compared against ship shielding ratings */
  intensity: 0 | 1 | 2 | 3;
}

export interface PoiDef {
  id: string;
  name: string;
  kind: PoiKind;
  color: number;
  /** map-plane coordinates; distances are in fuel-meaningful units */
  pos: [number, number];
  /** relative richness 0..1 per raw resource — drives node generation */
  composition: Partial<Record<RawResourceId, number>>;
  hazard: HazardProfile;
  /** revealed at scan tier 1 */
  blurb: string;
  /** revealed at scan tier 2 */
  detail: string;
  special?: 'home' | 'anomaly' | 'signal';
  terrainSeed: number;
  terrainColor: number;
  skyColor: number;
}

export const POIS: Record<string, PoiDef> = {
  foundry: {
    id: 'foundry',
    name: 'Foundry Site',
    kind: 'home',
    color: 0x8a7f6a,
    pos: [0, 0],
    composition: {},
    hazard: { type: null, intensity: 0 },
    blurb: 'The deployment platform. Or what landed of it.',
    detail: 'Shipyard and refinery are functional. The mission manifest is not where it should be.',
    special: 'home',
    terrainSeed: 11,
    terrainColor: 0x6b6053,
    skyColor: 0x0a0e12,
  },
  nearRock: {
    id: 'nearRock',
    name: 'Brant’s Rock',
    kind: 'asteroid',
    color: 0x7a6f60,
    pos: [8, -6],
    composition: { regolith: 0.8, ore: 0.6 },
    hazard: { type: null, intensity: 0 },
    blurb: 'A slow tumbling carbonaceous body. Regolith and workable ore near the surface.',
    detail: 'No hazards on record. As friendly as rocks get out here.',
    terrainSeed: 23,
    terrainColor: 0x5c554b,
    skyColor: 0x0a0e12,
  },
  iceMoon: {
    id: 'iceMoon',
    name: 'Halvorsen',
    kind: 'moon',
    color: 0xa8cade,
    pos: [-12, 13.4],
    composition: { ice: 0.9, regolith: 0.3 },
    hazard: { type: 'cold', intensity: 2 },
    blurb: 'An ice moon. Water ice in quantity — which is to say, fuel in quantity.',
    detail: 'Surface temperature will chew through unshielded equipment. Thermal shielding rated 2 recommended.',
    terrainSeed: 47,
    terrainColor: 0x7d99ad,
    skyColor: 0x0b1218,
  },
  fracturedMoon: {
    id: 'fracturedMoon',
    name: 'Kessel Fracture',
    kind: 'moon',
    color: 0x8a6a52,
    pos: [20, -13.2],
    composition: { ore: 0.9, regolith: 0.5 },
    hazard: { type: 'unstable', intensity: 2 },
    blurb: 'A shattered moonlet. Dense ore seams exposed along the fracture faces.',
    detail: 'Seismically live. Deposits collapse under sustained extraction — mine fast, commit or abandon.',
    terrainSeed: 71,
    terrainColor: 0x6e563f,
    skyColor: 0x100c0a,
  },
  irradiated: {
    id: 'irradiated',
    name: 'Vesta Prime',
    kind: 'planet',
    color: 0x9c7a4a,
    pos: [-26, 15],
    composition: { ore: 0.6, gas: 0.8 },
    hazard: { type: 'radiation', intensity: 2 },
    blurb: 'A stripped planetary core. Exotic gas pockets and heavy metals.',
    detail: 'Hard radiation across the resource fields. Radiation shielding rated 2 required for sustained work.',
    terrainSeed: 89,
    terrainColor: 0x77603c,
    skyColor: 0x120e07,
  },
  anomaly: {
    id: 'anomaly',
    name: 'Site Null',
    kind: 'anomaly',
    color: 0x2a6a5a,
    pos: [30, 20],
    composition: {},
    hazard: { type: null, intensity: 0 },
    blurb: 'Structures. Regular geometry. No registered installation within forty light-years.',
    detail: 'Dormant. Old — the erosion says very old. Nothing here matches any human catalogue GERTY will admit to having.',
    special: 'anomaly',
    terrainSeed: 113,
    terrainColor: 0x3d4a44,
    skyColor: 0x070d0b,
  },
  signal: {
    id: 'signal',
    name: 'The Relay',
    kind: 'signal',
    color: 0x7dffa8,
    pos: [-40, -23],
    composition: {},
    hazard: { type: null, intensity: 0 },
    blurb: 'A repeating signal. Not a beacon. Not a distress call. A work pattern.',
    detail: 'Something at the source is building. Or repairing. The signal is the sound of it not being finished.',
    special: 'signal',
    terrainSeed: 137,
    terrainColor: 0x46525c,
    skyColor: 0x06090c,
  },
};

export const POI_IDS = Object.keys(POIS);

export function poiDef(id: string): PoiDef {
  const p = POIS[id];
  if (!p) throw new Error(`unknown poi: ${id}`);
  return p;
}

export function distanceBetween(a: string, b: string): number {
  const pa = poiDef(a).pos;
  const pb = poiDef(b).pos;
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
}

export function distanceFromHome(id: string): number {
  return distanceBetween('foundry', id);
}

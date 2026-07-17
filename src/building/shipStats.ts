import { PARTS, type RigType } from './partCatalog';
import type { PartPlacement } from '../core/state';

export type StrainLevel = 'ok' | 'high' | 'critical';

export interface ShipStats {
  mass: number;
  thrust: number;
  fuelCap: number;
  cargoCap: number;
  sensorTier: number;
  scanRange: number;
  radRating: number;
  thermalRating: number;
  hasLifeSupport: boolean;
  rigCounts: Record<RigType, number>;
  massToThrust: number;
  strain: StrainLevel;
  /** fuel consumed per unit of map distance */
  fuelPerDist: number;
  /** lateral center-of-mass offset from the thrust axis — drives the wobble */
  comOffset: number;
}

const FUEL_K = 0.35;
const STRAIN_HIGH = 1.7;
const STRAIN_CRITICAL = 2.6;
const CRITICAL_FUEL_PENALTY = 1.5;

type Mat3 = [number, number, number, number, number, number, number, number, number];
type Vec3 = [number, number, number];

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mulMat(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return r;
}

function mulVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** rotation matrix from an XYZ Euler (our socket rots are single-axis, so order is moot) */
function eulerToMat([x, y, z]: Vec3): Mat3 {
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  const rx: Mat3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const ry: Mat3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rz: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mulMat(mulMat(rx, ry), rz);
}

interface Frame {
  pos: Vec3;
  rot: Mat3;
}

/**
 * World-space frame of every placement (position/orientation of the part's
 * local origin). Mirrors exactly how the shipyard nests THREE.Groups, so the
 * physics CoM and the rendered ship always agree.
 */
export function placementFrames(ship: PartPlacement[]): Map<string, Frame> {
  const byUid = new Map(ship.map((p) => [p.uid, p]));
  const frames = new Map<string, Frame>();

  const resolve = (p: PartPlacement): Frame => {
    const cached = frames.get(p.uid);
    if (cached) return cached;
    let frame: Frame;
    if (p.parent === null) {
      frame = { pos: [0, 0, 0], rot: IDENTITY };
    } else {
      const parent = byUid.get(p.parent);
      if (!parent) throw new Error(`placement ${p.uid} has missing parent ${p.parent}`);
      const parentFrame = resolve(parent);
      const socket = PARTS[parent.partId].sockets[p.socket];
      if (!socket) throw new Error(`placement ${p.uid} references bad socket ${p.socket} on ${parent.partId}`);
      const worldSocketPos = mulVec(parentFrame.rot, socket.pos);
      frame = {
        pos: [
          parentFrame.pos[0] + worldSocketPos[0],
          parentFrame.pos[1] + worldSocketPos[1],
          parentFrame.pos[2] + worldSocketPos[2],
        ],
        rot: mulMat(parentFrame.rot, eulerToMat(socket.rot)),
      };
    }
    frames.set(p.uid, frame);
    return frame;
  };

  for (const p of ship) resolve(p);
  return frames;
}

export function deriveStats(ship: PartPlacement[]): ShipStats {
  let mass = 0;
  let thrust = 0;
  let fuelCap = 0;
  let cargoCap = 0;
  let sensorTier = 0;
  let scanRange = 0;
  let radRating = 0;
  let thermalRating = 0;
  let hasLifeSupport = false;
  const rigCounts: Record<RigType, number> = { drill: 0, cryo: 0 };

  const frames = placementFrames(ship);
  let comX = 0;
  let comZ = 0;

  for (const p of ship) {
    const def = PARTS[p.partId];
    mass += def.mass;
    thrust += def.stats.thrust ?? 0;
    fuelCap += def.stats.fuelCap ?? 0;
    cargoCap += def.stats.cargoCap ?? 0;
    sensorTier = Math.max(sensorTier, def.stats.sensorTier ?? 0);
    scanRange = Math.max(scanRange, def.stats.scanRange ?? 0);
    radRating = Math.max(radRating, def.stats.radRating ?? 0);
    thermalRating = Math.max(thermalRating, def.stats.thermalRating ?? 0);
    if (def.stats.lifeSupport) hasLifeSupport = true;
    if (def.stats.rigType) rigCounts[def.stats.rigType] += 1;

    const frame = frames.get(p.uid)!;
    const com = mulVec(frame.rot, [0, def.comHeight, 0]);
    comX += (frame.pos[0] + com[0]) * def.mass;
    comZ += (frame.pos[2] + com[2]) * def.mass;
  }

  const massToThrust = thrust > 0 ? mass / thrust : Infinity;
  const strain: StrainLevel =
    massToThrust <= STRAIN_HIGH ? 'ok' : massToThrust <= STRAIN_CRITICAL ? 'high' : 'critical';
  let fuelPerDist = thrust > 0 ? FUEL_K * massToThrust : Infinity;
  if (strain === 'critical') fuelPerDist *= CRITICAL_FUEL_PENALTY;

  const comOffset = mass > 0 ? Math.hypot(comX / mass, comZ / mass) : 0;

  return {
    mass,
    thrust,
    fuelCap,
    cargoCap,
    sensorTier,
    scanRange,
    radRating,
    thermalRating,
    hasLifeSupport,
    rigCounts,
    massToThrust,
    strain,
    fuelPerDist,
    comOffset,
  };
}

/** max one-way distance on the current tank */
export function rangeAtFuel(stats: ShipStats, fuel: number): number {
  return stats.fuelPerDist > 0 && Number.isFinite(stats.fuelPerDist) ? fuel / stats.fuelPerDist : 0;
}

export function travelCost(stats: ShipStats, distance: number): number {
  return Math.ceil(distance * stats.fuelPerDist * 10) / 10;
}

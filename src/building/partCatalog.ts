import type { ResourceCost } from '../core/resources';

export type PartId =
  | 'hullS'
  | 'hullL'
  | 'habitatRing'
  | 'engine1'
  | 'engine2'
  | 'tank'
  | 'cargoPod'
  | 'lifeSupport'
  | 'sensor1'
  | 'sensor2'
  | 'radShield'
  | 'thermalShield'
  | 'drillRig'
  | 'cryoRig'
  | 'refineryMk2';

export type SocketType = 'structural' | 'mount' | 'utility';
export type RigType = 'drill' | 'cryo';

/**
 * Socket frames: a part attaches with its local +Y axis pointing along the
 * socket's outward direction (`rot` is an XYZ Euler applied to the part group).
 * Ships assemble vertically: root hull base at y=0, structural sockets chain
 * upward, mount sockets point down (engines), utility sockets point sideways.
 */
export interface SocketDef {
  type: SocketType;
  pos: [number, number, number];
  rot: [number, number, number];
}

export interface PartStats {
  thrust?: number;
  fuelCap?: number;
  cargoCap?: number;
  sensorTier?: number;
  scanRange?: number;
  radRating?: number;
  thermalRating?: number;
  lifeSupport?: boolean;
  rigType?: RigType;
}

export interface PartDef {
  id: PartId;
  name: string;
  desc: string;
  place: 'ship' | 'base';
  mass: number;
  cost: ResourceCost;
  /** socket type this part occupies; null = root-capable / base module */
  attachesTo: SocketType | null;
  sockets: SocketDef[];
  stats: PartStats;
  /** approximate distance from socket to part's own center of mass, along +Y */
  comHeight: number;
}

const HP = Math.PI / 2;

export const PARTS: Record<PartId, PartDef> = {
  hullS: {
    id: 'hullS',
    name: 'Hull Frame S',
    desc: 'Compact pressure hull. Structural spine of a small ship.',
    place: 'ship',
    mass: 10,
    cost: { alloy: 6, ceramic: 2 },
    attachesTo: 'structural',
    comHeight: 1.2,
    sockets: [
      { type: 'structural', pos: [0, 2.4, 0], rot: [0, 0, 0] },
      { type: 'mount', pos: [0.6, 0, 0], rot: [0, 0, Math.PI] },
      { type: 'mount', pos: [-0.6, 0, 0], rot: [0, 0, Math.PI] },
      { type: 'utility', pos: [1.05, 1.2, 0], rot: [0, 0, -HP] },
      { type: 'utility', pos: [-1.05, 1.2, 0], rot: [0, 0, HP] },
      { type: 'utility', pos: [0, 1.2, 1.05], rot: [HP, 0, 0] },
      { type: 'utility', pos: [0, 1.2, -1.05], rot: [-HP, 0, 0] },
    ],
    stats: { cargoCap: 6 },
  },
  hullL: {
    id: 'hullL',
    name: 'Hull Frame L',
    desc: 'Extended hull section. More hardpoints, more mass.',
    place: 'ship',
    mass: 18,
    cost: { alloy: 12, ceramic: 6 },
    attachesTo: 'structural',
    comHeight: 1.8,
    sockets: [
      { type: 'structural', pos: [0, 3.6, 0], rot: [0, 0, 0] },
      { type: 'utility', pos: [1.3, 1.0, 0], rot: [0, 0, -HP] },
      { type: 'utility', pos: [-1.3, 1.0, 0], rot: [0, 0, HP] },
      { type: 'utility', pos: [1.3, 2.6, 0], rot: [0, 0, -HP] },
      { type: 'utility', pos: [-1.3, 2.6, 0], rot: [0, 0, HP] },
      { type: 'utility', pos: [0, 1.8, 1.3], rot: [HP, 0, 0] },
      { type: 'utility', pos: [0, 1.8, -1.3], rot: [-HP, 0, 0] },
    ],
    stats: { cargoCap: 8 },
  },
  habitatRing: {
    id: 'habitatRing',
    name: 'Habitat Ring',
    desc: 'A spun centrifuge ring — living and stowage space under gentle artificial gravity. Heavy, and a real presence on the airframe.',
    place: 'ship',
    mass: 12,
    cost: { alloy: 10, ceramic: 6 },
    attachesTo: 'structural',
    comHeight: 0.6,
    sockets: [
      { type: 'structural', pos: [0, 1.6, 0], rot: [0, 0, 0] },
      { type: 'utility', pos: [0.85, 0.7, 0], rot: [0, 0, -HP] },
      { type: 'utility', pos: [-0.85, 0.7, 0], rot: [0, 0, HP] },
    ],
    stats: { cargoCap: 10, radRating: 1 },
  },
  engine1: {
    id: 'engine1',
    name: 'Thruster Mk1',
    desc: 'Reliable chemical thruster. Gets you to the near rocks.',
    place: 'ship',
    mass: 4,
    cost: { alloy: 4 },
    attachesTo: 'mount',
    comHeight: 0.7,
    sockets: [],
    stats: { thrust: 20 },
  },
  engine2: {
    id: 'engine2',
    name: 'Thruster Mk2',
    desc: 'Condensate-injected drive. Opens up the outer system.',
    place: 'ship',
    mass: 6,
    cost: { alloy: 8, condensate: 2 },
    attachesTo: 'mount',
    comHeight: 0.9,
    sockets: [],
    stats: { thrust: 48 },
  },
  tank: {
    id: 'tank',
    name: 'Fuel Tank',
    desc: 'Pressurized propellant tank.',
    place: 'ship',
    mass: 3,
    cost: { alloy: 3, ceramic: 1 },
    attachesTo: 'utility',
    comHeight: 0.7,
    sockets: [],
    stats: { fuelCap: 30 },
  },
  cargoPod: {
    id: 'cargoPod',
    name: 'Cargo Pod',
    desc: 'Sealed hold for raw material. Hauling is the whole game.',
    place: 'ship',
    mass: 3,
    cost: { alloy: 2, ceramic: 2 },
    attachesTo: 'utility',
    comHeight: 0.6,
    sockets: [],
    stats: { cargoCap: 10 },
  },
  lifeSupport: {
    id: 'lifeSupport',
    name: 'Life Support Pod',
    desc: 'Air, water, heat. The ship does not leave dock without one.',
    place: 'ship',
    mass: 3,
    cost: { alloy: 2, ceramic: 2 },
    attachesTo: 'utility',
    comHeight: 0.6,
    sockets: [],
    stats: { lifeSupport: true },
  },
  sensor1: {
    id: 'sensor1',
    name: 'Sensor Array Mk1',
    desc: 'Short-range survey package. Composition and rough hazard reads.',
    place: 'ship',
    mass: 1,
    cost: { alloy: 1, ceramic: 1 },
    attachesTo: 'utility',
    comHeight: 0.6,
    sockets: [],
    stats: { sensorTier: 1, scanRange: 25 },
  },
  sensor2: {
    id: 'sensor2',
    name: 'Sensor Array Mk2',
    desc: 'Deep-field array. Precise hazard intensity, long reach.',
    place: 'ship',
    mass: 2,
    cost: { alloy: 3, condensate: 1 },
    attachesTo: 'utility',
    comHeight: 0.8,
    sockets: [],
    stats: { sensorTier: 2, scanRange: 60 },
  },
  radShield: {
    id: 'radShield',
    name: 'Radiation Shielding',
    desc: 'Layered shielding housings for crew and deployed equipment.',
    place: 'ship',
    mass: 4,
    cost: { alloy: 3, ceramic: 3 },
    attachesTo: 'utility',
    comHeight: 0.4,
    sockets: [],
    stats: { radRating: 2 },
  },
  thermalShield: {
    id: 'thermalShield',
    name: 'Thermal Shielding',
    desc: 'Insulation and heater loops rated for cryogenic surfaces.',
    place: 'ship',
    mass: 3,
    cost: { ceramic: 4 },
    attachesTo: 'utility',
    comHeight: 0.4,
    sockets: [],
    stats: { thermalRating: 2 },
  },
  drillRig: {
    id: 'drillRig',
    name: 'Drill Rig',
    desc: 'Deployable extractor for regolith and metal ore.',
    place: 'ship',
    mass: 5,
    cost: { alloy: 4, ceramic: 1 },
    attachesTo: 'utility',
    comHeight: 0.7,
    sockets: [],
    stats: { rigType: 'drill' },
  },
  cryoRig: {
    id: 'cryoRig',
    name: 'Cryo Rig',
    desc: 'Deployable extractor for ices and trapped gases.',
    place: 'ship',
    mass: 5,
    cost: { alloy: 4, ceramic: 2 },
    attachesTo: 'utility',
    comHeight: 0.7,
    sockets: [],
    stats: { rigType: 'cryo' },
  },
  refineryMk2: {
    id: 'refineryMk2',
    name: 'Refinery Expansion',
    desc: 'Second processing line for the base refinery. Faster throughput.',
    place: 'base',
    mass: 0,
    cost: { alloy: 10, ceramic: 8 },
    attachesTo: null,
    comHeight: 0,
    sockets: [],
    stats: {},
  },
};

export const SHIP_PART_IDS = (Object.keys(PARTS) as PartId[]).filter((id) => PARTS[id].place === 'ship');
export const BASE_PART_IDS = (Object.keys(PARTS) as PartId[]).filter((id) => PARTS[id].place === 'base');

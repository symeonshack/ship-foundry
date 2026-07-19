/**
 * The Archive at Site Null — a fixed, authored interior. Everything here is
 * data: walls, doors, props, patrol waypoints. The scene builds meshes and
 * colliders from it; the custodian walks it; nothing in this file implies
 * combat because nothing in this game does.
 *
 * Plan (top-down, z north = negative):
 *   archive (x -8..-1)  |x0 band|  power room (x 1..8)     z -16..-8
 *   ── main door ──          ── maintenance door (sealed) ──
 *   junction + tool alcove                                  z -8..-2
 *   entry hall (hatch south)                                z -2..6
 */

export interface Wall {
  x: number;
  z: number;
  w: number;
  d: number;
}

export type DoorId = 'main' | 'maintenance';

export interface DoorDef {
  id: DoorId;
  x: number;
  z: number;
  w: number;
  d: number;
  /** doors the custodian controls vs doors a tool opens */
  startsSealed: boolean;
}

export type PropKind = 'panel' | 'item' | 'log' | 'console' | 'pedestal' | 'bench' | 'exit';

export interface PropDef {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  /** yaw the prop faces */
  facing: number;
  label: string;
  meta?: string;
}

export const CEILING = 3.2;
export const SPAWN = { x: 0, z: 4.2 };

export const WALLS: Wall[] = [
  // outer shell
  { x: 0, z: -16.3, w: 16.6, d: 0.6 }, // north
  { x: -4.75, z: 6.3, w: 7.1, d: 0.6 }, // south, west of hatch
  { x: 4.75, z: 6.3, w: 7.1, d: 0.6 }, // south, east of hatch
  { x: -8.3, z: -5, w: 0.6, d: 23.2 }, // west
  { x: 8.3, z: -5, w: 0.6, d: 23.2 }, // east
  // entry hall / junction divider (opening x -3..1)
  { x: -5.5, z: -2, w: 5, d: 0.6 },
  { x: 4.5, z: -2, w: 7, d: 0.6 },
  // junction / north rooms divider (main door x -5..-3, power opening x 4..6)
  { x: -6.5, z: -8, w: 3, d: 0.6 },
  { x: 0.5, z: -8, w: 7, d: 0.6 },
  { x: 7, z: -8, w: 2, d: 0.6 },
  // archive/power dividing band (maintenance passage z -13..-11)
  { x: 0, z: -14.5, w: 2, d: 3.6 },
  { x: 0, z: -9.5, w: 2, d: 3.2 },
];

export const DOORS: DoorDef[] = [
  { id: 'main', x: -4, z: -8, w: 2, d: 0.6, startsSealed: false },
  { id: 'maintenance', x: 0, z: -12, w: 2, d: 1.4, startsSealed: true },
];

export const PROPS: PropDef[] = [
  { id: 'exit', kind: 'exit', x: 0, z: 5.6, facing: Math.PI, label: 'Exit to the surface' },
  { id: 'panel-1', kind: 'panel', x: -7.6, z: 2, facing: Math.PI / 2, label: 'Pry open the wall panel', meta: 'powerCell' },
  { id: 'log-1', kind: 'log', x: 7.6, z: 0.5, facing: -Math.PI / 2, label: 'Read the etched plate', meta: 'archive-log-1' },
  { id: 'log-2', kind: 'log', x: -7.6, z: -5, facing: Math.PI / 2, label: 'Read the etched plate', meta: 'archive-log-2' },
  { id: 'frame-1', kind: 'item', x: 6.5, z: -5.5, facing: 0, label: 'Take the cutter frame', meta: 'cutterFrame' },
  { id: 'bench-1', kind: 'bench', x: 4.5, z: -6.8, facing: 0, label: 'Assemble at the workbench' },
  { id: 'console-1', kind: 'console', x: 6.6, z: -14.6, facing: 0, label: 'Start preservation cycle' },
  { id: 'pedestal-1', kind: 'pedestal', x: -5, z: -13, facing: 0, label: 'Take the archive fragment' },
];

/** where the custodian stands to oversee a preservation cycle */
export const CYCLE_STATION = { x: 2.8, z: -13.5 };
/** where a shoved player is deposited (junction side of the main door) */
export const SHOVE_EXIT = { x: -4, z: -6 };

export const PATROL: { x: number; z: number }[] = [
  { x: -5, z: -9.5 },
  { x: -2, z: -12 },
  { x: -5, z: -15 },
  { x: -7, z: -12 },
];

export function inArchive(x: number, z: number): boolean {
  return x < -1 && z < -8;
}

export const ITEM_NAMES: Record<string, string> = {
  powerCell: 'Power Cell',
  cutterFrame: 'Cutter Frame',
  plasmaCutter: 'Plasma Cutter',
};

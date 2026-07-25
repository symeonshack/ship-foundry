export type RawResourceId = 'ice' | 'regolith' | 'ore' | 'gas' | 'oreHigh' | 'isotope';
export type RefinedResourceId = 'fuel' | 'ceramic' | 'alloy' | 'condensate';
export type ResourceId = RawResourceId | RefinedResourceId;

export interface ResourceDef {
  id: ResourceId;
  name: string;
  kind: 'raw' | 'refined';
  color: number;
  desc: string;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  ice: { id: 'ice', name: 'Water Ice', kind: 'raw', color: 0xa8dcff, desc: 'Frozen volatiles. Refines into fuel.' },
  regolith: { id: 'regolith', name: 'Regolith', kind: 'raw', color: 0x9b8a76, desc: 'Loose surface material. Refines into ceramic.' },
  ore: { id: 'ore', name: 'Metal Ore', kind: 'raw', color: 0xc47a4a, desc: 'Metal-bearing rock. Refines into alloy.' },
  gas: { id: 'gas', name: 'Exotic Gas', kind: 'raw', color: 0xc98aff, desc: 'Trapped exotic volatiles. Refines into condensate.' },
  oreHigh: { id: 'oreHigh', name: 'High-Grade Ore', kind: 'raw', color: 0xe0522a, desc: 'A richer, harder-to-reach vein of the same metal — ordinary geology, just deep. Feeds ship repair and the Foundry.' },
  isotope: { id: 'isotope', name: 'Isotope Ore', kind: 'raw', color: 0x9fe066, desc: 'Radioactive isotope-bearing rock. Fuels the nuclear generator once refined equipment can handle it — this deposit is small enough that basic shielding suffices.' },
  fuel: { id: 'fuel', name: 'Fuel', kind: 'refined', color: 0xffb454, desc: 'Cracked propellant. Everything moves on this.' },
  ceramic: { id: 'ceramic', name: 'Ceramic', kind: 'refined', color: 0xd8d2c4, desc: 'Sintered structural ceramic.' },
  alloy: { id: 'alloy', name: 'Alloy', kind: 'refined', color: 0x8fb7c9, desc: 'Smelted structural alloy.' },
  condensate: { id: 'condensate', name: 'Condensate', kind: 'refined', color: 0xe08aff, desc: 'Stabilized exotic condensate. High-energy applications.' },
};

export const RAW_IDS: RawResourceId[] = ['ice', 'regolith', 'ore', 'gas', 'oreHigh', 'isotope'];
export const REFINED_IDS: RefinedResourceId[] = ['fuel', 'alloy', 'ceramic', 'condensate'];
export const ALL_RESOURCE_IDS: ResourceId[] = [...RAW_IDS, ...REFINED_IDS];

export interface Recipe {
  id: string;
  input: RawResourceId;
  inAmount: number;
  output: RefinedResourceId;
  outAmount: number;
  timeSec: number;
}

export const RECIPES: Recipe[] = [
  { id: 'crack-fuel', input: 'ice', inAmount: 1, output: 'fuel', outAmount: 2, timeSec: 4 },
  { id: 'smelt-alloy', input: 'ore', inAmount: 2, output: 'alloy', outAmount: 1, timeSec: 7 },
  { id: 'sinter-ceramic', input: 'regolith', inAmount: 2, output: 'ceramic', outAmount: 1, timeSec: 5 },
  { id: 'stabilize-condensate', input: 'gas', inAmount: 2, output: 'condensate', outAmount: 1, timeSec: 10 },
];

export function recipeById(id: string): Recipe {
  const r = RECIPES.find((r) => r.id === id);
  if (!r) throw new Error(`unknown recipe: ${id}`);
  return r;
}

export type ResourceCost = Partial<Record<ResourceId, number>>;

export function costToString(cost: ResourceCost): string {
  return Object.entries(cost)
    .map(([id, n]) => `${n} ${RESOURCES[id as ResourceId].name.toLowerCase()}`)
    .join(', ');
}

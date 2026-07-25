import { describe, expect, it } from 'vitest';
import { ALL_RESOURCE_IDS, RAW_IDS, REFINED_IDS, RESOURCES, type ResourceId } from '../src/core/resources';

describe('resource catalog stays in sync', () => {
  it('has a RESOURCES entry for every id in RAW_IDS and REFINED_IDS', () => {
    for (const id of [...RAW_IDS, ...REFINED_IDS]) {
      expect(RESOURCES[id]).toBeDefined();
      expect(RESOURCES[id].id).toBe(id);
    }
  });

  it('ALL_RESOURCE_IDS is exactly RAW_IDS followed by REFINED_IDS, no drift', () => {
    expect(ALL_RESOURCE_IDS).toEqual([...RAW_IDS, ...REFINED_IDS]);
  });

  it('has no duplicate ids across raw and refined', () => {
    expect(new Set(ALL_RESOURCE_IDS).size).toBe(ALL_RESOURCE_IDS.length);
  });

  it('every RESOURCES key matches its own id and kind matches which list it came from', () => {
    for (const id of Object.keys(RESOURCES) as ResourceId[]) {
      expect(RESOURCES[id].id).toBe(id);
      const expectedKind = (RAW_IDS as string[]).includes(id) ? 'raw' : 'refined';
      expect(RESOURCES[id].kind).toBe(expectedKind);
    }
  });

  it('Landing Zone resources (high-grade ore, isotope) are present as raw', () => {
    expect(RAW_IDS).toContain('oreHigh');
    expect(RAW_IDS).toContain('isotope');
    expect(RESOURCES.oreHigh.kind).toBe('raw');
    expect(RESOURCES.isotope.kind).toBe('raw');
  });
});

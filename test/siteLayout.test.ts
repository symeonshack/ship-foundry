import { describe, expect, it } from 'vitest';
import {
  buildSiteLayout,
  clusterCountFor,
  clusterForNode,
  jitterInCluster,
  LANDMARK_LABELS,
} from '../src/mining/siteLayout';
import { mulberry32 } from '../src/scene/primitives';
import { BALANCE } from '../src/config/balance';

const composition = { ore: 0.9, regolith: 0.5 };

describe('buildSiteLayout', () => {
  it('is deterministic per seed', () => {
    const a = buildSiteLayout(71, composition);
    const b = buildSiteLayout(71, composition);
    expect(a).toEqual(b);
  });

  it('produces at least the phase-3 minimum of 3 distinct features on a normal site', () => {
    const layout = buildSiteLayout(23, { regolith: 0.8, ore: 0.6, ice: 0.4 });
    expect(layout.clusters.length + layout.landmarks.length).toBeGreaterThanOrEqual(3);
  });

  it('gives every present resource at least one vein, sized by richness', () => {
    const layout = buildSiteLayout(23, composition);
    for (const res of Object.keys(composition)) {
      const count = layout.clusters.filter((c) => c.resource === res).length;
      expect(count).toBe(clusterCountFor(composition[res as keyof typeof composition]!));
    }
  });

  it('keeps every feature inside the site bounds', () => {
    const layout = buildSiteLayout(23, composition);
    const half = BALANCE.surface.siteHalfExtent;
    for (const f of [...layout.clusters, ...layout.landmarks]) {
      expect(Math.abs(f.x)).toBeLessThan(half);
      expect(Math.abs(f.z)).toBeLessThan(half);
    }
  });

  it('spaces landmarks apart from each other and from veins (AoE expansion-spot feel)', () => {
    const layout = buildSiteLayout(23, composition);
    const all = [...layout.clusters, ...layout.landmarks];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const d = Math.hypot(all[i]!.x - all[j]!.x, all[i]!.z - all[j]!.z);
        // the smaller of the two configured minimums is the floor any pair must clear
        const floor = Math.min(BALANCE.surface.clusters.minSeparation, BALANCE.surface.landmarks.minSeparation);
        expect(d).toBeGreaterThan(floor * 0.5); // rejection sampling has a soft fallback, not a hard guarantee
      }
    }
  });

  it('assigns every landmark a real label', () => {
    const layout = buildSiteLayout(23, composition);
    for (const lm of layout.landmarks) {
      expect(LANDMARK_LABELS[lm.kind]).toBe(lm.label);
    }
  });

  it('generates no filler landmarks for a narrative/special site (empty composition)', () => {
    const layout = buildSiteLayout(113, {});
    expect(layout.clusters).toEqual([]);
    expect(layout.landmarks).toEqual([]);
  });
});

describe('jitterInCluster', () => {
  it('stays within the configured vein radius', () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const { dx, dz } = jitterInCluster(rand);
      expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(BALANCE.surface.clusters.radius + 1e-9);
    }
  });
});

describe('clusterForNode', () => {
  it('distributes deposits round-robin across a resource’s veins', () => {
    const centers = [
      { id: 'a', resource: 'ore' as const, x: 0, z: 0 },
      { id: 'b', resource: 'ore' as const, x: 100, z: 0 },
    ];
    const perCluster = BALANCE.surface.clusters.nodesPerCluster;
    expect(clusterForNode(centers, 0).id).toBe('a');
    expect(clusterForNode(centers, perCluster).id).toBe('b');
    expect(clusterForNode(centers, perCluster * 2).id).toBe('a');
  });
});

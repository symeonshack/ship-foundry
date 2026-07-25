import * as THREE from 'three';
import { PARTS } from './partCatalog';
import { buildPartMesh } from '../scene/primitives';
import { loadShipAsset } from './shipAsset';
import type { PartPlacement } from '../core/state';
import type { ShipStats } from './shipStats';

/**
 * Shared assembled-ship mesh: the same nested-group construction the shipyard
 * edits is what flies in the flight scene — build choices are literally the
 * airframe. Root placement sits at the group origin, base at y=0.
 */
export interface ShipAssembly {
  group: THREE.Group;
  byUid: Map<string, THREE.Group>;
  dispose(): void;
}

export function buildShipAssembly(ship: PartPlacement[]): ShipAssembly {
  const group = new THREE.Group();
  const byUid = new Map<string, THREE.Group>();
  const placementByUid = new Map(ship.map((p) => [p.uid, p]));

  const assetRoot = new THREE.Group();
  assetRoot.name = 'ship-asset-root';
  group.add(assetRoot);

  loadShipAsset().then((asset) => {
    assetRoot.clear();
    const clone = asset.clone(true);
    clone.scale.setScalar(2.4);
    clone.rotation.set(0, 0, 0);
    clone.position.set(0, 1.2, 0);
    assetRoot.add(clone);
  }).catch((error) => {
    console.warn('Failed to load ship asset', error);
  });

  const build = (p: PartPlacement): THREE.Group => {
    let g = byUid.get(p.uid);
    if (g) return g;
    g = new THREE.Group();
    g.add(buildPartMesh(p.partId));
    g.userData.uid = p.uid;
    if (p.parent === null) {
      group.add(g);
    } else {
      const parentPlacement = placementByUid.get(p.parent)!;
      const parentGroup = build(parentPlacement);
      const socket = PARTS[parentPlacement.partId].sockets[p.socket]!;
      g.position.set(...socket.pos);
      g.rotation.set(...socket.rot);
      parentGroup.add(g);
    }
    byUid.set(p.uid, g);
    return g;
  };
  for (const p of ship) build(p);

  return {
    group,
    byUid,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      group.clear();
    },
  };
}

/** engines announce strain through their nozzle glow */
export function applyStrainGlow(group: THREE.Object3D, stats: ShipStats): void {
  const color = stats.strain === 'critical' ? 0xff5c5c : 0xffb454;
  const intensity = stats.strain === 'ok' ? 0.15 : stats.strain === 'high' ? 0.8 : 1.4;
  group.traverse((o) => {
    if (o.name === 'glow') {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissive.setHex(color);
      m.emissiveIntensity = intensity;
    }
  });
}

/** throttle flare on top of the strain base glow (flight scene) */
export function setEngineFlare(group: THREE.Object3D, flare: number): void {
  group.traverse((o) => {
    if (o.name === 'glow') {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.2 + flare * 2.2;
    }
  });
}

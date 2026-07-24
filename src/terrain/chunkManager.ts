/**
 * Chunked/streamed terrain: a grid of mesh patches over the one global
 * height field, loaded and unloaded as the focus point (top-down camera
 * target or on-foot player) moves. Mesh builds are budgeted per frame so
 * streaming never stalls a frame; hysteresis between the load and unload
 * radii prevents boundary thrash.
 */
import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { makeHeightField, type HeightField } from './heightfield';
import { chunkKey, chunkVertexWorld, planStreaming, type ChunkCoord } from './chunks';
import { mat } from '../scene/primitives';

export class ChunkedTerrain {
  /** add this to the scene; all chunk meshes live under it */
  readonly group = new THREE.Group();
  /** analytic ground height — valid everywhere, loaded or not */
  readonly heightAt: HeightField;
  private loaded = new Map<string, THREE.Mesh>();
  private material: THREE.MeshStandardMaterial;

  constructor(seed: number, color: number) {
    this.heightAt = makeHeightField(seed);
    this.material = mat(color, { flat: true, rough: 0.95, metal: 0.05 });
    this.group.name = 'chunked-terrain';
  }

  get chunkCount(): number {
    return this.loaded.size;
  }

  /** per-frame streaming step: unload far chunks, build near ones within budget */
  update(focusX: number, focusZ: number): void {
    this.step(focusX, focusZ, BALANCE.terrain.buildsPerFrame);
  }

  /** build everything in range at once — for screen entry, before the first frame */
  prewarm(focusX: number, focusZ: number): void {
    this.step(focusX, focusZ, Infinity);
  }

  private step(focusX: number, focusZ: number, budget: number): void {
    const plan = planStreaming(new Set(this.loaded.keys()), focusX, focusZ, BALANCE.terrain);
    for (const key of plan.unload) {
      const mesh = this.loaded.get(key)!;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      this.loaded.delete(key);
    }
    const n = Math.min(plan.load.length, budget);
    for (let i = 0; i < n; i++) this.addChunk(plan.load[i]!);
  }

  private addChunk(c: ChunkCoord): void {
    const { chunkSize: size, chunkSegments: segs } = BALANCE.terrain;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const centerX = c.cx * size + size / 2;
    const centerZ = c.cz * size + size / 2;
    // overwrite the grid with exact-fraction coordinates: edge vertices of
    // neighbouring chunks sample the height field at bit-identical world
    // positions, so boundaries cannot gap (see chunkVertexWorld)
    let i = 0;
    for (let iz = 0; iz <= segs; iz++) {
      for (let ix = 0; ix <= segs; ix++, i++) {
        const w = chunkVertexWorld(c, ix, iz, size, segs);
        pos.setX(i, w.x - centerX);
        pos.setZ(i, w.z - centerZ);
        pos.setY(i, this.heightAt(w.x, w.z));
      }
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(centerX, 0, centerZ);
    mesh.name = `chunk:${chunkKey(c)}`;
    this.group.add(mesh);
    this.loaded.set(chunkKey(c), mesh);
  }

  dispose(): void {
    for (const mesh of this.loaded.values()) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.loaded.clear();
    this.material.dispose();
    this.group.removeFromParent();
  }
}

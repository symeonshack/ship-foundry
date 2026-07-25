/**
 * Chunked/streamed terrain: a grid of mesh patches over the one global
 * height field, loaded and unloaded as the focus point (top-down camera
 * target or on-foot player) moves. Mesh builds are budgeted per frame so
 * streaming never stalls a frame; hysteresis between the load and unload
 * radii prevents boundary thrash.
 *
 * Performance pass (Group A Phase 4): distant chunks build at a coarse LOD
 * (a quarter of the triangles) and re-mesh only when they cross the LOD
 * boundary, not every frame; three.js frustum-culls the chunks the camera
 * can't see. The height field itself stays analytic, so LOD is purely a
 * render concern — foot/drone ground sampling is unaffected.
 */
import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { makeHeightField, type HeightField } from './heightfield';
import { chunkKey, chunkVertexWorld, distToChunk, lodSegmentsFor, parseChunkKey, planStreaming, type ChunkCoord } from './chunks';
import { mat } from '../scene/primitives';

interface LoadedChunk {
  mesh: THREE.Mesh;
  /** segments the mesh was built at — drives LOD re-meshing decisions */
  segs: number;
}

export class ChunkedTerrain {
  /** add this to the scene; all chunk meshes live under it */
  readonly group = new THREE.Group();
  /** analytic ground height — valid everywhere, loaded or not */
  readonly heightAt: HeightField;
  private loaded = new Map<string, LoadedChunk>();
  private material: THREE.MeshStandardMaterial;

  constructor(seed: number, color: number) {
    this.heightAt = makeHeightField(seed);
    this.material = mat(color, { flat: true, rough: 0.95, metal: 0.05 });
    this.group.name = 'chunked-terrain';
  }

  get chunkCount(): number {
    return this.loaded.size;
  }

  /** total triangles across loaded chunks — for profiling the LOD win.
   * PlaneGeometry is always indexed, so index count / 3 is exact. */
  get triangleCount(): number {
    let t = 0;
    for (const { mesh } of this.loaded.values()) {
      const idx = mesh.geometry.index;
      if (idx) t += idx.count / 3;
    }
    return t;
  }

  /** per-frame streaming step: unload far chunks, build/re-mesh near ones within budget */
  update(focusX: number, focusZ: number): void {
    this.step(focusX, focusZ, BALANCE.terrain.buildsPerFrame);
  }

  /** build everything in range at once — for screen entry, before the first frame */
  prewarm(focusX: number, focusZ: number): void {
    this.step(focusX, focusZ, Infinity);
  }

  private step(focusX: number, focusZ: number, budget: number): void {
    const size = BALANCE.terrain.chunkSize;
    const plan = planStreaming(new Set(this.loaded.keys()), focusX, focusZ, BALANCE.terrain);
    for (const key of plan.unload) {
      const entry = this.loaded.get(key)!;
      entry.mesh.removeFromParent();
      entry.mesh.geometry.dispose();
      this.loaded.delete(key);
    }

    // loaded chunks whose LOD tier changed as the focus moved need re-meshing
    const remesh: ChunkCoord[] = [];
    for (const [key, entry] of this.loaded) {
      const c = parseChunkKey(key);
      if (lodSegmentsFor(distToChunk(focusX, focusZ, c, size), BALANCE.terrain, entry.segs) !== entry.segs) {
        remesh.push(c);
      }
    }
    remesh.sort((a, b) => distToChunk(focusX, focusZ, a, size) - distToChunk(focusX, focusZ, b, size));

    // holes (missing chunks) come first — they're gaps in the visible ground;
    // LOD re-meshes are cosmetic refinements, so they take the leftover budget
    let built = 0;
    for (const c of plan.load) {
      if (built >= budget) return;
      this.addChunk(c, lodSegmentsFor(distToChunk(focusX, focusZ, c, size), BALANCE.terrain));
      built++;
    }
    for (const c of remesh) {
      if (built >= budget) return;
      const cur = this.loaded.get(chunkKey(c))!.segs;
      this.addChunk(c, lodSegmentsFor(distToChunk(focusX, focusZ, c, size), BALANCE.terrain, cur));
      built++;
    }
  }

  private addChunk(c: ChunkCoord, segs: number): void {
    const key = chunkKey(c);
    const existing = this.loaded.get(key);
    if (existing) {
      existing.mesh.removeFromParent();
      existing.mesh.geometry.dispose();
    }
    const size = BALANCE.terrain.chunkSize;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const centerX = c.cx * size + size / 2;
    const centerZ = c.cz * size + size / 2;
    // overwrite the grid with exact-fraction coordinates: edge vertices of
    // neighbouring chunks sample the height field at bit-identical world
    // positions, so same-tier boundaries cannot gap (see chunkVertexWorld).
    // Across an LOD tier change the edge vertex counts differ, but that seam
    // sits deep in the fog band (see lodRadius) where it reads as haze.
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
    mesh.name = `chunk:${key}`;
    mesh.frustumCulled = true; // three.js skips chunks outside the camera frustum
    this.group.add(mesh);
    this.loaded.set(key, { mesh, segs });
  }

  dispose(): void {
    for (const { mesh } of this.loaded.values()) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.loaded.clear();
    this.material.dispose();
    this.group.removeFromParent();
  }
}

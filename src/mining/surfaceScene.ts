import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera, makeOrbit } from '../scene/camera';
import {
  addBasicLights,
  addStars,
  buildDepositNode,
  buildLander,
  buildLandmark,
  buildMonolith,
  buildRigDeployed,
  buildRock,
  buildStructureDoor,
  mat,
  mulberry32,
} from '../scene/primitives';
import { ChunkedTerrain } from '../terrain/chunkManager';
import { BALANCE } from '../config/balance';
import { nodeCountFor, rollCollapse, rollYield } from './nodeLayout';
import { buildSiteLayout, clusterForNode, jitterInCluster, type SiteLayout, type LandmarkKind } from './siteLayout';
import { poiDef, type PoiDef } from '../exploration/starSystem';
import { deriveStats, travelCost, type ShipStats } from '../building/shipStats';
import { distanceBetween } from '../exploration/starSystem';
import { PARTS, type RigType } from '../building/partCatalog';
import { availableRigs, degradeRate, rigCanMine, tickExtraction, type ActiveRig } from './rigs';
import { canEmergencyReturn, emergencyReturn } from './hauling';
import { RESOURCES, type RawResourceId } from '../core/resources';
import { FLAGS } from '../core/flags';
import type { NodeState } from '../core/state';
import { rigTypeFor } from './rigs';
import { PLAYER_RADIUS, PlayerController, type Collider } from '../interior/playerController';
import { bar, box, button, clearPanel, el, hazardTag } from '../ui/panels';
import { toast } from '../ui/hud';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type FootTarget =
  | { kind: 'lander' }
  | { kind: 'hatch' }
  | { kind: 'node'; node: NodeState; action: 'recall' | 'deploy' | 'inspect'; rigId?: string; deployType?: RigType };

/** where the Archive hatch sits on the Site Null surface */
const HATCH_POS = { x: 12, z: 0 };

/** bump when deposit layout rules change — older saves get positions re-spread */
const LAYOUT_V = 2;

/** walk-blocking footprint half-extent per landmark kind (crater rim is walkable) */
const LANDMARK_FOOTPRINT: Record<LandmarkKind, number> = {
  spires: 2.4,
  crater: 0,
  wreck: 2.2,
  vent: 1.5,
};

interface Zone {
  x: number;
  z: number;
  r: number;
  mesh: THREE.Mesh;
}

export class SurfaceScreen implements GameScreen {
  readonly id = 'surface' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();

  private site = new THREE.Group();
  private terrain: ChunkedTerrain | null = null;
  private rand: () => number = Math.random;
  private layout: SiteLayout | null = null;
  private nodeMeshes = new Map<string, THREE.Group>();
  private rigMeshes = new Map<string, THREE.Group>();
  private rigs: ActiveRig[] = [];
  private zones: Zone[] = [];
  private armedRig: RigType | null = null;
  private stats!: ShipStats;
  private def!: PoiDef;
  private excursion = 0;
  private cargoFullSaid = false;
  private t = 0;
  private panelUpdaters: (() => void)[] = [];
  private panelSig: string | null = null;
  private unsub: (() => void)[] = [];

  // hybrid mode: one live scene, two control schemes
  private mode: 'command' | 'foot' = 'command';
  private controller: PlayerController;
  private footColliders: Collider[] = [];
  private rigColliders = new Map<string, Collider>();
  private prompt: HTMLElement;
  private footTarget: FootTarget | null = null;
  private wasInZone = false;
  private landerPos = { x: 2, z: 2 };
  private keyHandler = (ev: KeyboardEvent): void => {
    if (ev.code === 'Tab') {
      ev.preventDefault();
      this.setMode(this.mode === 'command' ? 'foot' : 'command');
    } else if (ev.code === 'KeyE' && this.mode === 'foot' && this.footTarget) {
      this.interactFoot(this.footTarget);
    }
  };

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    const cam = BALANCE.surface.camera;
    this.camera = makeCamera(50);
    this.camera.position.set(20, 24, 20);
    this.controls = makeOrbit(this.camera, canvas, {
      target: [0, 0, 0],
      minDistance: cam.minDistance,
      maxDistance: cam.maxDistance,
      maxPolar: Math.PI * cam.maxPolarFrac,
      enablePan: true,
    });
    // pan across the site, not across the screen plane
    this.controls.screenSpacePanning = false;
    addBasicLights(this.scene);
    addStars(this.scene);
    this.scene.add(this.site);

    this.controller = new PlayerController(this.camera, canvas, this.footColliders, new THREE.Vector3(5, 0, 5));
    this.prompt = el('div', 'interact-prompt');
    this.prompt.style.display = 'none';
    document.getElementById('hud')!.appendChild(this.prompt);
  }

  enter(): void {
    this.def = poiDef(this.ctx.store.state.currentPoi);
    this.stats = deriveStats(this.ctx.store.state.ship);
    this.excursion = 0;
    this.cargoFullSaid = false;
    this.mode = 'command';
    this.controls.enabled = true;
    this.wasInZone = false;
    // sites are big now — always come back to the landing area, not wherever
    // the camera was left last visit
    this.camera.position.set(20, 24, 20);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.buildSite();
    this.controller.position.set(this.landerPos.x + 3, 0, this.landerPos.z + 3);
    this.controller.yaw = Math.PI * 0.75; // facing back toward the lander/site
    window.addEventListener('keydown', this.keyHandler);
    this.panelSig = null;
  }

  exit(): void {
    window.removeEventListener('keydown', this.keyHandler);
    if (this.mode === 'foot') this.controller.detach();
    this.mode = 'command';
    this.controls.enabled = true;
    this.prompt.style.display = 'none';
    this.footTarget = null;
    for (const u of this.unsub) u();
    this.unsub = [];
    if (this.rigs.length > 0) {
      toast(`${this.rigs.length} rig(s) recalled to the ship`, 'info');
      for (const rig of this.rigs) this.ctx.bus.emit('rig:recalled', { rigId: rig.id });
      this.rigs = [];
    }
    this.armedRig = null;
    this.disposeSite();
    clearPanel();
  }

  // ---- site construction ----

  private disposeSite(): void {
    this.site.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    this.site.clear();
    this.terrain?.dispose();
    this.terrain = null;
    this.nodeMeshes.clear();
    this.rigMeshes.clear();
    this.zones = [];
    this.scene.fog = null;
  }

  private buildSite(): void {
    this.disposeSite();
    this.scene.background = new THREE.Color(this.def.skyColor);
    // fog hides the chunk-streaming horizon (cold sites override, denser, below)
    this.scene.fog = new THREE.Fog(this.def.skyColor, BALANCE.surface.fogNear, BALANCE.surface.fogFar);

    const terrain = new ChunkedTerrain(this.def.terrainSeed, this.def.terrainColor);
    this.terrain = terrain;
    this.scene.add(terrain.group);
    terrain.prewarm(0, 0);
    const rand = mulberry32(this.def.terrainSeed);
    this.rand = rand;
    const layout = buildSiteLayout(this.def.terrainSeed, this.def.composition);
    this.layout = layout;

    // on-foot collision: site bounds first, then props as they're placed
    this.footColliders.length = 0;
    this.rigColliders.clear();
    const half = BALANCE.surface.siteHalfExtent;
    this.footColliders.push(
      { minX: -half - 4, maxX: -half, minZ: -half - 4, maxZ: half + 4 },
      { minX: half, maxX: half + 4, minZ: -half - 4, maxZ: half + 4 },
      { minX: -half, maxX: half, minZ: -half - 4, maxZ: -half },
      { minX: -half, maxX: half, minZ: half, maxZ: half + 4 },
    );
    this.controller.groundHeight = (x, z) => terrain.heightAt(x, z);

    // scattered rocks around the landing area, keeping the middle workable
    const rocks = BALANCE.surface.rocks;
    for (let i = 0; i < rocks.nearSpawn; i++) {
      const x = (rand() - 0.5) * 2 * rocks.spawnSpread;
      const z = (rand() - 0.5) * 2 * rocks.spawnSpread;
      if (Math.hypot(x, z) < 6) continue;
      this.placeRock(x, z);
    }

    const lander = buildLander();
    lander.position.set(this.landerPos.x, terrain.heightAt(this.landerPos.x, this.landerPos.z), this.landerPos.z);
    this.site.add(lander);
    this.footColliders.push({
      minX: this.landerPos.x - 1.5,
      maxX: this.landerPos.x + 1.5,
      minZ: this.landerPos.z - 1.5,
      maxZ: this.landerPos.z + 1.5,
    });

    // landmarks — regions worth finding, regenerated deterministically per visit
    for (const lm of layout.landmarks) {
      const g = buildLandmark(lm.kind, rand);
      g.position.set(lm.x, terrain.heightAt(lm.x, lm.z), lm.z);
      this.site.add(g);
      const fp = LANDMARK_FOOTPRINT[lm.kind];
      if (fp > 0) {
        this.footColliders.push({ minX: lm.x - fp, maxX: lm.x + fp, minZ: lm.z - fp, maxZ: lm.z + fp });
      }
    }

    if (this.def.special === 'anomaly') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = 10 + (i % 3) * 5;
        const monolith = buildMonolith(i);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        monolith.position.set(x, terrain.heightAt(x, z), z);
        monolith.rotation.y = rand() * Math.PI;
        this.site.add(monolith);
      }
      // the Archive hatch: a doorway into the one structure still drawing power
      const hatch = buildStructureDoor(1.8, false);
      hatch.position.set(HATCH_POS.x, terrain.heightAt(HATCH_POS.x, HATCH_POS.z), HATCH_POS.z);
      hatch.rotation.y = -Math.PI / 2;
      this.site.add(hatch);
      this.footColliders.push({
        minX: HATCH_POS.x - 0.4,
        maxX: HATCH_POS.x + 0.4,
        minZ: HATCH_POS.z - 1.2,
        maxZ: HATCH_POS.z + 1.2,
      });
    }

    // deposit nodes (generated once, persisted)
    const poi = this.ctx.store.poi(this.def.id);
    if (poi.nodes === null) {
      poi.nodes = this.generateNodes(rand, layout);
      poi.layoutV = LAYOUT_V;
    } else {
      // saves from an older layout scheme: same deposits, re-gathered into
      // this site's veins (positions only — ids and remaining yield stay)
      if ((poi.layoutV ?? 1) < LAYOUT_V) {
        this.regroupNodes(poi.nodes, layout, rand);
        poi.layoutV = LAYOUT_V;
        this.ctx.store.changed();
      }
      // saves from before a composition change: add nodes for any resource
      // this site now offers that the stored set doesn't have
      const present = new Set(poi.nodes.map((n) => n.resource));
      for (const [res, richness] of Object.entries(this.def.composition)) {
        if (present.has(res as RawResourceId)) continue;
        const centers = layout.clusters.filter((c) => c.resource === res);
        for (let i = 0; i < nodeCountFor(richness); i++) {
          const center = clusterForNode(centers, i);
          const { dx, dz } = jitterInCluster(rand);
          poi.nodes.push({
            id: this.ctx.store.uid('n'),
            resource: res as RawResourceId,
            remaining: rollYield(rand),
            x: center.x + dx,
            z: center.z + dz,
            collapseIn: this.def.hazard.type === 'unstable' ? rollCollapse(rand) : null,
          });
        }
      }
    }
    for (const node of poi.nodes) {
      if (node.remaining <= 0) continue;
      const g = buildDepositNode(node.resource);
      g.position.set(node.x, terrain.heightAt(node.x, node.z), node.z);
      g.userData.nodeId = node.id;
      this.site.add(g);
      this.nodeMeshes.set(node.id, g);
      this.footColliders.push({ minX: node.x - 0.55, maxX: node.x + 0.55, minZ: node.z - 0.55, maxZ: node.z + 0.55 });
      // a little rock dressing so worked deposits read as geology, not markers
      for (let i = 0; i < rocks.perNode; i++) {
        const a = rand() * Math.PI * 2;
        const r = 2 + rand() * (rocks.nodeScatter - 2);
        this.placeRock(node.x + Math.cos(a) * r, node.z + Math.sin(a) * r);
      }
    }

    // hazard dressing
    if (this.def.hazard.type === 'radiation') {
      const zoneR = BALANCE.surface.radiationZoneRadius;
      const hot = (poi.nodes ?? []).filter((n) => n.resource === 'gas' || n.resource === 'ore').slice(0, 3);
      for (const n of hot) {
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(zoneR, zoneR, 3.2, 28, 1, true),
          mat(0x7dffa8, { emissive: 0x4a9a5a, emissiveIntensity: 0.4, transparent: true, opacity: 0.1 }),
        );
        disc.position.set(n.x, terrain.heightAt(n.x, n.z) + 1.6, n.z);
        this.site.add(disc);
        this.zones.push({ x: n.x, z: n.z, r: zoneR, mesh: disc });
      }
    } else if (this.def.hazard.type === 'cold') {
      this.scene.fog = new THREE.Fog(0x9fc4d8, 25, 95);
      this.scene.background = new THREE.Color(0x18242e);
    }
  }

  private placeRock(x: number, z: number): void {
    const rock = buildRock(this.rand);
    rock.position.set(x, this.terrain!.heightAt(x, z) + 0.1, z);
    this.site.add(rock);
    this.footColliders.push({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.9, maxZ: z + 0.9 });
  }

  private generateNodes(rand: () => number, layout: SiteLayout): NodeState[] {
    const nodes: NodeState[] = [];
    for (const [res, richness] of Object.entries(this.def.composition)) {
      const centers = layout.clusters.filter((c) => c.resource === res);
      for (let i = 0; i < nodeCountFor(richness); i++) {
        const center = clusterForNode(centers, i);
        const { dx, dz } = jitterInCluster(rand);
        nodes.push({
          id: this.ctx.store.uid('n'),
          resource: res as RawResourceId,
          remaining: rollYield(rand),
          x: center.x + dx,
          z: center.z + dz,
          collapseIn: this.def.hazard.type === 'unstable' ? rollCollapse(rand) : null,
        });
      }
    }
    return nodes;
  }

  /** move persisted deposits into this site's veins, keeping ids and remaining yield */
  private regroupNodes(nodes: NodeState[], layout: SiteLayout, rand: () => number): void {
    const indexByResource = new Map<RawResourceId, number>();
    for (const node of nodes) {
      const centers = layout.clusters.filter((c) => c.resource === node.resource);
      if (centers.length === 0) continue;
      const i = indexByResource.get(node.resource) ?? 0;
      indexByResource.set(node.resource, i + 1);
      const center = clusterForNode(centers, i);
      const { dx, dz } = jitterInCluster(rand);
      node.x = center.x + dx;
      node.z = center.z + dz;
    }
  }

  // ---- mode switching (the Phase 3 core: camera/control swap, same live scene) ----

  private setMode(mode: 'command' | 'foot'): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'foot') {
      // drop in where the command camera is looking — on a site this size,
      // walking out from the lander every time would make foot mode useless
      const half = BALANCE.surface.siteHalfExtent - 2;
      const spot = this.freeSpotNear(
        THREE.MathUtils.clamp(this.controls.target.x, -half, half),
        THREE.MathUtils.clamp(this.controls.target.z, -half, half),
      );
      this.controller.position.set(spot.x, 0, spot.z);
      this.controls.enabled = false;
      this.controller.attach();
      toast('On foot — Tab returns to command view', 'info');
    } else {
      this.controller.detach();
      const p = this.controller.position;
      this.controls.target.set(p.x, 0, p.z);
      this.camera.position.set(p.x + 20, 24, p.z + 20);
      this.controls.enabled = true;
      this.controls.update();
      this.prompt.style.display = 'none';
      this.footTarget = null;
    }
    this.renderPanel();
  }

  /** nearest spot not inside a collider — so a foot-drop can't spawn stuck in a rock */
  private freeSpotNear(x: number, z: number): { x: number; z: number } {
    const blocked = (px: number, pz: number): boolean =>
      this.footColliders.some(
        (c) => px + PLAYER_RADIUS > c.minX && px - PLAYER_RADIUS < c.maxX && pz + PLAYER_RADIUS > c.minZ && pz - PLAYER_RADIUS < c.maxZ,
      );
    if (!blocked(x, z)) return { x, z };
    for (let r = 1; r <= 8; r++) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (!blocked(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  private interactFoot(target: FootTarget): void {
    if (target.kind === 'lander') {
      this.ctx.nav('interior');
      return;
    }
    if (target.kind === 'hatch') {
      this.ctx.nav('structure');
      return;
    }
    const { node, action } = target;
    if (action === 'recall' && target.rigId) {
      this.recallRig(target.rigId);
    } else if (action === 'deploy' && target.deployType) {
      this.deployRig(target.deployType, node);
    } else {
      toast(`${RESOURCES[node.resource].name}: about ${Math.round(node.remaining)} units in the seam`, 'info');
    }
  }

  // ---- interaction ----

  onClick(ndc: THREE.Vector2): void {
    if (this.mode === 'foot') return; // command clicks don't exist on foot
    this.raycaster.setFromCamera(ndc, this.camera);

    // recall a rig by clicking it
    if (!this.armedRig) {
      const rigHit = this.raycaster.intersectObjects([...this.rigMeshes.values()], true)[0];
      if (rigHit) {
        let node: THREE.Object3D | null = rigHit.object;
        while (node && !node.userData.rigId) node = node.parent;
        if (node) this.recallRig(node.userData.rigId as string);
        return;
      }
    }

    if (!this.armedRig || !this.terrain) return;
    const hit = this.raycaster.intersectObjects(this.terrain.group.children, false)[0];
    if (!hit) return;
    const poi = this.ctx.store.poi(this.def.id);
    const nodes = poi.nodes ?? [];
    let best: NodeState | null = null;
    let bestDist = 4;
    for (const n of nodes) {
      if (n.remaining <= 0) continue;
      const d = Math.hypot(n.x - hit.point.x, n.z - hit.point.z);
      if (d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    if (!best) {
      toast('No deposit there — click directly on a deposit', 'warn');
      return;
    }
    if (!rigCanMine(this.armedRig, best.resource)) {
      toast(`A ${this.armedRig} rig can’t work ${RESOURCES[best.resource].name.toLowerCase()}`, 'warn');
      return;
    }
    if (this.rigs.some((r) => r.nodeId === best!.id)) {
      toast('A rig is already working that deposit', 'warn');
      return;
    }
    this.deployRig(this.armedRig, best);
  }

  private deployRig(type: RigType, node: NodeState): void {
    const rig: ActiveRig = { id: this.ctx.store.uid('r'), type, nodeId: node.id, integrity: 100, paused: false, buffer: 0 };
    this.rigs.push(rig);
    const mesh = buildRigDeployed(type);
    mesh.position.set(node.x + 1.6, this.terrain!.heightAt(node.x + 1.6, node.z), node.z);
    mesh.userData.rigId = rig.id;
    this.site.add(mesh);
    this.rigMeshes.set(rig.id, mesh);
    const rigCollider = { minX: node.x + 0.8, maxX: node.x + 2.4, minZ: node.z - 0.8, maxZ: node.z + 0.8 };
    this.rigColliders.set(rig.id, rigCollider);
    this.footColliders.push(rigCollider);
    this.ctx.bus.emit('rig:deployed', { rigId: rig.id, poiId: this.def.id });
    if (availableRigs(this.stats, this.rigs)[type] <= 0) this.armedRig = null;
    this.renderPanel();
  }

  private removeRigCollider(rigId: string): void {
    const collider = this.rigColliders.get(rigId);
    if (collider) {
      const i = this.footColliders.indexOf(collider);
      if (i >= 0) this.footColliders.splice(i, 1);
      this.rigColliders.delete(rigId);
    }
  }

  private recallRig(rigId: string): void {
    const rig = this.rigs.find((r) => r.id === rigId);
    if (!rig) return;
    this.rigs.splice(this.rigs.indexOf(rig), 1);
    this.removeRigCollider(rigId);
    const mesh = this.rigMeshes.get(rigId);
    if (mesh) {
      mesh.removeFromParent();
      this.rigMeshes.delete(rigId);
    }
    this.ctx.bus.emit('rig:recalled', { rigId });
    toast('Rig recalled', 'info');
    this.renderPanel();
  }

  private destroyRig(rig: ActiveRig, cause: 'hazard' | 'collapse'): void {
    this.rigs.splice(this.rigs.indexOf(rig), 1);
    this.removeRigCollider(rig.id);
    const mesh = this.rigMeshes.get(rig.id);
    if (mesh) {
      mesh.rotation.z = 0.8; // toppled
      setTimeout(() => mesh.removeFromParent(), 1800);
      this.rigMeshes.delete(rig.id);
    }
    // the physical rig was ship equipment — it's gone from the manifest too
    const ship = this.ctx.store.state.ship;
    const placement = ship.find((p) => PARTS[p.partId].stats.rigType === rig.type);
    if (placement) {
      ship.splice(ship.indexOf(placement), 1);
      this.stats = deriveStats(ship);
      this.ctx.bus.emit('rig:destroyed', { rigId: rig.id, poiId: this.def.id, partId: placement.partId });
    }
    toast(cause === 'collapse' ? 'Deposit collapsed — rig lost' : 'Rig integrity failed — rig lost', 'bad');
    this.ctx.store.changed();
  }

  /** charting: coming within range of a vein or landmark logs it as discovered, once */
  private checkDiscovery(x: number, z: number): void {
    if (!this.layout) return;
    const poi = this.ctx.store.poi(this.def.id);
    const r = BALANCE.surface.discoverRadius;
    const seen = new Set(poi.charted);
    for (const c of this.layout.clusters) {
      if (seen.has(c.id) || Math.hypot(c.x - x, c.z - z) > r) continue;
      poi.charted.push(c.id);
      const label = `${RESOURCES[c.resource].name} vein`;
      this.ctx.bus.emit('site:discovery', { poiId: this.def.id, id: c.id, label });
      toast(`Charted: ${label}`, 'good');
    }
    for (const lm of this.layout.landmarks) {
      if (seen.has(lm.id) || Math.hypot(lm.x - x, lm.z - z) > r) continue;
      poi.charted.push(lm.id);
      this.ctx.bus.emit('site:discovery', { poiId: this.def.id, id: lm.id, label: lm.label });
      toast(`Charted: ${lm.label}`, 'good');
    }
  }

  // ---- per-frame simulation: extraction, hazards, collapse ----

  private updateFoot(dt: number): void {
    this.controller.update(dt);
    const p = this.controller.position;

    // nearest interactable → prompt
    let best: { target: FootTarget; d: number } | null = null;
    const poi = this.ctx.store.poi(this.def.id);
    for (const node of poi.nodes ?? []) {
      if (node.remaining <= 0) continue;
      const d = Math.hypot(node.x - p.x, node.z - p.z);
      if (d > 3 || (best && d >= best.d)) continue;
      const rig = this.rigs.find((r) => r.nodeId === node.id);
      if (rig) {
        best = { target: { kind: 'node', node, action: 'recall', rigId: rig.id }, d };
      } else {
        const type = rigTypeFor(node.resource);
        if (availableRigs(this.stats, this.rigs)[type] > 0) {
          best = { target: { kind: 'node', node, action: 'deploy', deployType: type }, d };
        } else {
          best = { target: { kind: 'node', node, action: 'inspect' }, d };
        }
      }
    }
    if (this.def.special === 'anomaly') {
      const dHatch = Math.hypot(HATCH_POS.x - p.x, HATCH_POS.z - p.z);
      if (dHatch < 3 && (!best || dHatch < best.d)) best = { target: { kind: 'hatch' }, d: dHatch };
    }
    const dLander = Math.hypot(this.landerPos.x - p.x, this.landerPos.z - p.z);
    // right beside your own ship, boarding always wins the prompt contest
    if (dLander < 2.6) best = { target: { kind: 'lander' }, d: dLander };
    else if (dLander < 3.4 && (!best || dLander < best.d)) best = { target: { kind: 'lander' }, d: dLander };
    this.footTarget = best?.target ?? null;
    if (this.footTarget) {
      const label =
        this.footTarget.kind === 'lander'
          ? 'Board ship'
          : this.footTarget.kind === 'hatch'
            ? 'Enter the structure'
            : this.footTarget.action === 'recall'
            ? 'Recall rig'
            : this.footTarget.action === 'deploy'
              ? `Deploy ${this.footTarget.deployType} rig`
              : 'Inspect deposit';
      this.prompt.innerHTML = `<span class="key">E</span> ${label}`;
      this.prompt.style.display = 'block';
    } else {
      this.prompt.style.display = 'none';
    }

    // walking into a hot zone gets you a GERTY advisory (no damage — Phase 4's problem)
    if (this.zones.length > 0) {
      const inZone = this.zones.some((z) => Math.hypot(z.x - p.x, z.z - p.z) < z.r);
      if (inZone && !this.wasInZone) {
        this.ctx.bus.emit('hazard:warning', { poiId: this.def.id, hazard: 'radiation' });
      }
      this.wasInZone = inZone;
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.excursion += dt;
    if (this.mode === 'command') {
      this.controls.update();
      // keep the pan target on the site, and stream terrain around it
      const half = BALANCE.surface.siteHalfExtent;
      const t = this.controls.target;
      t.x = THREE.MathUtils.clamp(t.x, -half, half);
      t.z = THREE.MathUtils.clamp(t.z, -half, half);
      this.terrain?.update(t.x, t.z);
      this.checkDiscovery(t.x, t.z);
    } else {
      this.updateFoot(dt);
      this.terrain?.update(this.controller.position.x, this.controller.position.z);
      this.checkDiscovery(this.controller.position.x, this.controller.position.z);
    }
    const store = this.ctx.store;
    const poi = store.poi(this.def.id);
    const nodes = poi.nodes ?? [];

    for (const rig of [...this.rigs]) {
      const node = nodes.find((n) => n.id === rig.nodeId);
      if (!node) continue;

      // extraction into the hold, one whole unit at a time (paused rigs idle)
      const unit = tickExtraction(rig, node, dt);
      if (unit > 0) {
        const added = store.addCargo(node.resource, 1, this.stats.cargoCap);
        if (added > 0) {
          node.remaining -= 1;
          this.cargoFullSaid = false;
          if (!store.hasFlag(FLAGS.FIRST_MINE)) {
            store.setFlag(FLAGS.FIRST_MINE);
            store.bus.emit('mine:extracted', { resource: node.resource, amount: 1 });
          }
        } else {
          rig.buffer += 1; // hold it in the hopper until there's room
          if (!this.cargoFullSaid) {
            this.cargoFullSaid = true;
            store.bus.emit('cargo:full', {});
          }
        }
      }

      if (node.remaining <= 0) {
        const mesh = this.nodeMeshes.get(node.id);
        if (mesh) mesh.scale.setScalar(0.25);
        this.recallRig(rig.id);
        toast('Deposit exhausted', 'info');
        continue;
      }

      // hazard wear
      const hz = this.def.hazard;
      if (hz.type === 'cold') {
        rig.integrity -= degradeRate('cold', hz.intensity, this.stats) * dt;
      } else if (hz.type === 'radiation') {
        const inZone = this.zones.some((z) => Math.hypot(z.x - node.x, z.z - node.z) < z.r);
        if (inZone) rig.integrity -= degradeRate('radiation', hz.intensity, this.stats) * dt;
      }
      if (rig.integrity <= 0) {
        this.destroyRig(rig, 'hazard');
        continue;
      }

      // unstable ground gives you a window, not a promise
      if (node.collapseIn !== null) {
        node.collapseIn -= dt;
        const mesh = this.nodeMeshes.get(node.id);
        if (mesh && node.collapseIn < 6) {
          mesh.position.x = node.x + (Math.random() - 0.5) * 0.12;
          mesh.position.z = node.z + (Math.random() - 0.5) * 0.12;
        }
        if (node.collapseIn <= 0) {
          node.remaining = 0;
          if (mesh) {
            mesh.scale.set(1.3, 0.15, 1.3);
          }
          store.bus.emit('node:collapsed', { poiId: this.def.id, nodeId: node.id });
          this.destroyRig(rig, 'collapse');
        }
      }
    }

    // ambient animation
    for (const [rigId, mesh] of this.rigMeshes) {
      const rig = this.rigs.find((r) => r.id === rigId);
      const spin = mesh.getObjectByName('spin');
      if (spin && !rig?.paused) spin.rotation.y += dt * 6;
      const lamp = mesh.getObjectByName('lamp') as THREE.Mesh | undefined;
      if (rig && lamp) {
        const m = lamp.material as THREE.MeshStandardMaterial;
        if (rig.paused) {
          m.emissive.setHex(0x59d6ff);
        } else {
          const f = rig.integrity / 100;
          m.emissive.setRGB(1 - f, f, 0.15);
        }
      }
    }
    for (const z of this.zones) {
      (z.mesh.material as THREE.MeshStandardMaterial).opacity = 0.08 + Math.sin(this.t * 2.4) * 0.04;
    }

    // rebuild the panel only when its STRUCTURE changes (rigs, pause states,
    // which resources are held) — amounts update live via panelUpdaters, so
    // buttons stay stable under the cursor during continuous extraction
    const sig =
      this.mode +
      '@' +
      this.rigs.map((r) => r.id + (r.paused ? 'p' : '')).join('|') +
      '#' +
      Object.entries(store.state.cargo)
        .filter(([, n]) => n > 0)
        .map(([k]) => k)
        .join(',') +
      '~' +
      poi.charted.length;
    if (sig !== this.panelSig) {
      this.panelSig = sig;
      this.renderPanel();
    }
    for (const fn of this.panelUpdaters) fn();
  }

  // ---- panel ----

  private renderPanel(): void {
    clearPanel();
    this.panelUpdaters = [];
    const store = this.ctx.store;
    const poi = store.poi(this.def.id);

    const site = box(this.def.name);
    const hz = el('div', 'row');
    hz.appendChild(hazardTag(this.def.hazard.type, poi.scanTier >= 2 ? this.def.hazard.intensity : undefined));
    site.appendChild(hz);
    const clock = el('div', 'sub');
    site.appendChild(clock);
    this.panelUpdaters.push(() => {
      const m = Math.floor(this.excursion / 60);
      const s = Math.floor(this.excursion % 60);
      clock.textContent = `On-site ${m}:${String(s).padStart(2, '0')} · deposits live: ${(poi.nodes ?? []).filter((n) => n.remaining > 0).length}`;
    });
    const modeBtn = button(this.mode === 'command' ? 'Go on foot  [Tab]' : 'Command view  [Tab]', () =>
      this.setMode(this.mode === 'command' ? 'foot' : 'command'),
    );
    site.appendChild(modeBtn);
    if (this.mode === 'foot') {
      site.appendChild(el('div', 'sub', 'WASD walk · mouse/arrows look · E interact. Same site, same clocks — nothing paused because you got out.'));
    }
    site.appendChild(button('Board ship', () => this.ctx.nav('interior')));

    if (this.layout && (this.layout.clusters.length > 0 || this.layout.landmarks.length > 0)) {
      const total = this.layout.clusters.length + this.layout.landmarks.length;
      const charted = box(`Charted ${poi.charted.length}/${total}`);
      const chartedSet = new Set(poi.charted);
      for (const lm of this.layout.landmarks) {
        charted.appendChild(el('div', 'sub', chartedSet.has(lm.id) ? lm.label : '? uncharted'));
      }
      const veinsKnown = this.layout.clusters.filter((c) => chartedSet.has(c.id)).length;
      if (this.layout.clusters.length > 0) {
        charted.appendChild(el('div', 'sub', `${veinsKnown}/${this.layout.clusters.length} veins located`));
      }
    }

    if (this.def.special === 'anomaly') {
      const info = box('Site Null');
      info.appendChild(el('p', 'sub', 'Nothing here wants anything from you. That is somehow worse. The structures predate every catalogue GERTY holds — and one of them is still drawing power.'));
      info.appendChild(button('Enter the structure', () => this.ctx.nav('structure')));
      return;
    }

    // hold — with per-resource jettison so a bad mix isn't a wasted trip
    const hold = box('Hold');
    const holdBar = bar(0, 'var(--accent)');
    hold.appendChild(holdBar);
    const holdLabel = el('div', 'sub');
    hold.appendChild(holdLabel);
    this.panelUpdaters.push(() => {
      const total = store.cargoTotal();
      (holdBar.firstElementChild as HTMLElement).style.width = `${Math.round((total / Math.max(1, this.stats.cargoCap)) * 100)}%`;
      holdLabel.textContent = `${Math.round(total)} / ${this.stats.cargoCap}`;
    });
    for (const [res, amount] of Object.entries(store.state.cargo)) {
      if (amount <= 0) continue;
      const id = res as RawResourceId;
      const row = el('div', 'row');
      const name = el('span', 'grow', RESOURCES[id].name);
      name.style.fontSize = '12px';
      row.appendChild(name);
      const amt = el('span', undefined, String(Math.round(amount)));
      this.panelUpdaters.push(() => {
        amt.textContent = String(Math.round(store.state.cargo[id] ?? 0));
      });
      row.appendChild(amt);
      const dumpOne = button('▼1', () => {
        if (store.dumpCargo(id, 1) > 0) toast(`Jettisoned 1 ${RESOURCES[id].name.toLowerCase()}`, 'info');
      });
      dumpOne.title = 'Jettison one unit';
      row.appendChild(dumpOne);
      const dumpAll = button('▼ all', () => {
        const n = store.dumpCargo(id, Infinity);
        if (n > 0) toast(`Jettisoned ${Math.round(n)} ${RESOURCES[id].name.toLowerCase()}`, 'warn');
      });
      dumpAll.title = 'Jettison everything of this';
      row.appendChild(dumpAll);
      hold.appendChild(row);
    }

    // rigs
    const rigsBox = box('Extraction Rigs');
    const avail = availableRigs(this.stats, this.rigs);
    for (const type of ['drill', 'cryo'] as RigType[]) {
      const row = el('div', 'row');
      row.appendChild(el('span', 'grow', `${type === 'drill' ? 'Drill' : 'Cryo'} rig ×${avail[type]}`));
      const b = button(this.armedRig === type ? 'Armed — click a deposit' : 'Deploy…', () => {
        this.armedRig = this.armedRig === type ? null : type;
        this.renderPanel();
      });
      if ((avail[type] <= 0 && this.armedRig !== type) || this.mode === 'foot') b.disabled = true;
      if (this.mode === 'foot') b.title = 'On foot: walk up to a deposit and press E instead.';
      if (this.armedRig === type) b.classList.add('active');
      row.appendChild(b);
      rigsBox.appendChild(row);
    }
    if (this.stats.rigCounts.drill + this.stats.rigCounts.cryo === 0) {
      rigsBox.appendChild(el('div', 'sub', 'No rigs aboard. Fabricate one at the shipyard.'));
    }
    for (const rig of this.rigs) {
      const row = el('div', 'row');
      row.appendChild(el('span', undefined, rig.type));
      const ib = bar(rig.integrity / 100, 'var(--green)');
      row.appendChild(ib);
      this.panelUpdaters.push(() => {
        const inner = ib.firstElementChild as HTMLElement;
        inner.style.width = `${Math.max(0, Math.round(rig.integrity))}%`;
        inner.style.background = rig.integrity > 55 ? 'var(--green)' : rig.integrity > 25 ? 'var(--amber)' : 'var(--red)';
      });
      const pause = button(rig.paused ? 'Resume' : 'Pause', () => {
        rig.paused = !rig.paused;
        this.renderPanel();
      });
      if (rig.paused) pause.classList.add('active');
      row.appendChild(pause);
      row.appendChild(button('Recall', () => this.recallRig(rig.id)));
      rigsBox.appendChild(row);
    }

    // stranded escape hatch
    if (canEmergencyReturn(store)) {
      const homeCost = travelCost(this.stats, distanceBetween(this.def.id, 'foundry'));
      if (store.state.fuel < homeCost) {
        const sos = box('Emergency');
        sos.appendChild(el('p', 'sub', 'Not enough fuel to reach the Foundry.'));
        sos.appendChild(button('Emergency return (lose all cargo)', () => {
          emergencyReturn(store);
          toast('Hold jettisoned. You made it back with the frame and your pulse.', 'warn');
          this.ctx.nav('shipyard');
        }, 'danger'));
      }
    }
  }
}

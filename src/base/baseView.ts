/**
 * Landing Zone rendering/interaction delegate (Landing Zone plan, Phases 4+).
 *
 * SurfaceScreen hands all home-site-specific work to this class — mesh sync,
 * per-frame update, command-mode clicks, panel boxes — so the base-building
 * feature set grows here and in its sibling `src/base/*` modules instead of
 * inflating surfaceScene.ts. Constructed fresh in buildSite() when the site
 * is `special === 'home'`, disposed with the site.
 *
 * Phase 6: entity selection — left-click selects, Shift+left-drag box-selects
 * (window-capture listeners so the drag never pans the camera), right-click
 * is the reserved command channel.
 * Phase 7: building placement — arm a structure from the Construction menu,
 * a live-validated ghost follows the cursor, left-click commits (spends cost,
 * persists the instance, pushes its footprint into the shared colliders),
 * right-click/Escape cancels.
 */
import * as THREE from 'three';
import type { Ctx } from '../core/ctx';
import type { ChunkedTerrain } from '../terrain/chunkManager';
import type { Collider } from '../interior/playerController';
import {
  buildDroneMesh,
  buildEmShieldMesh,
  buildFabricatorMesh,
  buildFoundryStructureMesh,
  buildGreenhouseMesh,
  buildLaunchPadMesh,
  buildNuclearGeneratorMesh,
  buildStormShieldMesh,
  buildRallyFlag,
  buildRefineryMesh,
  buildRelayMesh,
  buildSelectionRing,
  buildSiloMesh,
  buildSoilProcessorMesh,
  buildSolarArrayMesh,
  buildStructureGhost,
  buildStructurePlaceholder,
  buildStructureRubble,
  mulberry32,
} from '../scene/primitives';
import { DRONES, DRONE_IDS, formationOffsets, orderGather, orderMove, shelterAll, spawnDrone } from './drones';
import {
  STRUCTURES,
  STRUCTURE_IDS,
  applyDamage,
  canBuild,
  canRepair,
  constructionStage,
  damageLevel,
  isDamaged,
  maxHpNow,
  repairCost,
  type StructureCategory,
  type StructureId,
  type StructureInstance,
} from './structures';
import { startRepair } from './baseSim';
import { canClean, hasPowerGrid, isGeneratorRunning, netPower, solarFactor } from './power';
import { stormActive } from './hazards';
import { missionObjectives } from './mission';
import { SATELLITES, SATELLITE_IDS, canLaunch, queueLaunch } from './satellites';
import { FLAGS } from '../core/flags';
import { canPlace, footprintAt } from './placement';
import { SelectionController, uidsInRect, type Px } from './selection';
import { BALANCE } from '../config/balance';
import { costToString } from '../core/resources';
import { bar, box, button, el, renderFabricatorPanel, renderRefineryPanel } from '../ui/panels';
import { toast } from '../ui/hud';

/** bespoke finished-body builders per structure; missing → generic placeholder */
const FINISHED_BUILDERS: Partial<Record<StructureId, (w: number, d: number, color: number) => THREE.Group>> = {
  solarArray: buildSolarArrayMesh,
  storageSilo: buildSiloMesh,
  powerRelay: buildRelayMesh,
  refineryBuilding: buildRefineryMesh,
  nuclearGenerator: buildNuclearGeneratorMesh,
  foundry: buildFoundryStructureMesh,
  launchPad: buildLaunchPadMesh,
  fabricator: buildFabricatorMesh,
  greenhouse: buildGreenhouseMesh,
  soilProcessor: buildSoilProcessorMesh,
  emShield: buildEmShieldMesh,
  stormShield: buildStormShieldMesh,
};

/** stable per-wreck seed so a given pile of rubble looks the same every rebuild */
function seedFromUid(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** placeholder tint per category, until bespoke builders land in Part III */
const CATEGORY_COLORS: Record<StructureCategory, number> = {
  power: 0xffb454,
  production: 0x59d6ff,
  storage: 0x8fb7c9,
  food: 0x7dffa8,
  launch: 0xc98aff,
  defense: 0x6ad0e0,
};

/** drags shorter than this are clicks — let the click path handle them */
const BOX_DRAG_MIN_PX = 5;

export interface BaseViewHooks {
  /** true while SurfaceScreen is in command mode (box select/placement are command-only) */
  isCommand: () => boolean;
  /** recenter the command camera on a world point (used to jump to an idle drone) */
  centerOn: (x: number, z: number) => void;
}

export class BaseView {
  /** every Landing-Zone mesh lives under this group — owned and disposed here */
  readonly group = new THREE.Group();
  private structureGroup = new THREE.Group();
  private droneGroup = new THREE.Group();
  private ringGroup = new THREE.Group();
  private meshByUid = new Map<string, THREE.Group>();
  private droneMeshByUid = new Map<string, THREE.Group>();
  private structureColliders = new Map<string, Collider>();
  private selection = new SelectionController();
  private boxEl: HTMLElement;
  private dragStart: Px | null = null;
  // placement state
  private armed: StructureId | null = null;
  private ghost: THREE.Group | null = null;
  private ghostValid = false;
  // rally-point state (Phase 21)
  private rallyArming = false;
  private rallyMesh: THREE.Group | null = null;
  // idle-cycle cursor (Phase 22): the last idle drone Find jumped to
  private lastIdleUid: string | null = null;
  // control groups (Phase 57): hotkey-recallable sets of drone uids (session-scoped)
  private controlGroups = new Map<number, string[]>();
  private ray = new THREE.Raycaster();
  /** live-updating panel elements (construction %, HP bars) — rebuilt with the panel */
  private panelUpdaters: (() => void)[] = [];

  constructor(
    private ctx: Ctx,
    scene: THREE.Scene,
    private terrain: ChunkedTerrain,
    private footColliders: Collider[],
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private hooks: BaseViewHooks,
    /** the site's deposit meshes — a live reference SurfaceScreen keeps populating,
     * so a right-click on a deposit can issue a gather order (Phase 20) */
    private nodeMeshes: Map<string, THREE.Group>,
  ) {
    this.group.name = 'landing-zone-base';
    this.group.add(this.structureGroup);
    this.group.add(this.droneGroup);
    this.group.add(this.ringGroup);
    scene.add(this.group);

    this.boxEl = el('div');
    this.boxEl.style.cssText =
      'position:absolute;border:1px dashed #59d6ff;background:rgba(89,214,255,0.08);' +
      'pointer-events:none;display:none;z-index:6;';
    document.getElementById('hud')!.appendChild(this.boxEl);

    // capture-phase on window: runs before OrbitControls' canvas listeners,
    // so a shift-drag becomes a selection box instead of a camera pan
    window.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);

    this.syncMeshes();
    this.syncDroneMeshes();
    this.syncRallyMarker();
  }

  // ---- selection box (Shift + left-drag) ----

  private onPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0 || !ev.shiftKey || ev.target !== this.canvas || !this.hooks.isCommand()) return;
    ev.stopPropagation(); // OrbitControls and the click filter never see this drag
    this.dragStart = { x: ev.clientX, y: ev.clientY };
    this.updateBoxEl(ev);
    this.boxEl.style.display = 'block';
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (this.dragStart) {
      this.updateBoxEl(ev);
      return;
    }
    if (this.armed && this.hooks.isCommand()) this.moveGhost(ev);
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (!this.dragStart) return;
    const start = this.dragStart;
    this.dragStart = null;
    this.boxEl.style.display = 'none';
    const end = { x: ev.clientX, y: ev.clientY };
    if (Math.hypot(end.x - start.x, end.y - start.y) < BOX_DRAG_MIN_PX) return;
    ev.stopPropagation();
    if (this.selection.replace(uidsInRect(this.projectSelectables(), start, end))) {
      this.syncSelectionRings();
    }
  };

  private updateBoxEl(ev: PointerEvent): void {
    if (!this.dragStart) return;
    const x = Math.min(this.dragStart.x, ev.clientX);
    const y = Math.min(this.dragStart.y, ev.clientY);
    this.boxEl.style.left = `${x}px`;
    this.boxEl.style.top = `${y}px`;
    this.boxEl.style.width = `${Math.abs(ev.clientX - this.dragStart.x)}px`;
    this.boxEl.style.height = `${Math.abs(ev.clientY - this.dragStart.y)}px`;
  }

  /** all selectable entities (structures + drones) projected to screen px */
  private projectSelectables(): { uid: string; px: Px }[] {
    const out: { uid: string; px: Px }[] = [];
    const v = new THREE.Vector3();
    const project = (uid: string, x: number, y: number, z: number): void => {
      v.set(x, y, z).project(this.camera);
      if (v.z > 1) return; // behind the camera
      out.push({ uid, px: { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight } });
    };
    for (const s of this.ctx.store.state.base.structures) {
      if (s.status === 'destroyed') continue;
      project(s.uid, s.x, this.terrain.heightAt(s.x, s.z) + 0.8, s.z);
    }
    for (const d of this.ctx.store.state.base.drones) {
      project(d.uid, d.x, this.terrain.heightAt(d.x, d.z) + 0.4, d.z);
    }
    return out;
  }

  // ---- placement (Phase 7) ----

  private toggleArm(id: StructureId): void {
    if (this.armed === id) {
      this.cancelArming();
      return;
    }
    this.rallyArming = false;
    this.armed = id;
    this.selection.clear();
    this.syncSelectionRings();
    this.disposeGhost();
    const def = STRUCTURES[id];
    this.ghost = buildStructureGhost(def.footprint.w, def.footprint.d);
    this.ghost.position.y = -999; // parked until the first mouse move
    this.group.add(this.ghost);
  }

  /** true when arming (structure placement OR rally-set) was active and got
   * cancelled — wired to Escape and right-click */
  cancelArming(): boolean {
    if (this.rallyArming) {
      this.rallyArming = false;
      return true;
    }
    if (!this.armed) return false;
    this.armed = null;
    this.disposeGhost();
    return true;
  }

  // ---- rally point (Phase 21) ----

  private toggleRallyArm(): void {
    this.rallyArming = !this.rallyArming;
    if (this.rallyArming) {
      this.cancelArmingStructureOnly();
      this.selection.clear();
      this.syncSelectionRings();
    }
  }

  /** clear only a structure-placement arm (used when arming rally instead) */
  private cancelArmingStructureOnly(): void {
    if (!this.armed) return;
    this.armed = null;
    this.disposeGhost();
  }

  private setRally(x: number, z: number): void {
    this.ctx.store.state.base.rallyPoint = { x, z };
    this.rallyArming = false;
    this.ctx.store.changed();
    this.syncRallyMarker();
  }

  private clearRally(): void {
    this.ctx.store.state.base.rallyPoint = null;
    this.ctx.store.changed();
    this.syncRallyMarker();
  }

  /** create/move/remove the world rally flag to match state.base.rallyPoint */
  private syncRallyMarker(): void {
    const rally = this.ctx.store.state.base.rallyPoint;
    if (!rally) {
      if (this.rallyMesh) {
        this.disposeSubtree(this.rallyMesh);
        this.group.remove(this.rallyMesh);
        this.rallyMesh = null;
      }
      return;
    }
    if (!this.rallyMesh) {
      this.rallyMesh = buildRallyFlag();
      this.group.add(this.rallyMesh);
    }
    this.rallyMesh.position.set(rally.x, this.terrain.heightAt(rally.x, rally.z), rally.z);
  }

  private disposeSubtree(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  }

  // ---- idle-unit detection (Phase 22) ----

  /** drones with nothing to do — no task, no queued order */
  private idleDrones() {
    return this.ctx.store.state.base.drones.filter((d) => d.status === 'idle');
  }

  /**
   * Select the next idle drone and jump the camera to it, cycling through them
   * on repeated presses (uid-sorted for a stable order). Returns false when
   * there are none. Wired to the panel button and the F hotkey.
   */
  findNextIdle(): boolean {
    const idle = this.idleDrones().sort((a, b) => a.uid.localeCompare(b.uid));
    if (idle.length === 0) return false;
    const startAfter = idle.findIndex((d) => d.uid === this.lastIdleUid);
    const next = idle[(startAfter + 1) % idle.length]!;
    this.lastIdleUid = next.uid;
    if (this.selection.replace([next.uid])) this.syncSelectionRings();
    this.hooks.centerOn(next.x, next.z);
    return true;
  }

  // ---- control groups (Phase 57) ----

  /** assign the current selection to control group n (1-9) */
  assignControlGroup(n: number): void {
    const uids = [...this.selection.selected];
    if (uids.length === 0) {
      this.controlGroups.delete(n);
      return;
    }
    this.controlGroups.set(n, uids);
    toast(`Control group ${n} set (${uids.length})`, 'info');
  }

  /** select control group n and centre the camera on it */
  recallControlGroup(n: number): void {
    const group = this.controlGroups.get(n);
    if (!group) return;
    const live = new Set([...this.meshByUid.keys(), ...this.droneMeshByUid.keys()]);
    const alive = group.filter((u) => live.has(u));
    if (alive.length === 0) {
      this.controlGroups.delete(n);
      return;
    }
    if (this.selection.replace(alive)) this.syncSelectionRings();
    const drones = this.ctx.store.state.base.drones.filter((d) => alive.includes(d.uid));
    if (drones.length > 0) {
      const cx = drones.reduce((a, d) => a + d.x, 0) / drones.length;
      const cz = drones.reduce((a, d) => a + d.z, 0) / drones.length;
      this.hooks.centerOn(cx, cz);
    }
  }

  /** the "Find idle (N)" button in the Drones panel box */
  private renderIdleControl(ctrl: HTMLElement): void {
    const count = this.idleDrones().length;
    const b = button(`Find idle drone (${count})`, () => this.findNextIdle());
    b.title = 'Select and jump to the next drone with nothing to do (hotkey: F).';
    if (count === 0) b.disabled = true;
    ctrl.appendChild(b);
  }

  private disposeGhost(): void {
    if (!this.ghost) return;
    this.ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    this.group.remove(this.ghost);
    this.ghost = null;
  }

  private moveGhost(ev: PointerEvent): void {
    if (!this.ghost || !this.armed) return;
    this.ray.setFromCamera(
      new THREE.Vector2((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1),
      this.camera,
    );
    const hit = this.ray.intersectObjects(this.terrain.group.children, false)[0];
    if (!hit) return;
    const def = STRUCTURES[this.armed];
    const x = hit.point.x;
    const z = hit.point.z;
    this.ghost.position.set(x, this.terrain.heightAt(x, z), z);
    const check = canPlace(def, x, z, this.footColliders, (a, b) => this.terrain.heightAt(a, b), this.ctx.store.canAfford(def.cost));
    if (check.ok !== this.ghostValid) {
      this.ghostValid = check.ok;
      const color = check.ok ? 0x7dffa8 : 0xff5c5c;
      this.ghost.traverse((o) => {
        if (o.name === 'ghost-fill') {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          m.color.setHex(color);
          m.emissive.setHex(color);
        } else if (o.name === 'ghost-edge') {
          ((o as THREE.LineSegments).material as THREE.LineBasicMaterial).color.setHex(color);
        }
      });
    }
  }

  private commitPlacement(raycaster: THREE.Raycaster): void {
    if (!this.armed) return;
    const def = STRUCTURES[this.armed];
    const hit = raycaster.intersectObjects(this.terrain.group.children, false)[0];
    if (!hit) return;
    const x = hit.point.x;
    const z = hit.point.z;
    const store = this.ctx.store;
    // defense in depth: the menu already locks unmet-prereq builds, but a
    // prereq could be lost between arming and committing (hazards, Phase 25+)
    const prereq = canBuild(this.armed, store.state.base.structures);
    if (!prereq.ok) {
      toast(prereq.reason ?? 'Prerequisite missing', 'warn');
      this.cancelArming();
      return;
    }
    const check = canPlace(def, x, z, this.footColliders, (a, b) => this.terrain.heightAt(a, b), store.canAfford(def.cost));
    if (!check.ok) {
      toast(check.reason ?? 'Cannot build there', 'warn');
      return;
    }
    if (!store.spendCost(def.cost)) return; // canAfford raced — nothing spent
    store.state.base.structures.push({
      uid: store.uid('b'),
      defId: def.id,
      x,
      z,
      rotY: 0,
      hp: def.maxHp * BALANCE.landingZone.structures.hpFractionAtStart,
      buildProgress: 0,
      status: 'building',
    });
    const placed = store.state.base.structures[store.state.base.structures.length - 1]!;
    store.bus.emit('structure:placed', { uid: placed.uid, defId: def.id });
    toast(`${def.name} under construction`, 'good');
    this.cancelArming();
    this.syncMeshes();
    store.changed();
  }

  // ---- meshes & colliders ----

  /** rebuild structure meshes + footprint colliders from persisted state.base */
  syncMeshes(): void {
    for (const child of [...this.structureGroup.children]) {
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      this.structureGroup.remove(child);
    }
    this.meshByUid.clear();
    // reconcile footprint colliders (shared array also used by foot movement)
    for (const c of this.structureColliders.values()) {
      const i = this.footColliders.indexOf(c);
      if (i >= 0) this.footColliders.splice(i, 1);
    }
    this.structureColliders.clear();
    for (const s of this.ctx.store.state.base.structures) {
      const def = STRUCTURES[s.defId];
      let g: THREE.Group;
      const visKey = this.visKeyFor(s);
      if (s.status === 'destroyed') {
        // ruined: a rubble pile that keeps its footprint blocked until cleared
        g = buildStructureRubble(def.footprint.w, def.footprint.d, mulberry32(seedFromUid(s.uid)));
      } else {
        // AoE-style staged model: foundation → frame → half-built → finished,
        // then progressive battle damage once standing. A finished, undamaged
        // structure gets its bespoke silhouette; scaffolds and damaged states
        // use the generic staged placeholder.
        const stage = constructionStage(s);
        const dmg = damageLevel(s);
        const finished = FINISHED_BUILDERS[s.defId];
        g =
          s.status === 'active' && dmg === 0 && finished
            ? finished(def.footprint.w, def.footprint.d, CATEGORY_COLORS[def.category])
            : buildStructurePlaceholder(def.footprint.w, def.footprint.d, CATEGORY_COLORS[def.category], stage, dmg);
        // reactor light goes dark the instant isotopes run out
        if (s.defId === 'nuclearGenerator' && !isGeneratorRunning(s)) {
          const light = g.getObjectByName('reactor-light') as THREE.Mesh | undefined;
          if (light) (light.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05;
        }
      }
      g.position.set(s.x, this.terrain.heightAt(s.x, s.z), s.z);
      g.rotation.y = s.rotY;
      g.userData.structureUid = s.uid;
      g.userData.visKey = visKey;
      this.structureGroup.add(g);
      this.meshByUid.set(s.uid, g);
      const collider = footprintAt(def, s.x, s.z);
      this.structureColliders.set(s.uid, collider);
      this.footColliders.push(collider);
    }
    this.pruneDeadSelection();
  }

  /** rebuild the drone mesh set to match state.base.drones — add/remove only;
   * positions are synced continuously in update(), not rebuilt here */
  private syncDroneMeshes(): void {
    const live = new Set(this.ctx.store.state.base.drones.map((d) => d.uid));
    for (const [uid, mesh] of [...this.droneMeshByUid]) {
      if (live.has(uid)) continue;
      mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      this.droneGroup.remove(mesh);
      this.droneMeshByUid.delete(uid);
    }
    for (const d of this.ctx.store.state.base.drones) {
      if (this.droneMeshByUid.has(d.uid)) continue;
      const mesh = buildDroneMesh(d.defId);
      mesh.position.set(d.x, this.terrain.heightAt(d.x, d.z), d.z);
      mesh.userData.droneUid = d.uid;
      this.droneGroup.add(mesh);
      this.droneMeshByUid.set(d.uid, mesh);
    }
    this.pruneDeadSelection();
  }

  /** drop selected uids whose structure/drone no longer exists, and refresh rings */
  private pruneDeadSelection(): void {
    const live = new Set([...this.meshByUid.keys(), ...this.droneMeshByUid.keys()]);
    this.selection.replace([...this.selection.selected].filter((u) => live.has(u)));
    this.syncSelectionRings();
  }

  /** remove a ruined structure, freeing its footprint (rebuild-premium is Phase 27) */
  private clearRubble(uid: string): void {
    const arr = this.ctx.store.state.base.structures;
    const i = arr.findIndex((s) => s.uid === uid);
    if (i < 0 || arr[i]!.status !== 'destroyed') return;
    arr.splice(i, 1);
    this.selection.clear();
    this.ctx.store.changed();
    this.syncMeshes();
  }

  private syncSelectionRings(): void {
    for (const child of [...this.ringGroup.children]) {
      const m = child as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.ringGroup.remove(child);
    }
    for (const uid of this.selection.selected) {
      const inst = this.ctx.store.state.base.structures.find((s) => s.uid === uid);
      if (inst) {
        const mesh = this.meshByUid.get(uid);
        if (!mesh) continue;
        const def = STRUCTURES[inst.defId];
        // translucent ring while under construction, solid once complete
        const ring = buildSelectionRing(Math.max(def.footprint.w, def.footprint.d) * 0.72, inst.status === 'active');
        ring.position.set(inst.x, this.terrain.heightAt(inst.x, inst.z) + 0.12, inst.z);
        this.ringGroup.add(ring);
        continue;
      }
      const d = this.ctx.store.state.base.drones.find((dr) => dr.uid === uid);
      if (!d || !this.droneMeshByUid.has(uid)) continue;
      const ring = buildSelectionRing(0.55, true);
      ring.position.set(d.x, this.terrain.heightAt(d.x, d.z) + 0.08, d.z);
      this.ringGroup.add(ring);
    }
  }

  // ---- per-frame ----

  /** the model key a structure should currently be showing (construction
   * stage + damage level, or rubble) — a mismatch triggers a mesh swap */
  private visKeyFor(s: StructureInstance): string {
    if (s.status === 'destroyed') return `${s.defId}:rubble`;
    // nuclear generators get an extra on/off suffix so the reactor light
    // dims the instant isotopes run out, without needing a per-frame poll
    const power = s.defId === 'nuclearGenerator' ? `:${isGeneratorRunning(s) ? 'on' : 'off'}` : '';
    return `${s.defId}:${constructionStage(s)}:${damageLevel(s)}${power}`;
  }

  /** per-frame hook: swap models as construction advances or damage crosses a
   * threshold, and drive the live panel elements (progress %, HP) without rebuilds */
  update(dt: number): void {
    void dt;
    for (const s of this.ctx.store.state.base.structures) {
      const mesh = this.meshByUid.get(s.uid);
      if (!mesh || mesh.userData.visKey !== this.visKeyFor(s)) {
        this.syncMeshes();
        break;
      }
    }
    // drones move every tick (BaseSim owns the actual motion) — add/remove
    // meshes when the roster changes, then just re-read position each frame
    if (this.droneMeshByUid.size !== this.ctx.store.state.base.drones.length) this.syncDroneMeshes();
    let selectionMoved = false;
    for (const d of this.ctx.store.state.base.drones) {
      const mesh = this.droneMeshByUid.get(d.uid);
      if (!mesh) continue;
      mesh.position.set(d.x, this.terrain.heightAt(d.x, d.z), d.z);
      if (this.selection.selected.has(d.uid)) selectionMoved = true;
    }
    if (selectionMoved) this.syncSelectionRings();
    for (const fn of this.panelUpdaters) fn();
  }

  // ---- clicks ----

  /** the home site's own deposit nodes — always the current poi while this view is alive */
  private currentNodes() {
    return this.ctx.store.poi(this.ctx.store.state.currentPoi).nodes ?? [];
  }

  /**
   * Command-mode click, tried before the rig-arming flow. While placing:
   * left commits, right cancels. Otherwise: left selects a structure or
   * drone (or clears on empty ground); right issues an order to any selected
   * drones — a gather order if it lands on a live deposit and a worker is
   * selected (Phase 20), otherwise a plain move order (Phase 19). No-op if
   * no drones are selected.
   */
  onCommandClick(raycaster: THREE.Raycaster, button: number): boolean {
    if (this.rallyArming) {
      if (button === 0) {
        const hit = raycaster.intersectObjects(this.terrain.group.children, false)[0];
        if (hit) this.setRally(hit.point.x, hit.point.z);
        return true;
      }
      if (button === 2) {
        this.rallyArming = false;
        return true;
      }
      return false;
    }
    if (this.armed) {
      if (button === 0) {
        this.commitPlacement(raycaster);
        return true;
      }
      if (button === 2) {
        this.cancelArming();
        return true;
      }
      return false;
    }
    if (button === 2) {
      const ordered = this.ctx.store.state.base.drones.filter((d) => this.selection.selected.has(d.uid));
      if (ordered.length > 0) {
        const workers = ordered.filter((d) => d.defId === 'worker');
        const nodeHit = workers.length > 0 ? raycaster.intersectObjects([...this.nodeMeshes.values()], true)[0] : undefined;
        let obj: THREE.Object3D | null | undefined = nodeHit?.object;
        while (obj && !obj.userData.nodeId) obj = obj.parent;
        const nodeState = obj ? this.currentNodes().find((n) => n.id === obj!.userData.nodeId) : undefined;
        if (nodeState && nodeState.remaining > 0) {
          for (const d of workers) orderGather(d, nodeState.id, nodeState.x, nodeState.z);
          this.ctx.store.changed();
        } else {
          const hit = raycaster.intersectObjects(this.terrain.group.children, false)[0];
          if (hit) {
            // spread a group across a small formation so they don't stack on one spot
            const offsets = formationOffsets(ordered.length);
            ordered.forEach((d, i) => orderMove(d, hit.point.x + offsets[i]!.dx, hit.point.z + offsets[i]!.dz));
            this.ctx.store.changed();
          }
        }
      }
      return true;
    }
    if (button !== 0) return false;
    const hit = raycaster.intersectObjects([...this.structureGroup.children, ...this.droneGroup.children], true)[0];
    if (hit) {
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.structureUid && !node.userData.droneUid) node = node.parent;
      const uid = node ? ((node.userData.structureUid ?? node.userData.droneUid) as string | undefined) : undefined;
      if (uid) {
        if (this.selection.replace([uid])) this.syncSelectionRings();
        return true;
      }
    }
    // empty ground clears the selection but doesn't consume — deploys still work
    if (this.selection.clear()) this.syncSelectionRings();
    return false;
  }

  // ---- panel ----

  /** part of SurfaceScreen's panel signature — selection, arming, statuses,
   * and affordability changes all trigger rebuilds (so Build buttons un-grey
   * the moment freshly mined stock covers a cost, and inspectors flip from
   * "under construction" to live status on completion) */
  panelSig(): string {
    const afford = STRUCTURE_IDS.map((id) => (this.ctx.store.canAfford(STRUCTURES[id].cost) ? '1' : '0')).join('');
    // status + repair/damage/clean markers + a coarse "dusty" bit so the Clean
    // button appears/disappears at the transitions but not every frame
    const statuses = this.ctx.store.state.base.structures
      .map(
        (s) =>
          s.status[0] +
          (s.repairing ? 'r' : '') +
          (isDamaged(s) ? 'd' : '') +
          (s.cleaning ? 'C' : (s.dustLevel ?? 0) > 0.02 ? 'u' : '') +
          (s.defId === 'nuclearGenerator' ? (isGeneratorRunning(s) ? 'N' : 'n') : ''),
      )
      .join('');
    const rally = this.ctx.store.state.base.rallyPoint;
    const drones = this.ctx.store.state.base.drones;
    const base = this.ctx.store.state.base;
    return (
      `${this.selection.sig()}|${this.armed ?? ''}|${this.rallyArming ? 'R' : ''}|${rally ? 'r' : ''}` +
      `|${afford}|${statuses}#${base.structures.length}` +
      // drone count so the rally controls appear/disappear with the roster,
      // and idle count so the "Find idle (N)" label + disabled state track it
      `|d${drones.length}i${drones.filter((d) => d.status === 'idle').length}` +
      // satellites in orbit + whether a launch is running, so the array panel
      // flips buttons to "in orbit" / re-disables during a launch
      `|sat${base.satellites.join('')}${base.launch ? 'L' : ''}` +
      // a live hazard warning flips the Shelter button to its ⚠ alert state
      `|w${base.flareWarningUntil !== null ? 'f' : ''}${base.stormWarningUntil !== null ? 's' : ''}`
    );
  }

  /** appended into the surface panel: power readout + construction menu + inspector */
  renderPanel(): void {
    const store = this.ctx.store;
    this.panelUpdaters = [];

    // power readout — live net power + the day/night state that drives solar
    if (hasPowerGrid(store.state.base.structures)) {
      const pwr = box('Power');
      const netVal = el('div', 'sub');
      pwr.appendChild(netVal);
      const cycle = el('div', 'sub');
      pwr.appendChild(cycle);
      this.panelUpdaters.push(() => {
        const t = store.state.playSeconds;
        const storming = stormActive(store.state.base, t);
        const net = netPower(store.state.base.structures, t, storming);
        netVal.innerHTML = `Net <span style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : ''}${net.toFixed(0)}</span> power`;
        const f = solarFactor(t);
        cycle.textContent = storming ? '🌪 Dust storm · solar blacked out' : f > 0.02 ? `☀ Daylight · solar ${Math.round(f * 100)}%` : '☾ Night · solar arrays idle';
      });
    }

    // operation status — the mission checklist (Phase 30), live-updated
    {
      const opBox = box('Operation');
      const rows = missionObjectives(store).map((o) => {
        const row = el('div', 'row');
        const mark = el('span', 'sub', '');
        mark.style.width = '14px';
        const label = el('span', 'grow', '');
        label.style.fontSize = '12px';
        row.append(mark, label);
        if (!o.available) row.style.opacity = '0.45';
        opBox.appendChild(row);
        return { mark, label };
      });
      this.panelUpdaters.push(() => {
        missionObjectives(store).forEach((o, i) => {
          const r = rows[i];
          if (!r) return;
          r.mark.textContent = !o.available ? '·' : o.done ? '✓' : '○';
          r.mark.style.color = o.done ? 'var(--green)' : o.available ? 'var(--amber)' : 'var(--border)';
          r.label.textContent = o.label;
        });
      });
    }

    const menu = box('Construction');
    if (this.armed) {
      menu.appendChild(el('div', 'sub', 'Click the ground to place · right-click or Esc to cancel.'));
    }
    for (const id of STRUCTURE_IDS) {
      const def = STRUCTURES[id];
      const row = el('div', 'row');
      const name = el('span', 'grow', def.name);
      name.style.fontSize = '12px';
      row.appendChild(name);
      const buildable = canBuild(id, store.state.base.structures);
      const affordable = store.canAfford(def.cost);
      // locked structures show WHY: prereq first (a hard wall), then cost
      const label = !buildable.ok ? 'Locked' : this.armed === id ? 'Placing…' : 'Build';
      const b = button(label, () => this.toggleArm(id));
      b.title = `${def.desc}\nCost: ${costToString(def.cost)} · build time ${def.buildTimeSec}s`;
      if (!buildable.ok) b.title += `\n⚠ ${buildable.reason}`;
      else if (!affordable) b.title += '\n(not enough resources)';
      const blocked = !buildable.ok || !affordable;
      if ((blocked && this.armed !== id) || !this.hooks.isCommand()) b.disabled = true;
      if (this.armed === id) b.classList.add('active');
      row.appendChild(b);
      menu.appendChild(row);
    }

    // base drone controls: rally point (Phase 21) + find-idle (Phase 22).
    // Shown once drones can exist here — a Fabricator stands, some drones are
    // already out, or dev mode is on (so it's reachable before Phase 24 wiring)
    const fab = store.state.base.structures.find((s) => s.status === 'active' && s.defId === 'fabricator');
    const droneCapable = !!fab || store.state.base.drones.length > 0 || store.hasFlag(FLAGS.DEV_MODE);
    if (droneCapable && this.hooks.isCommand()) {
      const ctrl = box('Drones');
      const rally = store.state.base.rallyPoint;
      // toggling/setting/clearing rally flips panelSig, so SurfaceScreen
      // rebuilds this panel next frame — no explicit re-render needed
      const rallyBtn = button(
        this.rallyArming ? 'Click ground to set…' : rally ? 'Move rally point' : 'Set rally point',
        () => this.toggleRallyArm(),
      );
      if (this.rallyArming) rallyBtn.classList.add('active');
      rallyBtn.title = 'New drones report to the rally point. Right-click or Esc cancels.';
      ctrl.appendChild(rallyBtn);
      if (rally) ctrl.appendChild(button('Clear rally', () => this.clearRally()));
      this.renderIdleControl(ctrl);
      // garrison/shelter (Phase 44): tuck all drones into the nearest structure —
      // sheltered drones ride out a hazard strike unharmed
      if (store.state.base.drones.length > 0) {
        const warning = store.state.base.flareWarningUntil !== null || store.state.base.stormWarningUntil !== null;
        const shelterBtn = button(warning ? '⚠ Shelter drones' : 'Shelter drones', () => {
          if (shelterAll(store) === 0) toast('Nowhere to shelter — build a structure first', 'warn');
          else store.changed();
        });
        shelterBtn.title = 'Send every drone to shelter in the nearest structure. A hazard strike loses drones caught in the open.';
        if (warning) shelterBtn.classList.add('active');
        ctrl.appendChild(shelterBtn);
      }
    }

    // dev-mode drone spawn: real production now rolls drones out of a finished
    // Fabricator job (Phase 24); these buttons stay only as a testing shortcut
    // that skips the Refinery→Power Relay→Fabricator build chain
    if (store.hasFlag(FLAGS.DEV_MODE)) {
      const dev = box('Dev');
      const sx = fab ? fab.x + 2 : 0;
      const sz = fab ? fab.z + 2 : 0;
      for (const id of DRONE_IDS) {
        dev.appendChild(
          button(`Spawn ${DRONES[id].name} (dev)`, () => {
            spawnDrone(store, id, sx + (Math.random() - 0.5) * 2, sz + (Math.random() - 0.5) * 2);
            store.changed();
            this.syncDroneMeshes();
          }),
        );
      }
    }

    // on-site refining: the shared refinery queue, available at the base only
    // once a Refinery structure stands (its panel is what makes raw → refined
    // possible here rather than only back at the shipyard)
    if (store.state.base.structures.some((s) => s.status === 'active' && s.defId === 'refineryBuilding')) {
      const live = renderRefineryPanel(this.ctx);
      this.panelUpdaters.push(() => live.update());
    }

    // fabricator: one queue panel per active instance (ordinarily just one)
    for (const inst of store.state.base.structures) {
      if (inst.status === 'active' && inst.defId === 'fabricator') {
        const live = renderFabricatorPanel(this.ctx, inst);
        this.panelUpdaters.push(() => live.update());
      }
    }

    // launch pad: the satellite array queue (Phase 31-34) — one launch at a time
    if (store.state.base.structures.some((s) => s.status === 'active' && s.defId === 'launchPad')) {
      const b = box('Satellite Array');
      for (const id of SATELLITE_IDS) {
        const def = SATELLITES[id];
        const row = el('div', 'row');
        const name = el('span', 'grow', def.name);
        name.style.fontSize = '12px';
        row.appendChild(name);
        if (store.state.base.satellites.includes(id)) {
          const tag = el('span', 'sub', 'in orbit ✓');
          tag.style.color = 'var(--green)';
          row.appendChild(tag);
        } else {
          const check = canLaunch(store, id);
          const affordable = store.canAfford(def.cost);
          const btn = button('Launch', () => {
            if (!queueLaunch(store, id)) toast(canLaunch(store, id).reason ?? 'Cannot launch now', 'warn');
          });
          btn.title = `${def.desc}\nCost: ${costToString(def.cost)} · launch ${def.launchTimeSec}s`;
          if (!check.ok) btn.title += `\n⚠ ${check.reason}`;
          else if (!affordable) btn.title += '\n(not enough resources)';
          if (!check.ok || !affordable || !this.hooks.isCommand()) btn.disabled = true;
          row.appendChild(btn);
        }
        b.appendChild(row);
      }
      const progLabel = el('div', 'sub', '');
      b.appendChild(progLabel);
      const progBar = bar(0, 'var(--accent)');
      b.appendChild(progBar);
      this.panelUpdaters.push(() => {
        const l = store.state.base.launch;
        if (l) {
          const def = SATELLITES[l.satId];
          progLabel.textContent = `Launching ${def.name}…`;
          (progBar.firstElementChild as HTMLElement).style.width = `${Math.round(Math.min(1, l.progressSec / def.launchTimeSec) * 100)}%`;
          progLabel.style.display = '';
          progBar.style.display = '';
        } else {
          progLabel.style.display = 'none';
          progBar.style.display = 'none';
        }
      });
    }

    // food chain (Phase 36-39): shown once a soil processor or greenhouse stands
    const foodStructures = store.state.base.structures.filter((s) => s.status === 'active' && (s.defId === 'soilProcessor' || s.defId === 'greenhouse'));
    if (foodStructures.length > 0) {
      const fcfg = BALANCE.landingZone.food;
      const b = box('Food Chain');
      const foodRow = el('div', 'sub', '');
      const wasteRow = el('div', 'sub', '');
      const medRow = el('div', 'sub', '');
      b.append(foodRow, wasteRow, medRow);
      this.panelUpdaters.push(() => {
        const f = store.state.food;
        foodRow.textContent = `Food ${f.level.toFixed(0)}/${fcfg.cap}`;
        wasteRow.textContent = `Organic waste ${f.organicWaste.toFixed(1)}/${fcfg.wasteCap}`;
        medRow.textContent = `Growing medium ${f.growingMedium.toFixed(1)}/${fcfg.growingMediumCap}`;
      });
      // per-greenhouse crop status + grow-lights toggle
      for (const gh of store.state.base.structures.filter((s) => s.status === 'active' && s.defId === 'greenhouse')) {
        const row = el('div', 'row');
        row.appendChild(el('span', 'grow', 'Greenhouse'));
        const status = el('span', 'sub', '');
        row.appendChild(status);
        b.appendChild(row);
        const cropBar = bar(0, 'var(--green)');
        b.appendChild(cropBar);
        const toggle = button('', () => {
          gh.growLights = !gh.growLights;
          store.changed();
        });
        b.appendChild(toggle);
        this.panelUpdaters.push(() => {
          const inner = cropBar.firstElementChild as HTMLElement;
          if (gh.cropProgress === undefined) {
            status.textContent = 'fallow — needs medium + irrigation';
            inner.style.width = '0%';
          } else {
            const frac = Math.min(1, gh.cropProgress / fcfg.crop.growSec);
            status.textContent = frac >= 1 ? 'harvesting…' : `growing ${Math.round(frac * 100)}%`;
            inner.style.width = `${Math.round(frac * 100)}%`;
          }
          toggle.textContent = gh.growLights ? 'Grow-lights: ON (burns fuel)' : 'Grow-lights: OFF (daylight only)';
        });
      }
    }

    if (this.selection.selected.size > 0) {
      const structures = store.state.base.structures;
      const b = box(this.selection.selected.size > 1 ? `Selected ×${this.selection.selected.size}` : 'Selected');
      for (const uid of this.selection.selected) {
        const drone = store.state.base.drones.find((d) => d.uid === uid);
        if (drone) {
          const def = DRONES[drone.defId];
          const row = el('div', 'row');
          row.appendChild(el('span', 'grow', def.name));
          const status = el('span', 'sub', '');
          row.appendChild(status);
          b.appendChild(row);
          this.panelUpdaters.push(() => {
            const carried = Math.floor(drone.carrying ?? 0);
            status.textContent =
              drone.defId === 'hauler' && drone.haulTarget ? `hauling · carrying ${carried}`
              : drone.status === 'gathering' ? (drone.hauledBy ? `gathering · hauled` : `gathering · carrying ${carried}`)
              : drone.status === 'returning' ? `returning · carrying ${carried}`
              : drone.status === 'moving' ? (drone.nodeId ? 'moving to deposit' : 'moving')
              : 'idle';
          });
          b.appendChild(el('div', 'sub', def.desc));
          continue;
        }
        const inst = structures.find((s) => s.uid === uid);
        if (!inst) continue;
        const def = STRUCTURES[inst.defId];
        const row = el('div', 'row');
        row.appendChild(el('span', 'grow', def.name));
        const status = el('span', 'sub', '');
        row.appendChild(status);
        b.appendChild(row);

        // ruined: no HP/repair, just the wreck and a way to reclaim the spot
        if (inst.status === 'destroyed') {
          status.textContent = 'DESTROYED';
          b.appendChild(el('div', 'sub', 'Ruined. Anything it produced or supported is gone.'));
          b.appendChild(button('Clear rubble', () => this.clearRubble(inst.uid), 'danger'));
          b.appendChild(el('div', 'sub', def.desc));
          continue;
        }

        if (inst.status === 'building') {
          // dedicated construction progress bar (amber), live-updated
          const progress = bar(inst.buildProgress, 'var(--amber)');
          b.appendChild(progress);
          this.panelUpdaters.push(() => {
            status.textContent = inst.status === 'building' ? `UNDER CONSTRUCTION · ${Math.round(inst.buildProgress * 100)}%` : inst.status;
            (progress.firstElementChild as HTMLElement).style.width = `${Math.round(inst.buildProgress * 100)}%`;
          });
        } else {
          status.textContent = inst.repairing ? 'active · repairing' : inst.status;
        }

        // HP bar — live: HP climbs with the scaffold (AoE model) and drops with damage
        const hpBar = bar(0, 'var(--green)');
        b.appendChild(hpBar);
        this.panelUpdaters.push(() => {
          const cap = maxHpNow(inst);
          const f = inst.hp / Math.max(1, cap);
          const inner = hpBar.firstElementChild as HTMLElement;
          inner.style.width = `${Math.round(f * 100)}%`;
          inner.style.background = f > 0.55 ? 'var(--green)' : f > 0.25 ? 'var(--amber)' : 'var(--red)';
        });

        // solar array: live dust level + a Clean action (costs time, not resources)
        if (inst.defId === 'solarArray' && inst.status === 'active') {
          const dustLabel = el('div', 'sub');
          b.appendChild(dustLabel);
          const dustBar = bar(0, 'var(--amber)');
          b.appendChild(dustBar);
          this.panelUpdaters.push(() => {
            const dust = inst.dustLevel ?? 0;
            (dustBar.firstElementChild as HTMLElement).style.width = `${Math.round(dust * 100)}%`;
            dustLabel.textContent = inst.cleaning ? 'Dust · cleaning (offline)…' : `Dust ${Math.round(dust * 100)}%`;
          });
          if (canClean(inst)) {
            b.appendChild(button('Clean panels', () => {
              inst.cleaning = true;
              store.changed();
            }));
          }
        }

        // nuclear generator: live isotope stock + running/offline status —
        // steady power for as long as the shared stock holds out
        if (inst.defId === 'nuclearGenerator' && inst.status === 'active') {
          const nuclearLabel = el('div', 'sub');
          b.appendChild(nuclearLabel);
          this.panelUpdaters.push(() => {
            const running = isGeneratorRunning(inst);
            const isotope = store.state.stock.isotope ?? 0;
            nuclearLabel.textContent = running
              ? `Running · isotope stock ${Math.round(isotope)}`
              : `OFFLINE — out of isotopes (stock ${Math.round(isotope)})`;
            nuclearLabel.style.color = running ? '' : 'var(--red)';
          });
        }

        // repair: cheaper and faster than a rebuild (Phase 9)
        if (canRepair(inst)) {
          const cost = repairCost(inst);
          const rb = button(`Repair (${costToString(cost)})`, () => {
            const r = startRepair(store, inst);
            if (!r.ok) toast(r.reason ?? 'Cannot repair', 'warn');
          });
          if (!store.canAfford(cost)) {
            rb.disabled = true;
            rb.title = 'Not enough resources to repair.';
          }
          b.appendChild(rb);
        }
        // dev-mode hook so damage/destruction can be exercised before hazards
        // land (Phase 25+) — a hit that drops HP to 0 ruins the structure
        if (this.ctx.store.hasFlag(FLAGS.DEV_MODE) && inst.status === 'active') {
          b.appendChild(
            button('Damage −25 (dev)', () => {
              if (applyDamage(inst, 25) === 'destroyed') {
                store.bus.emit('structure:destroyed', { uid: inst.uid, defId: inst.defId });
              }
              store.changed();
              this.syncMeshes();
            }, 'danger'),
          );
        }
        b.appendChild(el('div', 'sub', def.desc));
      }
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('pointermove', this.onPointerMove, true);
    window.removeEventListener('pointerup', this.onPointerUp, true);
    this.boxEl.remove();
    for (const c of this.structureColliders.values()) {
      const i = this.footColliders.indexOf(c);
      if (i >= 0) this.footColliders.splice(i, 1);
    }
    this.structureColliders.clear();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    this.group.clear();
    this.group.removeFromParent();
  }
}

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
  buildNuclearGeneratorMesh,
  buildRefineryMesh,
  buildRelayMesh,
  buildSelectionRing,
  buildSiloMesh,
  buildSolarArrayMesh,
  buildStructureGhost,
  buildStructurePlaceholder,
  buildStructureRubble,
  mulberry32,
} from '../scene/primitives';
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
import { FLAGS } from '../core/flags';
import { canPlace, footprintAt } from './placement';
import { SelectionController, uidsInRect, type Px } from './selection';
import { BALANCE } from '../config/balance';
import { costToString } from '../core/resources';
import { bar, box, button, el, renderRefineryPanel } from '../ui/panels';
import { toast } from '../ui/hud';

/** bespoke finished-body builders per structure; missing → generic placeholder */
const FINISHED_BUILDERS: Partial<Record<StructureId, (w: number, d: number, color: number) => THREE.Group>> = {
  solarArray: buildSolarArrayMesh,
  storageSilo: buildSiloMesh,
  powerRelay: buildRelayMesh,
  refineryBuilding: buildRefineryMesh,
  nuclearGenerator: buildNuclearGeneratorMesh,
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
};

/** drags shorter than this are clicks — let the click path handle them */
const BOX_DRAG_MIN_PX = 5;

export interface BaseViewHooks {
  /** true while SurfaceScreen is in command mode (box select/placement are command-only) */
  isCommand: () => boolean;
}

export class BaseView {
  /** every Landing-Zone mesh lives under this group — owned and disposed here */
  readonly group = new THREE.Group();
  private structureGroup = new THREE.Group();
  private ringGroup = new THREE.Group();
  private meshByUid = new Map<string, THREE.Group>();
  private structureColliders = new Map<string, Collider>();
  private selection = new SelectionController();
  private boxEl: HTMLElement;
  private dragStart: Px | null = null;
  // placement state
  private armed: StructureId | null = null;
  private ghost: THREE.Group | null = null;
  private ghostValid = false;
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
  ) {
    this.group.name = 'landing-zone-base';
    this.group.add(this.structureGroup);
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

  /** all selectable entities projected to screen px (drones join at Phase 19) */
  private projectSelectables(): { uid: string; px: Px }[] {
    const out: { uid: string; px: Px }[] = [];
    const v = new THREE.Vector3();
    for (const s of this.ctx.store.state.base.structures) {
      if (s.status === 'destroyed') continue;
      v.set(s.x, this.terrain.heightAt(s.x, s.z) + 0.8, s.z).project(this.camera);
      if (v.z > 1) continue; // behind the camera
      out.push({ uid: s.uid, px: { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight } });
    }
    return out;
  }

  // ---- placement (Phase 7) ----

  private toggleArm(id: StructureId): void {
    if (this.armed === id) {
      this.cancelArming();
      return;
    }
    this.armed = id;
    this.selection.clear();
    this.syncSelectionRings();
    this.disposeGhost();
    const def = STRUCTURES[id];
    this.ghost = buildStructureGhost(def.footprint.w, def.footprint.d);
    this.ghost.position.y = -999; // parked until the first mouse move
    this.group.add(this.ghost);
  }

  /** true when arming was active and got cancelled (Escape / right-click) */
  cancelArming(): boolean {
    if (!this.armed) return false;
    this.armed = null;
    this.disposeGhost();
    return true;
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
    // drop selections whose structure no longer stands
    const live = new Set(this.meshByUid.keys());
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
      const mesh = this.meshByUid.get(uid);
      if (!inst || !mesh) continue;
      const def = STRUCTURES[inst.defId];
      // translucent ring while under construction, solid once complete
      const ring = buildSelectionRing(Math.max(def.footprint.w, def.footprint.d) * 0.72, inst.status === 'active');
      ring.position.set(inst.x, this.terrain.heightAt(inst.x, inst.z) + 0.12, inst.z);
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
    for (const fn of this.panelUpdaters) fn();
  }

  // ---- clicks ----

  /**
   * Command-mode click, tried before the rig-arming flow. While placing:
   * left commits, right cancels. Otherwise: left selects a structure (or
   * clears on empty ground), right is the reserved command channel.
   */
  onCommandClick(raycaster: THREE.Raycaster, button: number): boolean {
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
    if (button === 2) return true; // reserved: drone orders from Phase 19
    if (button !== 0) return false;
    const hit = raycaster.intersectObjects(this.structureGroup.children, true)[0];
    if (hit) {
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.structureUid) node = node.parent;
      if (node) {
        if (this.selection.replace([node.userData.structureUid as string])) this.syncSelectionRings();
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
    return `${this.selection.sig()}|${this.armed ?? ''}|${afford}|${statuses}#${this.ctx.store.state.base.structures.length}`;
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
        const net = netPower(store.state.base.structures, t);
        netVal.innerHTML = `Net <span style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : ''}${net.toFixed(0)}</span> power`;
        const f = solarFactor(t);
        cycle.textContent = f > 0.02 ? `☀ Daylight · solar ${Math.round(f * 100)}%` : '☾ Night · solar arrays idle';
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

    // on-site refining: the shared refinery queue, available at the base only
    // once a Refinery structure stands (its panel is what makes raw → refined
    // possible here rather than only back at the shipyard)
    if (store.state.base.structures.some((s) => s.status === 'active' && s.defId === 'refineryBuilding')) {
      const live = renderRefineryPanel(this.ctx);
      this.panelUpdaters.push(() => live.update());
    }

    if (this.selection.selected.size > 0) {
      const structures = store.state.base.structures;
      const b = box(this.selection.selected.size === 1 ? 'Structure' : `Selected ×${this.selection.selected.size}`);
      for (const uid of this.selection.selected) {
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

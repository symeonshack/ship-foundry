import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera, makeOrbit } from '../scene/camera';
import { addBasicLights, addStars, buildFoundryBase, buildPartMesh, buildSocketMarker, mat } from '../scene/primitives';
import { PARTS, SHIP_PART_IDS, type PartId } from './partCatalog';
import { deriveStats, type ShipStats } from './shipStats';
import { costToString } from '../core/resources';
import type { PartPlacement } from '../core/state';
import { FLAGS } from '../core/flags';
import { box, button, clearPanel, el, renderRefineryPanel, type LivePanel } from '../ui/panels';
import { toast } from '../ui/hud';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ShipyardScreen implements GameScreen {
  readonly id = 'shipyard' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();

  private shipGroup = new THREE.Group();
  private placementGroups = new Map<string, THREE.Group>();
  private markers: THREE.Mesh[] = [];
  private ghost: THREE.Group | null = null;
  private selectedPart: PartId | null = null;
  private selectedPlacement: string | null = null;
  private stats: ShipStats;
  private t = 0;
  private unsub: (() => void) | null = null;
  private livePanels: LivePanel[] = [];

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x0a0e12);
    this.camera = makeCamera(46);
    this.camera.position.set(9, 6, 11);
    this.controls = makeOrbit(this.camera, canvas, { target: [0, 3, 0], minDistance: 5, maxDistance: 40 });
    addBasicLights(this.scene);
    addStars(this.scene);

    // landing pad + the foundry base itself
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 0.5, 24), mat(0x39454d, { rough: 0.9 }));
    pad.position.y = -0.25;
    this.scene.add(pad);
    const ringLight = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.06, 8, 48), mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.5 }));
    ringLight.rotation.x = Math.PI / 2;
    this.scene.add(ringLight);
    const base = buildFoundryBase();
    base.position.set(-12, 0, -6);
    base.rotation.y = 0.6;
    this.scene.add(base);
    const grid = new THREE.GridHelper(60, 30, 0x1e3a4a, 0x14222c);
    grid.position.y = -0.5;
    this.scene.add(grid);

    this.scene.add(this.shipGroup);
    this.stats = deriveStats(ctx.store.state.ship);
  }

  enter(): void {
    this.rebuildShip();
    this.renderPanel();
    this.unsub = this.ctx.bus.on('state:changed', () => {
      this.renderPanel();
    });
  }

  exit(): void {
    this.unsub?.();
    this.unsub = null;
    this.selectedPart = null;
    this.selectedPlacement = null;
    clearPanel();
  }

  // ---- ship assembly ----

  private rebuildShip(): void {
    this.shipGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    this.shipGroup.clear();
    this.placementGroups.clear();
    this.markers = [];
    this.ghost = null;

    const ship = this.ctx.store.state.ship;
    const byUid = new Map(ship.map((p) => [p.uid, p]));
    const build = (p: PartPlacement): THREE.Group => {
      let g = this.placementGroups.get(p.uid);
      if (g) return g;
      g = new THREE.Group();
      g.add(buildPartMesh(p.partId));
      g.userData.uid = p.uid;
      if (p.parent === null) {
        g.position.set(0, 0.5, 0);
        this.shipGroup.add(g);
      } else {
        const parentPlacement = byUid.get(p.parent)!;
        const parentGroup = build(parentPlacement);
        const socket = PARTS[parentPlacement.partId].sockets[p.socket]!;
        g.position.set(...socket.pos);
        g.rotation.set(...socket.rot);
        parentGroup.add(g);
      }
      this.placementGroups.set(p.uid, g);
      return g;
    };
    for (const p of ship) build(p);

    this.stats = deriveStats(ship);
    this.applyStrainGlow();
    this.rebuildMarkers();
  }

  private applyStrainGlow(): void {
    const { strain } = this.stats;
    const color = strain === 'critical' ? 0xff5c5c : 0xffb454;
    const intensity = strain === 'ok' ? 0.15 : strain === 'high' ? 0.8 : 1.4;
    this.shipGroup.traverse((o) => {
      if (o.name === 'glow') {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissive.setHex(color);
        m.emissiveIntensity = intensity;
      }
    });
  }

  private socketOccupied(parentUid: string, socketIndex: number): boolean {
    return this.ctx.store.state.ship.some((p) => p.parent === parentUid && p.socket === socketIndex);
  }

  private rebuildMarkers(): void {
    for (const m of this.markers) m.removeFromParent();
    this.markers = [];
    this.clearGhost();
    if (!this.selectedPart) return;
    const def = PARTS[this.selectedPart];
    if (!def.attachesTo) return;
    for (const p of this.ctx.store.state.ship) {
      const sockets = PARTS[p.partId].sockets;
      for (let i = 0; i < sockets.length; i++) {
        if (sockets[i]!.type !== def.attachesTo || this.socketOccupied(p.uid, i)) continue;
        const marker = buildSocketMarker();
        const outward = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...sockets[i]!.rot));
        marker.position.set(...sockets[i]!.pos).addScaledVector(outward, 0.08);
        marker.rotation.set(...sockets[i]!.rot);
        marker.rotateX(-Math.PI / 2); // disc faces outward along socket +Y
        marker.userData = { parentUid: p.uid, socketIndex: i };
        this.placementGroups.get(p.uid)!.add(marker);
        this.markers.push(marker);
      }
    }
  }

  private clearGhost(): void {
    if (this.ghost) {
      this.ghost.removeFromParent();
      this.ghost = null;
    }
  }

  private showGhost(parentUid: string, socketIndex: number): void {
    this.clearGhost();
    if (!this.selectedPart) return;
    const parentPlacement = this.ctx.store.state.ship.find((p) => p.uid === parentUid)!;
    const socket = PARTS[parentPlacement.partId].sockets[socketIndex]!;
    const ghost = buildPartMesh(this.selectedPart);
    ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material) {
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        mm.transparent = true;
        mm.opacity = 0.45;
        m.material = mm;
      }
    });
    ghost.position.set(...socket.pos);
    ghost.rotation.set(...socket.rot);
    this.placementGroups.get(parentUid)!.add(ghost);
    this.ghost = ghost;
  }

  // ---- interaction ----

  onClick(ndc: THREE.Vector2): void {
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.selectedPart) {
      const hit = this.raycaster.intersectObjects(this.markers, false)[0];
      if (hit) {
        this.placePart(hit.object.userData.parentUid as string, hit.object.userData.socketIndex as number);
        return;
      }
    }
    // otherwise: select an existing part for inspection/removal
    const meshes: THREE.Object3D[] = [];
    this.shipGroup.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      for (let a: THREE.Object3D | null = o; a; a = a.parent) {
        if (a.name === 'socket-marker') return;
      }
      meshes.push(o);
    });
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (hit) {
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.uid) node = node.parent;
      if (node?.userData.uid) {
        this.selectedPlacement = node.userData.uid as string;
        this.selectedPart = null;
        this.rebuildMarkers();
        this.renderPanel();
        return;
      }
    }
    if (this.selectedPlacement) {
      this.selectedPlacement = null;
      this.renderPanel();
    }
  }

  onPointerMove(ndc: THREE.Vector2): void {
    if (!this.selectedPart || this.markers.length === 0) return;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.markers, false)[0];
    if (hit) {
      const { parentUid, socketIndex } = hit.object.userData as { parentUid: string; socketIndex: number };
      if (!this.ghost || this.ghost.userData.key !== `${parentUid}:${socketIndex}`) {
        this.showGhost(parentUid, socketIndex);
        if (this.ghost) this.ghost.userData.key = `${parentUid}:${socketIndex}`;
      }
    } else {
      this.clearGhost();
    }
  }

  private placePart(parentUid: string, socketIndex: number): void {
    const partId = this.selectedPart;
    if (!partId) return;
    const def = PARTS[partId];
    if (this.socketOccupied(parentUid, socketIndex)) return;
    if (!this.ctx.store.spendCost(def.cost)) {
      toast(`Not enough materials (${costToString(def.cost)})`, 'warn');
      return;
    }
    this.ctx.store.state.ship.push({
      uid: this.ctx.store.uid('p'),
      partId,
      parent: parentUid,
      socket: socketIndex,
    });
    this.ctx.store.setFlag(FLAGS.FIRST_BUILD);
    this.ctx.bus.emit('build:placed', { partId });
    toast(`${def.name} fitted`, 'good');
    this.rebuildShip();
    this.rebuildMarkers();
    this.ctx.store.changed();
  }

  private removePart(uid: string): void {
    const ship = this.ctx.store.state.ship;
    const placement = ship.find((p) => p.uid === uid);
    if (!placement || placement.parent === null) return;
    if (ship.some((p) => p.parent === uid)) {
      toast('Remove attached parts first', 'warn');
      return;
    }
    ship.splice(ship.indexOf(placement), 1);
    this.ctx.store.refundCost(PARTS[placement.partId].cost);
    this.ctx.bus.emit('build:removed', { partId: placement.partId });
    toast(`${PARTS[placement.partId].name} removed — materials recovered`, 'info');
    this.selectedPlacement = null;
    this.rebuildShip();
    this.ctx.store.changed();
  }

  // ---- panel ----

  private renderPanel(): void {
    clearPanel();
    this.livePanels = [];
    const store = this.ctx.store;

    // readout — kept diegetic-adjacent: lamps and words, not spreadsheets
    const readout = box('Ship Readout');
    const strainRow = el('div', 'row');
    const lamp = el('span', 'dot');
    lamp.style.cssText = `width:10px;height:10px;border-radius:50%;background:${
      this.stats.strain === 'ok' ? 'var(--green)' : this.stats.strain === 'high' ? 'var(--amber)' : 'var(--red)'
    }`;
    strainRow.append(lamp, el('span', undefined, `Thrust strain: ${this.stats.strain === 'ok' ? 'nominal' : this.stats.strain}`));
    readout.appendChild(strainRow);
    if (this.stats.comOffset > 0.3) readout.appendChild(el('div', 'sub', '⚠ Load is off-axis — she’ll fly, but she’ll complain.'));
    readout.appendChild(el('div', 'sub', `Hold ${this.stats.cargoCap} · Tank ${this.stats.fuelCap} · Sensors reach ${this.stats.scanRange}`));
    readout.appendChild(el('div', 'sub', `Shielding — radiation ${this.stats.radRating || '—'} · thermal ${this.stats.thermalRating || '—'}`));
    readout.appendChild(el('div', 'sub', `Rigs aboard — drill ×${this.stats.rigCounts.drill} · cryo ×${this.stats.rigCounts.cryo}`));
    if (!this.stats.hasLifeSupport) readout.appendChild(el('div', 'sub', '⚠ No life support. The ship stays docked.'));
    readout.appendChild(button('Launch → Star Map', () => this.ctx.nav('starmap')));

    // selected placement
    if (this.selectedPlacement) {
      const placement = store.state.ship.find((p) => p.uid === this.selectedPlacement);
      if (placement) {
        const def = PARTS[placement.partId];
        const b = box(`Fitted: ${def.name}`);
        b.appendChild(el('div', 'sub', def.desc));
        if (placement.parent === null) {
          b.appendChild(el('div', 'sub', 'Root frame — the one thing you can’t unbolt.'));
        } else {
          b.appendChild(button(`Remove (recover ${costToString(def.cost)})`, () => this.removePart(placement.uid), 'danger'));
        }
      }
    }

    // parts palette
    const palette = box('Fabricate — Ship');
    for (const id of SHIP_PART_IDS) {
      const def = PARTS[id];
      const item = el('div', 'part-item');
      if (!store.canAfford(def.cost)) item.classList.add('unaffordable');
      if (this.selectedPart === id) item.classList.add('selected');
      item.appendChild(el('span', undefined, def.name));
      item.appendChild(el('span', 'cost', costToString(def.cost)));
      item.title = def.desc;
      item.addEventListener('click', () => {
        if (this.selectedPart !== id && !store.canAfford(def.cost)) {
          toast(`Not enough materials — ${def.name} needs ${costToString(def.cost)}`, 'warn');
          return;
        }
        this.selectedPart = this.selectedPart === id ? null : id;
        this.selectedPlacement = null;
        this.rebuildMarkers();
        if (this.selectedPart && this.markers.length === 0) {
          toast(`No free ${def.attachesTo} socket for the ${def.name}`, 'warn');
        }
        this.renderPanel();
      });
      palette.appendChild(item);
    }
    if (this.selectedPart) {
      if (this.markers.length > 0) {
        palette.appendChild(el('div', 'sub', 'Click a glowing socket on the ship to fit it.'));
      } else {
        const need = PARTS[this.selectedPart].attachesTo;
        palette.appendChild(
          el(
            'div',
            'sub',
            `⚠ Every ${need} socket is occupied. Hull frames add hardpoints — fit one on the free socket at the top of the stack (or remove a fitted part by clicking it).`,
          ),
        );
      }
    }

    // base module
    const baseBox = box('Fabricate — Base');
    if (store.state.refinery.tier === 1) {
      const def = PARTS.refineryMk2;
      const item = el('div', 'part-item');
      if (!store.canAfford(def.cost)) item.classList.add('unaffordable');
      item.appendChild(el('span', undefined, def.name));
      item.appendChild(el('span', 'cost', costToString(def.cost)));
      item.title = def.desc;
      item.addEventListener('click', () => {
        if (!store.spendCost(def.cost)) {
          toast(`Not enough materials (${costToString(def.cost)})`, 'warn');
          return;
        }
        store.state.refinery.tier = 2;
        this.ctx.bus.emit('build:placed', { partId: 'refineryMk2' });
        toast('Refinery expansion online', 'good');
        store.changed();
      });
      baseBox.appendChild(item);
    } else {
      baseBox.appendChild(el('div', 'sub', 'Refinery Mk2 installed — line running at expanded throughput.'));
    }

    this.livePanels.push(renderRefineryPanel(this.ctx));
  }

  update(dt: number): void {
    this.t += dt;
    this.controls.update();
    for (const p of this.livePanels) p.update();

    // stability wobble — off-axis mass makes the whole stack sway
    const over = Math.max(0, this.stats.comOffset - 0.3);
    const amp = Math.min(0.05, over * 0.045);
    this.shipGroup.rotation.z = amp > 0.001 ? Math.sin(this.t * 3.4) * amp : 0;
    this.shipGroup.rotation.x = amp > 0.001 ? Math.cos(this.t * 2.7) * amp * 0.6 : 0;

    // marker pulse
    for (const m of this.markers) {
      const mm = m.material as THREE.MeshStandardMaterial;
      mm.emissiveIntensity = 0.5 + Math.sin(this.t * 5) * 0.3;
    }
  }
}

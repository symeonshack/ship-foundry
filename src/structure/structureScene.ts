import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera } from '../scene/camera';
import { buildCustodian, buildStructureDoor, buildStructureProp, mat } from '../scene/primitives';
import { PlayerController, type Collider } from '../interior/playerController';
import { FLAGS } from '../core/flags';
import { toast } from '../ui/hud';
import { box, button, clearPanel, el } from '../ui/panels';
import {
  CEILING,
  DOORS,
  ITEM_NAMES,
  PROPS,
  SPAWN,
  WALLS,
  type DoorDef,
  type PropDef,
} from './layout';
import { initialCustodian, tickCustodian, type CustodianState } from './custodian';

const CYCLE_SECONDS = 45;
// generous enough to reach props past their own colliders (door band, pedestal base)
const INTERACT_RADIUS = 2.7;

/**
 * The Archive — Phase 4's first-person structure. Found tools, readable logs,
 * one very literal-minded resident. All obstruction, no harm: the custodian's
 * worst is a firm escort to the door.
 */
export class StructureScreen implements GameScreen {
  readonly id = 'structure' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controller: PlayerController;
  private colliders: Collider[] = [];
  private doorColliders = new Map<string, Collider>();
  private doorMeshes = new Map<string, THREE.Group>();
  private propMeshes = new Map<string, THREE.Group>();
  private custodian: CustodianState = initialCustodian();
  private custodianMesh: THREE.Group;
  private alarmLight: THREE.PointLight;
  private mainSealed = false;
  private cycleActive = false;
  private cycleT = 0;
  private shakeT = 0;
  private wasAttendNotified = false;
  private prompt: HTMLElement;
  private near: PropDef | { id: 'door-maintenance'; kind: 'door'; label: string; x: number; z: number } | null = null;
  private t = 0;
  private built = false;
  private keyHandler = (ev: KeyboardEvent): void => {
    if (ev.code === 'KeyE' && this.near) this.interact(this.near);
  };

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x05080a);
    this.camera = makeCamera(72);
    this.controller = new PlayerController(this.camera, canvas, this.colliders, new THREE.Vector3(SPAWN.x, 0, SPAWN.z));
    this.custodianMesh = buildCustodian();
    this.alarmLight = new THREE.PointLight(0xff5c5c, 0, 26);
    this.alarmLight.position.set(-4, 2.6, -12);

    this.prompt = el('div', 'interact-prompt');
    this.prompt.style.display = 'none';
    document.getElementById('hud')!.appendChild(this.prompt);
  }

  // ---- construction ----

  private buildOnce(): void {
    if (this.built) return;
    this.built = true;
    const wallMat = mat(0x232c30, { flat: true, rough: 0.8, metal: 0.3 });
    const floorMat = mat(0x181f24, { rough: 0.9 });
    const seam = mat(0x0e1a1e, { emissive: 0x2a6a5a, emissiveIntensity: 0.55 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(17, 0.2, 23.4), floorMat);
    floor.position.set(0, -0.1, -5);
    this.scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(17, 0.2, 23.4), mat(0x11171b, { rough: 0.9 }));
    ceiling.position.set(0, CEILING + 0.1, -5);
    this.scene.add(ceiling);

    for (const w of WALLS) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, CEILING, w.d), wallMat);
      wall.position.set(w.x, CEILING / 2, w.z);
      this.scene.add(wall);
      this.colliders.push({ minX: w.x - w.w / 2, maxX: w.x + w.w / 2, minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2 });
    }
    // glow seams along the corridors for readability
    for (const z of [-15.8, -8, -2, 5.8]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.08, 0.08), seam);
      strip.position.set(0, 2.9, z + (z < 0 ? 0.35 : -0.35));
      this.scene.add(strip);
    }

    this.scene.add(new THREE.AmbientLight(0x6a7e8c, 1.7));
    const entryLight = new THREE.PointLight(0xcfe0ec, 10, 14);
    entryLight.position.set(0, 2.6, 2);
    this.scene.add(entryLight);
    const junctionLight = new THREE.PointLight(0x9fd6e8, 8, 14);
    junctionLight.position.set(-1, 2.6, -5);
    this.scene.add(junctionLight);
    const archiveLight = new THREE.PointLight(0x7dffa8, 7, 14);
    archiveLight.position.set(-5, 2.6, -12.5);
    this.scene.add(archiveLight);
    const powerLight = new THREE.PointLight(0xffb454, 6, 12);
    powerLight.position.set(5, 2.6, -12.5);
    this.scene.add(powerLight);
    this.scene.add(this.alarmLight);

    for (const door of DOORS) {
      const mesh = buildStructureDoor(door.w, door.startsSealed);
      mesh.position.set(door.x, 0, door.z);
      if (door.id === 'maintenance') mesh.rotation.y = Math.PI / 2;
      this.scene.add(mesh);
      this.doorMeshes.set(door.id, mesh);
    }

    for (const prop of PROPS) {
      if (prop.kind === 'exit') continue;
      const mesh = buildStructureProp(prop.kind, prop.meta);
      mesh.position.set(prop.x, 0, prop.z);
      mesh.rotation.y = prop.facing;
      this.scene.add(mesh);
      this.propMeshes.set(prop.id, mesh);
    }

    this.scene.add(this.custodianMesh);
    this.scene.fog = new THREE.Fog(0x05080a, 14, 34);
  }

  private setDoorCollider(id: string, def: DoorDef, closed: boolean): void {
    const existing = this.doorColliders.get(id);
    if (closed && !existing) {
      const c: Collider = { minX: def.x - def.w / 2, maxX: def.x + def.w / 2, minZ: def.z - def.d / 2, maxZ: def.z + def.d / 2 };
      this.doorColliders.set(id, c);
      this.colliders.push(c);
    } else if (!closed && existing) {
      const i = this.colliders.indexOf(existing);
      if (i >= 0) this.colliders.splice(i, 1);
      this.doorColliders.delete(id);
    }
    const mesh = this.doorMeshes.get(id);
    if (mesh) {
      const panel = mesh.getObjectByName('door-panel')!;
      panel.visible = closed;
      const lamp = mesh.getObjectByName('door-lamp') as THREE.Mesh;
      const m = lamp.material as THREE.MeshStandardMaterial;
      m.color.setHex(closed ? 0xff5c5c : 0x7dffa8);
      m.emissive.setHex(closed ? 0xff5c5c : 0x7dffa8);
    }
  }

  private sealMain(sealed: boolean): void {
    if (this.mainSealed === sealed) return;
    this.mainSealed = sealed;
    this.setDoorCollider('main', DOORS.find((d) => d.id === 'main')!, sealed);
    if (sealed) toast('The archive door seals', 'warn');
  }

  private setAlarm(on: boolean): void {
    this.alarmLight.intensity = on ? 14 : 0;
    const strip = this.custodianMesh.getObjectByName('strip') as THREE.Mesh;
    (strip.material as THREE.MeshStandardMaterial).emissive.setHex(on ? 0xff5c5c : 0xffb454);
    const eye = this.custodianMesh.getObjectByName('eye') as THREE.Mesh;
    (eye.material as THREE.MeshStandardMaterial).emissive.setHex(on ? 0xff5c5c : 0xffb454);
  }

  // ---- lifecycle ----

  enter(): void {
    this.buildOnce();
    const st = this.ctx.store.state.structure;

    // reflect persistent state
    const maintDef = DOORS.find((d) => d.id === 'maintenance')!;
    this.setDoorCollider('maintenance', maintDef, !st.maintOpen);
    this.sealMain(false);
    this.setAlarm(false);
    const frame = this.propMeshes.get('frame-1');
    if (frame) frame.visible = !this.ctx.store.state.items.includes('cutterFrame') && !this.ctx.store.state.items.includes('plasmaCutter');
    const pedestal = this.propMeshes.get('pedestal-1');
    const fragment = pedestal?.getObjectByName('fragment');
    if (fragment) fragment.visible = !st.fragmentTaken;

    this.custodian = initialCustodian();
    if (st.fragmentTaken) {
      this.custodian.mode = 'dormant';
      this.custodian.x = -5;
      this.custodian.z = -12;
    }
    this.cycleActive = false;
    this.wasAttendNotified = false;
    this.controller.position.set(SPAWN.x, 0, SPAWN.z);
    this.controller.yaw = 0;
    this.controller.groundHeight = null;
    this.controller.attach();
    window.addEventListener('keydown', this.keyHandler);

    if (!this.ctx.store.hasFlag(FLAGS.ARCHIVE_ENTERED)) {
      this.ctx.store.setFlag(FLAGS.ARCHIVE_ENTERED);
      this.ctx.gerty.notify('structure-enter');
    }
    this.renderPanel();
  }

  exit(): void {
    this.controller.detach();
    window.removeEventListener('keydown', this.keyHandler);
    this.prompt.style.display = 'none';
    this.near = null;
    clearPanel();
  }

  // ---- interaction ----

  private interact(prop: { id: string; kind: string; meta?: string }): void {
    const store = this.ctx.store;
    const st = store.state.structure;
    switch (prop.kind) {
      case 'exit':
        this.ctx.nav('surface');
        return;
      case 'panel':
        if (!st.panelOpened) {
          st.panelOpened = true;
          store.state.items.push('powerCell');
          toast('Behind the panel: a power cell, still warm', 'good');
          store.changed();
        }
        break;
      case 'item':
        if (prop.meta === 'cutterFrame' && !store.state.items.includes('cutterFrame')) {
          store.state.items.push('cutterFrame');
          const mesh = this.propMeshes.get(prop.id);
          if (mesh) mesh.visible = false;
          toast('Cutter frame taken — it wants a power source', 'good');
          store.changed();
        }
        break;
      case 'log': {
        const key = prop.meta!;
        this.ctx.log.insert(key);
        if (!st.logsRead.includes(key)) st.logsRead.push(key);
        store.changed();
        break;
      }
      case 'bench': {
        const items = store.state.items;
        if (items.includes('powerCell') && items.includes('cutterFrame')) {
          store.state.items = items.filter((i) => i !== 'powerCell' && i !== 'cutterFrame');
          store.state.items.push('plasmaCutter');
          toast('Assembled: plasma cutter', 'good');
          store.changed();
        } else if (items.includes('plasmaCutter')) {
          toast('The cutter is already assembled', 'info');
        } else {
          toast('The bench wants a cutter frame and a power cell', 'warn');
        }
        break;
      }
      case 'console':
        if (!this.cycleActive) {
          this.cycleActive = true;
          this.cycleT = CYCLE_SECONDS;
          toast('Preservation cycle started — something is compelled to attend it', 'good');
        }
        break;
      case 'door':
        if (!st.maintOpen) {
          if (store.state.items.includes('plasmaCutter')) {
            st.maintOpen = true;
            this.setDoorCollider('maintenance', DOORS.find((d) => d.id === 'maintenance')!, false);
            toast('The cutter parts the seam. The maintenance way is open.', 'good');
            store.changed();
          } else {
            toast('Sealed. The seam wants a cutting tool.', 'warn');
          }
        }
        break;
      case 'pedestal':
        if (!st.fragmentTaken) {
          st.fragmentTaken = true;
          const pedestal = this.propMeshes.get('pedestal-1');
          const fragment = pedestal?.getObjectByName('fragment');
          if (fragment) fragment.visible = false;
          store.addStock('condensate', 4);
          store.setFlag(FLAGS.ARCHIVE_TAKEN);
          this.ctx.log.insert('archive-fragment');
          this.ctx.gerty.notify('archive-taken');
          toast('The archive fragment is yours. The room goes very quiet.', 'good');
          store.changed();
        }
        break;
    }
    this.renderPanel();
  }

  // ---- frame ----

  update(dt: number): void {
    this.t += dt;
    this.controller.update(dt);

    // camera shake after a shove
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.camera.position.x += (Math.random() - 0.5) * 0.18;
      this.camera.position.y += (Math.random() - 0.5) * 0.12;
    }

    // preservation cycle timer
    if (this.cycleActive) {
      this.cycleT -= dt;
      if (this.cycleT <= 0) this.cycleActive = false;
    }

    // custodian brain + body
    const st = this.ctx.store.state.structure;
    const p = this.controller.position;
    const before = { x: this.custodian.x, z: this.custodian.z, mode: this.custodian.mode };
    const actions = tickCustodian(this.custodian, {
      player: { x: p.x, z: p.z },
      cycleActive: this.cycleActive,
      fragmentTaken: st.fragmentTaken,
      dt,
    });
    for (const action of actions) {
      if (action.type === 'seal-main') this.sealMain(true);
      else if (action.type === 'unseal-main') this.sealMain(false);
      else if (action.type === 'alarm') this.setAlarm(action.on);
      else if (action.type === 'shove') {
        this.controller.position.set(action.to.x, 0, action.to.z);
        this.controller.yaw = Math.PI; // deposited facing the way out, pointedly
        this.controller.pitch = 0;
        this.shakeT = 0.7;
        this.ctx.gerty.notify('custodian-shoved');
        toast('It walks you out. Firmly. Nothing is damaged — including, notably, you.', 'warn');
      }
    }
    if (before.mode === 'patrol' && this.custodian.mode === 'alert') this.ctx.gerty.notify('custodian-seen');
    if (this.custodian.mode === 'attend' && !this.wasAttendNotified) {
      this.wasAttendNotified = true;
      this.ctx.gerty.notify('custodian-attend');
    }
    if (this.custodian.mode !== 'attend') this.wasAttendNotified = this.custodian.mode === 'dormant' ? this.wasAttendNotified : false;

    this.custodianMesh.position.set(this.custodian.x, Math.sin(this.t * 1.2) * 0.04, this.custodian.z);
    const moved = Math.hypot(this.custodian.x - before.x, this.custodian.z - before.z);
    if (moved > 0.001) {
      this.custodianMesh.rotation.y = Math.atan2(this.custodian.x - before.x, this.custodian.z - before.z);
    }
    const eye = this.custodianMesh.getObjectByName('eye') as THREE.Mesh;
    (eye.material as THREE.MeshStandardMaterial).emissiveIntensity =
      this.custodian.mode === 'dormant' ? 0.15 : this.custodian.mode === 'alert' ? 1.6 + Math.sin(this.t * 9) * 0.5 : 1.0 + Math.sin(this.t * 2) * 0.2;
    if (this.custodian.mode === 'alert') this.alarmLight.intensity = 11 + Math.sin(this.t * 8) * 5;

    // pedestal fragment idle spin
    const fragment = this.propMeshes.get('pedestal-1')?.getObjectByName('fragment');
    if (fragment?.visible) fragment.rotation.y += dt * 0.8;

    // nearest interactable → prompt
    this.updatePrompt(p.x, p.z);
  }

  private updatePrompt(px: number, pz: number): void {
    const store = this.ctx.store;
    const st = store.state.structure;
    let best: typeof this.near = null;
    let bestD = INTERACT_RADIUS;
    for (const prop of PROPS) {
      if (prop.kind === 'panel' && st.panelOpened) continue;
      if (prop.kind === 'item' && !this.propMeshes.get(prop.id)?.visible) continue;
      if (prop.kind === 'pedestal' && st.fragmentTaken) continue;
      if (prop.kind === 'console' && this.cycleActive) continue;
      const d = Math.hypot(prop.x - px, prop.z - pz);
      if (d < bestD) {
        best = prop;
        bestD = d;
      }
    }
    if (!st.maintOpen) {
      const maint = DOORS.find((d) => d.id === 'maintenance')!;
      const d = Math.hypot(maint.x - px, maint.z - pz);
      if (d < bestD) {
        best = { id: 'door-maintenance', kind: 'door', label: 'Cut the sealed maintenance door', x: maint.x, z: maint.z };
        bestD = d;
      }
    }
    this.near = best;
    if (best) {
      this.prompt.innerHTML = `<span class="key">E</span> ${best.label}`;
      this.prompt.style.display = 'block';
    } else {
      this.prompt.style.display = 'none';
    }
  }

  // ---- panel ----

  private renderPanel(): void {
    clearPanel();
    const b = box('Site Null — the Archive');
    const st = this.ctx.store.state.structure;
    b.appendChild(
      el(
        'p',
        'sub',
        st.fragmentTaken
          ? 'The custodian stands where the fragment was. Its directive is complete. Nothing here will ever move again unless you move it.'
          : 'Something in here still keeps the lights on. Read the plates. Watch what it protects. Its rules are older than you — and exactly as written.',
      ),
    );
    const items = this.ctx.store.state.items;
    if (items.length > 0) {
      b.appendChild(el('div', 'sub', `Carrying: ${items.map((i) => ITEM_NAMES[i] ?? i).join(', ')}`));
    }
    b.appendChild(button('Leave the structure', () => this.ctx.nav('surface')));
  }
}

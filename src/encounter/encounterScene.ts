import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera, makeOrbit } from '../scene/camera';
import {
  addBasicLights,
  addStars,
  buildEncounterModule,
  buildSocketMarker,
  buildStructureCore,
  buildTerminal,
  buildTerrain,
  mat,
} from '../scene/primitives';
import { poiDef } from '../exploration/starSystem';
import { Collaborator } from './collaborator';
import {
  COLLAB_TERMINAL,
  PLAYER_TERMINAL,
  SOCKETS,
  collaboratorTurn,
  connectedConduits,
  isSolved,
} from './sharedBuild';
import type { EncounterModuleType } from '../core/state';
import { FLAGS } from '../core/flags';
import { box, button, clearPanel, el } from '../ui/panels';
import { toast } from '../ui/hud';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SCALE = 1.7;
const PLAT_Y = 0.62;

type Tool = EncounterModuleType | 'remove' | null;

export class EncounterScreen implements GameScreen {
  readonly id = 'encounter' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();

  private structure = new THREE.Group();
  private markers: THREE.Mesh[] = [];
  private moduleMeshes = new Map<number, THREE.Group>();
  private collaborator: Collaborator;
  private core: THREE.Group;
  private beam: THREE.Mesh;
  private tool: Tool = null;
  private playerTurn = true;
  private collabDelay = 0;
  private t = 0;
  private statusLabel: HTMLElement | null = null;
  private built = false;

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x06090c);
    this.camera = makeCamera(48);
    this.camera.position.set(12, 13, 16);
    this.controls = makeOrbit(this.camera, canvas, {
      target: [0, 1, 0],
      minDistance: 7,
      maxDistance: 45,
      maxPolar: Math.PI * 0.46,
    });
    addBasicLights(this.scene, 0xcfe0ff, 0x1a2430);
    addStars(this.scene);

    this.core = buildStructureCore();
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 60, 12, 1, true),
      mat(0x7dffa8, { emissive: 0x7dffa8, emissiveIntensity: 1, transparent: true, opacity: 0 }),
    );
    this.beam.position.y = 30;
    this.collaborator = new Collaborator(new THREE.Vector3(0, PLAT_Y, COLLAB_TERMINAL.z * SCALE - 3.4));
  }

  private socketWorld(i: number): THREE.Vector3 {
    return new THREE.Vector3(SOCKETS[i]!.x * SCALE, PLAT_Y, SOCKETS[i]!.z * SCALE);
  }

  private buildScene(): void {
    if (this.built) return;
    this.built = true;
    const def = poiDef('signal');

    const terrain = buildTerrain(def.terrainSeed, def.terrainColor, 90);
    terrain.mesh.position.y = -2.2;
    this.scene.add(terrain.mesh);

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 1.2, 30), mat(0x232c33, { rough: 0.7, metal: 0.5 }));
    platform.position.y = 0;
    this.scene.add(platform);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(12.6, 0.08, 8, 60), mat(0x7dffa8, { emissive: 0x7dffa8, emissiveIntensity: 0.35 }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = PLAT_Y;
    this.scene.add(trim);

    this.core.position.set(0, PLAT_Y, 0);
    this.scene.add(this.core);
    this.beam.position.set(0, 30, 0);
    this.scene.add(this.beam);

    const pt = buildTerminal('player');
    pt.position.set(PLAYER_TERMINAL.x * SCALE, PLAT_Y, PLAYER_TERMINAL.z * SCALE);
    this.scene.add(pt);
    const ct = buildTerminal('collaborator');
    ct.position.set(COLLAB_TERMINAL.x * SCALE, PLAT_Y, COLLAB_TERMINAL.z * SCALE);
    this.scene.add(ct);

    for (let i = 0; i < SOCKETS.length; i++) {
      const marker = buildSocketMarker(0x59d6ff);
      marker.position.copy(this.socketWorld(i)).setY(PLAT_Y + 0.04);
      marker.userData.socket = i;
      (marker.material as THREE.MeshStandardMaterial).opacity = 0.35;
      this.scene.add(marker);
      this.markers.push(marker);
    }

    this.scene.add(this.structure);
    this.scene.add(this.collaborator.group);
  }

  enter(): void {
    this.buildScene();
    const enc = this.ctx.store.state.encounter;
    if (!enc.started) {
      enc.started = true;
      this.ctx.store.setFlag(FLAGS.ENCOUNTER_STARTED);
    }
    this.playerTurn = true;
    this.syncModules();
    if (enc.solved) this.applySolvedVisuals();
    this.renderPanel();
  }

  exit(): void {
    this.tool = null;
    clearPanel();
  }

  // ---- module sync ----

  private syncModules(): void {
    const modules = this.ctx.store.state.encounter.modules;
    for (const [socket, mesh] of [...this.moduleMeshes]) {
      if (!modules.some((m) => m.socket === socket)) {
        mesh.removeFromParent();
        this.moduleMeshes.delete(socket);
      }
    }
    for (const m of modules) {
      const existing = this.moduleMeshes.get(m.socket);
      if (existing && existing.userData.type === m.type) continue;
      if (existing) existing.removeFromParent();
      const mesh = buildEncounterModule(m.type);
      mesh.position.copy(this.socketWorld(m.socket));
      mesh.userData.type = m.type;
      this.structure.add(mesh);
      this.moduleMeshes.set(m.socket, mesh);
    }
  }

  // ---- turns ----

  onClick(ndc: THREE.Vector2): void {
    const enc = this.ctx.store.state.encounter;
    if (enc.solved || !this.playerTurn || !this.tool) return;
    this.raycaster.setFromCamera(ndc, this.camera);
    // markers are thin — also allow clicking a placed module to target its socket
    const targets: THREE.Object3D[] = [...this.markers, ...this.moduleMeshes.values()];
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    if (!hit) return;
    let node: THREE.Object3D | null = hit.object;
    while (node && node.userData.socket === undefined && !this.moduleMeshes.has(this.socketOf(node))) node = node.parent;
    let socket: number | undefined = node?.userData.socket as number | undefined;
    if (socket === undefined && node) socket = this.socketOf(node);
    if (socket === undefined || socket < 0) return;

    const existing = enc.modules.find((m) => m.socket === socket);
    if (this.tool === 'remove') {
      if (!existing) return;
      enc.modules.splice(enc.modules.indexOf(existing), 1);
    } else {
      if (existing) {
        toast('That socket is occupied — remove first', 'warn');
        return;
      }
      enc.modules.push({ socket, type: this.tool, placedBy: 'player' });
    }
    this.syncModules();
    this.ctx.bus.emit('encounter:turn', { actor: 'player' });
    this.playerTurn = false;
    this.collabDelay = 1.3;
    this.ctx.store.changed();
    this.renderPanel();
  }

  private socketOf(obj: THREE.Object3D): number {
    for (const [socket, mesh] of this.moduleMeshes) {
      if (mesh === obj) return socket;
    }
    return -1;
  }

  private collaboratorAct(): void {
    const enc = this.ctx.store.state.encounter;
    const action = collaboratorTurn(enc.modules);
    switch (action.kind) {
      case 'remove': {
        const target = enc.modules.find((m) => m.socket === action.socket);
        if (target) enc.modules.splice(enc.modules.indexOf(target), 1);
        this.collaborator.playGesture('agitate', this.socketWorld(action.socket));
        this.flashSocket(action.socket, 0xff5c5c);
        break;
      }
      case 'place':
        enc.modules.push({ socket: action.socket, type: action.type, placedBy: 'collaborator' });
        this.collaborator.playGesture('observe', this.socketWorld(action.socket));
        break;
      case 'demonstrate': {
        const target = action.target === 'core' ? new THREE.Vector3(0, PLAT_Y + 1, 0) : this.socketWorld(action.target);
        this.collaborator.playGesture('demonstrate', target);
        if (action.target !== 'core') this.flashSocket(action.target, 0xffd06a);
        else this.flashCore();
        break;
      }
      case 'idle':
        this.collaborator.playGesture(action.gesture);
        break;
    }
    enc.turnCount += 1;
    this.syncModules();
    this.ctx.bus.emit('encounter:gesture', { gesture: action.gesture });
    this.ctx.bus.emit('encounter:turn', { actor: 'collaborator' });
    this.playerTurn = true;
    this.ctx.store.changed();

    if (!enc.solved && isSolved(enc.modules)) this.solve();
    this.renderPanel();
  }

  private flashSocket(socket: number, color: number): void {
    const marker = this.markers[socket];
    if (!marker) return;
    const m = marker.material as THREE.MeshStandardMaterial;
    m.emissive.setHex(color);
    m.opacity = 1;
    setTimeout(() => {
      m.emissive.setHex(0x59d6ff);
      m.opacity = 0.35;
    }, 1500);
  }

  private flashCore(): void {
    const heart = this.core.getObjectByName('heart') as THREE.Mesh;
    (heart.material as THREE.MeshStandardMaterial).emissive.setHex(0xffd06a);
    setTimeout(() => (heart.material as THREE.MeshStandardMaterial).emissive.setHex(0x223038), 1500);
  }

  private solve(): void {
    const store = this.ctx.store;
    store.state.encounter.solved = true;
    store.setFlag(FLAGS.ENCOUNTER_SOLVED);
    store.addStock('condensate', 6);
    store.bus.emit('encounter:solved', {});
    this.applySolvedVisuals();
    this.collaborator.playGesture('approve');
    toast('The structure hums. A cache of stabilized condensate transfers to your stock.', 'good');
  }

  private applySolvedVisuals(): void {
    const heart = this.core.getObjectByName('heart') as THREE.Mesh;
    const hm = heart.material as THREE.MeshStandardMaterial;
    hm.emissive.setHex(0x7dffa8);
    hm.emissiveIntensity = 2.2;
    (this.beam.material as THREE.MeshStandardMaterial).opacity = 0.22;
  }

  // ---- panel ----

  private renderPanel(): void {
    clearPanel();
    const enc = this.ctx.store.state.encounter;

    const b = box('Shared Structure');
    if (enc.solved) {
      b.appendChild(el('p', 'sub', 'It works — for both of you. The worker has already gone back to its own tasks, unhurried, as if this was always going to happen.'));
      b.appendChild(button('Return to orbit', () => this.ctx.nav('starmap')));
      return;
    }
    b.appendChild(el('p', 'sub', 'Your goal: a powered conduit line from your terminal (blue) to the core, with an emitter beside the core. What the other builder needs, it will show you — by editing.'));
    this.statusLabel = el('div', 'sub', 'Your move.');
    this.statusLabel.style.color = 'var(--accent)';
    b.appendChild(this.statusLabel);

    const tools: [Tool, string][] = [
      ['strut', 'Strut'],
      ['conduit', 'Conduit'],
      ['emitter', 'Emitter'],
      ['damper', 'Damper'],
      ['remove', 'Remove'],
    ];
    for (const [tool, label] of tools) {
      const btn = button(label, () => {
        this.tool = this.tool === tool ? null : tool;
        this.renderPanel();
      });
      btn.style.margin = '2px';
      if (this.tool === tool) btn.classList.add('active');
      b.appendChild(btn);
    }
    if (this.tool && this.tool !== 'remove') b.appendChild(el('div', 'sub', 'Click an open socket ring to place.'));
    if (this.tool === 'remove') b.appendChild(el('div', 'sub', 'Click a placed module to take it out.'));

    const nav = box('Ship');
    nav.appendChild(button('Return to orbit', () => this.ctx.nav('starmap')));
  }

  update(dt: number): void {
    this.t += dt;
    this.controls.update();
    this.collaborator.update(dt);

    if (!this.playerTurn && this.collabDelay > 0) {
      this.collabDelay -= dt;
      if (this.statusLabel) this.statusLabel.textContent = 'It is considering the structure…';
      if (this.collabDelay <= 0) {
        this.collaboratorAct();
        if (this.statusLabel) this.statusLabel.textContent = 'Your move.';
      }
    }

    // power flow visualization
    const modules = this.ctx.store.state.encounter.modules;
    const playerNet = connectedConduits(modules, 'player');
    const collabNet = connectedConduits(modules, 'collaborator');
    for (const [socket, mesh] of this.moduleMeshes) {
      const power = mesh.getObjectByName('power') as THREE.Mesh | undefined;
      if (!power) continue;
      const powered = playerNet.has(socket) || collabNet.has(socket);
      const m = power.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = powered ? 1.3 + Math.sin(this.t * 4) * 0.3 : 0.2;
    }

    const ring = this.core.getObjectByName('ring');
    if (ring) ring.rotation.z += dt * (this.ctx.store.state.encounter.solved ? 2.4 : 0.3);
    if (this.ctx.store.state.encounter.solved) {
      const heart = this.core.getObjectByName('heart') as THREE.Mesh;
      (heart.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(this.t * 3) * 0.5;
    }

    for (const marker of this.markers) {
      const m = marker.material as THREE.MeshStandardMaterial;
      if (this.tool && this.tool !== 'remove') {
        m.emissiveIntensity = 0.6 + Math.sin(this.t * 5) * 0.3;
      } else {
        m.emissiveIntensity = 0.4;
      }
    }
  }
}

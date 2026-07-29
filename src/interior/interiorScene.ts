import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera } from '../scene/camera';
import { buildGertyBot, buildShipInterior, type InteriorHotspot } from '../scene/primitives';
import { poiDef } from '../exploration/starSystem';
import { EYE_HEIGHT, PlayerController, moveWithCollision, type Collider } from './playerController';
import { box, button, clearPanel, el } from '../ui/panels';
import type { SpokenLine } from '../companion/gerty';

const INTERACT_RADIUS = 2.2;
/** GERTY halts its wander and turns to the player once they're this close */
const NOTICE_RADIUS = 2.7;

/** step an angle toward a target (radians) by at most maxStep, taking the short way around */
function turnToward(current: number, target: number, maxStep: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + THREE.MathUtils.clamp(diff, -maxStep, maxStep);
}

/**
 * The walkable ship interior — Phase 1 hub. One fixed core room regardless of
 * exterior build. The star map and GERTY live here as physical consoles.
 */
export class InteriorScreen implements GameScreen {
  readonly id = 'interior' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controller: PlayerController;
  private hotspots: InteriorHotspot[];
  private near: InteriorHotspot | null = null;
  private prompt: HTMLElement;
  private bubble: HTMLElement;
  private bubbleUntil = 0;
  // GERTY the mobile robot
  private gerty: THREE.Group;
  private gertyScreen: THREE.Mesh;
  private gertyEye: THREE.Mesh;
  private gertyHover: THREE.Mesh;
  private gertyHotspot: InteriorHotspot;
  private colliders: Collider[];
  private gertyYaw = 0;
  private wanderTarget: { x: number; z: number } | null = null;
  private pauseTimer = 0;
  private holo: THREE.Object3D;
  private speakGlow = 0;
  private panelOpen = false;
  private t = 0;
  private keyHandler: (ev: KeyboardEvent) => void;
  private unsub: (() => void)[] = [];

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x05080b);
    this.camera = makeCamera(72);

    const interior = buildShipInterior();
    this.scene.add(interior.group);
    this.hotspots = interior.hotspots;
    this.colliders = interior.colliders;
    this.gertyHotspot = this.hotspots.find((h) => h.id === 'gerty')!;
    this.holo = interior.group.getObjectByName('holo')!;

    // GERTY is now a real robot roaming the deck, not a wall console
    this.gerty = buildGertyBot();
    this.gerty.position.set(2.4, 0.03, -2.4);
    this.scene.add(this.gerty);
    this.gertyScreen = this.gerty.getObjectByName('gerty-screen') as THREE.Mesh;
    this.gertyEye = this.gerty.getObjectByName('gerty-eye') as THREE.Mesh;
    this.gertyHover = this.gerty.getObjectByName('gerty-hover') as THREE.Mesh;

    // interior lighting: soft ambient + warm key over the table + cool fill
    this.scene.add(new THREE.AmbientLight(0x8fa5b5, 1.6));
    const key = new THREE.PointLight(0xfff0dc, 22, 18);
    key.position.set(0, 2.6, -2.2);
    this.scene.add(key);
    const fill = new THREE.PointLight(0x9fd6e8, 14, 16);
    fill.position.set(2.5, 2.5, 3);
    this.scene.add(fill);

    this.controller = new PlayerController(
      this.camera,
      canvas,
      interior.colliders,
      new THREE.Vector3(0, EYE_HEIGHT, 2.2),
      0,
    );

    const hud = document.getElementById('hud')!;
    this.prompt = el('div', 'interact-prompt');
    this.prompt.style.display = 'none';
    hud.appendChild(this.prompt);
    this.bubble = el('div');
    this.bubble.id = 'gerty-bubble';
    this.bubble.style.display = 'none';
    hud.appendChild(this.bubble);

    this.keyHandler = (ev) => {
      if (ev.code === 'KeyE' && this.near) this.interact(this.near);
    };
  }

  enter(): void {
    this.controller.attach();
    window.addEventListener('keydown', this.keyHandler);
    this.unsub.push(this.ctx.bus.on('gerty:line', ({ line }) => this.showBubble(line)));
    this.panelOpen = false;
    clearPanel();
  }

  exit(): void {
    this.controller.detach();
    window.removeEventListener('keydown', this.keyHandler);
    for (const u of this.unsub) u();
    this.unsub = [];
    this.prompt.style.display = 'none';
    this.bubble.style.display = 'none';
    clearPanel();
  }

  // ---- interaction ----

  private interact(h: InteriorHotspot): void {
    if (h.id === 'starmap') {
      this.ctx.nav('starmap');
    } else if (h.id === 'exit') {
      // the ship is in orbit — the hatch takes the lander down to the site
      const def = poiDef(this.ctx.store.state.currentPoi);
      this.ctx.nav(def.special === 'signal' ? 'encounter' : 'surface');
    } else {
      this.openGertyPanel();
    }
  }

  private openGertyPanel(): void {
    this.controller.releasePointer();
    this.panelOpen = true;
    clearPanel();
    const b = box('GERTY — Shipboard Console');
    const history = this.ctx.gerty.transcript();
    if (history.length === 0) {
      b.appendChild(el('p', 'sub', 'Console log empty. GERTY is, uncharacteristically, saying nothing.'));
    } else {
      for (const line of history.slice(-6)) {
        const row = el('p', 'sub', `${line.mood === 'decline' ? '⛔ ' : ''}${line.text}`);
        row.style.borderLeft = line.mood === 'decline' ? '2px solid var(--amber)' : '2px solid var(--border)';
        row.style.paddingLeft = '8px';
        b.appendChild(row);
      }
    }
    const topics = box('Ask GERTY');
    for (const topic of this.ctx.gerty.topicList()) {
      const btn = button(topic.label, () => {
        this.ctx.gerty.ask(topic.id);
        // refresh shortly after so the reply lands in the transcript
        window.setTimeout(() => {
          if (this.panelOpen) this.openGertyPanel();
        }, 600);
      });
      btn.style.margin = '2px';
      topics.appendChild(btn);
    }
    const closeBox = box('');
    closeBox.appendChild(
      button('Close console', () => {
        this.panelOpen = false;
        clearPanel();
      }),
    );
  }

  // ---- GERTY presence ----

  private showBubble(line: SpokenLine): void {
    this.bubble.textContent = line.text;
    this.bubble.classList.toggle('decline', line.mood === 'decline');
    this.bubble.style.display = 'block';
    this.bubbleUntil = this.t + line.duration;
    this.speakGlow = 1.5;
  }

  update(dt: number): void {
    this.t += dt;
    this.controller.update(dt);
    const p = this.controller.position;

    // GERTY: wander the deck when left alone; stop and face you when near/talking
    this.updateGerty(dt, p);

    // hotspot proximity → prompt (the gerty hotspot rides the robot, set above)
    let nearest: InteriorHotspot | null = null;
    let best = INTERACT_RADIUS;
    for (const h of this.hotspots) {
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < best) {
        best = d;
        nearest = h;
      }
    }
    this.near = nearest;
    if (nearest) {
      const label =
        nearest.id === 'exit'
          ? `Take the lander down — ${poiDef(this.ctx.store.state.currentPoi).name}`
          : nearest.id === 'gerty'
            ? 'Talk to GERTY'
            : nearest.label;
      this.prompt.innerHTML = `<span class="key">E</span> ${label}`;
      this.prompt.style.display = 'block';
    } else {
      this.prompt.style.display = 'none';
      if (this.panelOpen) {
        // walked away from GERTY — close the console
        this.panelOpen = false;
        clearPanel();
      }
    }

    // GERTY life: idle breathing on the screen/eye, bright while speaking
    this.speakGlow = Math.max(0, this.speakGlow - dt * 0.5);
    const screenMat = this.gertyScreen.material as THREE.MeshStandardMaterial;
    screenMat.emissiveIntensity = 0.5 + Math.sin(this.t * 1.8) * 0.15 + this.speakGlow;
    const eyeMat = this.gertyEye.material as THREE.MeshStandardMaterial;
    eyeMat.emissiveIntensity = 1.0 + Math.sin(this.t * 2.4) * 0.25 + this.speakGlow * 0.8;
    const hoverMat = this.gertyHover.material as THREE.MeshStandardMaterial;
    hoverMat.emissiveIntensity = 0.7 + Math.sin(this.t * 4) * 0.2;

    // speech bubble anchored above GERTY's head, wherever it is
    if (this.bubble.style.display === 'block') {
      if (this.t > this.bubbleUntil) {
        this.bubble.style.display = 'none';
      } else {
        const v = new THREE.Vector3(this.gerty.position.x, this.gerty.position.y + 1.9, this.gerty.position.z).project(this.camera);
        if (v.z > 1 || v.x < -1 || v.x > 1) {
          this.bubble.style.opacity = '0';
        } else {
          this.bubble.style.opacity = '1';
          this.bubble.style.left = `${((v.x + 1) / 2) * window.innerWidth}px`;
          this.bubble.style.top = `${((-v.y + 1) / 2) * window.innerHeight}px`;
        }
      }
    }

    // the holo table slowly rotates its miniature system
    this.holo.rotation.y += dt * 0.15;
  }

  /** GERTY's simple brain: attend the player (stop + track) when talking or
   * close by, otherwise amble to random reachable points around the deck. */
  private updateGerty(dt: number, p: { x: number; z: number }): void {
    const gx = this.gerty.position.x;
    const gz = this.gerty.position.z;
    const dist = Math.hypot(p.x - gx, p.z - gz);
    const speaking = this.bubble.style.display === 'block' && this.t <= this.bubbleUntil;
    const attend = speaking || this.panelOpen || dist < NOTICE_RADIUS;

    // gentle hover bob
    this.gerty.position.y = 0.03 + Math.sin(this.t * 2.2) * 0.04;

    if (attend) {
      // stop and turn to face the player, tracking them as they move
      this.wanderTarget = null;
      this.pauseTimer = 0.8; // settle a moment before resuming the wander
      this.gertyYaw = turnToward(this.gertyYaw, Math.atan2(p.x - gx, p.z - gz), dt * 4);
    } else if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
    } else {
      if (!this.wanderTarget) this.wanderTarget = this.pickWanderTarget();
      const t = this.wanderTarget;
      const dx = t.x - gx;
      const dz = t.z - gz;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) {
        this.wanderTarget = null;
        this.pauseTimer = 1.5 + Math.random() * 2.5; // linger before moving on
      } else {
        const step = Math.min(d, 0.9 * dt);
        const next = moveWithCollision({ x: gx, z: gz }, (dx / d) * step, (dz / d) * step, this.colliders, 0.45);
        const moved = Math.hypot(next.x - gx, next.z - gz);
        this.gerty.position.x = next.x;
        this.gerty.position.z = next.z;
        if (moved < step * 0.3) {
          this.wanderTarget = null; // wedged against something — pick a new spot
          this.pauseTimer = 0.6;
        }
        this.gertyYaw = turnToward(this.gertyYaw, Math.atan2(dx, dz), dt * 4);
      }
    }
    this.gerty.rotation.y = this.gertyYaw;
    // keep the interaction hotspot glued to GERTY so the prompt tracks it
    this.gertyHotspot.x = this.gerty.position.x;
    this.gertyHotspot.z = this.gerty.position.z;
  }

  private pickWanderTarget(): { x: number; z: number } {
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() * 2 - 1) * 3;
      const z = (Math.random() * 2 - 1) * 4;
      if (!this.blocked(x, z)) return { x, z };
    }
    return { x: this.gerty.position.x, z: this.gerty.position.z };
  }

  private blocked(x: number, z: number): boolean {
    const r = 0.5;
    return this.colliders.some((c) => x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ);
  }
}

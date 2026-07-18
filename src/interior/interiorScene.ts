import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera } from '../scene/camera';
import { buildShipInterior, type InteriorHotspot } from '../scene/primitives';
import { poiDef } from '../exploration/starSystem';
import { EYE_HEIGHT, PlayerController } from './playerController';
import { box, button, clearPanel, el } from '../ui/panels';
import type { SpokenLine } from '../companion/gerty';

const INTERACT_RADIUS = 2.2;

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
  private gertyScreen: THREE.Mesh;
  private gertyEye: THREE.Mesh;
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
    this.gertyScreen = interior.group.getObjectByName('gerty-screen') as THREE.Mesh;
    this.gertyEye = interior.group.getObjectByName('gerty-eye') as THREE.Mesh;
    this.holo = interior.group.getObjectByName('holo')!;

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
    this.prompt = el('div');
    this.prompt.id = 'interact-prompt';
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
      const def = poiDef(this.ctx.store.state.currentPoi);
      this.ctx.nav(def.special === 'home' ? 'shipyard' : def.special === 'signal' ? 'encounter' : 'surface');
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

    // hotspot proximity → prompt
    const p = this.controller.position;
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
          ? `Exit hatch — ${poiDef(this.ctx.store.state.currentPoi).special === 'home' ? 'Foundry pad' : poiDef(this.ctx.store.state.currentPoi).name}`
          : nearest.label;
      this.prompt.innerHTML = `<span class="key">E</span> ${label}`;
      this.prompt.style.display = 'block';
    } else {
      this.prompt.style.display = 'none';
      if (this.panelOpen) {
        // walked away from the console — close it
        this.panelOpen = false;
        clearPanel();
      }
    }

    // GERTY console life: idle breathing, bright while speaking
    this.speakGlow = Math.max(0, this.speakGlow - dt * 0.5);
    const screenMat = this.gertyScreen.material as THREE.MeshStandardMaterial;
    screenMat.emissiveIntensity = 0.5 + Math.sin(this.t * 1.8) * 0.15 + this.speakGlow;
    const eyeMat = this.gertyEye.material as THREE.MeshStandardMaterial;
    eyeMat.emissiveIntensity = 1.0 + Math.sin(this.t * 2.4) * 0.25 + this.speakGlow * 0.8;

    // speech bubble anchored above the console
    if (this.bubble.style.display === 'block') {
      if (this.t > this.bubbleUntil) {
        this.bubble.style.display = 'none';
      } else {
        const v = new THREE.Vector3(3.6, 2.7, -0.5).project(this.camera);
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
}

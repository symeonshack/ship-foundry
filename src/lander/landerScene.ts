import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera } from '../scene/camera';
import { buildLanderInterior, type InteriorHotspot } from '../scene/primitives';
import { EYE_HEIGHT, PlayerController } from '../interior/playerController';
import { box, button, clearPanel, el } from '../ui/panels';
import { toast } from '../ui/hud';

const INTERACT_RADIUS = 2.0;

/**
 * The lander cabin — where you operate while planetside. Distinct from the
 * ship interior: cramped, a GERTY console (not the robot), and a launch
 * station that flies you up to the orbiting ship. You can't reach the ship
 * interior from a surface without launching from here (dev mode aside).
 */
export class LanderScreen implements GameScreen {
  readonly id = 'lander' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controller: PlayerController;
  private hotspots: InteriorHotspot[];
  private near: InteriorHotspot | null = null;
  private prompt: HTMLElement;
  private gertyScreen: THREE.Mesh;
  private gertyEye: THREE.Mesh;
  private speakGlow = 0;
  private panelOpen = false;
  private t = 0;
  private keyHandler: (ev: KeyboardEvent) => void;
  private unsub: (() => void)[] = [];

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x04070a);
    this.camera = makeCamera(74);

    const cabin = buildLanderInterior();
    this.scene.add(cabin.group);
    this.hotspots = cabin.hotspots;
    this.gertyScreen = cabin.group.getObjectByName('gerty-screen') as THREE.Mesh;
    this.gertyEye = cabin.group.getObjectByName('gerty-eye') as THREE.Mesh;

    // tight, functional lighting — a working cockpit, not a lounge
    this.scene.add(new THREE.AmbientLight(0x8494a2, 1.5));
    const key = new THREE.PointLight(0xbfe0ff, 14, 12);
    key.position.set(0, 2.1, -1.6);
    this.scene.add(key);
    const warm = new THREE.PointLight(0xffd8a8, 8, 10);
    warm.position.set(1.2, 1.9, 1.4);
    this.scene.add(warm);

    this.controller = new PlayerController(this.camera, canvas, cabin.colliders, new THREE.Vector3(0.6, EYE_HEIGHT, 1.7), 0);

    const hud = document.getElementById('hud')!;
    this.prompt = el('div', 'interact-prompt');
    this.prompt.style.display = 'none';
    hud.appendChild(this.prompt);

    this.keyHandler = (ev) => {
      if (ev.code === 'KeyE' && this.near) this.interact(this.near);
    };
  }

  enter(): void {
    this.ctx.store.state.location = 'ground'; // in the lander = planetside
    this.controller.attach();
    window.addEventListener('keydown', this.keyHandler);
    this.unsub.push(this.ctx.bus.on('gerty:line', () => (this.speakGlow = 1.5)));
    this.panelOpen = false;
    clearPanel();
  }

  exit(): void {
    this.controller.detach();
    window.removeEventListener('keydown', this.keyHandler);
    for (const u of this.unsub) u();
    this.unsub = [];
    this.prompt.style.display = 'none';
    clearPanel();
  }

  private interact(h: InteriorHotspot): void {
    if (h.id === 'exit') {
      this.ctx.nav('surface');
    } else if (h.id === 'launch') {
      this.launch();
    } else {
      this.openGertyPanel();
    }
  }

  private launch(): void {
    this.controller.releasePointer();
    // climb to the orbiting ship — the one path from planetside to the ship interior
    this.ctx.store.state.location = 'orbit';
    this.ctx.store.changed();
    this.ctx.gerty.notify('flight');
    toast('Lander climbing to orbit — docking with the ship.', 'good');
    this.ctx.nav('interior');
  }

  private openGertyPanel(): void {
    this.controller.releasePointer();
    this.panelOpen = true;
    clearPanel();
    const b = box('GERTY — Lander Console');
    const history = this.ctx.gerty.transcript();
    if (history.length === 0) {
      b.appendChild(el('p', 'sub', 'Console idle. GERTY is quiet — the robot chassis is aboard the ship; only its voice reaches the lander.'));
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
      this.prompt.innerHTML = `<span class="key">E</span> ${nearest.id === 'gerty' ? 'Talk to GERTY' : nearest.label}`;
      this.prompt.style.display = 'block';
    } else {
      this.prompt.style.display = 'none';
      if (this.panelOpen) {
        this.panelOpen = false;
        clearPanel();
      }
    }

    // GERTY console life: idle breathing, bright while its voice comes through
    this.speakGlow = Math.max(0, this.speakGlow - dt * 0.5);
    const screenMat = this.gertyScreen.material as THREE.MeshStandardMaterial;
    screenMat.emissiveIntensity = 0.5 + Math.sin(this.t * 1.8) * 0.15 + this.speakGlow;
    const eyeMat = this.gertyEye.material as THREE.MeshStandardMaterial;
    eyeMat.emissiveIntensity = 1.0 + Math.sin(this.t * 2.4) * 0.25 + this.speakGlow * 0.8;
  }
}

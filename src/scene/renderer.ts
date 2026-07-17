import * as THREE from 'three';
import type { EventBus, ScreenId } from '../core/events';

export interface GameScreen {
  id: ScreenId;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  enter(): void;
  exit(): void;
  update(dt: number): void;
  /** fired for real clicks only (drag-orbits are filtered out) */
  onClick?(ndc: THREE.Vector2, ev: PointerEvent): void;
  onPointerMove?(ndc: THREE.Vector2, ev: PointerEvent): void;
}

export class ScreenManager {
  readonly renderer: THREE.WebGLRenderer;
  private screens = new Map<ScreenId, GameScreen>();
  active: GameScreen | null = null;
  private clock = new THREE.Clock();
  private downAt: { x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private bus: EventBus,
    private onTick: (dt: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', (ev) => {
      this.downAt = { x: ev.clientX, y: ev.clientY };
    });
    canvas.addEventListener('pointerup', (ev) => {
      if (!this.downAt) return;
      const moved = Math.hypot(ev.clientX - this.downAt.x, ev.clientY - this.downAt.y);
      this.downAt = null;
      if (moved < 6 && this.active?.onClick) this.active.onClick(this.ndc(ev), ev);
    });
    canvas.addEventListener('pointermove', (ev) => {
      this.active?.onPointerMove?.(this.ndc(ev), ev);
    });
  }

  private ndc(ev: PointerEvent): THREE.Vector2 {
    return new THREE.Vector2(
      (ev.clientX / window.innerWidth) * 2 - 1,
      -(ev.clientY / window.innerHeight) * 2 + 1,
    );
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    for (const s of this.screens.values()) {
      s.camera.aspect = w / h;
      s.camera.updateProjectionMatrix();
    }
  }

  register(screen: GameScreen): void {
    this.screens.set(screen.id, screen);
  }

  show(id: ScreenId): void {
    const next = this.screens.get(id);
    if (!next || next === this.active) return;
    this.active?.exit();
    this.active = next;
    next.enter();
    this.bus.emit('screen:change', { screen: id });
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.onTick(dt);
      if (this.active) {
        this.active.update(dt);
        this.renderer.render(this.active.scene, this.active.camera);
      }
    });
  }
}

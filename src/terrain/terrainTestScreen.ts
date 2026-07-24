/**
 * The terrain range — Group A Phase 1 proof-of-concept screen. Not a
 * gameplay site: an endless procedural surface for verifying that chunk
 * streaming holds up in both control schemes the game runs on:
 *
 *  - command mode: top-down orbit camera, pan/zoom; chunks stream around
 *    the camera's focus target
 *  - foot mode: the standard first-person controller walking the same
 *    live terrain, ground height sampled analytically
 *
 * Tab swaps modes (same pattern as SurfaceScreen). Reached via the
 * #terrain URL hash or `__game.manager.show('terraintest')`.
 */
import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera, makeOrbit } from '../scene/camera';
import { addBasicLights } from '../scene/primitives';
import { PlayerController, type Collider } from '../interior/playerController';
import { ChunkedTerrain } from './chunkManager';
import { BALANCE } from '../config/balance';
import { box, button, clearPanel, el } from '../ui/panels';
import { toast } from '../ui/hud';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class TerrainTestScreen implements GameScreen {
  readonly id = 'terraintest' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private controller: PlayerController;
  private footColliders: Collider[] = []; // empty range — nothing to bump into
  private terrain: ChunkedTerrain | null = null;
  private mode: 'command' | 'foot' = 'command';
  private statsLine: HTMLElement | null = null;
  private keyHandler = (ev: KeyboardEvent): void => {
    if (ev.code === 'Tab') {
      ev.preventDefault();
      this.setMode(this.mode === 'command' ? 'foot' : 'command');
    }
  };

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    const cfg = BALANCE.terrainTest;
    this.camera = makeCamera(50);
    this.controls = makeOrbit(this.camera, canvas, {
      target: [0, 0, 0],
      minDistance: cfg.camMinDistance,
      maxDistance: cfg.camMaxDistance,
      maxPolar: Math.PI * cfg.camMaxPolarFrac,
      enablePan: true,
    });
    // pan along the ground plane, not the screen plane — this is what
    // "panning the top-down camera across the site" means here
    this.controls.screenSpacePanning = false;
    addBasicLights(this.scene);
    this.controller = new PlayerController(this.camera, canvas, this.footColliders, new THREE.Vector3(0, 0, 0));
  }

  enter(): void {
    const cfg = BALANCE.terrainTest;
    this.scene.background = new THREE.Color(cfg.skyColor);
    this.scene.fog = new THREE.Fog(cfg.skyColor, cfg.fogNear, cfg.fogFar);
    this.terrain = new ChunkedTerrain(cfg.seed, cfg.groundColor);
    this.scene.add(this.terrain.group);
    this.controller.groundHeight = (x, z) => this.terrain!.heightAt(x, z);

    this.mode = 'command';
    this.controls.enabled = true;
    this.camera.position.set(cfg.camStart.x, cfg.camStart.y, cfg.camStart.z);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.terrain.prewarm(0, 0);

    window.addEventListener('keydown', this.keyHandler);
    this.renderPanel();
  }

  exit(): void {
    window.removeEventListener('keydown', this.keyHandler);
    if (this.mode === 'foot') this.controller.detach();
    this.mode = 'command';
    this.controls.enabled = true;
    this.terrain?.dispose();
    this.terrain = null;
    this.statsLine = null;
    clearPanel();
  }

  private setMode(mode: 'command' | 'foot'): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'foot') {
      // drop in at the point the command camera was looking at
      this.controller.position.set(this.controls.target.x, 0, this.controls.target.z);
      this.controls.enabled = false;
      this.controller.attach();
      toast('On foot — Tab returns to command view', 'info');
    } else {
      this.controller.detach();
      const p = this.controller.position;
      this.controls.target.set(p.x, 0, p.z);
      this.camera.position.set(p.x + 26, 34, p.z + 26);
      this.controls.enabled = true;
      this.controls.update();
    }
    this.renderPanel();
  }

  update(dt: number): void {
    if (!this.terrain) return;
    let focusX: number;
    let focusZ: number;
    if (this.mode === 'command') {
      this.controls.update();
      focusX = this.controls.target.x;
      focusZ = this.controls.target.z;
    } else {
      this.controller.update(dt);
      focusX = this.controller.position.x;
      focusZ = this.controller.position.z;
    }
    this.terrain.update(focusX, focusZ);
    if (this.statsLine) {
      this.statsLine.textContent = `chunks loaded: ${this.terrain.chunkCount} · focus ${Math.round(focusX)}, ${Math.round(focusZ)}`;
    }
  }

  private renderPanel(): void {
    clearPanel();
    const b = box('Terrain Range');
    b.appendChild(
      el(
        'p',
        'sub',
        this.mode === 'command'
          ? 'Chunk-streaming proof of concept. Drag to orbit, right-drag to pan, scroll to zoom — terrain loads and unloads around the camera focus.'
          : 'WASD walk · mouse/arrows look. The ground under you is the same streamed terrain the command view manages.',
      ),
    );
    this.statsLine = el('div', 'sub');
    b.appendChild(this.statsLine);
    b.appendChild(
      button(this.mode === 'command' ? 'Go on foot  [Tab]' : 'Command view  [Tab]', () =>
        this.setMode(this.mode === 'command' ? 'foot' : 'command'),
      ),
    );
    b.appendChild(button('Back to ship', () => this.ctx.nav('interior')));
  }
}

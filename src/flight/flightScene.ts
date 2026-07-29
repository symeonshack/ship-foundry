import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera } from '../scene/camera';
import { addBasicLights, addStars, buildFoundryBase, buildPoiMarker, buildTerrain, mat, type Terrain } from '../scene/primitives';
import { buildShipAssembly, setEngineFlare, spinCentrifuges, type ShipAssembly } from '../building/shipMesh';
import { deriveStats, type ShipStats } from '../building/shipStats';
import { poiDef, type PoiDef } from '../exploration/starSystem';
import { checkFuelState } from '../companion/hints';
import { FLAGS } from '../core/flags';
import {
  SOFT_LANDING_V,
  START_ALTITUDE,
  brakePower,
  driftForce,
  entryHeat,
  fuelAdjustment,
  startDescent,
  tickDescent,
  tripDuration,
  turbulence,
  type DescentState,
} from './flightModel';
import { bar, box, button, clearPanel, el } from '../ui/panels';
import { toast } from '../ui/hud';

interface Journey {
  from: string;
  to: string;
  baseCost: number;
  duration: number;
  progress: number;
  throttle: number;
  offsetX: number;
  velX: number;
  offsetSum: number;
  samples: number;
}

const MAX_OFFSET = 5;
const STEER_ACCEL = 7;

/**
 * Phase 2: travel is a flown sequence, not a teleport. Cruise is a guided
 * transit where the ship's stats are the handling; descent is a retro-burn
 * landing with entry heat. Bad flying costs a little fuel; bad landings cost
 * pride (cosmetic-only, by design).
 */
export class FlightScreen implements GameScreen {
  readonly id = 'flight' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private assembly: ShipAssembly | null = null;
  private shipRig = new THREE.Group(); // offset/bank wrapper around the assembly
  private stats!: ShipStats;
  private phase: 'cruise' | 'descent' | 'touchdown' = 'cruise';
  private journey: Journey | null = null;
  private pending: { from: string; to: string; baseCost: number } | null = null;
  private destDef!: PoiDef;
  private targetMarker: THREE.Group | null = null;
  private originMarker: THREE.Group | null = null;
  private streaks: THREE.Mesh[] = [];
  private terrain: Terrain | null = null;
  private groundGroup = new THREE.Group();
  private descent: DescentState = startDescent();
  private heat = 0;
  private touchdownTimer = 0;
  private hardLanding = false;
  private dust: THREE.Mesh[] = [];
  private keys = new Set<string>();
  private t = 0;
  private panelUpdaters: (() => void)[] = [];
  private keyDown = (ev: KeyboardEvent): void => {
    this.keys.add(ev.code);
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.code)) ev.preventDefault();
  };
  private keyUp = (ev: KeyboardEvent): void => {
    this.keys.delete(ev.code);
  };

  constructor(private ctx: Ctx) {
    this.scene.background = new THREE.Color(0x04070c);
    this.camera = makeCamera(60);
    addBasicLights(this.scene, 0xfff4e0, 0x1c2833);
    addStars(this.scene, 900);
    this.scene.add(this.shipRig);
    this.scene.add(this.groundGroup);

    // motion streaks: thin primitives rushing past
    for (let i = 0; i < 42; i++) {
      const streak = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.03, 2.2),
        mat(0x9fb6c4, { emissive: 0x9fb6c4, emissiveIntensity: 0.5, transparent: true, opacity: 0.4 }),
      );
      this.resetStreak(streak, true);
      this.scene.add(streak);
      this.streaks.push(streak);
    }
  }

  private resetStreak(streak: THREE.Mesh, anywhere = false): void {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 14;
    streak.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, anywhere ? -60 + Math.random() * 80 : -60 - Math.random() * 20);
  }

  /** called by the star map before nav('flight') */
  begin(from: string, to: string, baseCost: number): void {
    this.pending = { from, to, baseCost };
  }

  enter(): void {
    const pending = this.pending ?? { from: 'foundry', to: this.ctx.store.state.currentPoi, baseCost: 0 };
    this.pending = null;
    this.destDef = poiDef(pending.to);

    const ship = this.ctx.store.state.ship;
    this.stats = deriveStats(ship);
    this.assembly = buildShipAssembly(ship);
    // nose forward (+Y → -Z), engines toward the camera
    this.assembly.group.rotation.x = -Math.PI / 2;
    this.assembly.group.position.set(0, -1.2, 0);
    this.shipRig.add(this.assembly.group);
    this.shipRig.position.set(0, 0, 0);

    this.journey = {
      ...pending,
      duration: tripDuration(Math.max(1, this.distance(pending.from, pending.to)), this.stats),
      progress: 0,
      throttle: 0.7,
      offsetX: 0,
      velX: 0,
      offsetSum: 0,
      samples: 0,
    };
    this.phase = 'cruise';
    this.heat = entryHeat(this.destDef.kind);
    this.hardLanding = false;

    // destination grows ahead, origin shrinks behind
    this.targetMarker = buildPoiMarker(this.destDef.kind, this.destDef.color);
    this.targetMarker.position.set(0, 0, -70);
    this.scene.add(this.targetMarker);
    const originDef = poiDef(pending.from);
    this.originMarker = buildPoiMarker(originDef.kind, originDef.color);
    this.originMarker.position.set(2, 1.5, 30);
    this.scene.add(this.originMarker);

    this.camera.position.set(0, 2.6, 9);
    this.camera.lookAt(0, 0, -10);

    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    this.ctx.gerty.notify('flight');
    this.renderPanel();
  }

  exit(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    this.keys.clear();
    this.assembly?.dispose();
    this.assembly = null;
    this.shipRig.clear();
    this.shipRig.rotation.set(0, 0, 0);
    this.disposeGround();
    if (this.targetMarker) {
      this.targetMarker.removeFromParent();
      this.targetMarker = null;
    }
    if (this.originMarker) {
      this.originMarker.removeFromParent();
      this.originMarker = null;
    }
    this.scene.fog = null;
    clearPanel();
  }

  private distance(a: string, b: string): number {
    const pa = poiDef(a).pos;
    const pb = poiDef(b).pos;
    return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  }

  private disposeGround(): void {
    this.groundGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    this.groundGroup.clear();
    this.terrain = null;
    this.dust = [];
  }

  // ---- phases ----

  private beginDescent(): void {
    this.phase = 'descent';
    this.descent = startDescent();
    if (this.targetMarker) {
      this.targetMarker.removeFromParent();
      this.targetMarker = null;
    }
    this.terrain = buildTerrain(this.destDef.terrainSeed, this.destDef.terrainColor, 90);
    this.groundGroup.add(this.terrain.mesh);
    if (this.destDef.special === 'home') {
      const base = buildFoundryBase();
      base.position.set(-10, 0.2, -6);
      this.groundGroup.add(base);
    }
    this.scene.background = new THREE.Color(this.destDef.skyColor);
    this.renderPanel();
  }

  private touchdown(): void {
    this.phase = 'touchdown';
    this.touchdownTimer = 1.4;
    this.hardLanding = this.descent.velocity > SOFT_LANDING_V;
    if (this.hardLanding) {
      this.ctx.gerty.notify('hard-landing');
      toast('Hard landing. Everything is still attached. Probably.', 'warn');
      // dust burst
      for (let i = 0; i < 14; i++) {
        const puff = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.25, 0.25),
          mat(0x8a7f6f, { transparent: true, opacity: 0.8, flat: true }),
        );
        const a = Math.random() * Math.PI * 2;
        puff.position.set(Math.cos(a) * 1.5, -1, Math.sin(a) * 1.5);
        puff.userData.vel = new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 3), 1 + Math.random() * 2, Math.sin(a) * (2 + Math.random() * 3));
        this.groundGroup.add(puff);
        this.dust.push(puff);
      }
    } else {
      toast('Touchdown.', 'good');
    }
    this.renderPanel();
  }

  private finish(skipAdjustment = false): void {
    const store = this.ctx.store;
    const j = this.journey!;
    if (!skipAdjustment && j.samples > 0 && j.baseCost > 0) {
      const meanOffset = j.offsetSum / j.samples;
      const delta = fuelAdjustment(j.baseCost, meanOffset, store.state.fuel);
      if (Math.abs(delta) > 0.05) {
        store.state.fuel = Math.max(0, store.state.fuel + delta);
        toast(
          delta > 0
            ? `Clean burn — ${delta.toFixed(1)} fuel recovered from the margins`
            : `Sloppy vectoring cost ${(-delta).toFixed(1)} extra fuel`,
          delta > 0 ? 'good' : 'warn',
        );
      }
    }
    this.journey = null;
    store.state.location = 'orbit'; // the ship arrives in orbit at the new POI
    store.bus.emit('travel:arrive', { poiId: store.state.currentPoi });
    checkFuelState(store, this.stats);
    store.changed();
    this.ctx.nav('interior');
  }

  /** dev-mode escape hatch */
  private autopilot(): void {
    if (this.phase === 'touchdown') return;
    this.descent = { altitude: 0, velocity: 1.5 };
    this.finish(true);
  }

  // ---- frame ----

  update(dt: number): void {
    this.t += dt;
    if (this.assembly) spinCentrifuges(this.assembly.group, dt);
    const j = this.journey;
    if (!j) return;

    if (this.phase === 'cruise') {
      // throttle + steering
      if (this.keys.has('KeyW')) j.throttle = Math.min(1.2, j.throttle + dt * 0.8);
      if (this.keys.has('KeyS')) j.throttle = Math.max(0.35, j.throttle - dt * 0.8);
      let steer = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;

      // drift from off-axis mass, countered by the player
      j.velX += (driftForce(this.stats) + steer * STEER_ACCEL) * dt;
      j.velX *= 1 - Math.min(1, dt * 1.6); // damping
      j.offsetX = THREE.MathUtils.clamp(j.offsetX + j.velX * dt, -MAX_OFFSET, MAX_OFFSET);
      j.offsetSum += Math.abs(j.offsetX);
      j.samples += 1;

      j.progress += (j.throttle / j.duration) * dt;

      // ship presentation: offset, bank into the correction, turbulence shake
      const shake = turbulence(this.stats) * j.throttle;
      this.shipRig.position.x = j.offsetX * 0.8 + (Math.random() - 0.5) * shake;
      this.shipRig.position.y = (Math.random() - 0.5) * shake;
      this.shipRig.rotation.z = -j.velX * 0.12;
      if (this.assembly) setEngineFlare(this.assembly.group, j.throttle);

      // world: streaks stream by, target closes in offset-parallax
      for (const streak of this.streaks) {
        streak.position.z += (26 + j.throttle * 30) * dt;
        if (streak.position.z > 12) this.resetStreak(streak);
      }
      if (this.targetMarker) {
        const closeness = j.progress;
        this.targetMarker.position.set(-j.offsetX * 1.4, 0, -70 + closeness * 52);
        this.targetMarker.scale.setScalar(0.8 + closeness * 4);
        this.targetMarker.rotation.y += dt * 0.3;
      }
      if (this.originMarker) {
        this.originMarker.position.z = 30 + j.progress * 60;
        this.originMarker.scale.setScalar(Math.max(0.1, 1.4 - j.progress * 1.6));
      }

      if (j.progress >= 1) this.beginDescent();
    } else if (this.phase === 'descent') {
      const braking = this.keys.has('Space');
      this.descent = tickDescent(this.descent, braking, brakePower(this.stats), dt);

      // ship rights itself for landing; engines flare while braking
      this.shipRig.rotation.z *= 1 - Math.min(1, dt * 3);
      this.shipRig.position.x *= 1 - Math.min(1, dt * 2);
      if (this.assembly) {
        this.assembly.group.rotation.x = THREE.MathUtils.lerp(this.assembly.group.rotation.x, 0, Math.min(1, dt * 2.5));
        setEngineFlare(this.assembly.group, braking ? 1.3 : 0.25);
      }

      // terrain rises to meet you
      const alt = this.descent.altitude;
      this.groundGroup.position.y = -2.4 - alt * 1.1;
      // entry heat flush across the hull in the upper atmosphere
      const heatBand = Math.max(0, Math.min(1, (alt - 20) / 30));
      const flush = this.heat * heatBand;
      if (this.assembly && flush > 0.01) {
        this.assembly.group.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.emissive && o.name !== 'glow') {
            m.emissive.setRGB(flush * 0.55, flush * 0.18, 0.02 * flush);
          }
        });
      }
      this.scene.fog = flush > 0.05 ? new THREE.Fog(0x66300a, 10, 80 - flush * 30) : new THREE.Fog(new THREE.Color(this.destDef.skyColor).getHex(), 20, 120);

      // camera: slightly above, watching the descent
      this.camera.position.lerp(new THREE.Vector3(0, 4.5, 10), Math.min(1, dt * 2));
      this.camera.lookAt(0, -1, 0);

      if (this.descent.altitude <= 0) this.touchdown();
    } else {
      // touchdown: settle, shake if hard, dust, then hand over to the interior
      this.touchdownTimer -= dt;
      if (this.hardLanding && this.touchdownTimer > 0.6) {
        this.camera.position.x = (Math.random() - 0.5) * 0.5;
        this.camera.position.y = 4.5 + (Math.random() - 0.5) * 0.4;
      }
      for (const puff of this.dust) {
        const vel = puff.userData.vel as THREE.Vector3;
        puff.position.addScaledVector(vel, dt);
        vel.y -= 4 * dt;
        (puff.material as THREE.MeshStandardMaterial).opacity *= 1 - dt * 1.5;
      }
      if (this.assembly) setEngineFlare(this.assembly.group, 0);
      if (this.touchdownTimer <= 0) this.finish();
    }

    for (const fn of this.panelUpdaters) fn();
  }

  // ---- panel ----

  private renderPanel(): void {
    clearPanel();
    this.panelUpdaters = [];
    const j = this.journey;
    if (!j) return;

    if (this.phase === 'cruise') {
      const b = box(`Transit — ${this.destDef.name}`);
      b.appendChild(el('div', 'sub', 'A/D steer against drift · W/S throttle. Keep her centered; sloppy vectoring burns fuel.'));
      const progress = bar(0, 'var(--accent)');
      b.appendChild(progress);
      const throttleRow = el('div', 'row');
      throttleRow.appendChild(el('span', 'sub', 'Throttle'));
      const throttle = bar(0, 'var(--amber)');
      throttleRow.appendChild(throttle);
      b.appendChild(throttleRow);
      const driftLabel = el('div', 'sub');
      b.appendChild(driftLabel);
      this.panelUpdaters.push(() => {
        (progress.firstElementChild as HTMLElement).style.width = `${Math.round(j.progress * 100)}%`;
        (throttle.firstElementChild as HTMLElement).style.width = `${Math.round((j.throttle / 1.2) * 100)}%`;
        const off = Math.abs(j.offsetX);
        driftLabel.textContent = off < 0.6 ? 'Vector: centered' : off < 2 ? 'Vector: drifting — correct it' : 'Vector: way off the line';
        driftLabel.style.color = off < 0.6 ? 'var(--green)' : off < 2 ? 'var(--amber)' : 'var(--red)';
      });
      if (this.ctx.store.hasFlag(FLAGS.DEV_MODE)) {
        b.appendChild(button('Autopilot (dev)', () => this.autopilot()));
      }
    } else if (this.phase === 'descent') {
      const b = box(`Descent — ${this.destDef.name}`);
      b.appendChild(el('div', 'sub', 'HOLD SPACE to retro-burn. Touch down under 2.5 or arrive as a percussion instrument.'));
      const altBar = bar(1, 'var(--accent)');
      b.appendChild(altBar);
      const vLabel = el('div', 'sub');
      b.appendChild(vLabel);
      this.panelUpdaters.push(() => {
        (altBar.firstElementChild as HTMLElement).style.width = `${Math.round((this.descent.altitude / START_ALTITUDE) * 100)}%`;
        vLabel.textContent = `Descent ${this.descent.velocity.toFixed(1)} · altitude ${Math.round(this.descent.altitude)}`;
        vLabel.style.color = this.descent.velocity <= SOFT_LANDING_V ? 'var(--green)' : 'var(--red)';
      });
      if (this.ctx.store.hasFlag(FLAGS.DEV_MODE)) {
        b.appendChild(button('Autopilot (dev)', () => this.autopilot()));
      }
    } else {
      box(this.hardLanding ? 'Down. Loudly.' : 'Touchdown');
    }
  }
}

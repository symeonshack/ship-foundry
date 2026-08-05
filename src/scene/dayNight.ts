import * as THREE from 'three';
import { dayPhase } from '../base/power';

/**
 * A visible day/night cycle for a surface site, driven by the same clock as the
 * solar-power dip (`dayPhase`): a sun disc rises in the east, arcs overhead at
 * noon, and sets in the west, with a moon opposite it at night. The directional
 * sun light tracks the disc (warming near the horizon, dark below it), the
 * ambient dims to a still-navigable night floor, the sky/fog recolour through
 * day → dusk-orange → deep-blue night, and the starfield fades in after dark.
 *
 * Owned by SurfaceScreen: created once, re-based to each site's day sky in
 * buildSite, and update(playSeconds)'d every frame.
 */

// phase 0 = solar noon; elevation = cos, east-west sweep = sin
const HORIZON = 0.4; // how far above the horizon counts as "low sun" for warm tinting

const DAY_AMB = new THREE.Color(0x4a5a66);
const NIGHT_AMB = new THREE.Color(0x141e2c);
const SUN_WHITE = new THREE.Color(0xffffff);
const SUN_WARM = new THREE.Color(0xff8a3c);
const DISC_HIGH = new THREE.Color(0xfff2c0);
const DISC_LOW = new THREE.Color(0xff7a30);
const GLOW_HIGH = new THREE.Color(0xffcf66);
const GLOW_LOW = new THREE.Color(0xff5f28);
const STORM_SKY = new THREE.Color(0x6b4a2a);
const STORM_AMB = new THREE.Color(0x3a2c1c);

export class DayNightSky {
  readonly sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
  readonly ambient = new THREE.AmbientLight(0x4a5a66, 1.9);
  private fill = new THREE.DirectionalLight(0x4a6a8a, 0.35);
  private sunDisc: THREE.Mesh;
  private sunGlow: THREE.Mesh;
  private moon: THREE.Mesh;
  private daySky = new THREE.Color(0x8fb7c9);
  private readonly duskSky = new THREE.Color(0xcf7a3a);
  private readonly nightSky = new THREE.Color(0x0a1420);
  private readonly tmpSky = new THREE.Color();
  private readonly dir = new THREE.Vector3();
  private readonly added: THREE.Object3D[] = [];
  private readonly R = 380; // just inside the star shell (radius 400) so it stays within the far plane

  constructor(private scene: THREE.Scene, daySky?: number, private stars: THREE.Points | null = null) {
    if (daySky !== undefined) this.daySky.set(daySky);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 20), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
    this.sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(30, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffcf66, transparent: true, opacity: 0.3, fog: false, depthWrite: false }),
    );
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 20), new THREE.MeshBasicMaterial({ color: 0xcfd6e0, fog: false }));
    this.fill.position.set(-14, 8, -18);
    for (const o of [this.sunLight, this.sunLight.target, this.ambient, this.fill, this.sunGlow, this.sunDisc, this.moon]) {
      scene.add(o);
      this.added.push(o);
    }
  }

  /** re-base the daytime sky colour when a new site is built */
  setDaySky(color: number): void {
    this.daySky.set(color);
  }

  /** `storm` 0..1 blends in a dust-storm look: brown, dimmed, sun/stars hidden */
  update(t: number, storm = 0): void {
    const st = Math.max(0, Math.min(1, storm));
    const ang = dayPhase(t) * Math.PI * 2;
    const elev = Math.cos(ang); // +1 noon, 0 dawn/dusk, -1 midnight
    const ew = Math.sin(ang); // +west at dusk, -east at dawn
    this.dir.set(ew, elev, -0.3).normalize();

    this.sunDisc.position.copy(this.dir).multiplyScalar(this.R);
    this.sunGlow.position.copy(this.sunDisc.position);
    this.moon.position.copy(this.dir).multiplyScalar(-this.R);
    this.sunLight.position.copy(this.sunDisc.position);

    const dayAmt = Math.max(0, elev);
    const lowness = 1 - Math.min(1, dayAmt / HORIZON); // 1 at/under horizon → 0 at high noon
    const night = 1 - dayAmt;

    // directional sun: dark below the horizon, warm and low near it; the storm
    // chokes it off
    this.sunLight.intensity = 2.7 * dayAmt * (1 - st * 0.85);
    this.sunLight.color.copy(SUN_WHITE).lerp(SUN_WARM, Math.max(lowness, st * 0.6));
    // ambient stays high enough to keep working after dark (for now); a storm
    // dims it toward a murky brown
    this.ambient.color.copy(DAY_AMB).lerp(NIGHT_AMB, night).lerp(STORM_AMB, st);
    this.ambient.intensity = (1.9 - night * 0.75) * (1 - st * 0.35);

    // sky + fog recolour — brown out under a storm
    const sky = this.skyColor(elev).lerp(STORM_SKY, st);
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(sky);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(sky);

    // sun disc / glow appearance + horizon visibility (hidden in a storm)
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(DISC_HIGH).lerp(DISC_LOW, lowness);
    const gm = this.sunGlow.material as THREE.MeshBasicMaterial;
    gm.color.copy(GLOW_HIGH).lerp(GLOW_LOW, lowness);
    gm.opacity = (0.12 + lowness * 0.35) * (1 - st);
    this.sunDisc.visible = elev > -0.06 && st < 0.5;
    this.sunGlow.visible = elev > -0.06 && st < 0.5;
    this.moon.visible = elev < 0.12 && st < 0.5;

    // stars fade in after dark, gone in a storm
    if (this.stars) {
      const sm = this.stars.material as THREE.PointsMaterial;
      sm.transparent = true;
      sm.opacity = Math.min(1, Math.max(0, night * 1.5 - 0.25)) * (1 - st);
    }
  }

  private skyColor(elev: number): THREE.Color {
    if (elev >= 0) {
      const low = 1 - Math.min(1, elev / HORIZON);
      return this.tmpSky.copy(this.daySky).lerp(this.duskSky, low);
    }
    return this.tmpSky.copy(this.duskSky).lerp(this.nightSky, Math.min(1, -elev / 0.35));
  }

  dispose(): void {
    for (const o of this.added) {
      this.scene.remove(o);
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    }
  }
}

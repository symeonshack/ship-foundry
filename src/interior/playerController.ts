import * as THREE from 'three';

export const EYE_HEIGHT = 1.6;
const SPEED = 3.5;
const LOOK_SPEED = 0.0023;
const ARROW_LOOK_SPEED = 1.9;
export const PLAYER_RADIUS = 0.35;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

/** axis-aligned collider on the deck plane (y ignored — flat floor, no jumping) */
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Axis-separated move: apply x then z independently, rejecting an axis if it
 * puts the player (inflated by radius) inside any collider. Sliding along
 * walls falls out for free. Pure and unit-tested.
 */
export function moveWithCollision(
  pos: { x: number; z: number },
  dx: number,
  dz: number,
  colliders: Collider[],
  radius = PLAYER_RADIUS,
): { x: number; z: number } {
  const blocked = (x: number, z: number): boolean =>
    colliders.some(
      (c) => x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ,
    );
  let x = pos.x;
  let z = pos.z;
  if (!blocked(x + dx, z)) x += dx;
  if (!blocked(x, z + dz)) z += dz;
  return { x, z };
}

/**
 * First-person controller: pointer-lock mouse look with arrow-key fallback,
 * WASD movement on a flat deck. Owns its camera orientation via yaw/pitch.
 */
export class PlayerController {
  yaw = 0;
  pitch = 0;
  readonly position: THREE.Vector3;
  /** terrain height sampler; null = flat deck at y 0 (the ship interior) */
  groundHeight: ((x: number, z: number) => number) | null = null;
  private keys = new Set<string>();
  private disposers: (() => void)[] = [];
  private active = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private colliders: Collider[],
    spawn: THREE.Vector3,
    spawnYaw = 0,
  ) {
    this.position = spawn.clone();
    this.yaw = spawnYaw;
  }

  /** begin listening; called on screen enter */
  attach(): void {
    this.active = true;
    const down = (ev: KeyboardEvent): void => {
      if (!this.active) return;
      this.keys.add(ev.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
    };
    const up = (ev: KeyboardEvent): void => {
      this.keys.delete(ev.code);
    };
    const move = (ev: MouseEvent): void => {
      if (!this.active || document.pointerLockElement !== this.canvas) return;
      this.yaw -= ev.movementX * LOOK_SPEED;
      this.pitch = THREE.MathUtils.clamp(this.pitch - ev.movementY * LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
    };
    const click = (): void => {
      if (this.active && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousemove', move);
    this.canvas.addEventListener('click', click);
    this.disposers = [
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
      () => window.removeEventListener('mousemove', move),
      () => this.canvas.removeEventListener('click', click),
    ];
  }

  detach(): void {
    this.active = false;
    this.keys.clear();
    for (const d of this.disposers) d();
    this.disposers = [];
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  releasePointer(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  update(dt: number): void {
    if (!this.active) return;

    // arrow-key look fallback (also what automated verification drives)
    if (this.keys.has('ArrowLeft')) this.yaw += ARROW_LOOK_SPEED * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= ARROW_LOOK_SPEED * dt;
    if (this.keys.has('ArrowUp')) this.pitch = Math.min(PITCH_LIMIT, this.pitch + ARROW_LOOK_SPEED * dt);
    if (this.keys.has('ArrowDown')) this.pitch = Math.max(-PITCH_LIMIT, this.pitch - ARROW_LOOK_SPEED * dt);

    let fwd = 0;
    let strafe = 0;
    if (this.keys.has('KeyW')) fwd += 1;
    if (this.keys.has('KeyS')) fwd -= 1;
    if (this.keys.has('KeyA')) strafe -= 1;
    if (this.keys.has('KeyD')) strafe += 1;
    if (fwd !== 0 || strafe !== 0) {
      const len = Math.hypot(fwd, strafe);
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // camera faces -Z at yaw 0
      const dx = ((-sin * fwd + cos * strafe) / len) * SPEED * dt;
      const dz = ((-cos * fwd - sin * strafe) / len) * SPEED * dt;
      const next = moveWithCollision({ x: this.position.x, z: this.position.z }, dx, dz, this.colliders);
      this.position.x = next.x;
      this.position.z = next.z;
    }

    const ground = this.groundHeight ? this.groundHeight(this.position.x, this.position.z) : 0;
    this.camera.position.set(this.position.x, ground + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }
}

import * as THREE from 'three';
import { buildCollaborator } from '../scene/primitives';
import type { Gesture } from './sharedBuild';

export type { Gesture } from './sharedBuild';

const EYE_COLORS: Record<Gesture, number> = {
  approve: 0x7dffa8,
  agitate: 0xff8a5c,
  observe: 0x9fd6e8,
  demonstrate: 0xffd06a,
};

/**
 * The collaborator's body — primitive-composed and deliberately ambiguous
 * between grown and built. All communication is gesture + light; there is no
 * dialogue channel by design.
 */
export class Collaborator {
  readonly group: THREE.Group;
  private eye: THREE.Mesh;
  private limbs: THREE.Group;
  private baseY: number;
  private t = Math.random() * 10;
  private gesture: Gesture | null = null;
  private gestureT = 0;
  private target = new THREE.Vector3();

  constructor(position: THREE.Vector3) {
    this.group = buildCollaborator();
    this.group.position.copy(position);
    this.baseY = position.y;
    this.eye = this.group.getObjectByName('eye') as THREE.Mesh;
    this.limbs = this.group.getObjectByName('limbs') as THREE.Group;
  }

  playGesture(g: Gesture, worldTarget?: THREE.Vector3): void {
    this.gesture = g;
    this.gestureT = 0;
    if (worldTarget) this.target.copy(worldTarget);
    const m = this.eye.material as THREE.MeshStandardMaterial;
    m.emissive.setHex(EYE_COLORS[g]);
  }

  update(dt: number): void {
    this.t += dt;
    // idle hover
    this.group.position.y = this.baseY + Math.sin(this.t * 1.4) * 0.12;
    this.limbs.rotation.y = Math.sin(this.t * 0.5) * 0.15;

    const m = this.eye.material as THREE.MeshStandardMaterial;
    if (this.gesture) {
      this.gestureT += dt;
      const p = this.gestureT;
      switch (this.gesture) {
        case 'approve':
          this.group.position.y += Math.abs(Math.sin(p * 9)) * 0.35 * Math.max(0, 1 - p / 1.6);
          m.emissiveIntensity = 1.4 + Math.sin(p * 9) * 0.6;
          break;
        case 'agitate':
          this.group.position.x += Math.sin(p * 26) * 0.09 * Math.max(0, 1 - p / 1.4);
          m.emissiveIntensity = 1.8;
          break;
        case 'observe': {
          this.group.rotation.z = Math.sin(Math.min(p, 1) * Math.PI) * 0.18;
          m.emissiveIntensity = 1.1;
          break;
        }
        case 'demonstrate': {
          // lean and orient toward the target it wants the player to look at
          const dir = this.target.clone().sub(this.group.position);
          const yaw = Math.atan2(dir.x, dir.z);
          this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, yaw, Math.min(1, p * 2));
          this.group.rotation.x = Math.sin(Math.min(p, 1.4) * Math.PI / 1.4) * 0.22;
          m.emissiveIntensity = 1.4 + Math.sin(p * 6) * 0.8;
          break;
        }
      }
      if (this.gestureT > 2.2) {
        this.gesture = null;
        this.group.rotation.set(0, this.group.rotation.y, 0);
        m.emissive.setHex(EYE_COLORS.observe);
        m.emissiveIntensity = 1.2;
      }
    } else {
      m.emissiveIntensity = 1.0 + Math.sin(this.t * 2.2) * 0.25;
    }
  }
}

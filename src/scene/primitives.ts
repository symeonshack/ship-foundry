/**
 * Every mesh in the game is composed here from geometric primitives
 * (boxes, cylinders, spheres, cones, tori). No modeled or imported assets —
 * this is the v1 constraint; real .glb assets get swapped in behind these
 * factory functions later without touching game logic.
 */
import * as THREE from 'three';
import type { PartId } from '../building/partCatalog';
import type { RigType } from '../building/partCatalog';
import type { RawResourceId } from '../core/resources';
import { RESOURCES } from '../core/resources';
import type { EncounterModuleType } from '../core/state';
import { makeHeightField } from '../terrain/heightfield';

// ---- shared materials ----

interface MatOpts {
  rough?: number;
  metal?: number;
  emissive?: number;
  emissiveIntensity?: number;
  flat?: boolean;
  transparent?: boolean;
  opacity?: number;
}

export function mat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.8,
    metalness: o.metal ?? 0.25,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    flatShading: o.flat ?? false,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
}

const C = {
  hull: 0x5d707c,
  hullDark: 0x3a4750,
  frame: 0x2c363d,
  accent: 0x59d6ff,
  amber: 0xffb454,
  green: 0x7dffa8,
  red: 0xff5c5c,
  white: 0xd8e2e8,
  violet: 0xc98aff,
};

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}
function cyl(rt: number, rb: number, h: number, material: THREE.Material, seg = 12): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
}
function sph(r: number, material: THREE.Material, seg = 12): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material);
}
function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

// ---- ship parts (all extend along +Y from a base at y=0) ----

export function buildPartMesh(id: PartId): THREE.Group {
  const g = new THREE.Group();
  const hull = mat(C.hull, { flat: true });
  const haloMaterial = mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.45, metal: 0.6, rough: 0.35 });
  const dark = mat(C.hullDark);
  const frame = mat(C.frame);

  switch (id) {
    case 'hullS': {
      g.add(at(cyl(0.95, 1.05, 2.4, hull, 8), 0, 1.2, 0));
      g.add(at(cyl(1.08, 1.08, 0.18, frame, 8), 0, 0.35, 0));
      g.add(at(cyl(1.08, 1.08, 0.18, frame, 8), 0, 2.05, 0));
      g.add(at(box(0.5, 0.3, 0.25, dark), 0, 1.2, 0.95));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 8, 36), haloMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.2, 0);
      ring.name = 'hull-ring';
      g.add(ring);
      break;
    }
    case 'hullL': {
      g.add(at(cyl(1.2, 1.3, 3.6, hull, 8), 0, 1.8, 0));
      g.add(at(cyl(1.34, 1.34, 0.2, frame, 8), 0, 0.5, 0));
      g.add(at(cyl(1.34, 1.34, 0.2, frame, 8), 0, 1.8, 0));
      g.add(at(cyl(1.34, 1.34, 0.2, frame, 8), 0, 3.1, 0));
      g.add(at(box(0.6, 0.9, 0.2, dark), 0, 1.8, 1.22));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 8, 40), haloMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.8, 0);
      ring.name = 'hull-ring';
      g.add(ring);
      break;
    }
    case 'engine1': {
      g.add(at(box(0.5, 0.12, 0.5, frame), 0, 0.06, 0));
      g.add(at(cyl(0.3, 0.34, 0.55, dark), 0, 0.42, 0));
      const nozzle = at(cyl(0.48, 0.26, 0.5, mat(C.frame, { metal: 0.6, rough: 0.4 }), 14), 0, 0.95, 0);
      g.add(nozzle);
      const glow = at(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.2, 0.42, 14),
          mat(0x201510, { emissive: C.amber, emissiveIntensity: 0.0 }),
        ),
        0,
        0.96,
        0,
      );
      glow.name = 'glow';
      g.add(glow);
      break;
    }
    case 'engine2': {
      g.add(at(box(0.7, 0.14, 0.7, frame), 0, 0.07, 0));
      g.add(at(cyl(0.42, 0.46, 0.7, dark), 0, 0.55, 0));
      g.add(at(cyl(0.62, 0.34, 0.6, mat(C.frame, { metal: 0.6, rough: 0.4 }), 16), 0, 1.2, 0));
      const glow = at(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.52, 0.26, 0.5, 16),
          mat(0x201510, { emissive: C.amber, emissiveIntensity: 0.0 }),
        ),
        0,
        1.22,
        0,
      );
      glow.name = 'glow';
      g.add(glow);
      g.add(at(cyl(0.1, 0.1, 0.9, mat(C.violet, { emissive: C.violet, emissiveIntensity: 0.4 })), 0.4, 0.5, 0.4));
      break;
    }
    case 'tank': {
      g.add(at(cyl(0.45, 0.45, 0.85, mat(0x8a949c, { metal: 0.5, rough: 0.35 })), 0, 0.6, 0));
      g.add(at(sph(0.45, mat(0x8a949c, { metal: 0.5, rough: 0.35 })), 0, 1.03, 0));
      g.add(at(cyl(0.5, 0.5, 0.1, frame), 0, 0.18, 0));
      g.add(at(cyl(0.5, 0.5, 0.08, mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.25 })), 0, 0.6, 0));
      break;
    }
    case 'cargoPod': {
      g.add(at(box(0.95, 0.95, 0.95, mat(0x6d7a68, { flat: true })), 0, 0.55, 0));
      for (const [x, z] of [[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]] as const) {
        g.add(at(box(0.08, 1.05, 0.08, frame), x, 0.55, z));
      }
      g.add(at(box(1.0, 0.14, 1.0, mat(C.amber)), 0, 0.55, 0));
      break;
    }
    case 'lifeSupport': {
      g.add(at(box(0.85, 0.7, 0.85, mat(0x7b8894)), 0, 0.4, 0));
      g.add(at(sph(0.32, mat(0x2a3c34, { emissive: C.green, emissiveIntensity: 0.5 })), 0, 0.88, 0));
      g.add(at(cyl(0.06, 0.06, 0.7, dark), 0.32, 0.45, 0.44));
      g.add(at(cyl(0.06, 0.06, 0.7, dark), -0.32, 0.45, 0.44));
      break;
    }
    case 'sensor1': {
      g.add(at(cyl(0.18, 0.24, 0.18, frame), 0, 0.09, 0));
      g.add(at(cyl(0.05, 0.05, 0.55, dark), 0, 0.4, 0));
      const dish = at(cyl(0.34, 0.05, 0.2, mat(C.white, { metal: 0.4, rough: 0.5 }), 14), 0, 0.75, 0);
      g.add(dish);
      g.add(at(sph(0.06, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.8 })), 0, 0.88, 0));
      break;
    }
    case 'sensor2': {
      g.add(at(cyl(0.22, 0.28, 0.2, frame), 0, 0.1, 0));
      g.add(at(cyl(0.06, 0.06, 0.9, dark), 0, 0.6, 0));
      g.add(at(cyl(0.42, 0.06, 0.24, mat(C.white, { metal: 0.4, rough: 0.5 }), 14), 0, 1.05, 0));
      const oct = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16),
        mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.9 }),
      );
      g.add(at(oct, 0, 1.3, 0));
      g.add(at(cyl(0.2, 0.04, 0.14, mat(C.white, { metal: 0.4 }), 10), 0.3, 0.55, 0));
      break;
    }
    case 'radShield': {
      for (let i = 0; i < 3; i++) {
        g.add(at(box(1.15 - i * 0.12, 0.11, 1.15 - i * 0.12, mat(0x4a5d52, { flat: true })), 0, 0.1 + i * 0.17, 0));
      }
      g.add(at(sph(0.09, mat(C.green, { emissive: C.green, emissiveIntensity: 0.8 })), 0, 0.62, 0));
      break;
    }
    case 'thermalShield': {
      for (let i = 0; i < 3; i++) {
        g.add(at(box(1.1 - i * 0.1, 0.1, 1.1 - i * 0.1, mat(0x8a7a5c, { flat: true })), 0, 0.1 + i * 0.16, 0));
      }
      g.add(at(sph(0.09, mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.8 })), 0, 0.58, 0));
      break;
    }
    case 'drillRig': {
      g.add(at(box(0.85, 0.4, 0.85, mat(0x8c6f4f, { flat: true })), 0, 0.25, 0));
      const drill = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 8), mat(0x9aa4ac, { metal: 0.6, rough: 0.35 }));
      drill.rotation.z = Math.PI / 2;
      g.add(at(drill, 0.1, 0.62, 0));
      g.add(at(box(0.3, 0.3, 0.3, dark), -0.25, 0.6, 0));
      break;
    }
    case 'cryoRig': {
      g.add(at(box(0.85, 0.35, 0.85, mat(0x5c7c8a, { flat: true })), 0, 0.22, 0));
      g.add(at(sph(0.28, mat(0xbfe2f2, { metal: 0.3, rough: 0.3 })), -0.22, 0.62, 0));
      g.add(at(sph(0.22, mat(0xbfe2f2, { metal: 0.3, rough: 0.3 })), 0.26, 0.56, 0));
      g.add(at(cyl(0.05, 0.05, 0.5, dark), 0, 0.45, 0.3));
      break;
    }
    case 'refineryMk2': {
      g.add(at(box(1.2, 0.8, 1.2, mat(0x7a6a56, { flat: true })), 0, 0.4, 0));
      g.add(at(cyl(0.2, 0.2, 1.0, dark), 0.35, 1.0, 0.35));
      break;
    }
  }
  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  return g;
}

// ---- deployed mining rigs ----

export function buildRigDeployed(type: RigType): THREE.Group {
  const g = new THREE.Group();
  const dark = mat(C.hullDark);
  // tripod
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.06, 0.06, 1.5, dark);
    leg.position.set(Math.cos(a) * 0.55, 0.6, Math.sin(a) * 0.55);
    leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    g.add(leg);
  }
  if (type === 'drill') {
    g.add(at(box(0.7, 0.35, 0.7, mat(0x8c6f4f, { flat: true })), 0, 1.25, 0));
    const spin = new THREE.Group();
    spin.name = 'spin';
    const bit = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 8), mat(0x9aa4ac, { metal: 0.6, rough: 0.3 }));
    bit.rotation.x = Math.PI;
    bit.position.y = 0.55;
    spin.add(bit);
    g.add(spin);
    g.add(at(box(0.34, 0.34, 0.34, mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.2 })), 0.45, 1.55, 0));
  } else {
    g.add(at(cyl(0.32, 0.38, 0.9, mat(0x5c7c8a, { flat: true })), 0, 1.35, 0));
    const spin = new THREE.Group();
    spin.name = 'spin';
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 20), mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.5 }));
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.9;
    spin.add(coil);
    g.add(spin);
    g.add(at(sph(0.3, mat(0xbfe2f2, { metal: 0.3, rough: 0.3 })), -0.5, 1.5, 0));
  }
  // integrity lamp
  const lamp = sph(0.09, mat(C.green, { emissive: C.green, emissiveIntensity: 1 }));
  lamp.name = 'lamp';
  lamp.position.set(0, 1.9, 0);
  g.add(lamp);
  return g;
}

// ---- surface props ----

export function buildDepositNode(resource: RawResourceId): THREE.Group {
  const g = new THREE.Group();
  const color = RESOURCES[resource].color;
  const m = mat(color, { flat: true, emissive: color, emissiveIntensity: 0.12, rough: 0.55 });
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.5;
    const h = 0.5 + Math.random() * 0.9;
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.16 + Math.random() * 0.14, h, 5), m);
    crystal.position.set(Math.cos(a) * r, h * 0.42, Math.sin(a) * r);
    crystal.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    g.add(crystal);
  }
  return g;
}

export function buildRock(rand: () => number): THREE.Mesh {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4 + rand() * 1.1, 0),
    mat(0x55504a, { flat: true, rough: 0.95, metal: 0.05 }),
  );
  rock.scale.set(0.7 + rand() * 0.8, 0.5 + rand() * 0.6, 0.7 + rand() * 0.8);
  rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
  return rock;
}

export function buildLander(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(cyl(0.9, 1.1, 0.9, mat(C.hull, { flat: true }), 8), 0, 1.0, 0));
  g.add(at(cyl(0.5, 0.7, 0.5, mat(C.hullDark), 8), 0, 1.7, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.06, 0.06, 1.2, mat(C.frame));
    leg.position.set(Math.cos(a) * 1.1, 0.45, Math.sin(a) * 1.1);
    leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leg);
    g.add(at(cyl(0.18, 0.22, 0.08, mat(C.frame)), Math.cos(a) * 1.38, 0.04, Math.sin(a) * 1.38));
  }
  g.add(at(cyl(0.03, 0.03, 0.9, mat(C.frame)), 0.3, 2.4, 0));
  g.add(at(sph(0.06, mat(C.accent, { emissive: C.accent, emissiveIntensity: 1 })), 0.3, 2.9, 0));
  return g;
}

/** foundry base: crashed deployment platform + refinery stack */
export function buildFoundryBase(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(6, 0.5, 5, mat(0x4a545c, { flat: true })), 0, 0.25, 0));
  g.add(at(box(2.2, 1.6, 2.0, mat(C.hull, { flat: true })), -1.5, 1.3, -0.8));
  g.add(at(cyl(0.5, 0.5, 2.6, mat(0x7a6a56, { flat: true })), 1.6, 1.8, -1.2));
  g.add(at(cyl(0.34, 0.5, 0.8, mat(C.frame)), 1.6, 3.4, -1.2));
  const glow = at(sph(0.12, mat(C.amber, { emissive: C.amber, emissiveIntensity: 1 })), 1.6, 3.9, -1.2);
  glow.name = 'refinery-lamp';
  g.add(glow);
  g.add(at(box(1.4, 0.9, 1.2, mat(0x6d7a68, { flat: true })), 1.4, 0.95, 1.2));
  // bent solar mast — evidence of the rough landing
  const mast = at(cyl(0.06, 0.06, 2.4, mat(C.frame)), -2.4, 1.4, 1.4);
  mast.rotation.z = 0.5;
  g.add(mast);
  g.add(at(box(1.6, 0.05, 0.9, mat(0x2c4a6e, { metal: 0.6, rough: 0.3 })), -3.1, 2.3, 1.4));
  return g;
}

export function buildMonolith(variant: number): THREE.Group {
  const g = new THREE.Group();
  const body = mat(0x1c2226, { rough: 0.4, metal: 0.7 });
  const seam = mat(0x0e1a1e, { emissive: 0x2a6a5a, emissiveIntensity: 0.6 });
  if (variant % 3 === 0) {
    g.add(at(box(1.2, 6 + (variant % 5), 1.2, body), 0, 3 + (variant % 5) / 2, 0));
    g.add(at(box(1.26, 0.12, 1.26, seam), 0, 2 + (variant % 3), 0));
    g.add(at(box(1.26, 0.12, 1.26, seam), 0, 4 + (variant % 3), 0));
  } else if (variant % 3 === 1) {
    g.add(at(cyl(0.5, 0.9, 5 + (variant % 4), body, 6), 0, 2.5, 0));
    g.add(at(cyl(0.95, 0.95, 0.15, seam, 6), 0, 1.4, 0));
  } else {
    const arch = at(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 6, 16, Math.PI), body), 0, 0.2, 0);
    g.add(arch);
    g.add(at(sph(0.2, seam), 0, 2.6, 0));
  }
  return g;
}

// ---- Landing Zone structures ----

/** scale an RGB hex toward black by factor f (0..1) — used for damage tinting */
function scaleColor(hex: number, f: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * f);
  const gc = Math.round(((hex >> 8) & 0xff) * f);
  const b = Math.round((hex & 0xff) * f);
  return (r << 16) | (gc << 8) | b;
}

/**
 * Placeholder structure body with AoE-style scaffolding stages — the model
 * visibly steps through construction instead of popping in finished:
 *   0 foundation slab → 1 corner frame → 2 half-built shell → 3 finished.
 * A finished building (stage 3) also shows progressive battle damage via
 * `damage`: 0 pristine → 1 scorched/dimmed → 2 buckled with a knocked-off
 * corner and its power light out. Every structure renders through this until
 * its bespoke builder lands with its Part III phase (buildSiloMesh etc.) —
 * selection, placement, and damage systems are built against real meshes from
 * day one this way.
 */
export function buildStructurePlaceholder(
  w: number,
  d: number,
  color: number,
  stage: 0 | 1 | 2 | 3 = 3,
  damage: 0 | 1 | 2 = 0,
): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  const scorch = mat(0x15130f, { flat: true, rough: 1 });
  // stage 0+: the foundation slab (collision is locked from placement on)
  g.add(at(box(w, 0.25, d, frame), 0, 0.125, 0));
  if (stage >= 1) {
    // corner frame columns
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      g.add(at(box(0.12, 1.2, 0.12, frame), sx * (w * 0.35 - 0.06), 0.85, sz * (d * 0.35 - 0.06)));
    }
  }
  if (stage === 2) {
    // half-built shell: lower body only, still showing frame above
    const shell = mat(color, { flat: true, rough: 0.7, metal: 0.3, transparent: true, opacity: 0.8 });
    g.add(at(box(w * 0.7, 0.55, d * 0.7, shell), 0, 0.52, 0));
  }
  if (stage >= 3) {
    const bodyColor = damage === 0 ? color : damage === 1 ? scaleColor(color, 0.66) : scaleColor(color, 0.44);
    const body = mat(bodyColor, { flat: true, rough: damage ? 0.9 : 0.7, metal: 0.3 });
    const bodyMesh = at(box(w * 0.7, 1.1, d * 0.7, body), 0, 0.8, 0);
    if (damage === 2) bodyMesh.rotation.z = 0.14; // buckled
    g.add(bodyMesh);
    // power light: bright when pristine, dim when damaged, dark when heavy
    if (damage < 2) {
      g.add(
        at(
          sph(0.09, mat(color, { emissive: color, emissiveIntensity: damage === 0 ? 0.8 : 0.22 })),
          w * 0.28,
          1.5,
          d * 0.28,
        ),
      );
    }
    if (damage >= 1) {
      // scorch scar across the roof
      g.add(at(box(w * 0.32, 0.06, d * 0.26, scorch), -w * 0.14, 1.36, d * 0.09));
    }
    if (damage >= 2) {
      // corner blown out: exposed frame stub + a fallen chunk of hull
      g.add(at(box(0.12, 0.7, 0.12, frame), w * 0.3, 0.7, d * 0.3));
      const chunk = at(box(w * 0.26, 0.4, d * 0.26, mat(scaleColor(color, 0.44), { flat: true })), w * 0.2, 0.24, -d * 0.24);
      chunk.rotation.set(0.3, 0.5, 0.2);
      g.add(chunk);
      g.add(at(box(w * 0.34, 0.06, d * 0.3, scorch), w * 0.1, 1.36, -d * 0.12));
    }
  }
  return g;
}

/**
 * Bespoke finished-structure bodies — distinct silhouettes for the completed,
 * undamaged look. BaseView uses these only for `active` + pristine structures;
 * construction scaffolds and battle damage fall back to the generic staged
 * placeholder above. Each sits on the same foundation slab as the placeholder
 * so the two read as the same object at different life stages.
 */
export function buildSiloMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  g.add(at(box(w, 0.25, d, frame), 0, 0.125, 0));
  const tank = mat(color, { flat: true, rough: 0.6, metal: 0.4 });
  const r = Math.min(w, d) * 0.22;
  for (const sx of [-0.28, 0.28] as const) {
    g.add(at(cyl(r, r, 1.3, tank, 12), w * sx, 0.9, 0));
    g.add(at(sph(r, tank, 12), w * sx, 1.55, 0));
  }
  g.add(at(box(w * 0.9, 0.12, 0.2, frame), 0, 1.0, 0));
  g.add(at(sph(0.08, mat(color, { emissive: color, emissiveIntensity: 0.8 })), w * 0.36, 1.7, d * 0.3));
  return g;
}

export function buildSolarArrayMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  g.add(at(box(w, 0.25, d, frame), 0, 0.125, 0));
  const panelMat = mat(0x2c4a6e, { metal: 0.6, rough: 0.3 });
  for (const sx of [-0.25, 0.25] as const) {
    g.add(at(cyl(0.05, 0.05, 0.6, frame, 6), w * sx, 0.4, 0));
    const panel = at(box(w * 0.42, 0.06, d * 0.72, panelMat), w * sx, 0.78, 0);
    panel.rotation.x = -0.5;
    g.add(panel);
  }
  g.add(at(sph(0.08, mat(color, { emissive: color, emissiveIntensity: 0.7 })), w * 0.4, 0.5, d * 0.38));
  return g;
}

export function buildRelayMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  g.add(at(box(w, 0.25, d, frame), 0, 0.125, 0));
  g.add(at(box(w * 0.6, 0.6, d * 0.6, mat(color, { flat: true, rough: 0.7, metal: 0.4 })), 0, 0.5, 0));
  g.add(at(cyl(0.05, 0.07, 2.4, frame, 6), 0, 1.9, 0));
  for (const y of [1.5, 2.1, 2.7]) g.add(at(box(0.9, 0.05, 0.05, frame), 0, y, 0));
  const tip = at(sph(0.1, mat(color, { emissive: color, emissiveIntensity: 1 })), 0, 3.1, 0);
  tip.name = 'beacon';
  g.add(tip);
  return g;
}

export function buildRefineryMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  g.add(at(box(w, 0.25, d, frame), 0, 0.125, 0));
  g.add(at(box(w * 0.75, 0.9, d * 0.7, mat(color, { flat: true, rough: 0.8, metal: 0.3 })), 0, 0.7, 0));
  // chimney stack
  g.add(at(cyl(0.22, 0.26, 1.4, mat(0x7a6a56, { flat: true }), 10), w * 0.28, 1.4, -d * 0.2));
  g.add(at(cyl(0.16, 0.24, 0.4, frame, 10), w * 0.28, 2.2, -d * 0.2));
  // holding tank
  g.add(at(cyl(0.3, 0.3, 0.7, mat(0x8a949c, { metal: 0.5 }), 12), -w * 0.28, 0.6, d * 0.22));
  g.add(at(sph(0.3, mat(0x8a949c, { metal: 0.5 }), 12), -w * 0.28, 0.95, d * 0.22));
  g.add(at(sph(0.09, mat(color, { emissive: color, emissiveIntensity: 0.7 })), w * 0.3, 1.3, d * 0.28));
  return g;
}

/**
 * A ruined structure: a scorched patch with scattered debris chunks and a
 * couple of leaning skeletal frame remnants. Pass a seeded rand so a given
 * wreck looks the same every time the scene rebuilds.
 */
export function buildStructureRubble(w: number, d: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const debris = mat(0x33383d, { flat: true, rough: 0.95, metal: 0.1 });
  const frame = mat(C.frame, { flat: true });
  const scorch = mat(0x15130f, { flat: true, rough: 1 });
  g.add(at(box(w * 0.95, 0.05, d * 0.95, scorch), 0, 0.03, 0));
  const n = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const bw = 0.3 + rand() * 0.6;
    const bh = 0.12 + rand() * 0.35;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.3 + rand() * 0.6), i % 3 === 0 ? frame : debris);
    chunk.position.set((rand() - 0.5) * w * 0.8, bh * 0.5 + 0.05, (rand() - 0.5) * d * 0.8);
    chunk.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.6);
    g.add(chunk);
  }
  for (const sx of [-1, 1] as const) {
    const col = at(box(0.1, 0.6 + rand() * 0.4, 0.1, frame), sx * w * 0.22, 0.35, (rand() - 0.5) * d * 0.4);
    col.rotation.z = sx * (0.3 + rand() * 0.3);
    g.add(col);
  }
  return g;
}

/**
 * Placement ghost: a translucent footprint volume + edge outline that follows
 * the cursor while a structure is armed. BaseView retints the named children
 * (`ghost-fill`, `ghost-edge`) green/red as validity changes.
 */
export function buildStructureGhost(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(w, 1.1, d),
    mat(C.green, { transparent: true, opacity: 0.28, emissive: C.green, emissiveIntensity: 0.5 }),
  );
  fill.position.y = 0.55;
  fill.name = 'ghost-fill';
  g.add(fill);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 1.1, d)),
    new THREE.LineBasicMaterial({ color: C.green, transparent: true, opacity: 0.9 }),
  );
  edge.position.y = 0.55;
  edge.name = 'ghost-edge';
  g.add(edge);
  return g;
}

/** flat ring marking a selected structure/unit — translucent while under
 * construction, solid once complete (the classic RTS selection-ring tell) */
export function buildSelectionRing(radius: number, solid = true): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.09, 8, 36),
    mat(C.accent, {
      emissive: C.accent,
      emissiveIntensity: solid ? 0.9 : 0.5,
      transparent: !solid,
      opacity: solid ? 1 : 0.45,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

// ---- site landmarks (Phase 3: distinct regions worth finding) ----

export type SiteLandmarkKind = 'spires' | 'crater' | 'wreck' | 'vent';

export function buildLandmark(kind: SiteLandmarkKind, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const dark = mat(C.hullDark);
  switch (kind) {
    case 'spires': {
      const rock = mat(0x4c463e, { flat: true, rough: 0.95, metal: 0.05 });
      const n = 5 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * 4;
        const h = 3 + rand() * 4.5;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rand() * 0.7, h, 5), rock);
        spire.position.set(Math.cos(a) * r, h * 0.42, Math.sin(a) * r);
        spire.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
        g.add(spire);
      }
      break;
    }
    case 'crater': {
      // raised rim of tumbled boulders around a scorched center
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rand() * 0.3;
        const r = 5 + rand() * 2;
        const boulder = buildRock(rand);
        boulder.scale.multiplyScalar(1.15);
        boulder.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
        g.add(boulder);
      }
      const scorch = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.8, 0.5, 18),
        mat(0x1f1c18, { flat: true, rough: 1, metal: 0 }),
      );
      scorch.position.y = 0.05;
      g.add(scorch);
      break;
    }
    case 'wreck': {
      // human-made debris, half-buried — a story hook without a story yet
      const plate = at(box(3.2, 0.18, 1.8, mat(C.hull, { flat: true, rough: 0.7 })), -0.8, 0.5, 0);
      plate.rotation.set(0.35, rand() * Math.PI, 0.5);
      g.add(plate);
      const drum = cyl(0.55, 0.55, 2.6, mat(0x4a545c, { flat: true }));
      drum.rotation.set(Math.PI / 2 - 0.25, 0, rand());
      drum.position.set(1.3, 0.45, 0.8);
      g.add(drum);
      g.add(at(box(0.8, 0.8, 0.8, mat(0x6d7a68, { flat: true })), 0.4, 0.35, -1.3));
      g.add(at(cyl(0.05, 0.05, 1.8, dark), -1.7, 0.9, 1.1));
      const beacon = at(sph(0.09, mat(C.amber, { emissive: C.amber, emissiveIntensity: 1 })), -1.7, 1.85, 1.1);
      beacon.name = 'beacon';
      g.add(beacon);
      break;
    }
    case 'vent': {
      const crust = mat(0x3a3f38, { flat: true, rough: 0.95 });
      for (let i = 0; i < 5; i++) {
        const a = rand() * Math.PI * 2;
        const r = 0.6 + rand() * 1.6;
        const lip = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rand() * 0.4, 1.1 + rand() * 0.9, 6), crust);
        lip.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
        lip.rotation.set((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
        g.add(lip);
      }
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 0.35, 12),
        mat(0x9adf9a, { emissive: 0x4a9a5a, emissiveIntensity: 0.8, transparent: true, opacity: 0.55 }),
      );
      glow.name = 'vent-glow';
      glow.position.y = 0.2;
      g.add(glow);
      break;
    }
  }
  return g;
}

// ---- collaborator creature ----

export function buildCollaborator(): THREE.Group {
  const g = new THREE.Group();
  const shell = mat(0x8a93b8, { flat: true, rough: 0.5, metal: 0.4 });
  const core = sph(0.55, shell);
  core.name = 'body';
  core.position.y = 1.1;
  g.add(core);
  g.add(at(sph(0.4, shell), 0, 1.75, 0));
  const head = at(sph(0.28, shell), 0, 2.25, 0);
  g.add(head);
  const eye = sph(0.12, mat(0xffffff, { emissive: 0x7dffa8, emissiveIntensity: 1.2 }));
  eye.name = 'eye';
  eye.position.set(0, 2.28, 0.22);
  g.add(eye);
  // radial limbs — deliberately ambiguous between grown and made
  const limbs = new THREE.Group();
  limbs.name = 'limbs';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const limb = cyl(0.05, 0.08, 1.3, mat(0x6a7396, { rough: 0.5 }));
    limb.position.set(Math.cos(a) * 0.7, 0.85, Math.sin(a) * 0.7);
    limb.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    limbs.add(limb);
  }
  g.add(limbs);
  return g;
}

// ---- the Custodian (obstructive agent — heavy, slow, amber; contrast to the collaborator) ----

export function buildCustodian(): THREE.Group {
  const g = new THREE.Group();
  const shell = mat(0x4a4238, { flat: true, rough: 0.6, metal: 0.5 });
  const trimMat = mat(0x2c2620, { rough: 0.7 });
  // broad, planted torso — built to stand in doorways
  g.add(at(box(1.25, 1.3, 0.9, shell), 0, 1.05, 0));
  g.add(at(box(1.45, 0.35, 1.05, trimMat), 0, 0.45, 0));
  g.add(at(cyl(0.55, 0.65, 0.35, trimMat, 8), 0, 0.18, 0));
  // shoulder plates
  g.add(at(box(0.35, 0.8, 0.95, trimMat), -0.85, 1.15, 0));
  g.add(at(box(0.35, 0.8, 0.95, trimMat), 0.85, 1.15, 0));
  // low dome head with a single amber eye
  g.add(at(sph(0.42, shell, 10), 0, 1.95, 0));
  const eye = sph(0.11, mat(0xffffff, { emissive: 0xffb454, emissiveIntensity: 1.2 }));
  eye.name = 'eye';
  eye.position.set(0, 1.98, 0.4);
  g.add(eye);
  // chest strip — pulses with its mood
  const strip = at(box(0.7, 0.12, 0.06, mat(0x201a12, { emissive: 0xffb454, emissiveIntensity: 0.5 })), 0, 1.25, 0.48);
  strip.name = 'strip';
  g.add(strip);
  return g;
}

// ---- Archive structure props ----

export function buildStructureDoor(w: number, sealed: boolean): THREE.Group {
  const g = new THREE.Group();
  const door = at(box(w, 2.6, 0.25, mat(0x3a4750, { metal: 0.5, rough: 0.5 })), 0, 1.3, 0);
  door.name = 'door-panel';
  g.add(door);
  const lamp = at(box(w * 0.8, 0.12, 0.3, mat(sealed ? 0xff5c5c : 0x7dffa8, { emissive: sealed ? 0xff5c5c : 0x7dffa8, emissiveIntensity: 0.7 })), 0, 2.75, 0);
  lamp.name = 'door-lamp';
  g.add(lamp);
  return g;
}

export function buildStructureProp(kind: 'panel' | 'item' | 'log' | 'console' | 'pedestal' | 'bench', meta?: string): THREE.Group {
  const g = new THREE.Group();
  const dark = mat(0x1c2226, { rough: 0.5, metal: 0.6 });
  const seam = mat(0x0e1a1e, { emissive: 0x2a6a5a, emissiveIntensity: 0.6 });
  switch (kind) {
    case 'panel':
      g.add(at(box(0.15, 1.0, 1.2, dark), 0, 1.3, 0));
      g.add(at(box(0.18, 0.08, 1.0, seam), 0, 1.75, 0));
      break;
    case 'item': {
      g.add(at(cyl(0.4, 0.45, 0.5, dark, 8), 0, 0.25, 0));
      const item =
        meta === 'powerCell'
          ? at(cyl(0.14, 0.14, 0.4, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.7 })), 0, 0.72, 0)
          : at(box(0.5, 0.16, 0.28, mat(0x8a949c, { metal: 0.6, rough: 0.4 })), 0, 0.6, 0);
      item.name = 'item-mesh';
      g.add(item);
      break;
    }
    case 'log':
      g.add(at(box(0.12, 0.9, 1.4, mat(0x11181c, { rough: 0.35, metal: 0.7 })), 0, 1.5, 0));
      g.add(at(box(0.15, 0.6, 1.1, seam), 0, 1.5, 0));
      break;
    case 'console':
      g.add(at(box(1.4, 0.9, 0.6, dark), 0, 0.45, 0));
      g.add(at(box(1.2, 0.5, 0.1, mat(0x0c2a26, { emissive: 0x2a6a5a, emissiveIntensity: 0.8 })), 0, 1.15, 0.15));
      g.add(at(cyl(0.06, 0.06, 0.5, dark), -0.5, 1.0, 0.1));
      break;
    case 'pedestal': {
      g.add(at(cyl(0.5, 0.65, 1.1, dark, 8), 0, 0.55, 0));
      const fragment = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), mat(0x7dffa8, { emissive: 0x7dffa8, emissiveIntensity: 1.0, flat: true }));
      fragment.name = 'fragment';
      fragment.position.y = 1.5;
      g.add(fragment);
      break;
    }
    case 'bench':
      g.add(at(box(1.6, 0.12, 0.8, mat(0x39454d, { metal: 0.4 })), 0, 0.95, 0));
      g.add(at(box(0.14, 0.95, 0.7, dark), -0.65, 0.47, 0));
      g.add(at(box(0.14, 0.95, 0.7, dark), 0.65, 0.47, 0));
      g.add(at(box(0.3, 0.1, 0.2, mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.4 })), 0.4, 1.05, 0.15));
      break;
  }
  return g;
}

// ---- encounter structure pieces ----

export function buildEncounterModule(type: EncounterModuleType): THREE.Group {
  const g = new THREE.Group();
  switch (type) {
    case 'strut':
      g.add(at(box(0.5, 1.0, 0.5, mat(0x707a82, { flat: true })), 0, 0.5, 0));
      break;
    case 'conduit': {
      g.add(at(cyl(0.28, 0.34, 0.9, mat(0x39454d)), 0, 0.45, 0));
      const line = at(cyl(0.1, 0.1, 0.95, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.7 })), 0, 0.46, 0);
      line.name = 'power';
      g.add(line);
      break;
    }
    case 'emitter': {
      g.add(at(cyl(0.34, 0.4, 0.5, mat(0x39454d)), 0, 0.25, 0));
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 8), mat(0x707a82, { flat: true })), 0, 0.85, 0));
      const tip = at(sph(0.12, mat(C.amber, { emissive: C.amber, emissiveIntensity: 1 })), 0, 1.25, 0);
      tip.name = 'power';
      g.add(tip);
      break;
    }
    case 'damper': {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(0x23282e, { rough: 0.9, metal: 0.1 }),
      );
      g.add(dome);
      g.add(at(cyl(0.48, 0.48, 0.1, mat(0x39454d)), 0, 0.05, 0));
      break;
    }
  }
  return g;
}

export function buildStructureCore(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(cyl(0.7, 0.9, 0.4, mat(0x2c363d)), 0, 0.2, 0));
  g.add(at(cyl(0.4, 0.5, 1.6, mat(0x4a545c, { flat: true }), 6), 0, 1.1, 0));
  const heart = sph(0.3, mat(0x101418, { emissive: 0x223038, emissiveIntensity: 1 }));
  heart.name = 'heart';
  heart.position.y = 2.1;
  g.add(heart);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), mat(0x39454d, { metal: 0.6 }));
  ring.name = 'ring';
  ring.position.y = 2.1;
  g.add(ring);
  return g;
}

export function buildTerminal(owner: 'player' | 'collaborator'): THREE.Group {
  const g = new THREE.Group();
  const color = owner === 'player' ? C.accent : C.green;
  g.add(at(cyl(0.4, 0.5, 0.7, mat(0x39454d)), 0, 0.35, 0));
  const top = at(cyl(0.3, 0.3, 0.16, mat(color, { emissive: color, emissiveIntensity: 0.8 })), 0, 0.78, 0);
  top.name = 'lamp';
  g.add(top);
  return g;
}

/**
 * Socket marker: a faint clickable disc (so clicks in the middle land) with a
 * bright ring on top. Faces +Z natively — rotate X by -π/2 to face up/outward
 * along a socket's +Y.
 */
export function buildSocketMarker(color = C.accent): THREE.Mesh {
  const discMat = mat(color, { emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.2 });
  discMat.side = THREE.DoubleSide;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), discMat);
  disc.name = 'socket-marker';
  const ringMat = mat(color, { emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 });
  ringMat.side = THREE.DoubleSide;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 24), ringMat);
  ring.name = 'socket-marker';
  disc.add(ring);
  // beacon orb so the socket reads from any camera angle, even edge-on or occluded
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), mat(color, { emissive: color, emissiveIntensity: 1.4 }));
  orb.name = 'socket-marker';
  orb.position.z = 0.16;
  disc.add(orb);
  return disc;
}

// ---- ship interior (Phase 1: one fixed core room, independent of exterior build) ----

import type { Collider } from '../interior/playerController';
import { POIS } from '../exploration/starSystem';

export interface InteriorHotspot {
  id: 'starmap' | 'gerty' | 'exit';
  label: string;
  x: number;
  z: number;
}

export interface ShipInterior {
  group: THREE.Group;
  colliders: Collider[];
  hotspots: InteriorHotspot[];
}

export function buildShipInterior(): ShipInterior {
  const g = new THREE.Group();
  const W = 8;
  const H = 3;
  const L = 10;
  const hx = W / 2;
  const hz = L / 2;

  const wall = mat(0x2e3a42, { rough: 0.85, metal: 0.3 });
  const deck = mat(0x232b31, { rough: 0.9, metal: 0.2 });
  const trim = mat(0x1c242a, { rough: 0.8 });

  g.add(at(box(W, 0.2, L, deck), 0, -0.1, 0));
  g.add(at(box(W, 0.2, L, trim), 0, H + 0.1, 0));
  // front wall (window end) and side walls
  g.add(at(box(W, H, 0.2, wall), 0, H / 2, -hz - 0.1));
  g.add(at(box(0.2, H, L, wall), -hx - 0.1, H / 2, 0));
  g.add(at(box(0.2, H, L, wall), hx + 0.1, H / 2, 0));
  // rear wall split around the hatch
  const segW = (W - 1.5) / 2;
  g.add(at(box(segW, H, 0.2, wall), -(0.75 + segW / 2), H / 2, hz + 0.1));
  g.add(at(box(segW, H, 0.2, wall), 0.75 + segW / 2, H / 2, hz + 0.1));
  g.add(at(box(1.5, H - 2.4, 0.2, wall), 0, 2.4 + (H - 2.4) / 2, hz + 0.1));
  // structural ribs
  for (let z = -4; z <= 4; z += 2) {
    g.add(at(box(0.08, H, 0.3, trim), -hx + 0.06, H / 2, z));
    g.add(at(box(0.08, H, 0.3, trim), hx - 0.06, H / 2, z));
  }
  // ceiling light bars
  for (const x of [-1.5, 1.5]) {
    g.add(at(box(0.35, 0.06, 6, mat(0xdfeaf2, { emissive: 0xcfe0ec, emissiveIntensity: 0.9 })), x, H - 0.04, 0));
  }
  // overhead pipes
  for (const x of [-(hx - 0.35), hx - 0.35]) {
    const pipe = cyl(0.07, 0.07, L - 0.6, mat(0x39454d, { metal: 0.5 }));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, H - 0.25, 0);
    g.add(pipe);
  }

  // cockpit window: frame + starfield pane
  g.add(at(box(3.4, 1.6, 0.12, trim), 0, 1.7, -hz + 0.03));
  g.add(at(box(3.1, 1.3, 0.06, mat(0x060b12, { emissive: 0x0b1624, emissiveIntensity: 0.9 })), 0, 1.7, -hz + 0.08));
  const paneRand = mulberry32(77);
  for (let i = 0; i < 16; i++) {
    g.add(
      at(
        sph(0.018, mat(0xffffff, { emissive: 0xdfeaf2, emissiveIntensity: 1.2 }), 6),
        (paneRand() - 0.5) * 2.9,
        1.7 + (paneRand() - 0.5) * 1.1,
        -hz + 0.12,
      ),
    );
  }

  // star-map table with a live miniature of the system
  g.add(at(cyl(0.45, 0.55, 0.9, mat(0x39454d, { metal: 0.4 })), 0, 0.45, -2.5));
  g.add(at(cyl(1.05, 1.05, 0.1, trim), 0, 0.95, -2.5));
  g.add(
    at(
      cyl(0.95, 0.95, 0.03, mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.35 })),
      0,
      1.02,
      -2.5,
    ),
  );
  const holo = new THREE.Group();
  holo.name = 'holo';
  holo.position.set(0, 1.14, -2.5);
  const SCALE = 1 / 52;
  for (const def of Object.values(POIS)) {
    const orb = sph(def.kind === 'planet' ? 0.08 : def.kind === 'home' ? 0.06 : 0.045, mat(def.color, { emissive: def.color, emissiveIntensity: 0.8 }), 8);
    orb.position.set(def.pos[0] * SCALE, 0.06, def.pos[1] * SCALE);
    holo.add(orb);
  }
  g.add(holo);

  // GERTY console on the starboard wall: frame, screen, lens
  g.add(at(box(0.15, 1.7, 1.6, trim), hx - 0.08, 1.5, -0.5));
  const screen = at(box(0.07, 0.75, 1.05, mat(0x0c2a26, { emissive: 0x1f6a5a, emissiveIntensity: 0.6 })), hx - 0.18, 1.7, -0.5);
  screen.name = 'gerty-screen';
  g.add(screen);
  const eye = at(sph(0.08, mat(0xffffff, { emissive: 0x7dffa8, emissiveIntensity: 1.1 }), 10), hx - 0.2, 2.42, -0.5);
  eye.name = 'gerty-eye';
  g.add(eye);
  g.add(at(box(0.45, 0.07, 1.3, trim), hx - 0.35, 1.0, -0.5));

  // rear hatch
  const door = at(box(1.4, 2.35, 0.15, mat(0x39454d, { metal: 0.4 })), 0, 1.18, hz + 0.02);
  door.name = 'hatch-door';
  g.add(door);
  g.add(at(box(1.4, 0.16, 0.16, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.4 })), 0, 1.95, hz));
  g.add(at(box(0.28, 0.38, 0.1, mat(0x1c242a, { emissive: 0x59d6ff, emissiveIntensity: 0.35 })), 0.95, 1.35, hz + 0.02));

  // bunk + crates for density
  g.add(at(box(1.1, 0.45, 2.0, mat(0x3f4c56)), -3.35, 0.3, 3.4));
  g.add(at(box(0.5, 0.14, 0.7, mat(0x8a949c)), -3.35, 0.6, 2.7));
  g.add(at(box(0.75, 0.75, 0.75, mat(0x6d7a68, { flat: true })), -3.3, 0.38, -3.8));
  const crate2 = at(box(0.65, 0.65, 0.65, mat(0x7a6a56, { flat: true })), 2.9, 0.33, 3.9);
  crate2.rotation.y = 0.4;
  g.add(crate2);

  const colliders: Collider[] = [
    { minX: -hx, maxX: hx, minZ: -hz - 1, maxZ: -hz + 0.15 },
    { minX: -hx, maxX: hx, minZ: hz - 0.15, maxZ: hz + 1 },
    { minX: -hx - 1, maxX: -hx + 0.15, minZ: -hz, maxZ: hz },
    { minX: hx - 0.15, maxX: hx + 1, minZ: -hz, maxZ: hz },
    { minX: -1.15, maxX: 1.15, minZ: -3.65, maxZ: -1.35 }, // map table
    { minX: hx - 0.6, maxX: hx, minZ: -1.4, maxZ: 0.4 }, // gerty console
    { minX: -4.2, maxX: -2.7, minZ: 2.3, maxZ: 4.5 }, // bunk
    { minX: -3.75, maxX: -2.85, minZ: -4.25, maxZ: -3.35 }, // crate
    { minX: 2.45, maxX: 3.35, minZ: 3.45, maxZ: 4.35 }, // crate
  ];

  const hotspots: InteriorHotspot[] = [
    { id: 'starmap', label: 'Open star map', x: 0, z: -2.5 },
    { id: 'gerty', label: 'GERTY console', x: hx - 0.4, z: -0.5 },
    { id: 'exit', label: 'Exit hatch', x: 0, z: hz - 0.1 },
  ];

  return { group: g, colliders, hotspots };
}

// ---- star map markers ----

export type PoiKind = 'home' | 'asteroid' | 'moon' | 'planet' | 'anomaly' | 'signal';

export function buildPoiMarker(kind: PoiKind, color: number): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'home': {
      g.add(sph(0.7, mat(color, { flat: true })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.045, 8, 32), mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.6 }));
      ring.rotation.x = Math.PI / 2.3;
      g.add(ring);
      break;
    }
    case 'asteroid': {
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(color, { flat: true, rough: 0.95 }));
      a.scale.set(1.2, 0.8, 1);
      g.add(a);
      break;
    }
    case 'moon':
      g.add(sph(0.8, mat(color, { flat: true, rough: 0.9 })));
      break;
    case 'planet': {
      g.add(sph(1.15, mat(color, { flat: true, rough: 0.85 })));
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 40), mat(0x7a6248, { rough: 0.8 }));
      band.rotation.x = Math.PI / 2.1;
      g.add(band);
      break;
    }
    case 'anomaly': {
      g.add(at(box(0.5, 1.6, 0.5, mat(0x1c2226, { metal: 0.7, rough: 0.4 })), 0, 0, 0));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 8, 28), mat(0x2a6a5a, { emissive: 0x2a6a5a, emissiveIntensity: 0.9 }));
      halo.name = 'halo';
      g.add(halo);
      break;
    }
    case 'signal': {
      const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(color, { emissive: color, emissiveIntensity: 0.5, flat: true }));
      o.name = 'pulse';
      g.add(o);
      break;
    }
  }
  return g;
}

// ---- terrain ----

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Terrain {
  mesh: THREE.Mesh;
  heightAt(x: number, z: number): number;
  size: number;
  rand: () => number;
}

export function buildTerrain(seed: number, color: number, size = 70): Terrain {
  const heightAt = makeHeightField(seed);

  const geo = new THREE.PlaneGeometry(size, size, 56, 56);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(color, { flat: true, rough: 0.95, metal: 0.05 }));
  mesh.name = 'terrain';
  return { mesh, heightAt, size, rand: mulberry32(seed) };
}

// ---- lighting rigs ----

export function addBasicLights(scene: THREE.Scene, sunColor = 0xfff4e0, ambient = 0x22303a): void {
  const sun = new THREE.DirectionalLight(sunColor, 2.2);
  sun.position.set(18, 30, 12);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(ambient, 2.0));
  const fill = new THREE.DirectionalLight(0x4a6a8a, 0.6);
  fill.position.set(-14, 8, -18);
  scene.add(fill);
}

export function addStars(scene: THREE.Scene, count = 500, radius = 400): void {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const rand = mulberry32(9001);
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // fog: false — stars are backdrop, not scenery; site fog must never erase the sky
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fb6c4, size: 1.1, sizeAttenuation: false, fog: false })));
}

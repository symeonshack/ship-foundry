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
import type { DroneId } from '../base/drones';
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
  const band = mat(C.frame, { metal: 0.5, rough: 0.5 });
  const torus = (r: number, tube: number, m: THREE.Material, rad = 8, tub = 24) =>
    new THREE.Mesh(new THREE.TorusGeometry(r, tube, rad, tub), m);
  const windowLight = (): THREE.MeshStandardMaterial => mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.75 });

  switch (id) {
    case 'hullS': {
      // segmented pressure hull with ribs, frame bands, a cockpit canopy and lit ports
      g.add(at(cyl(0.98, 1.08, 2.4, hull, 12), 0, 1.2, 0));
      for (const y of [0.35, 1.2, 2.05]) g.add(at(cyl(1.12, 1.12, 0.16, band, 12), 0, y, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rib = at(box(0.08, 2.2, 0.12, band), Math.cos(a) * 1.04, 1.2, Math.sin(a) * 1.04);
        rib.rotation.y = -a;
        g.add(rib);
      }
      g.add(at(box(0.6, 0.42, 0.34, dark), 0, 1.95, 0.92)); // cockpit shell (+z)
      g.add(at(box(0.44, 0.24, 0.1, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.5 })), 0, 2.0, 1.12));
      g.add(at(box(0.5, 0.5, 0.18, dark), 0, 1.0, -1.0)); // rear access hatch
      for (let i = 0; i < 3; i++) g.add(at(box(0.13, 0.13, 0.05, windowLight()), -0.3 + i * 0.3, 0.8, 1.02));
      g.add(at(sph(0.055, mat(C.green, { emissive: C.green, emissiveIntensity: 0.9 })), 0.95, 2.1, 0.35));
      g.add(at(sph(0.055, mat(C.red, { emissive: C.red, emissiveIntensity: 0.9 })), -0.95, 2.1, 0.35));
      const ring = torus(1.15, 0.05, haloMaterial, 8, 40);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.2, 0);
      ring.name = 'hull-ring';
      g.add(ring);
      break;
    }
    case 'hullL': {
      // extended spine: more bands, a raised bridge, antenna mast and window rows
      g.add(at(cyl(1.18, 1.32, 3.6, hull, 14), 0, 1.8, 0));
      for (const y of [0.5, 1.5, 2.5, 3.4]) g.add(at(cyl(1.38, 1.38, 0.18, band, 14), 0, y, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rib = at(box(0.09, 3.3, 0.14, band), Math.cos(a) * 1.28, 1.8, Math.sin(a) * 1.28);
        rib.rotation.y = -a;
        g.add(rib);
      }
      g.add(at(box(0.8, 0.7, 0.45, dark), 0, 3.05, 1.2)); // bridge (+z)
      g.add(at(box(0.58, 0.3, 0.12, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.5 })), 0, 3.12, 1.42));
      g.add(at(cyl(0.035, 0.035, 0.9, band), 0, 3.9, -0.5)); // dorsal antenna
      g.add(at(sph(0.07, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.9 })), 0, 4.4, -0.5));
      for (const row of [1.0, 2.2]) for (let i = 0; i < 5; i++) g.add(at(box(0.15, 0.15, 0.05, windowLight()), -0.6 + i * 0.3, row, 1.28));
      const ring = torus(1.42, 0.06, haloMaterial, 8, 44);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.8, 0);
      ring.name = 'hull-ring';
      g.add(ring);
      break;
    }
    case 'habitatRing': {
      // a spun centrifuge ring on a static hub — the whole ring assembly (named
      // 'centrifuge') turns; spinCentrifuges() drives it in the shipyard/flight.
      const trim = mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.4, metal: 0.6, rough: 0.35 });
      g.add(at(cyl(0.5, 0.58, 1.6, hull, 14), 0, 0.8, 0)); // central hub
      g.add(at(cyl(0.64, 0.64, 0.14, band, 14), 0, 0.25, 0));
      g.add(at(cyl(0.64, 0.64, 0.14, band, 14), 0, 1.4, 0));
      g.add(at(sph(0.12, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.7 })), 0, 1.66, 0)); // hub beacon
      const spin = new THREE.Group();
      spin.name = 'centrifuge';
      spin.position.y = 0.6;
      const R = 2.9;
      const outer = torus(R, 0.36, hull, 14, 64); // the habitat torus itself
      outer.rotation.x = Math.PI / 2;
      spin.add(outer);
      for (const yo of [0.34, -0.34]) {
        const rail = torus(R, 0.08, trim, 8, 64);
        rail.rotation.x = Math.PI / 2;
        rail.position.y = yo;
        spin.add(rail);
      }
      // eight spoke arms trussed out to the rim
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spoke = at(box(R - 0.5, 0.14, 0.14, band), Math.cos(a) * (R / 2 + 0.1), 0, Math.sin(a) * (R / 2 + 0.1));
        spoke.rotation.y = -a;
        spin.add(spoke);
      }
      // six habitat modules riding the rim, each with a lit face
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 8;
        const pod = at(box(0.8, 0.62, 1.15, mat(C.hullDark, { flat: true })), Math.cos(a) * R, 0, Math.sin(a) * R);
        pod.rotation.y = -a;
        spin.add(pod);
        spin.add(at(box(0.5, 0.34, 0.06, windowLight()), Math.cos(a) * (R + 0.42), 0.02, Math.sin(a) * (R + 0.42)));
      }
      // running lights strung between the modules
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        spin.add(at(sph(0.05, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.85 })), Math.cos(a) * (R + 0.36), 0.34, Math.sin(a) * (R + 0.36)));
      }
      g.add(spin);
      break;
    }
    case 'engine1': {
      g.add(at(box(0.55, 0.13, 0.55, frame), 0, 0.065, 0));
      g.add(at(cyl(0.32, 0.38, 0.6, dark), 0, 0.44, 0));
      g.add(at(cyl(0.52, 0.28, 0.55, mat(C.frame, { metal: 0.6, rough: 0.4 }), 16), 0, 1.0, 0));
      const glow = at(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.2, 0.44, 16),
          mat(0x201510, { emissive: C.amber, emissiveIntensity: 0.0 }),
        ),
        0,
        1.01,
        0,
      );
      glow.name = 'glow';
      g.add(glow);
      g.add(at(cyl(0.05, 0.05, 0.5, dark), 0.3, 0.5, 0)); // feed line
      break;
    }
    case 'engine2': {
      g.add(at(box(0.78, 0.15, 0.78, frame), 0, 0.075, 0));
      g.add(at(cyl(0.46, 0.5, 0.72, dark), 0, 0.56, 0));
      g.add(at(cyl(0.68, 0.36, 0.62, mat(C.frame, { metal: 0.6, rough: 0.4 }), 18), 0, 1.24, 0));
      const glow = at(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.56, 0.28, 0.5, 18),
          mat(0x201510, { emissive: C.amber, emissiveIntensity: 0.0 }),
        ),
        0,
        1.26,
        0,
      );
      glow.name = 'glow';
      g.add(glow);
      g.add(at(cyl(0.1, 0.1, 0.95, mat(C.violet, { emissive: C.violet, emissiveIntensity: 0.4 })), 0.44, 0.55, 0.44));
      g.add(at(cyl(0.1, 0.1, 0.95, mat(C.violet, { emissive: C.violet, emissiveIntensity: 0.4 })), -0.44, 0.55, -0.44));
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

/** the descent craft standing on the surface — the boardable lander, matched
 * to its interior (canted cabin) and the overhauled ship aesthetic */
export function buildLander(): THREE.Group {
  const g = new THREE.Group();
  const hull = mat(C.hull, { flat: true });
  const dark = mat(C.hullDark, { metal: 0.4 });
  const band = mat(C.frame, { metal: 0.5, rough: 0.5 });
  const tankMat = mat(0x8a949c, { metal: 0.5, rough: 0.4 });
  // lower descent stage: wide tapered body with frame banding
  g.add(at(cyl(1.05, 1.28, 1.0, hull, 12), 0, 1.0, 0));
  g.add(at(cyl(1.32, 1.32, 0.14, band, 12), 0, 0.6, 0));
  g.add(at(cyl(1.32, 1.32, 0.14, band, 12), 0, 1.4, 0));
  // propellant tanks wrapped around the waist
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(at(cyl(0.22, 0.22, 0.9, tankMat, 10), Math.cos(a) * 1.18, 1.0, Math.sin(a) * 1.18));
  }
  // engine bells tucked underneath
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(at(cyl(0.28, 0.15, 0.42, band, 12), Math.cos(a) * 0.42, 0.3, Math.sin(a) * 0.42));
  }
  // crew cabin up top with a canted, lit canopy
  g.add(at(box(1.24, 0.12, 1.04, band), 0, 1.62, 0.05));
  g.add(at(box(1.2, 0.95, 1.0, hull), 0, 2.15, 0.05));
  const canopy = at(box(0.92, 0.52, 0.12, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.5 })), 0, 2.28, 0.6);
  canopy.rotation.x = -0.32;
  g.add(canopy);
  // rear boarding hatch with a lit lintel
  g.add(at(box(0.56, 0.72, 0.1, dark), 0, 1.98, -0.56));
  g.add(at(box(0.6, 0.08, 0.1, mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.45 })), 0, 2.38, -0.55));
  // landing legs + footpads
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.07, 0.07, 1.5, band);
    leg.position.set(Math.cos(a) * 1.25, 0.5, Math.sin(a) * 1.25);
    leg.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    g.add(leg);
    g.add(at(cyl(0.24, 0.3, 0.1, band, 10), Math.cos(a) * 1.62, 0.04, Math.sin(a) * 1.62));
  }
  // antenna mast + beacon, nav lights
  g.add(at(cyl(0.03, 0.03, 0.7, band), 0.42, 2.75, -0.2));
  g.add(at(sph(0.06, mat(C.accent, { emissive: C.accent, emissiveIntensity: 1 })), 0.42, 3.12, -0.2));
  g.add(at(sph(0.05, mat(C.green, { emissive: C.green, emissiveIntensity: 0.9 })), 1.18, 2.05, 0.32));
  g.add(at(sph(0.05, mat(C.red, { emissive: C.red, emissiveIntensity: 0.9 })), -1.18, 2.05, 0.32));
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
/** the foundation slab every finished structure shares */
function slab(w: number, d: number): THREE.Mesh {
  return at(box(w, 0.25, d, mat(C.frame)), 0, 0.125, 0);
}
/** a small emissive indicator light */
function lamp(color: number, r = 0.07, i = 0.9): THREE.Mesh {
  return sph(r, mat(color, { emissive: color, emissiveIntensity: i }));
}
/** a hazard-stripe torus band used on skirts/pads */
function stripeBand(r: number, tube = 0.05): THREE.Mesh {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 28), mat(0xd8b23c, { emissive: 0xd8b23c, emissiveIntensity: 0.2, rough: 0.6 }));
  t.rotation.x = Math.PI / 2;
  return t;
}

export function buildSiloMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const band = mat(C.frame, { metal: 0.5, rough: 0.5 });
  g.add(slab(w, d));
  const tank = mat(color, { flat: true, rough: 0.55, metal: 0.45 });
  const steel = mat(0x8a949c, { metal: 0.5, rough: 0.4 });
  const r = Math.min(w, d) * 0.2;
  // three vertical silos of staggered height, ringed with banding and domed
  const spots: [number, number, number][] = [[-0.26, -0.18, 1.55], [0.28, -0.16, 1.35], [0.02, 0.3, 1.15]];
  for (const [sx, sz, h] of spots) {
    const x = w * sx;
    const z = d * sz;
    g.add(at(cyl(r, r, h, tank, 14), x, 0.25 + h / 2, z));
    for (const f of [0.35, 0.65, 0.95]) g.add(at(cyl(r * 1.05, r * 1.05, 0.07, band, 14), x, 0.25 + h * f, z));
    g.add(at(sph(r, tank, 14), x, 0.25 + h, z));
    g.add(at(cyl(0.045, 0.045, 0.28, band), x, 0.25 + h + r + 0.1, z)); // vent stack
  }
  // base manifold + valve wheels tying the silos together
  g.add(at(box(w * 0.9, 0.16, 0.14, band), 0, 0.55, -d * 0.1));
  for (const [sx, , ] of spots) g.add(at(cyl(0.09, 0.09, 0.12, steel, 8), w * sx, 0.62, -d * 0.1));
  // lit fill-gauge on the tallest silo
  g.add(at(box(0.05, 0.7, 0.12, mat(color, { emissive: color, emissiveIntensity: 0.7 })), w * -0.26 - r, 0.95, d * -0.18));
  // access ladder
  for (let i = 0; i < 5; i++) g.add(at(box(0.18, 0.03, 0.03, band), w * 0.28, 0.4 + i * 0.28, d * -0.16 - r));
  g.add(at(lamp(color), w * 0.36, 0.5, d * 0.34));
  return g;
}

export function buildSolarArrayMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const band = mat(C.frame, { metal: 0.5, rough: 0.5 });
  g.add(slab(w, d));
  const cell = mat(0x21406a, { metal: 0.65, rough: 0.28 });
  const gridline = mat(0x0e1a30, { rough: 0.5 });
  // a tracker mast carrying two rows of gridded panel wings
  g.add(at(cyl(0.08, 0.1, 0.7, band, 8), 0, 0.55, 0));
  g.add(at(cyl(0.14, 0.14, 0.12, band, 10), 0, 0.9, 0)); // pivot hub
  for (const sx of [-0.26, 0.26] as const) {
    for (const sz of [-0.32, 0.32] as const) {
      const wing = new THREE.Group();
      wing.add(at(box(w * 0.4, 0.05, d * 0.46, cell), 0, 0, 0));
      // cell grid lines
      for (let i = -1; i <= 1; i++) wing.add(at(box(w * 0.4, 0.06, 0.015, gridline), 0, 0.001, i * d * 0.14));
      for (let i = -1; i <= 1; i++) wing.add(at(box(0.015, 0.06, d * 0.46, gridline), i * w * 0.12, 0.001, 0));
      wing.position.set(w * sx, 0.95, d * sz);
      wing.rotation.x = -0.5;
      g.add(wing);
    }
  }
  // junction box + status lamp + cabling
  g.add(at(box(0.3, 0.34, 0.24, mat(C.hullDark, { flat: true })), w * 0.36, 0.42, d * 0.36));
  g.add(at(lamp(color, 0.06), w * 0.36, 0.62, d * 0.36));
  return g;
}

export function buildNuclearGeneratorMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(slab(w, d));
  const hull = mat(0x6b6560, { flat: true, rough: 0.6, metal: 0.5 });
  const steel = mat(0x8a949c, { metal: 0.6, rough: 0.4 });
  const r = Math.min(w, d) * 0.3;
  // containment dome on a hazard-striped skirt
  g.add(at(cyl(r, r * 1.1, 1.1, hull, 16), 0, 0.8, 0));
  g.add(at(sph(r, hull, 16), 0, 1.35, 0));
  g.add(at(cyl(r * 1.06, r * 1.06, 0.18, mat(0x1a1a1a, { flat: true, rough: 0.9 }), 16), 0, 0.35, 0));
  g.add(at(stripeBand(r * 1.12, 0.06), 0, 0.35, 0));
  // twin coolant towers with vent glow
  for (const sx of [-1, 1] as const) {
    const cx = sx * (r + 0.34);
    g.add(at(cyl(0.18, 0.26, 1.0, steel, 12), cx, 0.75, d * 0.3));
    g.add(at(cyl(0.22, 0.18, 0.16, steel, 12), cx, 1.32, d * 0.3));
    g.add(at(lamp(0x9fd6e8, 0.09, 0.5), cx, 1.42, d * 0.3));
  }
  // radial cooling fins
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fin = at(box(0.05, 0.85, r * 0.7, steel), Math.cos(a) * r * 1.12, 0.8, Math.sin(a) * r * 1.12);
    fin.rotation.y = a;
    g.add(fin);
  }
  const light = at(lamp(color, 0.11), 0, 1.95, 0);
  light.name = 'reactor-light';
  g.add(light);
  return g;
}

export function buildRelayMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  const band = mat(C.frame, { metal: 0.5, rough: 0.5 });
  g.add(slab(w, d));
  // transformer cabinet with cooling fins + insulators
  g.add(at(box(w * 0.62, 0.7, d * 0.62, mat(color, { flat: true, rough: 0.65, metal: 0.45 })), 0, 0.6, 0));
  for (let i = 0; i < 4; i++) g.add(at(box(w * 0.66, 0.5, 0.03, band), 0, 0.6, -d * 0.28 + i * d * 0.19));
  for (const sx of [-1, 1] as const) g.add(at(cyl(0.05, 0.06, 0.3, mat(0xcfc2a0, { rough: 0.4 }), 8), sx * w * 0.22, 1.05, d * 0.2));
  // lattice mast with a dish and a beacon
  g.add(at(cyl(0.05, 0.07, 2.4, frame, 6), 0, 2.1, 0));
  for (const y of [1.4, 2.0, 2.6]) {
    g.add(at(box(0.85, 0.04, 0.04, frame), 0, y, 0));
    g.add(at(box(0.04, 0.04, 0.85, frame), 0, y, 0));
  }
  const dish = at(cyl(0.34, 0.05, 0.16, mat(C.white, { metal: 0.4, rough: 0.5 }), 14), 0.3, 2.3, 0.2);
  dish.rotation.set(0.7, 0.4, 0);
  g.add(dish);
  const tip = at(lamp(color, 0.1), 0, 3.35, 0);
  tip.name = 'beacon';
  g.add(tip);
  return g;
}

export function buildRefineryMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const band = mat(C.frame, { metal: 0.5, rough: 0.5 });
  const steel = mat(0x8a949c, { metal: 0.5, rough: 0.4 });
  g.add(slab(w, d));
  // main process block with paneling
  g.add(at(box(w * 0.72, 1.0, d * 0.7, mat(color, { flat: true, rough: 0.75, metal: 0.35 })), -w * 0.05, 0.75, 0));
  g.add(at(box(w * 0.74, 0.1, d * 0.72, band), -w * 0.05, 1.28, 0));
  // twin distillation columns rising above the block
  for (const sx of [0.14, 0.34] as const) {
    g.add(at(cyl(0.16, 0.18, 1.7, steel, 12), w * sx, 1.4, -d * 0.18));
    g.add(at(cyl(0.11, 0.16, 0.35, band, 10), w * sx, 2.35, -d * 0.18));
  }
  // flare tip on the taller column
  g.add(at(lamp(C.amber, 0.07, 0.6), w * 0.14, 2.6, -d * 0.18));
  // spherical holding tank on a cradle + feed pipes
  g.add(at(sph(0.36, steel, 12), -w * 0.34, 0.9, d * 0.24));
  g.add(at(cyl(0.36, 0.36, 0.2, band, 12), -w * 0.34, 0.55, d * 0.24));
  g.add(at(cyl(0.05, 0.05, 0.7, band), -w * 0.1, 0.9, d * 0.24));
  g.add(at(lamp(color), w * 0.3, 1.35, d * 0.28));
  return g;
}

/**
 * The Foundry (earned, Phase 16) — the keystone fabrication hall: a big shed
 * with a gantry crane straddling the roof, a glowing bay door, roof vents and
 * an exhaust stack. Distinct from `buildFoundryBase()` (the crashed
 * deployment-platform backdrop at the shipyard scene), which this doesn't touch.
 */
export function buildFoundryStructureMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  const rail = mat(0x8a949c, { metal: 0.6, rough: 0.4 });
  g.add(slab(w, d));
  const hall = mat(color, { flat: true, rough: 0.7, metal: 0.4 });
  g.add(at(box(w * 0.82, 1.4, d * 0.78, hall), 0, 0.95, 0));
  // ribbed roof + vents
  for (let i = -1; i <= 1; i++) g.add(at(box(w * 0.84, 0.08, 0.12, frame), 0, 1.66, i * d * 0.22));
  for (const sx of [-0.2, 0.2] as const) g.add(at(cyl(0.14, 0.14, 0.24, frame, 8), w * sx, 1.78, d * 0.1));
  // glowing bay door on the front
  g.add(at(box(w * 0.4, 0.9, 0.06, mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.4 })), 0, 0.7, d * 0.4));
  g.add(at(box(w * 0.46, 1.0, 0.05, frame), 0, 0.75, d * 0.41));
  // exhaust stack
  g.add(at(cyl(0.18, 0.22, 1.3, rail, 10), -w * 0.34, 1.6, -d * 0.28));
  g.add(at(cyl(0.13, 0.19, 0.3, frame, 10), -w * 0.34, 2.35, -d * 0.28));
  // gantry crane straddling the roof
  for (const sz of [-1, 1] as const) {
    g.add(at(box(w * 0.92, 0.1, 0.1, rail), 0, 1.9, sz * d * 0.35));
    for (const sx of [-1, 1] as const) g.add(at(box(0.08, 0.6, 0.08, frame), sx * w * 0.43, 1.6, sz * d * 0.35));
  }
  g.add(at(box(0.4, 0.22, d * 0.74, rail), -w * 0.1, 2.0, 0));
  g.add(at(cyl(0.03, 0.03, 0.6, frame, 6), -w * 0.1, 1.65, 0));
  g.add(at(lamp(color, 0.1), w * 0.34, 1.5, d * 0.32));
  return g;
}

/**
 * The Launch Pad (Phase 18) — a circular blast pad with a service gantry
 * tower, hazard striping, a flame trench, a propellant tank and floodlights.
 * Structure only for now: no launch queue yet, so it takes part in
 * selection/repair/damage like any other structure with no special-casing.
 */
export function buildLaunchPadMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  const steel = mat(0x8a949c, { metal: 0.6, rough: 0.4 });
  g.add(slab(w, d));
  const pad = mat(0x4a4640, { flat: true, rough: 0.85, metal: 0.2 });
  const r = Math.min(w, d) * 0.46;
  g.add(at(cyl(r, r, 0.2, pad, 24), 0, 0.35, 0));
  g.add(at(stripeBand(r * 0.98, 0.07), 0, 0.46, 0));
  // central flame hole + trench
  g.add(at(cyl(r * 0.22, r * 0.22, 0.22, mat(0x101010, { flat: true, rough: 1 }), 16), 0, 0.36, 0));
  g.add(at(box(w * 0.22, 0.3, d * 0.5, mat(0x2a2a2a, { flat: true, rough: 0.9 })), -w * 0.34, 0.2, 0));
  // service gantry tower with platforms + swing arm
  const tx = r * 0.7;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) g.add(at(cyl(0.07, 0.07, 3.6, frame, 6), tx + sx * 0.28, 1.9, sz * 0.28));
  for (const y of [0.8, 1.8, 2.8, 3.5]) {
    g.add(at(box(0.62, 0.05, 0.62, frame), tx, y, 0));
    g.add(at(box(0.62, 0.05, 0.05, frame), tx, y, 0.28));
  }
  g.add(at(box(r * 0.7, 0.1, 0.14, steel), tx - r * 0.35, 2.6, 0)); // swing arm reaching over the pad
  // propellant tank alongside
  g.add(at(cyl(0.34, 0.34, 1.1, steel, 12), -tx, 0.9, d * 0.28));
  g.add(at(sph(0.34, steel, 12), -tx, 1.5, d * 0.28));
  // floodlights + beacon
  for (const s of [-1, 1] as const) g.add(at(lamp(C.white, 0.07, 0.7), s * r * 0.9, 0.6, s * r * 0.5));
  g.add(at(lamp(color, 0.1), tx, 3.75, 0));
  return g;
}

/** Fabricator — the drone works: an assembly shed with a bay door, a robotic
 * arm on the roof and an output apron. */
export function buildFabricatorMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const steel = mat(0x8a949c, { metal: 0.6, rough: 0.4 });
  g.add(slab(w, d));
  g.add(at(box(w * 0.78, 1.1, d * 0.72, mat(color, { flat: true, rough: 0.7, metal: 0.4 })), 0, 0.8, 0));
  // sawtooth roof skylights
  for (let i = -1; i <= 1; i++) {
    const sky = at(box(w * 0.24, 0.14, d * 0.6, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.35 })), i * w * 0.26, 1.42, 0);
    sky.rotation.z = 0.3;
    g.add(sky);
  }
  // roof-mounted robotic arm (segmented)
  const base = at(cyl(0.16, 0.2, 0.24, steel, 10), -w * 0.1, 1.5, -d * 0.05);
  g.add(base);
  const seg1 = at(box(0.12, 0.7, 0.12, steel), -w * 0.1, 1.9, -d * 0.05);
  seg1.rotation.z = 0.5;
  g.add(seg1);
  const seg2 = at(box(0.1, 0.6, 0.1, steel), -w * 0.1 + 0.5, 2.2, -d * 0.05);
  seg2.rotation.z = -0.7;
  g.add(seg2);
  g.add(at(lamp(C.amber, 0.06), -w * 0.1 + 0.85, 2.05, -d * 0.05)); // welding tip
  // output bay door + apron
  g.add(at(box(w * 0.34, 0.8, 0.06, mat(0x11181d, { emissive: 0x1a2a30, emissiveIntensity: 0.5 })), 0, 0.65, d * 0.37));
  g.add(at(box(w * 0.5, 0.04, d * 0.22, mat(0x39454d, { rough: 0.85 })), 0, 0.27, d * 0.5));
  g.add(at(lamp(color), w * 0.32, 1.25, d * 0.3));
  return g;
}

/** Greenhouse — a vaulted glasshouse: translucent barrel roof, planting beds
 * glowing under grow-lights, an airlock end. */
export function buildGreenhouseMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  g.add(slab(w, d));
  g.add(at(box(w * 0.82, 0.5, d * 0.78, mat(0x3a444c, { flat: true })), 0, 0.4, 0)); // knee wall
  // translucent barrel-vault roof
  const glass = mat(0x9fe8c4, { transparent: true, opacity: 0.4, emissive: 0x2f6a4a, emissiveIntensity: 0.3, rough: 0.2, metal: 0.1 });
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.42, d * 0.42, w * 0.82, 16, 1, false, 0, Math.PI), glass);
  vault.rotation.z = Math.PI / 2;
  vault.position.set(0, 0.65, 0);
  g.add(vault);
  // roof ribs
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(d * 0.42, 0.03, 6, 16, Math.PI), frame);
    rib.rotation.y = Math.PI / 2;
    rib.position.set(i * w * 0.18, 0.65, 0);
    g.add(rib);
  }
  // planting beds glowing under grow-lights (seen through the glass)
  for (const sz of [-0.22, 0.22] as const) {
    g.add(at(box(w * 0.66, 0.16, d * 0.2, mat(0x2f6a3a, { emissive: 0x3fa85a, emissiveIntensity: 0.5 })), 0, 0.55, d * sz));
  }
  // airlock end cap + lamp
  g.add(at(box(0.1, 0.9, d * 0.5, mat(color, { flat: true, metal: 0.4 })), w * 0.42, 0.7, 0));
  g.add(at(lamp(color), w * 0.42, 1.15, d * 0.3));
  return g;
}

/** Soil Processor — a hopper-and-auger rig that blends fertilizer with regolith. */
export function buildSoilProcessorMesh(w: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(C.frame);
  const steel = mat(0x8a949c, { metal: 0.55, rough: 0.4 });
  g.add(slab(w, d));
  // inverted-cone hopper on legs
  g.add(at(cyl(Math.min(w, d) * 0.34, 0.08, 0.9, mat(color, { flat: true, rough: 0.7, metal: 0.35 }), 12), 0, 0.9, 0));
  g.add(at(cyl(Math.min(w, d) * 0.34, Math.min(w, d) * 0.34, 0.3, steel, 12), 0, 1.45, 0)); // rim
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = cyl(0.05, 0.05, 1.0, frame);
    leg.position.set(Math.cos(a) * w * 0.28, 0.5, Math.sin(a) * d * 0.28);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(leg);
  }
  // inclined output auger + motor
  const auger = at(cyl(0.09, 0.09, 1.3, steel, 10), w * 0.32, 0.7, 0);
  auger.rotation.z = 0.7;
  g.add(auger);
  g.add(at(box(0.24, 0.24, 0.24, mat(C.hullDark, { flat: true })), w * 0.36, 0.3, 0)); // motor
  g.add(at(lamp(color), -w * 0.2, 1.5, d * 0.2));
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

// ---- drones (Phase 19: real, movable, selectable world units) ----

export function buildDroneMesh(defId: DroneId): THREE.Group {
  const g = new THREE.Group();
  const body = mat(defId === 'hauler' ? C.hull : C.hullDark, { flat: true });
  const frame = mat(C.frame);
  if (defId === 'hauler') {
    g.add(at(box(0.6, 0.4, 0.9, body), 0, 0.35, 0));
    for (const [sx, sz] of [[-0.3, 0.32], [0.3, 0.32], [-0.3, -0.32], [0.3, -0.32]]) {
      g.add(at(cyl(0.1, 0.1, 0.16, frame, 10), sx!, 0.1, sz!));
    }
  } else {
    g.add(at(box(0.42, 0.32, 0.42, body), 0, 0.3, 0));
    const arm = cyl(0.045, 0.045, 0.4, frame);
    arm.rotation.z = Math.PI / 2.3;
    arm.position.set(0.28, 0.42, 0);
    g.add(arm);
  }
  const lamp = sph(0.06, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.9 }));
  lamp.name = 'lamp';
  lamp.position.set(0, defId === 'hauler' ? 0.58 : 0.48, 0);
  g.add(lamp);
  return g;
}

/** rally-point marker (Phase 21): a slim pole with a pennant and a faint ground ring */
export function buildRallyFlag(): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.04, 0.04, 2, mat(C.white, { metal: 0.4, rough: 0.5 }));
  pole.position.y = 1;
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.4),
    mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.6, flat: true, transparent: true, opacity: 0.9 }),
  );
  flag.material.side = THREE.DoubleSide;
  flag.position.set(0.37, 1.75, 0);
  g.add(flag);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.05, 8, 32),
    mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.4, transparent: true, opacity: 0.5 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  return g;
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
  id: 'starmap' | 'gerty' | 'exit' | 'launch';
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

  // GERTY's charging dock on the starboard wall — a lit alcove + floor pad.
  // GERTY itself is now a mobile robot (buildGertyBot) that roams the deck and
  // returns to roughly here; the dock is scenery, not the thing you talk to.
  g.add(at(box(0.15, 2.0, 1.8, trim), hx - 0.08, 1.2, -0.5));
  const dockScreen = at(box(0.06, 0.5, 1.2, mat(0x0c2a26, { emissive: 0x1f6a5a, emissiveIntensity: 0.4 })), hx - 0.17, 1.85, -0.5);
  dockScreen.name = 'dock-screen';
  g.add(dockScreen);
  for (let i = 0; i < 4; i++) {
    const on = i % 2 === 0;
    g.add(at(box(0.05, 0.09, 0.09, mat(on ? 0xffb454 : 0x7dffa8, { emissive: on ? 0xffb454 : 0x7dffa8, emissiveIntensity: 0.9 })), hx - 0.16, 1.35, -1.0 + i * 0.32));
  }
  // recessed floor pad with an underglow ring — GERTY's berth
  g.add(at(cyl(0.55, 0.55, 0.04, trim, 20), hx - 0.95, 0.02, -0.5));
  const dockGlow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 28), mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.6 }));
  dockGlow.rotation.x = Math.PI / 2;
  dockGlow.position.set(hx - 0.95, 0.05, -0.5);
  g.add(dockGlow);

  // rear hatch
  const door = at(box(1.4, 2.35, 0.15, mat(0x39454d, { metal: 0.4 })), 0, 1.18, hz + 0.02);
  door.name = 'hatch-door';
  g.add(door);
  g.add(at(box(1.4, 0.16, 0.16, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.4 })), 0, 1.95, hz));
  g.add(at(box(0.28, 0.38, 0.1, mat(0x1c242a, { emissive: 0x59d6ff, emissiveIntensity: 0.35 })), 0.95, 1.35, hz + 0.02));

  // ---- furnishings: a lived-in deck ----
  // bunk against the port-aft wall
  g.add(at(box(1.1, 0.45, 2.0, mat(0x3f4c56)), -3.35, 0.3, 3.4));
  g.add(at(box(0.5, 0.14, 0.7, mat(0x8a949c)), -3.35, 0.6, 2.7)); // pillow
  g.add(at(box(1.0, 0.06, 1.9, mat(0x2a3138)), -3.35, 0.55, 3.5)); // rumpled blanket
  // workbench along the port-forward wall, mid-repair
  g.add(at(box(1.3, 0.1, 2.0, mat(0x4a565f, { metal: 0.4 })), -3.3, 0.9, -1.0));
  for (const z of [-1.8, -1.0, -0.2]) g.add(at(box(0.1, 0.9, 0.1, trim), -3.85, 0.45, z));
  g.add(at(box(0.34, 0.22, 0.34, mat(0x8a949c, { metal: 0.5 })), -3.3, 1.06, -1.6)); // tool caddy
  g.add(at(box(0.5, 0.06, 0.35, mat(0x2a3138)), -3.3, 0.98, -0.4)); // opened access panel
  g.add(at(sph(0.05, mat(0x7dffa8, { emissive: 0x7dffa8, emissiveIntensity: 0.9 })), -3.3, 1.05, -0.4)); // diagnostic light
  g.add(at(box(0.06, 0.5, 1.4, trim), -3.96, 1.7, -1.0)); // tool board
  for (const z of [-1.5, -1.1, -0.7]) g.add(at(cyl(0.03, 0.03, 0.42, mat(0x8a949c, { metal: 0.6 })), -3.82, 1.7, z));
  // tall equipment locker, port-forward corner
  g.add(at(box(0.9, 2.0, 0.6, mat(0x3a444c, { metal: 0.35 })), -3.3, 1.0, -3.9));
  g.add(at(box(0.05, 1.6, 0.06, trim), -2.84, 1.0, -3.9)); // door seam
  g.add(at(box(0.06, 0.06, 0.06, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.9 })), -2.83, 1.45, -3.9));
  // pilot seat facing the cockpit window
  g.add(at(box(0.6, 0.12, 0.6, mat(0x3f4c56)), -1.2, 0.55, -3.9));
  g.add(at(box(0.6, 0.75, 0.12, mat(0x3f4c56)), -1.2, 0.98, -4.18));
  g.add(at(cyl(0.09, 0.11, 0.5, trim), -1.2, 0.27, -3.9)); // pedestal
  // stowed crates, starboard-aft
  const crate2 = at(box(0.65, 0.65, 0.65, mat(0x7a6a56, { flat: true })), 2.9, 0.33, 3.9);
  crate2.rotation.y = 0.4;
  g.add(crate2);
  g.add(at(box(0.5, 0.5, 0.5, mat(0x6d7a68, { flat: true })), 3.25, 0.25, 3.05));
  // floor guidance stripes
  for (const x of [-2.2, 2.2]) g.add(at(box(0.12, 0.02, L - 1.6, mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.22 })), x, 0.011, 0));
  g.add(at(box(W - 1.8, 0.02, 0.12, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.18 })), 0, 0.011, 1.4));
  // wall status panels with indicator LEDs (port + starboard)
  for (const s of [-1, 1] as const) {
    const wx = s === 1 ? -hx + 0.12 : hx - 0.12;
    g.add(at(box(0.05, 0.55, 0.85, mat(0x11181d, { emissive: 0x1a2a30, emissiveIntensity: 0.5 })), wx, 1.85, 2.4 * s));
    for (let i = 0; i < 3; i++) g.add(at(box(0.04, 0.09, 0.09, mat(0x7dffa8, { emissive: 0x7dffa8, emissiveIntensity: 0.8 })), wx + s * 0.02, 2.0, 2.4 * s - 0.22 + i * 0.22));
  }
  // caution chevrons flanking the hatch
  for (const s of [-1, 1]) g.add(at(box(0.12, 1.8, 0.03, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.22 })), s * 0.85, 1.1, hz - 0.02));
  // overhead cable bundle running the length
  const cable = cyl(0.05, 0.05, L - 1, mat(0x1c242a));
  cable.rotation.x = Math.PI / 2;
  cable.position.set(0.6, H - 0.35, 0);
  g.add(cable);

  const colliders: Collider[] = [
    { minX: -hx, maxX: hx, minZ: -hz - 1, maxZ: -hz + 0.15 },
    { minX: -hx, maxX: hx, minZ: hz - 0.15, maxZ: hz + 1 },
    { minX: -hx - 1, maxX: -hx + 0.15, minZ: -hz, maxZ: hz },
    { minX: hx - 0.15, maxX: hx + 1, minZ: -hz, maxZ: hz },
    { minX: -1.15, maxX: 1.15, minZ: -3.65, maxZ: -1.35 }, // map table
    { minX: hx - 0.6, maxX: hx, minZ: -1.4, maxZ: 0.4 }, // gerty dock frame
    { minX: -4.2, maxX: -2.7, minZ: 2.3, maxZ: 4.5 }, // bunk
    { minX: -4.1, maxX: -2.6, minZ: -2.1, maxZ: 0.1 }, // workbench
    { minX: -3.85, maxX: -2.75, minZ: -4.3, maxZ: -3.5 }, // locker
    { minX: -1.65, maxX: -0.75, minZ: -4.45, maxZ: -3.55 }, // pilot seat
    { minX: 2.45, maxX: 3.6, minZ: 2.7, maxZ: 4.4 }, // crates
  ];

  const hotspots: InteriorHotspot[] = [
    { id: 'starmap', label: 'Open star map', x: 0, z: -2.5 },
    { id: 'gerty', label: 'GERTY console', x: hx - 0.4, z: -0.5 },
    { id: 'exit', label: 'Exit hatch', x: 0, z: hz - 0.1 },
  ];

  return { group: g, colliders, hotspots };
}

/**
 * The lander cabin — a cramped descent craft, distinct from the roomy ship.
 * Two-seat cockpit facing a downward-raked window, a pilot/launch console, a
 * wall-mounted GERTY console (no robot down here — that presence is aboard the
 * orbiting ship), and a rear hatch to the surface.
 */
export function buildLanderInterior(): ShipInterior {
  const g = new THREE.Group();
  const W = 4.4;
  const H = 2.4;
  const L = 5.4;
  const hx = W / 2;
  const hz = L / 2;

  const wall = mat(0x333f47, { rough: 0.85, metal: 0.35 });
  const deck = mat(0x262e34, { rough: 0.9, metal: 0.2 });
  const trim = mat(0x1c242a, { rough: 0.8 });
  const win = (): THREE.MeshStandardMaterial => mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.7 });

  // shell — the cabin is a canted box: floor, ceiling, walls, split rear
  g.add(at(box(W, 0.2, L, deck), 0, -0.1, 0));
  g.add(at(box(W, 0.2, L, trim), 0, H + 0.1, 0));
  g.add(at(box(0.2, H, L, wall), -hx - 0.1, H / 2, 0));
  g.add(at(box(0.2, H, L, wall), hx + 0.1, H / 2, 0));
  // raked front (a low bulkhead below the canopy)
  g.add(at(box(W, 1.0, 0.2, wall), 0, 0.5, -hz - 0.1));
  // rear wall split around the hatch
  const segW = (W - 1.4) / 2;
  g.add(at(box(segW, H, 0.2, wall), -(0.7 + segW / 2), H / 2, hz + 0.1));
  g.add(at(box(segW, H, 0.2, wall), 0.7 + segW / 2, H / 2, hz + 0.1));
  g.add(at(box(1.4, H - 2.1, 0.2, wall), 0, 2.1 + (H - 2.1) / 2, hz + 0.1));
  // structural hoops
  for (const z of [-1.6, 0, 1.6]) {
    const hoop = box(W - 0.1, 0.12, 0.16, trim);
    g.add(at(hoop, 0, H - 0.06, z));
    g.add(at(box(0.12, H, 0.16, trim), -hx + 0.06, H / 2, z));
    g.add(at(box(0.12, H, 0.16, trim), hx - 0.06, H / 2, z));
  }
  // one central ceiling strip + overhead grab rail
  g.add(at(box(0.4, 0.05, L - 1, mat(0xdfeaf2, { emissive: 0xcfe0ec, emissiveIntensity: 0.85 })), 0, H - 0.04, 0));
  const rail = cyl(0.04, 0.04, L - 1.4, mat(0x8a949c, { metal: 0.6 }));
  rail.rotation.x = Math.PI / 2;
  rail.position.set(-hx + 0.5, H - 0.5, 0);
  g.add(rail);

  // canted cockpit canopy: a raked frame + starfield pane looking down/out
  const canopyFrame = at(box(3.4, 1.7, 0.14, trim), 0, 1.55, -hz + 0.35);
  canopyFrame.rotation.x = -0.32;
  g.add(canopyFrame);
  const pane = at(box(3.05, 1.4, 0.06, mat(0x060b12, { emissive: 0x0b1624, emissiveIntensity: 0.9 })), 0, 1.55, -hz + 0.42);
  pane.rotation.x = -0.32;
  g.add(pane);
  const paneRand = mulberry32(41);
  for (let i = 0; i < 14; i++) {
    g.add(at(sph(0.016, mat(0xffffff, { emissive: 0xdfeaf2, emissiveIntensity: 1.2 }), 6), (paneRand() - 0.5) * 2.8, 1.15 + paneRand() * 1.0, -hz + 0.5 + (paneRand() - 0.5) * 0.2));
  }

  // pilot console under the canopy (the launch station)
  g.add(at(box(2.6, 0.6, 0.7, mat(0x39454d, { metal: 0.4 })), 0, 0.7, -hz + 1.05));
  const consoleTop = at(box(2.4, 0.1, 0.55, mat(0x11181d, { emissive: 0x1a2a30, emissiveIntensity: 0.5 })), 0, 1.02, -hz + 1.0);
  consoleTop.rotation.x = 0.35;
  g.add(consoleTop);
  for (let i = 0; i < 5; i++) g.add(at(box(0.18, 0.02, 0.12, win()), -0.7 + i * 0.35, 1.1, -hz + 0.85));
  g.add(at(box(0.5, 0.06, 0.3, mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.5 })), 0.7, 1.12, -hz + 0.95));
  // twin flight seats
  for (const sx of [-0.65, 0.65]) {
    g.add(at(box(0.55, 0.12, 0.55, mat(0x3f4c56)), sx, 0.5, -hz + 1.9));
    g.add(at(box(0.55, 0.7, 0.12, mat(0x3f4c56)), sx, 0.9, -hz + 2.15));
    g.add(at(cyl(0.08, 0.1, 0.42, trim), sx, 0.24, -hz + 1.9));
  }

  // GERTY console on the starboard wall — a screen + lens, no robot down here
  g.add(at(box(0.14, 1.5, 1.3, trim), hx - 0.08, 1.3, 0.6));
  const screen = at(box(0.06, 0.66, 0.9, mat(0x0c2a26, { emissive: 0x1f6a5a, emissiveIntensity: 0.6 })), hx - 0.17, 1.45, 0.6);
  screen.name = 'gerty-screen';
  g.add(screen);
  const eye = at(sph(0.075, mat(0xffffff, { emissive: 0x7dffa8, emissiveIntensity: 1.1 }), 10), hx - 0.19, 2.02, 0.6);
  eye.name = 'gerty-eye';
  g.add(eye);
  g.add(at(box(0.4, 0.06, 1.0, trim), hx - 0.32, 0.95, 0.6));

  // rear hatch + caution striping
  const door = at(box(1.3, 2.05, 0.14, mat(0x39454d, { metal: 0.4 })), 0, 1.03, hz + 0.02);
  door.name = 'hatch-door';
  g.add(door);
  g.add(at(box(1.3, 0.14, 0.16, mat(0xffb454, { emissive: 0xffb454, emissiveIntensity: 0.4 })), 0, 1.75, hz));
  g.add(at(box(0.26, 0.34, 0.1, mat(0x1c242a, { emissive: 0x59d6ff, emissiveIntensity: 0.35 })), 0.85, 1.2, hz + 0.02));
  // port-wall stowage: netted crates + a fold-down jump seat
  g.add(at(box(0.6, 0.9, 1.4, mat(0x6d7a68, { flat: true })), -hx + 0.45, 0.5, 1.4));
  g.add(at(box(0.5, 0.5, 0.5, mat(0x7a6a56, { flat: true })), -hx + 0.5, 0.28, -0.4));
  for (let i = 0; i < 4; i++) g.add(at(box(0.02, 1.3, 0.02, trim), -hx + 0.2, 0.9, 0.8 + i * 0.35)); // net lacing
  // conduit run along the ceiling
  const cond = cyl(0.05, 0.05, L - 0.8, mat(0x39454d, { metal: 0.5 }));
  cond.rotation.x = Math.PI / 2;
  cond.position.set(hx - 0.4, H - 0.3, 0);
  g.add(cond);

  const colliders: Collider[] = [
    { minX: -hx, maxX: hx, minZ: -hz - 1, maxZ: -hz + 0.15 }, // front bulkhead
    { minX: -hx, maxX: hx, minZ: hz - 0.15, maxZ: hz + 1 }, // rear wall
    { minX: -hx - 1, maxX: -hx + 0.15, minZ: -hz, maxZ: hz }, // port wall
    { minX: hx - 0.15, maxX: hx + 1, minZ: -hz, maxZ: hz }, // starboard wall
    { minX: -1.4, maxX: 1.4, minZ: -hz + 0.6, maxZ: -hz + 2.5 }, // console + seats block
    { minX: hx - 0.55, maxX: hx, minZ: 0.0, maxZ: 1.2 }, // gerty console
    { minX: -hx, maxX: -hx + 0.8, minZ: 0.7, maxZ: 2.1 }, // port stowage
  ];

  const hotspots: InteriorHotspot[] = [
    { id: 'launch', label: 'Launch to orbit', x: 0, z: -hz + 1.9 },
    { id: 'gerty', label: 'GERTY console', x: hx - 0.5, z: 0.6 },
    { id: 'exit', label: 'Step outside', x: 0, z: hz - 0.1 },
  ];

  return { group: g, colliders, hotspots };
}

/**
 * GERTY — a mobile shipboard robot. The head/face points along local +Z, so
 * the owner just yaws the group to aim GERTY at the player. Named nodes:
 * 'gerty-eye', 'gerty-screen' (pulse/brighten while speaking) and
 * 'gerty-hover' (the antigrav underglow). Origin sits on the deck (y=0).
 */
export function buildGertyBot(): THREE.Group {
  const g = new THREE.Group();
  const shell = mat(C.hull, { metal: 0.5, rough: 0.4 });
  const dark = mat(C.hullDark, { metal: 0.4 });
  const bezel = mat(C.frame, { metal: 0.5 });
  // hover base + antigrav underglow
  g.add(at(cyl(0.28, 0.4, 0.16, dark), 0, 0.16, 0));
  const hover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.28, 0.05, 20),
    mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }),
  );
  hover.position.y = 0.04;
  hover.name = 'gerty-hover';
  g.add(hover);
  // torso
  g.add(at(cyl(0.3, 0.34, 0.5, shell), 0, 0.5, 0));
  g.add(at(cyl(0.36, 0.36, 0.1, bezel), 0, 0.4, 0));
  g.add(at(sph(0.34, shell), 0, 0.8, 0));
  // side pods (manipulator arms, tucked)
  for (const s of [-1, 1]) {
    g.add(at(cyl(0.07, 0.07, 0.34, dark), s * 0.34, 0.62, 0));
    g.add(at(sph(0.1, shell), s * 0.5, 0.62, 0));
  }
  // head + face (faces +Z)
  g.add(at(box(0.5, 0.4, 0.28, dark), 0, 1.14, 0.02));
  g.add(at(box(0.44, 0.34, 0.04, bezel), 0, 1.14, 0.17));
  const screen = at(box(0.4, 0.3, 0.04, mat(0x0c2a26, { emissive: 0x1f6a5a, emissiveIntensity: 0.6 })), 0, 1.14, 0.2);
  screen.name = 'gerty-screen';
  g.add(screen);
  const eye = at(sph(0.09, mat(0xffffff, { emissive: C.green, emissiveIntensity: 1.1 }), 12), 0, 1.16, 0.24);
  eye.name = 'gerty-eye';
  g.add(eye);
  // antenna
  g.add(at(cyl(0.02, 0.02, 0.22, bezel), 0.16, 1.42, -0.02));
  g.add(at(sph(0.045, mat(C.amber, { emissive: C.amber, emissiveIntensity: 0.9 })), 0.16, 1.55, -0.02));
  return g;
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

export function addStars(scene: THREE.Scene, count = 500, radius = 400): THREE.Points {
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
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fb6c4, size: 1.1, sizeAttenuation: false, fog: false }));
  scene.add(stars);
  return stars;
}

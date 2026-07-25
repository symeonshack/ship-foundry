import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mat } from '../scene/primitives';

let cached: THREE.Group | null = null;
let pending: Promise<THREE.Group> | null = null;

function prepareAsset(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });
}

function hasRenderableMesh(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

export function createProceduralShipAsset(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'procedural-ship-asset';

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.85, 24), mat(0x3a4750, { metal: 0.7, rough: 0.35 }));
  hub.name = 'station-hub';
  root.add(hub);

  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.14, 12, 48), mat(0x5d707c, { metal: 0.65, rough: 0.3, flat: true }));
  coreRing.rotation.x = Math.PI / 2;
  coreRing.name = 'station-ring';
  root.add(coreRing);

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.08, 10, 48), mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.24, metal: 0.45, rough: 0.4 }));
  outerRing.rotation.x = Math.PI / 2;
  outerRing.name = 'station-ring-outer';
  root.add(outerRing);

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.35, 16), mat(0x2c363d, { metal: 0.8, rough: 0.25 }));
  spine.position.y = 0.15;
  spine.name = 'station-spine';
  root.add(spine);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), mat(0x2c363d, { metal: 0.55, rough: 0.35 }));
    arm.position.set(Math.cos(angle) * 1.36, 0.05, Math.sin(angle) * 1.36);
    arm.rotation.z = Math.sin(angle) * 0.18;
    arm.name = `station-arm-${i}`;
    root.add(arm);

    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.28), mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.18, metal: 0.5, rough: 0.3 }));
    pod.position.set(Math.cos(angle) * 2.05, 0.05, Math.sin(angle) * 2.05);
    pod.name = `station-pod-${i}`;
    root.add(pod);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });

  return root;
}

export function loadShipAsset(): Promise<THREE.Group> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  pending = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/space_station.glb',
      (gltf) => {
        const root = gltf.scene;
        prepareAsset(root);
        if (!hasRenderableMesh(root)) {
          const fallback = createProceduralShipAsset();
          cached = fallback;
          resolve(fallback);
          return;
        }
        cached = root;
        resolve(root);
      },
      undefined,
      () => {
        const fallback = createProceduralShipAsset();
        cached = fallback;
        resolve(fallback);
      },
    );
  });

  return pending;
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface OrbitOpts {
  target?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
  maxPolar?: number;
  minPolar?: number;
  enablePan?: boolean;
}

export function makeCamera(fov = 50): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 2000);
}

export function makeOrbit(
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
  opts: OrbitOpts = {},
): OrbitControls {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = opts.minDistance ?? 4;
  controls.maxDistance = opts.maxDistance ?? 120;
  controls.maxPolarAngle = opts.maxPolar ?? Math.PI * 0.49;
  if (opts.minPolar !== undefined) controls.minPolarAngle = opts.minPolar;
  controls.enablePan = opts.enablePan ?? false;
  if (opts.target) controls.target.set(...opts.target);
  controls.update();
  return controls;
}

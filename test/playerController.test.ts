import { describe, expect, it } from 'vitest';
import { moveWithCollision, type Collider } from '../src/interior/playerController';

const wallEast: Collider = { minX: 4, maxX: 5, minZ: -5, maxZ: 5 };
const crate: Collider = { minX: 1, maxX: 2, minZ: 1, maxZ: 2 };

describe('moveWithCollision', () => {
  it('moves freely with no colliders', () => {
    expect(moveWithCollision({ x: 0, z: 0 }, 0.5, -0.3, [])).toEqual({ x: 0.5, z: -0.3 });
  });

  it('clamps against a wall but keeps the other axis (slide)', () => {
    const out = moveWithCollision({ x: 3.5, z: 0 }, 0.5, 0.4, [wallEast], 0.35);
    expect(out.x).toBe(3.5); // blocked: 4.0 + radius would pierce the wall
    expect(out.z).toBe(0.4); // still slides along it
  });

  it('blocks entering a furniture box from either axis', () => {
    const fromWest = moveWithCollision({ x: 0.4, z: 1.5 }, 0.5, 0, [crate], 0.35);
    expect(fromWest.x).toBe(0.4);
    const fromNorth = moveWithCollision({ x: 1.5, z: 0.4 }, 0, 0.5, [crate], 0.35);
    expect(fromNorth.z).toBe(0.4);
  });

  it('walks past a box that is not in the path', () => {
    const out = moveWithCollision({ x: 0, z: 0 }, -0.5, -0.5, [crate], 0.35);
    expect(out).toEqual({ x: -0.5, z: -0.5 });
  });

  it('respects the player radius', () => {
    const wide = moveWithCollision({ x: 3.4, z: 0 }, 0.3, 0, [wallEast], 0.35);
    expect(wide.x).toBe(3.4); // 3.7 + 0.35 > 4 → blocked
    const narrow = moveWithCollision({ x: 3.4, z: 0 }, 0.3, 0, [wallEast], 0.1);
    expect(narrow.x).toBeCloseTo(3.7); // smaller body fits
  });
});

describe('PlayerController ground height', () => {
  const make = async () => {
    const THREE = await import('three');
    const { PlayerController, EYE_HEIGHT } = await import('../src/interior/playerController');
    const camera = new THREE.PerspectiveCamera();
    const controller = new PlayerController(camera, {} as HTMLCanvasElement, [], new THREE.Vector3(1, 0, 2));
    (controller as unknown as { active: boolean }).active = true; // bypass DOM attach in node
    return { camera, controller, EYE_HEIGHT };
  };

  it('walks a flat deck by default', async () => {
    const { camera, controller, EYE_HEIGHT } = await make();
    controller.update(0.016);
    expect(camera.position.y).toBeCloseTo(EYE_HEIGHT);
  });

  it('follows the terrain when a ground sampler is set', async () => {
    const { camera, controller, EYE_HEIGHT } = await make();
    controller.groundHeight = (x, z) => x + z; // 1 + 2 = 3 at the spawn
    controller.update(0.016);
    expect(camera.position.y).toBeCloseTo(3 + EYE_HEIGHT);
  });
});

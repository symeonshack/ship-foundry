import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DayNightSky } from '../../src/scene/dayNight';
import { BALANCE } from '../../src/config/balance';

const period = BALANCE.landingZone.power.dayNight.periodSec;

const freshScene = (): THREE.Scene => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 10, 100);
  return scene;
};

describe('DayNightSky', () => {
  it('sun blazes at noon and goes dark at midnight, ambient keeps a night floor', () => {
    const scene = freshScene();
    const dn = new DayNightSky(scene, 0x8fb7c9);

    dn.update(0); // solar noon
    const noonSun = dn.sunLight.intensity;
    const noonAmb = dn.ambient.intensity;
    expect(noonSun).toBeGreaterThan(2);

    dn.update(period / 2); // midnight
    expect(dn.sunLight.intensity).toBeLessThan(1e-6);
    // ambient dims but stays navigable (you can still see, for now)
    expect(dn.ambient.intensity).toBeLessThan(noonAmb);
    expect(dn.ambient.intensity).toBeGreaterThan(0.8);
  });

  it('recolours the sky toward the dusk tone as the sun reaches the horizon', () => {
    const scene = freshScene();
    const dn = new DayNightSky(scene, 0x8fb7c9);
    dn.update(period / 4); // dusk — sun on the horizon
    const c = scene.background as THREE.Color;
    // the dusk tint is warm: much more red than blue
    expect(c.r).toBeGreaterThan(c.b);
    // fog tracks the same sky colour so the horizon matches
    expect((scene.fog as THREE.Fog).color.getHex()).toBe(c.getHex());
  });

  it('sun intensity rises and falls smoothly across a full cycle', () => {
    const scene = freshScene();
    const dn = new DayNightSky(scene, 0x8fb7c9);
    const sample = (frac: number) => {
      dn.update(period * frac);
      return dn.sunLight.intensity;
    };
    expect(sample(0)).toBeGreaterThan(sample(0.15)); // past noon, dimming
    expect(sample(0.25)).toBeLessThan(1e-6); // horizon → dark
    expect(sample(0.5)).toBeLessThan(1e-6); // midnight
    expect(sample(0.85)).toBeGreaterThan(0.01); // climbing back toward dawn/day
  });
});

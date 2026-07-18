import * as THREE from 'three';
import type { GameScreen } from '../scene/renderer';
import type { Ctx } from '../core/ctx';
import { makeCamera, makeOrbit } from '../scene/camera';
import { addStars, buildPoiMarker, mat } from '../scene/primitives';
import { POIS, POI_IDS, distanceBetween, poiDef } from './starSystem';
import { canScan, scanPoi } from './scanner';
import { deriveStats, travelCost, type ShipStats } from '../building/shipStats';
import { warnBeforeTravel, checkFuelState, hazardShortfall } from '../companion/hints';
import { arriveHome, canEmergencyReturn, emergencyReturn } from '../mining/hauling';
import { RESOURCES, type RawResourceId } from '../core/resources';
import { bar, box, button, clearPanel, el, hazardTag } from '../ui/panels';
import { toast } from '../ui/hud';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const UNKNOWN_COLOR = 0x3a4750;

export class StarMapScreen implements GameScreen {
  readonly id = 'starmap' as const;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();

  private markers = new Map<string, THREE.Group>();
  private labels = new Map<string, HTMLElement>();
  private labelLayer: HTMLElement;
  private ringNoReturn: THREE.LineLoop;
  private ringSafe: THREE.LineLoop;
  private shipMarker: THREE.Group;
  private selection: THREE.Mesh;
  private selectedPoi: string | null = null;
  private stats: ShipStats;
  private t = 0;
  private unsub: (() => void)[] = [];
  /** wired in main; travel hands the journey to the flight screen */
  flightRef: { begin(from: string, to: string, cost: number): void } | null = null;

  constructor(private ctx: Ctx, canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x06090d);
    this.camera = makeCamera(50);
    this.camera.position.set(0, 52, 40);
    this.controls = makeOrbit(this.camera, canvas, {
      target: [0, 0, 2],
      minDistance: 18,
      maxDistance: 140,
      maxPolar: Math.PI * 0.42,
      enablePan: true,
    });
    addStars(this.scene, 700);
    this.scene.add(new THREE.AmbientLight(0x8aa4b8, 1.6));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
    sun.position.set(30, 40, 10);
    this.scene.add(sun);

    const grid = new THREE.GridHelper(140, 28, 0x142430, 0x0d1820);
    grid.position.y = -0.6;
    this.scene.add(grid);

    for (const id of POI_IDS) {
      const def = POIS[id]!;
      const marker = buildPoiMarker(def.kind, def.color);
      marker.position.set(def.pos[0], 0, def.pos[1]);
      marker.scale.setScalar(1.5);
      marker.userData.poiId = id;
      this.scene.add(marker);
      this.markers.set(id, marker);
    }

    // fuel-range rings — the literal lines on the map that move as you build
    const circle = (color: number): THREE.LineLoop => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const ring = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
      this.scene.add(ring);
      return ring;
    };
    this.ringNoReturn = circle(0xff8a5c);
    this.ringSafe = circle(0x7dffa8);

    // where the ship is
    this.shipMarker = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.7, flat: true }));
    this.shipMarker.add(cone);
    this.scene.add(this.shipMarker);

    this.selection = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.05, 8, 40),
      mat(0x59d6ff, { emissive: 0x59d6ff, emissiveIntensity: 0.8 }),
    );
    this.selection.rotation.x = Math.PI / 2;
    this.selection.visible = false;
    this.scene.add(this.selection);

    // DOM labels
    this.labelLayer = el('div');
    this.labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;';
    document.getElementById('hud')!.appendChild(this.labelLayer);
    for (const id of POI_IDS) {
      const label = el('div', 'map-label', '?');
      this.labelLayer.appendChild(label);
      this.labels.set(id, label);
    }

    this.stats = deriveStats(ctx.store.state.ship);
  }

  enter(): void {
    this.stats = deriveStats(this.ctx.store.state.ship);
    this.labelLayer.style.display = 'block';
    this.refreshMarkers();
    this.renderPanel();
    this.unsub.push(
      this.ctx.bus.on('state:changed', () => {
        this.stats = deriveStats(this.ctx.store.state.ship);
        this.refreshMarkers();
        this.renderPanel();
      }),
    );
  }

  exit(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.labelLayer.style.display = 'none';
    clearPanel();
  }

  private refreshMarkers(): void {
    for (const id of POI_IDS) {
      const def = POIS[id]!;
      const scanned = this.ctx.store.poi(id).scanTier > 0 || id === 'foundry';
      const marker = this.markers.get(id)!;
      marker.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mm = m.material as THREE.MeshStandardMaterial;
          if (!scanned) {
            mm.color.setHex(UNKNOWN_COLOR);
            mm.emissive.setHex(0x000000);
          }
        }
      });
      // rebuilt colors for newly scanned sites come from a fresh marker
      if (scanned && marker.userData.dimmed) {
        const fresh = buildPoiMarker(def.kind, def.color);
        fresh.position.copy(marker.position);
        fresh.scale.copy(marker.scale);
        fresh.userData.poiId = id;
        this.scene.remove(marker);
        this.scene.add(fresh);
        this.markers.set(id, fresh);
      }
      if (!scanned) marker.userData.dimmed = true;
      this.labels.get(id)!.textContent = scanned ? def.name : 'unknown contact';
      this.labels.get(id)!.classList.toggle('unknown', !scanned);
    }
    const here = poiDef(this.ctx.store.state.currentPoi);
    this.shipMarker.position.set(here.pos[0], 2.4, here.pos[1]);
    this.ringNoReturn.position.set(here.pos[0], 0.05, here.pos[1]);
    this.ringSafe.position.set(here.pos[0], 0.05, here.pos[1]);
  }

  onClick(ndc: THREE.Vector2): void {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.markers.values()], true);
    const hit = hits[0];
    if (!hit) return;
    let node: THREE.Object3D | null = hit.object;
    while (node && !node.userData.poiId) node = node.parent;
    if (!node) return;
    this.selectPoi(node.userData.poiId as string);
  }

  private selectPoi(id: string): void {
    this.selectedPoi = id;
    const def = poiDef(id);
    this.selection.visible = true;
    this.selection.position.set(def.pos[0], 0.1, def.pos[1]);
    // GERTY flags under-rated hazards the moment you show interest
    if (this.ctx.store.poi(id).scanTier > 0 && id !== this.ctx.store.state.currentPoi) {
      warnBeforeTravel(this.ctx.store, id, this.stats);
    }
    this.renderPanel();
  }

  private travelTo(id: string): void {
    const store = this.ctx.store;
    const from = store.state.currentPoi;
    const cost = travelCost(this.stats, distanceBetween(from, id));
    if (!this.stats.hasLifeSupport) {
      toast('No life support fitted — the ship stays docked', 'bad');
      return;
    }
    if (this.stats.thrust <= 0) {
      toast('No engine fitted', 'bad');
      return;
    }
    if (store.state.fuel < cost) {
      toast('Not enough fuel for that burn', 'bad');
      return;
    }
    warnBeforeTravel(store, id, this.stats);
    // emitted before the burn so departure listeners (checkpoints) see the pre-trip state
    store.bus.emit('travel:depart', { from, to: id });
    store.state.fuel -= cost;
    store.state.currentPoi = id;
    if (id === 'foundry') {
      arriveHome(store);
    } else {
      store.poi(id).visited = true;
    }
    store.changed();
    // travel is flown, not teleported: the flight screen finishes the arrival
    // (emits travel:arrive, checks fuel state, lands you aboard)
    if (this.flightRef) {
      this.flightRef.begin(from, id, cost);
      this.ctx.nav('flight');
    } else {
      store.bus.emit('travel:arrive', { poiId: id });
      checkFuelState(store, this.stats);
      this.ctx.nav('interior');
    }
  }

  private renderPanel(): void {
    clearPanel();
    const store = this.ctx.store;

    if (this.selectedPoi) {
      const id = this.selectedPoi;
      const def = poiDef(id);
      const poi = store.poi(id);
      const scanned = poi.scanTier > 0 || id === 'foundry';
      const card = box(scanned ? def.name : 'Unknown Contact');

      const dist = distanceBetween(store.state.currentPoi, id);
      if (id !== store.state.currentPoi) {
        card.appendChild(el('div', 'sub', `Distance ${dist.toFixed(0)} · burn ≈ ${travelCost(this.stats, dist).toFixed(1)} fuel`));
      } else {
        card.appendChild(el('div', 'sub', 'You are here.'));
      }

      if (scanned) {
        card.appendChild(el('p', 'sub', def.blurb));
        if (poi.scanTier >= 2) card.appendChild(el('p', 'sub', def.detail));
        const hz = el('div', 'row');
        hz.appendChild(hazardTag(def.hazard.type, poi.scanTier >= 2 ? def.hazard.intensity : undefined));
        if (def.hazard.type && hazardShortfall(id, this.stats)) {
          hz.appendChild(el('span', 'sub', '· exceeds your shielding'));
        }
        card.appendChild(hz);
        for (const [res, richness] of Object.entries(def.composition)) {
          const row = el('div', 'row');
          const name = el('span', undefined, RESOURCES[res as RawResourceId].name);
          name.style.cssText = 'font-size:12px;width:80px';
          row.appendChild(name);
          row.appendChild(bar(richness, `#${RESOURCES[res as RawResourceId].color.toString(16).padStart(6, '0')}`));
          card.appendChild(row);
        }
      } else {
        card.appendChild(el('p', 'sub', 'No survey data. Scan it before you spend fuel on it.'));
      }

      // scan
      const scanCheck = canScan(store, id);
      const wouldTier = Math.max(1, Math.min(2, this.stats.sensorTier));
      if (poi.scanTier < wouldTier && id !== 'foundry') {
        if (scanCheck.ok) {
          card.appendChild(button(poi.scanTier === 0 ? 'Scan' : 'Re-scan (deeper array)', () => {
            scanPoi(store, id);
            toast('Survey complete', 'good');
          }));
        } else {
          card.appendChild(el('div', 'sub', `✕ ${scanCheck.reason}`));
        }
      }

      // travel
      if (id !== store.state.currentPoi && scanned) {
        const cost = travelCost(this.stats, dist);
        const b = button(`Travel (${cost.toFixed(1)} fuel)`, () => this.travelTo(id));
        if (store.state.fuel < cost || !this.stats.hasLifeSupport || this.stats.thrust <= 0) b.disabled = true;
        card.appendChild(b);
        const homeCostAfter = travelCost(this.stats, distanceBetween(id, 'foundry'));
        if (store.state.fuel >= cost && store.state.fuel - cost < homeCostAfter && id !== 'foundry') {
          card.appendChild(el('div', 'sub', '⚠ That burn leaves you short of the fuel to get home.'));
        }
      }
    } else {
      const help = box('System Chart');
      help.appendChild(el('p', 'sub', 'Click a contact to survey it. Solid outer ring: point of no return. Inner ring: out-and-back on the current tank.'));
    }

    const ship = box('Ship');
    ship.appendChild(button('Step back from the console', () => this.ctx.nav('interior')));

    // stranded escape hatch
    if (canEmergencyReturn(store)) {
      const homeCost = travelCost(this.stats, distanceBetween(store.state.currentPoi, 'foundry'));
      if (store.state.fuel < homeCost) {
        const sos = box('Emergency');
        sos.appendChild(el('p', 'sub', 'Not enough fuel to reach the Foundry. Jettison the hold and burn the reserve.'));
        sos.appendChild(button('Emergency return (lose all cargo)', () => {
          emergencyReturn(store);
          toast('Hold jettisoned. You made it back with the frame and your pulse.', 'warn');
          this.ctx.nav('shipyard');
        }, 'danger'));
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.controls.update();

    const fuel = this.ctx.store.state.fuel;
    const oneWay = Number.isFinite(this.stats.fuelPerDist) && this.stats.fuelPerDist > 0 ? fuel / this.stats.fuelPerDist : 0;
    this.ringNoReturn.scale.setScalar(Math.max(0.001, oneWay));
    this.ringSafe.scale.setScalar(Math.max(0.001, oneWay / 2));

    this.shipMarker.position.y = 2.4 + Math.sin(this.t * 2) * 0.2;
    this.shipMarker.rotation.y += dt;

    const anomaly = this.markers.get('anomaly');
    const halo = anomaly?.getObjectByName('halo');
    if (halo) halo.rotation.z += dt * 0.5;
    const signal = this.markers.get('signal')?.getObjectByName('pulse');
    if (signal) {
      const s = 1 + Math.sin(this.t * 3) * 0.15;
      signal.scale.setScalar(s);
    }

    // project DOM labels
    const v = new THREE.Vector3();
    for (const id of POI_IDS) {
      const def = POIS[id]!;
      const label = this.labels.get(id)!;
      v.set(def.pos[0], 1.8, def.pos[1]).project(this.camera);
      if (v.z > 1) {
        label.style.display = 'none';
        continue;
      }
      label.style.display = 'block';
      label.style.left = `${((v.x + 1) / 2) * window.innerWidth}px`;
      label.style.top = `${((-v.y + 1) / 2) * window.innerHeight}px`;
    }
  }
}

/**
 * The food system (Phase 36-39). Food is a separate meter that always drains,
 * fed by a chain the player builds:
 *
 *   passive organic waste + regolith  --(Soil Processor)-->  growing medium
 *   growing medium + irrigation (fuel) --(Greenhouse)-->  crop --grows--> harvest --> food
 *
 * A greenhouse auto-plants when supplied and auto-replants on harvest (that's
 * the seed-saving — the loop keeps itself going). Growth speed depends on the
 * light source: transparent panels grow full-speed in daylight and slowly at
 * night, grow-lights grow full-speed around the clock but burn fuel. A damaged
 * greenhouse risks contamination (a lost harvest); a running greenhouse eases
 * the food drain a touch (oxygen). Intermediates are base-state counters, not
 * stock resources. Pure — BaseSim ticks it.
 */
import { BALANCE } from '../config/balance';
import type { GameStore } from '../core/state';
import { isDamaged, type StructureInstance } from './structures';
import { solarFactor } from './power';

export interface FoodTick {
  /** a crop was harvested into food this tick */
  harvested: boolean;
  /** a harvest was lost to contamination this tick */
  contaminated: boolean;
  /** the food meter crossed the low threshold this tick ('low' entering, 'ok' leaving) */
  lowCrossed: 'low' | 'ok' | null;
}

const lowThreshold = (): number => BALANCE.landingZone.food.cap * 0.2;

/** food status for the HUD gauge */
export function foodStatus(level: number): 'ok' | 'low' | 'critical' {
  if (level <= 0.001) return 'critical';
  if (level <= lowThreshold()) return 'low';
  return 'ok';
}

function hasProducingGreenhouse(structures: readonly StructureInstance[]): boolean {
  return structures.some((s) => s.status === 'active' && s.defId === 'greenhouse' && s.cropProgress !== undefined);
}

export function tickFood(store: GameStore, dt: number): FoodTick {
  const cfg = BALANCE.landingZone.food;
  const f = store.state.food;
  const stock = store.state.stock;
  const t = store.state.playSeconds;
  const structures = store.state.base.structures;
  const active = (id: StructureInstance['defId']) => structures.filter((s) => s.status === 'active' && s.defId === id);

  // 1. organic waste trickles up passively (a habitat byproduct), capped
  f.organicWaste = Math.min(cfg.wasteCap, f.organicWaste + cfg.wastePerSec * dt);

  // 2. soil processors: waste + regolith → growing medium
  for (const sp of active('soilProcessor')) {
    void sp;
    if (f.growingMedium >= cfg.growingMediumCap) break;
    const amt = cfg.soil.ratePerSec * dt;
    const needWaste = amt * cfg.soil.wastePerMedium;
    const needReg = amt * cfg.soil.regolithPerMedium;
    if (f.organicWaste >= needWaste && (stock.regolith ?? 0) >= needReg) {
      f.organicWaste -= needWaste;
      stock.regolith -= needReg;
      f.growingMedium = Math.min(cfg.growingMediumCap, f.growingMedium + amt);
    }
  }

  // 3. greenhouses: plant → grow → harvest → replant
  let harvested = false;
  let contaminated = false;
  const daylight = solarFactor(t) > 0.02;
  for (const gh of active('greenhouse')) {
    if (gh.cropProgress === undefined) {
      // fallow — plant when there's medium and irrigation to spare
      if (f.growingMedium >= cfg.crop.mediumPerPlant && (stock.fuel ?? 0) >= cfg.crop.fuelPerPlant) {
        f.growingMedium -= cfg.crop.mediumPerPlant;
        stock.fuel -= cfg.crop.fuelPerPlant;
        gh.cropProgress = 0;
      }
      continue;
    }
    // growing — light source sets the rate
    let rate = 1;
    if (gh.growLights) {
      const cost = cfg.crop.growLightFuelPerSec * dt;
      if ((stock.fuel ?? 0) >= cost) stock.fuel -= cost;
      else rate = daylight ? 1 : cfg.crop.nightFactor; // out of fuel → fall back to sunlight
    } else {
      rate = daylight ? 1 : cfg.crop.nightFactor;
    }
    gh.cropProgress += dt * rate;
    if (gh.cropProgress >= cfg.crop.growSec) {
      const spoiled = isDamaged(gh) && Math.random() < cfg.crop.contaminationChanceWhenDamaged;
      if (spoiled) {
        contaminated = true;
      } else {
        f.level = Math.min(cfg.cap, f.level + cfg.crop.foodPerHarvest);
        f.harvests += 1;
        harvested = true;
      }
      gh.cropProgress = undefined; // fallow again; replants next tick if still supplied
    }
  }

  // 4. the food meter drains continuously — a producing greenhouse eases it (oxygen)
  const wasLow = f.level <= lowThreshold();
  const drain = cfg.drainPerSec * (hasProducingGreenhouse(structures) ? 1 - cfg.oxygenRelief : 1);
  f.level = Math.max(0, f.level - drain * dt);
  const nowLow = f.level <= lowThreshold();

  return { harvested, contaminated, lowCrossed: wasLow !== nowLow ? (nowLow ? 'low' : 'ok') : null };
}

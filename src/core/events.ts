import type { RawResourceId, RefinedResourceId } from './resources';
import type { PartId } from '../building/partCatalog';
import type { FlagValue } from './flags';
import type { HazardType } from '../exploration/starSystem';
import type { SpokenLine } from '../companion/gerty';
import type { Gesture } from '../encounter/collaborator';

export type ScreenId = 'interior' | 'lander' | 'starmap' | 'shipyard' | 'surface' | 'encounter' | 'flight' | 'structure' | 'terraintest';

export interface GameEvents {
  'screen:change': { screen: ScreenId };
  'state:changed': Record<string, never>;

  'scan:complete': { poiId: string; tier: number };
  'travel:depart': { from: string; to: string };
  'travel:arrive': { poiId: string };

  'rig:deployed': { rigId: string; poiId: string };
  'rig:destroyed': { rigId: string; poiId: string; partId: PartId };
  'rig:recalled': { rigId: string };
  'mine:extracted': { resource: RawResourceId; amount: number };
  'cargo:full': Record<string, never>;
  'cargo:unloaded': Record<string, never>;
  'node:collapsed': { poiId: string; nodeId: string };
  'site:discovery': { poiId: string; id: string; label: string };

  // Landing Zone base-building
  'structure:placed': { uid: string; defId: string };
  'structure:complete': { uid: string; defId: string };
  'structure:destroyed': { uid: string; defId: string };
  'structure:repaired': { uid: string; defId: string };
  /** the ambient fuel drain stopped/resumed — solar+refinery+storage all standing or not (Phase 14) */
  'pressure:relieved': Record<string, never>;
  'pressure:engaged': Record<string, never>;
  /** a nuclear generator ran dry / came back on stream (Phase 15) */
  'power:generatorOffline': { uid: string; defId: string };
  'power:generatorOnline': { uid: string; defId: string };
  /** a Fabricator queue job finished (Phase 17) — no world entity yet, that's Phase 24 */
  'drone:produced': { defId: string };
  'drone:idle': Record<string, never>;

  'refine:complete': { recipeId: string; output: RefinedResourceId };
  'build:placed': { partId: PartId };
  'build:removed': { partId: PartId };

  'flag:set': { flag: string; value: FlagValue };
  'fragment:found': { key: string };
  'gerty:line': { line: SpokenLine };
  'hazard:warning': { poiId: string; hazard: HazardType };
  'fuel:low': Record<string, never>;
  'fuel:stranded': Record<string, never>;

  'encounter:gesture': { gesture: Gesture };
  'encounter:turn': { actor: 'player' | 'collaborator' };
  'encounter:solved': Record<string, never>;

  'game:reset': Record<string, never>;
}

type Handler<T> = (payload: T) => void;

/** Tiny typed pub/sub bus; every cross-system interaction goes through here. */
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(event: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<GameEvents[K]>)(payload);
  }
}

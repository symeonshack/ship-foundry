import type { EventBus, ScreenId } from './events';
import type { GameStore } from './state';
import type { Gerty } from '../companion/gerty';
import type { DiscoveryLog } from '../companion/discoveryLog';
import type { Refinery } from '../mining/refinery';

/** wiring handed to every screen and UI module */
export interface Ctx {
  bus: EventBus;
  store: GameStore;
  gerty: Gerty;
  log: DiscoveryLog;
  refinery: Refinery;
  nav: (id: ScreenId) => void;
}

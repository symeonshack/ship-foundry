import type { GameStore } from '../core/state';
import { FRAGMENTS } from './fragments';

/**
 * Auto-populated logbook. Anything in the game can insert a keyed fragment at
 * a trigger/location; entries are deduplicated by key in the store.
 */
export class DiscoveryLog {
  constructor(private store: GameStore) {}

  insert(key: string): void {
    const def = FRAGMENTS[key];
    if (!def) {
      console.warn(`unknown fragment key: ${key}`);
      return;
    }
    this.store.pushLog({
      key: def.key,
      title: def.title,
      body: def.body,
      source: def.source,
      topicId: def.topicId,
      at: this.store.state.playSeconds,
    });
  }

  /** standard location/system triggers; GERTY lines insert their own via onFragment */
  wire(): void {
    const bus = this.store.bus;
    bus.on('scan:complete', ({ poiId }) => {
      if (poiId === 'anomaly') this.insert('anomaly-scan');
      if (poiId === 'signal') this.insert('signal-scan');
    });
    bus.on('travel:arrive', ({ poiId }) => {
      if (poiId === 'anomaly') this.insert('anomaly-visit');
    });
    bus.on('encounter:solved', () => this.insert('encounter-solved'));
  }
}

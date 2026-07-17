import type { GameStore } from '../core/state';

export type GertyMood = 'say' | 'hint' | 'decline';

export interface SpokenLine {
  id: string;
  mood: GertyMood;
  text: string;
  /** seconds the HUD should keep it on screen */
  duration: number;
}

export interface CondCtx {
  store: GameStore;
}

/**
 * A single GERTY line, matched by trigger key. All narrative meaning lives in
 * `text`/`fragment`/`setFlags` — the engine only sees trigger names and flag
 * names, which is what keeps both open story questions swappable later.
 */
export interface LineDef {
  id: string;
  trigger: string;
  text: string;
  mood?: GertyMood;
  priority?: number;
  /** how many times this line may ever fire; default 1 */
  maxTimes?: number;
  /** min seconds between repeats when maxTimes > 1 */
  cooldownSec?: number;
  when?: (ctx: CondCtx) => boolean;
  setFlags?: string[];
  /** discovery-log fragment inserted when this line is spoken */
  fragment?: string;
}

/**
 * Topics the player can raise from the logbook. Each resolves to an open
 * answer or an explicit "declines to answer" state purely from flag data —
 * future narrative content changes these entries, never the engine.
 */
export interface TopicDef {
  id: string;
  label: string;
  /** flag that unlocks the open answer; omitted = declines for all of v1 */
  unlockFlag?: string;
  locked: string;
  unlocked?: string;
  /** log the refusal as evidence the first time it happens */
  declineFragment?: string;
}

export class Gerty {
  private queue: SpokenLine[] = [];
  private busyUntil = 0;
  onFragment: ((key: string) => void) | null = null;

  constructor(
    private store: GameStore,
    private lines: LineDef[],
    private topics: TopicDef[],
  ) {}

  /** hook up the standard trigger events; called once from main */
  wire(): void {
    const bus = this.store.bus;
    bus.on('scan:complete', ({ poiId }) => {
      this.notify(`scan:${poiId}`);
      this.notify('scan');
    });
    bus.on('travel:arrive', ({ poiId }) => {
      this.notify(`arrive:${poiId}`);
      this.notify('arrive');
    });
    bus.on('mine:extracted', () => this.notify('mine'));
    bus.on('cargo:full', () => this.notify('cargo-full'));
    bus.on('cargo:unloaded', () => this.notify('unload'));
    bus.on('rig:destroyed', () => this.notify('rig-destroyed'));
    bus.on('node:collapsed', () => this.notify('node-collapsed'));
    bus.on('refine:complete', () => this.notify('refine'));
    bus.on('build:placed', () => this.notify('build'));
    bus.on('fuel:low', () => this.notify('fuel-low'));
    bus.on('fuel:stranded', () => this.notify('stranded'));
    bus.on('hazard:warning', ({ hazard }) => this.notify(`hazard:${hazard}`));
    bus.on('encounter:turn', ({ actor }) => {
      if (actor === 'collaborator') this.notify('encounter-response');
    });
    bus.on('encounter:gesture', ({ gesture }) => this.notify(`gesture:${gesture}`));
    bus.on('encounter:solved', () => this.notify('encounter-solved'));
  }

  /** find the best line for a trigger and queue it */
  notify(trigger: string): void {
    const now = this.store.state.playSeconds;
    const candidates = this.lines.filter((l) => {
      if (l.trigger !== trigger) return false;
      const seen = this.store.state.gertySeen[l.id];
      if (seen && seen.count >= (l.maxTimes ?? 1)) return false;
      if (seen && now - seen.lastAt < (l.cooldownSec ?? 20)) return false;
      if (l.when && !l.when({ store: this.store })) return false;
      return true;
    });
    if (candidates.length === 0) return;
    candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.speak(candidates[0]!);
  }

  speakById(id: string): void {
    const line = this.lines.find((l) => l.id === id);
    if (line) this.speak(line);
  }

  private speak(line: LineDef): void {
    const now = this.store.state.playSeconds;
    const seen = this.store.state.gertySeen[line.id] ?? { count: 0, lastAt: -Infinity };
    this.store.state.gertySeen[line.id] = { count: seen.count + 1, lastAt: now };
    for (const f of line.setFlags ?? []) this.store.setFlag(f);
    if (line.fragment) this.onFragment?.(line.fragment);
    this.enqueue({
      id: line.id,
      mood: line.mood ?? 'say',
      text: line.text,
      duration: Math.min(12, 2.5 + line.text.length * 0.045),
    });
  }

  /** the player asks about a discovered topic; resolves to say or an explicit decline */
  ask(topicId: string): void {
    const topic = this.topics.find((t) => t.id === topicId);
    if (!topic) return;
    // a direct question interrupts ambient chatter — answer immediately
    this.queue = [];
    this.busyUntil = 0;
    const open = topic.unlockFlag !== undefined && this.store.hasFlag(topic.unlockFlag) && topic.unlocked;
    if (open) {
      this.enqueue({ id: `topic:${topic.id}`, mood: 'say', text: topic.unlocked!, duration: Math.min(12, 2.5 + topic.unlocked!.length * 0.045) });
    } else {
      this.enqueue({ id: `topic:${topic.id}`, mood: 'decline', text: topic.locked, duration: Math.min(12, 2.5 + topic.locked.length * 0.045) });
      if (topic.declineFragment) this.onFragment?.(topic.declineFragment);
    }
  }

  topicList(): TopicDef[] {
    return this.topics;
  }

  private enqueue(line: SpokenLine): void {
    if (this.queue.length >= 3) this.queue.shift();
    this.queue.push(line);
  }

  update(_dt: number): void {
    const now = this.store.state.playSeconds;
    if (now < this.busyUntil || this.queue.length === 0) return;
    const line = this.queue.shift()!;
    this.busyUntil = now + line.duration + 0.6;
    this.store.bus.emit('gerty:line', { line });
  }
}

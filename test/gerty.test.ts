import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { GameStore, createNewGame } from '../src/core/state';
import { Gerty, type LineDef, type SpokenLine, type TopicDef } from '../src/companion/gerty';

const LINES: LineDef[] = [
  { id: 'once', trigger: 'test', text: 'only once' },
  { id: 'low', trigger: 'pick', text: 'low', priority: 0 },
  { id: 'high', trigger: 'pick', text: 'high', priority: 5 },
  { id: 'gated', trigger: 'gated', text: 'gated', when: ({ store }) => store.hasFlag('open-sesame') },
  { id: 'flagger', trigger: 'flag-me', text: 'sets a flag', setFlags: ['was-said'] },
];

const TOPICS: TopicDef[] = [
  { id: 'secret', label: 'Secret', locked: 'no comment', unlockFlag: 'revealed', unlocked: 'the answer' },
  { id: 'forever', label: 'Forever sealed', locked: 'sealed' },
];

function setup(): { store: GameStore; gerty: Gerty; spoken: SpokenLine[] } {
  const store = new GameStore(new EventBus(), createNewGame());
  const gerty = new Gerty(store, LINES, TOPICS);
  const spoken: SpokenLine[] = [];
  store.bus.on('gerty:line', ({ line }) => spoken.push(line));
  return { store, gerty, spoken };
}

/** advance play time and pump the queue */
function pump(store: GameStore, gerty: Gerty, seconds: number): void {
  for (let i = 0; i < seconds * 10; i++) {
    store.state.playSeconds += 0.1;
    gerty.update(0.1);
  }
}

describe('Gerty', () => {
  it('speaks a line at most maxTimes', () => {
    const { store, gerty, spoken } = setup();
    gerty.notify('test');
    pump(store, gerty, 20);
    gerty.notify('test');
    pump(store, gerty, 20);
    expect(spoken.filter((l) => l.id === 'once')).toHaveLength(1);
  });

  it('prefers higher priority lines', () => {
    const { store, gerty, spoken } = setup();
    gerty.notify('pick');
    pump(store, gerty, 5);
    expect(spoken[0]!.id).toBe('high');
  });

  it('respects when() conditions on flags', () => {
    const { store, gerty, spoken } = setup();
    gerty.notify('gated');
    pump(store, gerty, 5);
    expect(spoken).toHaveLength(0);
    store.setFlag('open-sesame');
    gerty.notify('gated');
    pump(store, gerty, 5);
    expect(spoken.map((l) => l.id)).toContain('gated');
  });

  it('sets flags when a line is spoken', () => {
    const { store, gerty } = setup();
    gerty.notify('flag-me');
    expect(store.hasFlag('was-said')).toBe(true);
  });

  it('declines locked topics explicitly, then answers once unlocked', () => {
    const { store, gerty, spoken } = setup();
    gerty.ask('secret');
    pump(store, gerty, 8);
    expect(spoken[0]!.mood).toBe('decline');
    expect(spoken[0]!.text).toBe('no comment');
    store.setFlag('revealed');
    gerty.ask('secret');
    pump(store, gerty, 8);
    expect(spoken[1]!.mood).toBe('say');
    expect(spoken[1]!.text).toBe('the answer');
  });

  it('keeps permanently sealed topics in the decline state', () => {
    const { store, gerty, spoken } = setup();
    gerty.ask('forever');
    pump(store, gerty, 8);
    expect(spoken[0]!.mood).toBe('decline');
  });
});

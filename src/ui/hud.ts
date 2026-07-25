import type { Ctx } from '../core/ctx';
import { ALL_RESOURCE_IDS, RESOURCES, type RawResourceId } from '../core/resources';
import { deriveStats } from '../building/shipStats';
import { poiDef } from '../exploration/starSystem';
import { listCheckpoints, restoreCheckpoint, wipeAll } from '../save/persistence';
import { FLAGS } from '../core/flags';
import { ITEM_NAMES } from '../structure/layout';
import { el } from './panels';
import type { SpokenLine } from '../companion/gerty';
import type { ScreenId } from '../core/events';

let toastArea: HTMLElement | null = null;

export function toast(text: string, kind: 'info' | 'warn' | 'bad' | 'good' = 'info'): void {
  if (!toastArea) return;
  const t = el('div', `toast ${kind === 'info' ? '' : kind}`, text);
  toastArea.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

const SCREEN_HINTS: Record<ScreenId, string> = {
  interior: 'SHIP — WASD to move, mouse to look (click the view to capture the cursor; arrows also look), E to interact. The map lives on the table; GERTY lives on the wall.',
  flight: 'TRANSIT — A/D steer against drift, W/S throttle. On descent: HOLD SPACE to retro-burn before the ground arrives.',
  shipyard: 'SHIPYARD — pick a part, click a glowing socket to fit it. Click a fitted part to inspect or remove it. Watch the engines: glow means strain.',
  starmap: 'STAR MAP — click a contact to survey it. The outer ring is your point of no return; the inner ring gets you home again.',
  surface: 'SURFACE OPS — drag or WASD to pan, wheel to zoom, right-drag to rotate. Minimap (bottom right): click to jump; H recenters on the lander. Arm a rig, click a deposit to deploy. TAB drops you on foot wherever the camera is looking; E to interact.',
  encounter: 'THE RELAY — no shared language. Place a module; watch what it keeps, what it removes, what it points at.',
  structure: 'THE ARCHIVE — WASD/mouse, E to interact. Read the plates. The resident is not hostile; it is thorough. Its rules can be satisfied to the letter.',
  terraintest: 'TERRAIN RANGE — dev proof of concept. Pan/zoom: chunks stream under the camera focus. TAB drops you on foot at that spot; TAB again lifts back out.',
};

export class Hud {
  private chips = new Map<string, HTMLElement>();
  private cargoChips: HTMLElement;
  private fuelFill: HTMLElement;
  private fuelLabel: HTMLElement;
  private location: HTMLElement;
  private navButtons = new Map<string, HTMLButtonElement>();
  private gertyBox: HTMLElement;
  private gertyText: HTMLElement;
  private gertyTimer: number | null = null;
  private typeTimer: number | null = null;
  private modal: HTMLElement;
  private hint: HTMLElement;
  private devBadge: HTMLElement;
  private activeScreen: ScreenId = 'interior';

  constructor(private ctx: Ctx) {
    const hud = document.getElementById('hud')!;

    // top bar
    const top = el('div');
    top.id = 'topbar';
    const res = el('div');
    res.id = 'resources';
    for (const id of ALL_RESOURCE_IDS) {
      const chip = el('span', `chip ${RESOURCES[id].kind}`);
      const dot = el('span', 'dot');
      dot.style.background = `#${RESOURCES[id].color.toString(16).padStart(6, '0')}`;
      chip.append(dot, el('span', 'name', RESOURCES[id].name), el('span', 'amt', '0'));
      chip.title = RESOURCES[id].desc;
      this.chips.set(id, chip);
      res.appendChild(chip);
    }
    this.cargoChips = el('span');
    res.appendChild(this.cargoChips);
    top.appendChild(res);

    const fuelWrap = el('div');
    fuelWrap.id = 'fuel-wrap';
    fuelWrap.appendChild(el('span', undefined, 'FUEL'));
    const fuelBar = el('div');
    fuelBar.id = 'fuel-bar';
    this.fuelFill = el('div');
    this.fuelFill.id = 'fuel-fill';
    fuelBar.appendChild(this.fuelFill);
    fuelWrap.appendChild(fuelBar);
    this.fuelLabel = el('span', undefined, '');
    fuelWrap.appendChild(this.fuelLabel);
    top.appendChild(fuelWrap);

    this.location = el('span');
    this.location.id = 'location';
    top.appendChild(this.location);

    this.devBadge = el('span', undefined, 'DEV');
    this.devBadge.id = 'dev-badge';
    this.devBadge.title = 'Dev mode active — full stock, bottomless tank. Type c-h-t to toggle.';
    this.devBadge.style.display = 'none';
    top.appendChild(this.devBadge);

    const nav = el('div');
    nav.id = 'nav';
    const addNav = (key: string, label: string, onClick: () => void): void => {
      const b = el('button', undefined, label) as HTMLButtonElement;
      b.addEventListener('click', onClick);
      this.navButtons.set(key, b);
      nav.appendChild(b);
    };
    addNav('ship', 'SHIP', () => ctx.nav('interior'));
    addNav('shipyard', 'SHIPYARD', () => ctx.nav('shipyard'));
    addNav('site', 'SITE', () => {
      const def = poiDef(ctx.store.state.currentPoi);
      ctx.nav(def.special === 'signal' ? 'encounter' : 'surface');
    });
    addNav('log', 'LOG', () => this.openLogbook());
    addNav('reset', '⟲', () => this.openSaves());
    this.navButtons.get('reset')!.classList.add('danger');
    this.navButtons.get('reset')!.title = 'Saves & checkpoints';
    top.appendChild(nav);
    hud.appendChild(top);

    // side panel container (screens fill it)
    const panel = el('div');
    panel.id = 'panel';
    hud.appendChild(panel);

    // screen hint
    this.hint = el('div');
    this.hint.id = 'screen-hint';
    hud.appendChild(this.hint);

    // GERTY box
    this.gertyBox = el('div');
    this.gertyBox.id = 'gerty';
    this.gertyBox.appendChild(el('div', 'g-name', 'GERTY'));
    this.gertyText = el('div', 'g-text');
    this.gertyBox.appendChild(this.gertyText);
    hud.appendChild(this.gertyBox);

    // toasts + modal
    toastArea = el('div');
    toastArea.id = 'toasts';
    hud.appendChild(toastArea);
    this.modal = el('div');
    this.modal.id = 'modal';
    this.modal.addEventListener('click', (ev) => {
      if (ev.target === this.modal) this.modal.classList.remove('open');
    });
    hud.appendChild(this.modal);

    ctx.bus.on('state:changed', () => this.refresh());
    ctx.bus.on('screen:change', ({ screen }) => {
      this.activeScreen = screen;
      for (const [key, b] of this.navButtons)
        b.classList.toggle(
          'active',
          (key === 'ship' && screen === 'interior') || key === screen || (key === 'site' && (screen === 'surface' || screen === 'encounter')),
        );
      this.hint.textContent = SCREEN_HINTS[screen];
      // aboard, GERTY is a physical console — the comms box is for away operations
      if (screen === 'interior') this.gertyBox.classList.remove('visible');
      this.refresh();
    });
    ctx.bus.on('gerty:line', ({ line }) => this.showGerty(line));
    ctx.bus.on('fragment:found', () => toast('Discovery logged', 'good'));
    this.refresh();
  }

  private refresh(): void {
    const s = this.ctx.store.state;
    for (const id of ALL_RESOURCE_IDS) {
      const chip = this.chips.get(id)!;
      const amt = Math.floor(s.stock[id] ?? 0);
      (chip.querySelector('.amt') as HTMLElement).textContent = String(amt);
      chip.style.display = amt > 0 || RESOURCES[id].kind === 'refined' ? '' : 'none';
    }
    // hold contents
    this.cargoChips.replaceChildren();
    for (const [id, n] of Object.entries(s.cargo)) {
      if (n <= 0) continue;
      const chip = el('span', 'chip raw');
      const dot = el('span', 'dot');
      dot.style.background = `#${RESOURCES[id as RawResourceId].color.toString(16).padStart(6, '0')}`;
      chip.append(dot, el('span', 'name', `hold: ${RESOURCES[id as RawResourceId].name}`), el('span', 'amt', String(Math.floor(n))));
      this.cargoChips.appendChild(chip);
    }
    for (const item of s.items ?? []) {
      const chip = el('span', 'chip raw');
      const dot = el('span', 'dot');
      dot.style.background = '#59d6ff';
      chip.append(dot, el('span', 'name', `tool: ${ITEM_NAMES[item] ?? item}`));
      this.cargoChips.appendChild(chip);
    }

    const stats = deriveStats(s.ship);
    const frac = stats.fuelCap > 0 ? s.fuel / stats.fuelCap : 0;
    this.fuelFill.style.width = `${Math.round(frac * 100)}%`;
    this.fuelFill.classList.toggle('low', frac < 0.25);
    this.fuelLabel.textContent = `${s.fuel.toFixed(0)}/${stats.fuelCap}`;

    const def = poiDef(s.currentPoi);
    this.location.textContent = `◈ ${def.name.toUpperCase()}`;
    this.devBadge.style.display = this.ctx.store.hasFlag(FLAGS.DEV_MODE) ? '' : 'none';

    const atHome = s.currentPoi === 'foundry';
    const inFlight = this.activeScreen === 'flight';
    const foundryBuilt = this.ctx.store.hasFlag(FLAGS.FOUNDRY_BUILT);
    this.navButtons.get('ship')!.disabled = this.activeScreen === 'interior' || inFlight;
    this.navButtons.get('shipyard')!.disabled = !atHome || inFlight || !foundryBuilt;
    this.navButtons.get('shipyard')!.title = !foundryBuilt
      ? 'No working foundry yet — establish one at the site first.'
      : atHome
        ? ''
        : 'The shipyard is back at the Foundry.';
    // the Foundry is a live buildable/mineable site now, same as any away-site
    this.navButtons.get('site')!.disabled = inFlight;
    this.navButtons.get('site')!.textContent = `SITE: ${def.name.toUpperCase()}`;
  }

  private showGerty(line: SpokenLine): void {
    if (this.activeScreen === 'interior') return; // the console speech bubble handles it aboard
    if (this.gertyTimer) window.clearTimeout(this.gertyTimer);
    if (this.typeTimer) window.clearInterval(this.typeTimer);
    this.gertyBox.classList.add('visible');
    this.gertyBox.classList.toggle('decline', line.mood === 'decline');
    (this.gertyBox.querySelector('.g-name') as HTMLElement).textContent =
      line.mood === 'decline' ? 'GERTY — UNABLE TO COMPLY' : line.mood === 'hint' ? 'GERTY — ADVISORY' : 'GERTY';
    this.gertyText.textContent = '';
    let i = 0;
    this.typeTimer = window.setInterval(() => {
      i += 2;
      this.gertyText.textContent = line.text.slice(0, i);
      if (i >= line.text.length && this.typeTimer) window.clearInterval(this.typeTimer);
    }, 18);
    this.gertyTimer = window.setTimeout(() => this.gertyBox.classList.remove('visible'), line.duration * 1000);
  }

  openSaves(): void {
    const card = el('div', 'modal-card');
    card.appendChild(el('h2', undefined, 'Saves & Checkpoints'));
    card.appendChild(
      el(
        'p',
        'sub',
        'Checkpoints are captured automatically: at wake-up, before every departure from the Foundry, on docking, and at major discoveries. Restoring first snapshots your current progress as “Before rollback”, so you can always change your mind.',
      ),
    );
    const cps = listCheckpoints();
    if (cps.length === 0) {
      card.appendChild(el('p', 'sub', 'No checkpoints yet.'));
    }
    for (const cp of cps) {
      const row = el('div', 'log-entry');
      row.appendChild(el('h4', undefined, cp.label));
      const mins = Math.floor(cp.playSeconds / 60);
      row.appendChild(el('div', 'meta', `${new Date(cp.at).toLocaleString()} · ${mins}m played · at ${cp.state.currentPoi}`));
      const restore = el('button', undefined, 'Restore') as HTMLButtonElement;
      restore.addEventListener('click', () => {
        restoreCheckpoint(cp, this.ctx.store.state);
      });
      row.appendChild(restore);
      card.appendChild(row);
    }
    const wipe = el('button', 'danger', 'Wipe save & checkpoints — start over') as HTMLButtonElement;
    wipe.style.marginTop = '14px';
    wipe.addEventListener('click', () => {
      if (window.confirm('Erase everything — save and all checkpoints — and start from the wake-up?')) {
        wipeAll();
      }
    });
    card.appendChild(wipe);
    const close = el('button', undefined, 'Close') as HTMLButtonElement;
    close.style.cssText = 'margin-top:14px;margin-left:8px';
    close.addEventListener('click', () => this.modal.classList.remove('open'));
    card.appendChild(close);
    this.modal.replaceChildren(card);
    this.modal.classList.add('open');
  }

  openLogbook(): void {
    const card = el('div', 'modal-card');
    card.appendChild(el('h2', undefined, 'Discovery Log'));
    const entries = [...this.ctx.store.state.log].reverse();
    if (entries.length === 0) {
      card.appendChild(el('p', 'sub', 'Nothing yet. The universe hasn’t said anything worth writing down — or you haven’t been listening in the right places.'));
    }
    for (const entry of entries) {
      const div = el('div', 'log-entry');
      div.appendChild(el('h4', undefined, entry.title));
      div.appendChild(el('div', 'meta', entry.source));
      div.appendChild(el('p', undefined, entry.body));
      if (entry.topicId) {
        const topic = this.ctx.gerty.topicList().find((t) => t.id === entry.topicId);
        if (topic) {
          const ask = el('div', 'ask');
          const b = el('button', undefined, `Ask GERTY about ${topic.label.toLowerCase()}`) as HTMLButtonElement;
          b.addEventListener('click', () => {
            this.modal.classList.remove('open');
            this.ctx.gerty.ask(topic.id);
          });
          ask.appendChild(b);
          div.appendChild(ask);
        }
      }
      card.appendChild(div);
    }
    const close = el('button', undefined, 'Close') as HTMLButtonElement;
    close.style.marginTop = '12px';
    close.addEventListener('click', () => this.modal.classList.remove('open'));
    card.appendChild(close);
    this.modal.replaceChildren(card);
    this.modal.classList.add('open');
  }
}

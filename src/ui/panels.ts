import type { Ctx } from '../core/ctx';
import { costToString, RESOURCES, recipeById } from '../core/resources';
import type { HazardType } from '../exploration/starSystem';
import { DRONES, DRONE_IDS, queueDrone, type DroneId } from '../base/drones';
import type { StructureInstance } from '../base/structures';

export function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function panelRoot(): HTMLElement {
  return document.getElementById('panel')!;
}

export function clearPanel(): void {
  panelRoot().replaceChildren();
}

export function box(title: string): HTMLElement {
  const b = el('div', 'panel-box');
  b.appendChild(el('h3', undefined, title));
  panelRoot().appendChild(b);
  return b;
}

export function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', cls, label) as HTMLButtonElement;
  b.addEventListener('click', onClick);
  return b;
}

export function bar(frac: number, color: string): HTMLElement {
  const outer = el('div', 'bar');
  const inner = el('div');
  inner.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
  inner.style.background = color;
  outer.appendChild(inner);
  return outer;
}

export function hazardTag(type: HazardType | null, intensity?: number): HTMLElement {
  if (!type) return el('span', 'hazard-tag hazard-none', 'no known hazards');
  const label = intensity !== undefined ? `${type} ·${'▮'.repeat(intensity)}` : type;
  return el('span', `hazard-tag hazard-${type}`, label);
}

export interface LivePanel {
  root: HTMLElement;
  update(): void;
}

/** the refinery queue — shown at the Foundry (shipyard screen) */
export function renderRefineryPanel(ctx: Ctx): LivePanel {
  const b = box(`Refinery ${ctx.store.state.refinery.tier === 2 ? '· Mk2' : '· Mk1'}`);
  const progressBars = new Map<string, HTMLElement>();

  for (const recipe of ctx.refinery.recipes()) {
    const row = el('div', 'row');
    const label = el('span', 'grow', `${recipe.inAmount} ${RESOURCES[recipe.input].name.toLowerCase()} → ${recipe.outAmount} ${RESOURCES[recipe.output].name.toLowerCase()}`);
    label.style.fontSize = '12px';
    row.appendChild(label);
    row.appendChild(button('+1', () => ctx.refinery.queueJob(recipe.id, 1)));
    row.appendChild(button('+5', () => ctx.refinery.queueJob(recipe.id, 5)));
    b.appendChild(row);
  }

  const queueWrap = el('div');
  b.appendChild(queueWrap);

  const rebuildQueue = (): void => {
    queueWrap.replaceChildren();
    progressBars.clear();
    const queue = ctx.store.state.refinery.queue;
    if (queue.length === 0) {
      queueWrap.appendChild(el('div', 'sub', 'Line idle.'));
      return;
    }
    for (const job of queue) {
      const recipe = recipeById(job.recipeId);
      const row = el('div', 'row');
      row.appendChild(el('span', undefined, `${RESOURCES[recipe.output].name} ${job.unitsDone}/${job.unitsTotal}`));
      const pb = bar(0, 'var(--amber)');
      progressBars.set(job.recipeId, pb.firstElementChild as HTMLElement);
      row.appendChild(pb);
      queueWrap.appendChild(row);
    }
  };
  rebuildQueue();

  return {
    root: b,
    update() {
      const queue = ctx.store.state.refinery.queue;
      const shown = progressBars.size;
      if (queue.length !== shown || (queue[0] && !progressBars.has(queue[0].recipeId))) rebuildQueue();
      const job = queue[0];
      if (job) {
        const inner = progressBars.get(job.recipeId);
        if (inner) {
          const recipe = recipeById(job.recipeId);
          const unitFrac = job.progressSec / recipe.timeSec;
          const frac = (job.unitsDone + Math.min(1, unitFrac)) / job.unitsTotal;
          inner.style.width = `${Math.round(frac * 100)}%`;
        }
      }
    },
  };
}

/**
 * A Fabricator's drone-production queue (Phase 17) — same +1/+5-then-watch-
 * the-bar shape as the refinery panel above, but keyed off one specific
 * structure instance (a base could in principle stand more than one).
 * Jobs don't spawn a world entity yet; completion is announced by a toast
 * ("Worker Drone ready") wired in main.ts — real drones land at Phase 24.
 */
export function renderFabricatorPanel(ctx: Ctx, inst: StructureInstance): LivePanel {
  const b = box('Fabricator');
  const progressBars = new Map<string, HTMLElement>();

  for (const id of DRONE_IDS) {
    const def = DRONES[id];
    const row = el('div', 'row');
    const label = el('span', 'grow', `${def.name} (${costToString(def.cost)})`);
    label.style.fontSize = '12px';
    row.appendChild(label);
    row.appendChild(button('+1', () => queueDrone(ctx.store, inst, id, 1)));
    row.appendChild(button('+5', () => queueDrone(ctx.store, inst, id, 5)));
    b.appendChild(row);
  }

  const queueWrap = el('div');
  b.appendChild(queueWrap);

  const rebuildQueue = (): void => {
    queueWrap.replaceChildren();
    progressBars.clear();
    const queue = inst.queue ?? [];
    if (queue.length === 0) {
      queueWrap.appendChild(el('div', 'sub', 'Bay idle.'));
      return;
    }
    for (const job of queue) {
      const def = DRONES[job.defId as DroneId];
      const row = el('div', 'row');
      row.appendChild(el('span', undefined, `${def.name} ${job.unitsDone}/${job.unitsTotal}`));
      const pb = bar(0, 'var(--amber)');
      progressBars.set(job.defId, pb.firstElementChild as HTMLElement);
      row.appendChild(pb);
      queueWrap.appendChild(row);
    }
  };
  rebuildQueue();

  return {
    root: b,
    update() {
      const queue = inst.queue ?? [];
      const shown = progressBars.size;
      if (queue.length !== shown || (queue[0] && !progressBars.has(queue[0].defId))) rebuildQueue();
      const job = queue[0];
      if (job) {
        const inner = progressBars.get(job.defId);
        if (inner) {
          const def = DRONES[job.defId as DroneId];
          const unitFrac = job.progressSec / def.buildTimeSec;
          const frac = (job.unitsDone + Math.min(1, unitFrac)) / job.unitsTotal;
          inner.style.width = `${Math.round(frac * 100)}%`;
        }
      }
    },
  };
}

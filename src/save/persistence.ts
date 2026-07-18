import type { GameState } from '../core/state';

const KEY = 'ship-foundry-save';
const CP_KEY = 'ship-foundry-checkpoints';
const CP_MAX = 10;
/** min seconds of playtime between two checkpoints with the same label */
const CP_MIN_GAP_SEC = 45;

/**
 * Reset/restore latch: the beforeunload autosave would otherwise re-write the
 * state we just wiped or replaced, resurrecting it after the reload.
 */
let savingDisabled = false;
export function disableSaving(): void {
  savingDisabled = true;
}

export function saveGame(state: GameState): void {
  if (savingDisabled) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('save failed', err);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1 || !Array.isArray(parsed.ship) || typeof parsed.currentPoi !== 'string') {
      console.warn('incompatible save discarded');
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('load failed', err);
    return null;
  }
}

// ---- checkpoints ----

export interface Checkpoint {
  label: string;
  at: number;
  playSeconds: number;
  state: GameState;
}

export function listCheckpoints(): Checkpoint[] {
  try {
    const raw = localStorage.getItem(CP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Checkpoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** snapshot the current state under a label; newest first, capped ring */
export function pushCheckpoint(state: GameState, label: string, force = false): void {
  try {
    const cps = listCheckpoints();
    const last = cps[0];
    if (!force && last && last.label === label && state.playSeconds - last.playSeconds < CP_MIN_GAP_SEC) return;
    cps.unshift({
      label,
      at: Date.now(),
      playSeconds: state.playSeconds,
      state: JSON.parse(JSON.stringify(state)) as GameState,
    });
    localStorage.setItem(CP_KEY, JSON.stringify(cps.slice(0, CP_MAX)));
  } catch (err) {
    console.warn('checkpoint failed', err);
  }
}

/**
 * Roll back to a checkpoint. The state being abandoned is snapshotted first
 * ("Before rollback"), so a restore is itself always undoable.
 */
export function restoreCheckpoint(cp: Checkpoint, current: GameState): void {
  pushCheckpoint(current, 'Before rollback', true);
  disableSaving();
  try {
    localStorage.setItem(KEY, JSON.stringify(cp.state));
  } catch (err) {
    console.warn('restore failed', err);
  }
  window.location.reload();
}

/** full wipe: save + all checkpoints, then a clean boot */
export function wipeAll(): void {
  disableSaving();
  localStorage.removeItem(KEY);
  localStorage.removeItem(CP_KEY);
  window.location.reload();
}

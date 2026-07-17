import type { GameState } from '../core/state';

const KEY = 'ship-foundry-save';

export function saveGame(state: GameState): void {
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

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

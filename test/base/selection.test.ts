import { describe, expect, it } from 'vitest';
import { normalizeRect, rectContains, SelectionController, uidsInRect } from '../../src/base/selection';

describe('rect math', () => {
  it('normalizes any drag direction into the same rect', () => {
    const r1 = normalizeRect({ x: 10, y: 20 }, { x: 50, y: 80 });
    const r2 = normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 });
    expect(r1).toEqual(r2);
    expect(r1).toEqual({ minX: 10, minY: 20, maxX: 50, maxY: 80 });
  });

  it('containment includes edges', () => {
    const r = normalizeRect({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(rectContains(r, { x: 0, y: 0 })).toBe(true);
    expect(rectContains(r, { x: 10, y: 10 })).toBe(true);
    expect(rectContains(r, { x: 5, y: 5 })).toBe(true);
    expect(rectContains(r, { x: 11, y: 5 })).toBe(false);
    expect(rectContains(r, { x: 5, y: -1 })).toBe(false);
  });

  it('uidsInRect picks exactly the candidates inside the box, any drag direction', () => {
    const candidates = [
      { uid: 'a', px: { x: 5, y: 5 } },
      { uid: 'b', px: { x: 25, y: 25 } },
      { uid: 'c', px: { x: 100, y: 5 } },
    ];
    expect(uidsInRect(candidates, { x: 0, y: 0 }, { x: 30, y: 30 })).toEqual(['a', 'b']);
    expect(uidsInRect(candidates, { x: 30, y: 30 }, { x: 0, y: 0 })).toEqual(['a', 'b']);
    expect(uidsInRect(candidates, { x: 90, y: 0 }, { x: 110, y: 10 })).toEqual(['c']);
    expect(uidsInRect(candidates, { x: 200, y: 200 }, { x: 210, y: 210 })).toEqual([]);
  });
});

describe('SelectionController', () => {
  it('replace reports change only when the set actually differs', () => {
    const s = new SelectionController();
    expect(s.replace(['a', 'b'])).toBe(true);
    expect(s.replace(['b', 'a'])).toBe(false); // same set, different order
    expect(s.replace(['a'])).toBe(true);
    expect([...s.selected]).toEqual(['a']);
  });

  it('clear is a no-op on an empty selection', () => {
    const s = new SelectionController();
    expect(s.clear()).toBe(false);
    s.replace(['x']);
    expect(s.clear()).toBe(true);
    expect(s.selected.size).toBe(0);
  });

  it('sig is order-stable', () => {
    const s = new SelectionController();
    s.replace(['b', 'a', 'c']);
    expect(s.sig()).toBe('a,b,c');
  });
});

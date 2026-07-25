/**
 * Surface-site minimap: a small canvas overlay showing the whole site at a
 * glance — deposits (resource colors), landmarks, deployed rigs, the lander,
 * you (on foot), and the camera focus. Clicking jumps the command camera.
 * Owned by SurfaceScreen; shown/hidden with the screen.
 */
import { BALANCE } from '../config/balance';

export interface MinimapData {
  nodes: { x: number; z: number; color: number }[];
  landmarks: { x: number; z: number; charted: boolean }[];
  rigs: { x: number; z: number }[];
  /** placed base structures (home site only) */
  structures: { x: number; z: number }[];
  lander: { x: number; z: number };
  focus: { x: number; z: number };
  /** on-foot player position, when in foot mode */
  foot: { x: number; z: number } | null;
}

/** world x/z → canvas px (pure, tested) */
export function worldToMap(v: number, half: number, size: number): number {
  return ((v / half) * 0.5 + 0.5) * size;
}

/** canvas px → world x/z (pure, tested) */
export function mapToWorld(px: number, half: number, size: number): number {
  return (px / size - 0.5) * 2 * half;
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private c2d: CanvasRenderingContext2D;
  private size: number;
  private half: number;
  /** command-camera jump callback; set by the owning screen */
  onJump: ((x: number, z: number) => void) | null = null;

  constructor() {
    this.size = BALANCE.surface.minimap.size;
    this.half = BALANCE.surface.siteHalfExtent;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.c2d = this.canvas.getContext('2d')!;
    this.canvas.style.cssText =
      'position:absolute;right:12px;bottom:12px;border:1px solid #2c3a44;border-radius:6px;' +
      'background:rgba(8,12,16,.88);cursor:crosshair;pointer-events:auto;display:none;';
    this.canvas.title = 'Click to move the command camera';
    this.canvas.addEventListener('pointerdown', (ev) => {
      const r = this.canvas.getBoundingClientRect();
      this.onJump?.(
        mapToWorld(((ev.clientX - r.left) / r.width) * this.size, this.half, this.size),
        mapToWorld(((ev.clientY - r.top) / r.height) * this.size, this.half, this.size),
      );
    });
    document.getElementById('hud')!.appendChild(this.canvas);
  }

  show(): void {
    this.canvas.style.display = 'block';
  }

  hide(): void {
    this.canvas.style.display = 'none';
  }

  update(data: MinimapData): void {
    const { size, half, c2d } = this;
    const px = (v: number): number => worldToMap(v, half, size);
    c2d.clearRect(0, 0, size, size);

    // deposits
    for (const n of data.nodes) {
      c2d.fillStyle = `#${n.color.toString(16).padStart(6, '0')}`;
      c2d.fillRect(px(n.x) - 1.5, px(n.z) - 1.5, 3, 3);
    }
    // landmarks: charted read bright, uncharted faint
    for (const lm of data.landmarks) {
      c2d.fillStyle = lm.charted ? '#9fb6c4' : '#3a4550';
      c2d.beginPath();
      c2d.moveTo(px(lm.x), px(lm.z) - 3);
      c2d.lineTo(px(lm.x) + 3, px(lm.z));
      c2d.lineTo(px(lm.x), px(lm.z) + 3);
      c2d.lineTo(px(lm.x) - 3, px(lm.z));
      c2d.closePath();
      c2d.fill();
    }
    // working rigs
    c2d.strokeStyle = '#ffb454';
    for (const r of data.rigs) {
      c2d.strokeRect(px(r.x) - 2.5, px(r.z) - 2.5, 5, 5);
    }
    // base structures
    c2d.fillStyle = '#d8e2e8';
    for (const s of data.structures) {
      c2d.fillRect(px(s.x) - 2, px(s.z) - 2, 4, 4);
    }
    // the lander
    c2d.fillStyle = '#59d6ff';
    c2d.beginPath();
    c2d.moveTo(px(data.lander.x), px(data.lander.z) - 4);
    c2d.lineTo(px(data.lander.x) + 3.5, px(data.lander.z) + 3);
    c2d.lineTo(px(data.lander.x) - 3.5, px(data.lander.z) + 3);
    c2d.closePath();
    c2d.fill();
    // on-foot player
    if (data.foot) {
      c2d.fillStyle = '#7dffa8';
      c2d.beginPath();
      c2d.arc(px(data.foot.x), px(data.foot.z), 2.5, 0, Math.PI * 2);
      c2d.fill();
    }
    // camera focus crosshair
    c2d.strokeStyle = 'rgba(216,226,232,0.9)';
    const fx = px(data.focus.x);
    const fz = px(data.focus.z);
    c2d.beginPath();
    c2d.moveTo(fx - 5, fz);
    c2d.lineTo(fx + 5, fz);
    c2d.moveTo(fx, fz - 5);
    c2d.lineTo(fx, fz + 5);
    c2d.stroke();
  }

  dispose(): void {
    this.canvas.remove();
  }
}

// ============================================================
// FogOfWar.js - Savaş sisi (Phaser tarafı) - HIZLI SÜRÜM
// ============================================================
import { computeVisibility, drawFog } from './Vision.js';

export const FOG_SCALE = 6;
export const FOG_ALPHA = 0.93;
const PAD = 120;

export class FogOfWar {
  constructor(scene, worldW, worldH, grid) {
    this.scene = scene;
    this.grid = grid;
    this.w = 8; this.h = 8;
    if (scene.textures.exists('fog')) scene.textures.remove('fog');
    this.tex = scene.textures.createCanvas('fog', this.w, this.h);
    this.ctx = this.tex.getContext();
    this.image = scene.add.image(0, 0, 'fog').setOrigin(0).setScale(FOG_SCALE).setDepth(1000000);
    this.last = { x: -1, y: -1, r: -1, vx: -1, vy: -1 };
    this.enabled = true;
    this.poly = null;
    this.polyAt = { x: -1e9, y: -1e9, r: -1 };
  }

  setEnabled(on) {
    this.enabled = on;
    this.image.setVisible(on);
    this.last.r = -1;
  }

  update(x, y, radius) {
    if (!this.enabled) return;
    const v = this.scene.cameras.main.worldView;
    const ox = Math.floor((v.x - PAD) / FOG_SCALE) * FOG_SCALE, oy = Math.floor((v.y - PAD) / FOG_SCALE) * FOG_SCALE;
    const w = Math.ceil((v.width + PAD * 2) / FOG_SCALE), h = Math.ceil((v.height + PAD * 2) / FOG_SCALE);
    const L = this.last;
    if (Math.abs(x - L.x) < 2 && Math.abs(y - L.y) < 2 && Math.abs(radius - L.r) < 2 && ox === L.vx && oy === L.vy && w === this.w && h === this.h) return;
    this.last = { x, y, r: radius, vx: ox, vy: oy };
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.tex.setSize(w, h);
      this.ctx = this.tex.getContext();
    }
    const P = this.polyAt;
    if (!this.poly || Math.abs(x - P.x) > 3 || Math.abs(y - P.y) > 3 || Math.abs(radius - P.r) > 3) {
      this.poly = computeVisibility(this.grid, x, y, radius);
      this.polyAt = { x, y, r: radius };
    }
    drawFog(this.ctx, this.poly, x, y, radius, FOG_SCALE, w, h, FOG_ALPHA, ox, oy);
    this.image.setPosition(ox, oy);
    this.tex.refresh();
  }
}

// ============================================================
// FogOfWar.js - Savaş sisi (Phaser tarafı) - HIZLI SÜRÜM
// ============================================================
// Eskiden sis TÜM DÜNYAYI kaplayan büyük bir canvas'tı ve her karede baştan çizilip
// ekran kartına yükleniyordu (kasmanın ana sebebi). Artık sadece KAMERANIN gördüğü
// bölge kadar küçük bir canvas var (dünyanın 1/FOG_SCALE'i): her karede çok daha az iş.
// Doku büyütülürken yumuşatıldığı için kenarlar pikselli görünmez.
import { computeVisibility, drawFog } from './Vision.js';
import { perf } from './Perf.js';

export const FOG_SCALE = 6;
// Sis koyuluğu: 1 = simsiyah, daha düşük = karanlıkta silüetler hafifçe seçilir.
export const FOG_ALPHA = 0.93;
const PAD = 120;               // kamera kenarından taşma payı (dünya pikseli)

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
    this._frame = 0;
    // Mobil / düşük kalitede sis her 2. karede güncellenir
    try {
      const q = localStorage.getItem('cfs.quality');
      const mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      this.skipFrames = (q === 'low' || mobile) ? 1 : 0;
      // Düşük kalitede hareket eşiğini de biraz yükselt (daha az yeniden çizim)
      this.moveEps = (q === 'low' || mobile) ? 4 : 2;
      this.polyEps = (q === 'low' || mobile) ? 6 : 3;
    } catch (e) {
      this.skipFrames = 0;
      this.moveEps = 2;
      this.polyEps = 3;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.image.setVisible(on);
    this.last.r = -1; // yeniden çizilsin
  }

  // x,y: gözün dünya konumu, radius: görüş yarıçapı (px)
  update(x, y, radius) {
    if (!this.enabled) return;
    this._frame++;
    const skip = Math.max(this.skipFrames, perf().fogSkip);     // performans moduna göre 1/2/3 karede bir
    if (skip && (this._frame % (skip + 1))) return;

    const v = this.scene.cameras.main.worldView;
    const ox = Math.floor((v.x - PAD) / FOG_SCALE) * FOG_SCALE, oy = Math.floor((v.y - PAD) / FOG_SCALE) * FOG_SCALE;
    const w = Math.ceil((v.width + PAD * 2) / FOG_SCALE), h = Math.ceil((v.height + PAD * 2) / FOG_SCALE);
    const L = this.last;
    const eps = this.moveEps;
    if (Math.abs(x - L.x) < eps && Math.abs(y - L.y) < eps && Math.abs(radius - L.r) < eps && ox === L.vx && oy === L.vy && w === this.w && h === this.h) return;
    this.last = { x, y, r: radius, vx: ox, vy: oy };
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.tex.setSize(w, h);
      this.ctx = this.tex.getContext();
    }
    // Görünür alan çokgeni sadece oyuncu yeterince yer değiştirince yeniden hesaplanır
    const P = this.polyAt;
    const pe = this.polyEps;
    if (!this.poly || Math.abs(x - P.x) > pe || Math.abs(y - P.y) > pe || Math.abs(radius - P.r) > pe) {
      this.poly = computeVisibility(this.grid, x, y, radius);
      this.polyAt = { x, y, r: radius };
    }
    drawFog(this.ctx, this.poly, x, y, radius, FOG_SCALE, w, h, FOG_ALPHA, ox, oy);
    this.image.setPosition(ox, oy);
    this.tex.refresh(); // küçük canvas'ı GPU'ya yükle
  }
}

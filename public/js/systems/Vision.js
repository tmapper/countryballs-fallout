// ============================================================
// Vision.js - Görüş alanı hesabı (ışın atma / raycasting), Phaser'dan bağımsız
// ============================================================
// Oyuncunun gözünden her yöne ışın atarız. Işın bir duvara çarpınca durur.
// Işınların bittiği noktaları birleştirince "görünen alan" çokgeni çıkar.
import { isWall } from '../map/BunkerMap.js';

export function computeVisibility(grid, ox, oy, radius, rays = 300, step = 8) {
  const pts = new Float32Array(rays * 2);
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = 0;
    let hit = false;
    while (t < radius) {
      t = Math.min(t + step, radius);
      if (isWall(grid, ox + dx * t, oy + dy * t)) { hit = true; break; }
    }
    if (hit) {
      // Duvarın tam yerini bulmak için son adımı ikiye bölerek daralt (4 kez)
      let lo = Math.max(0, t - step), hi = t;
      for (let n = 0; n < 4; n++) {
        const mid = (lo + hi) / 2;
        if (isWall(grid, ox + dx * mid, oy + dy * mid)) hi = mid; else lo = mid;
      }
      t = hi;
    }
    pts[k * 2] = ox + dx * t;
    pts[k * 2 + 1] = oy + dy * t;
  }
  return pts;
}

// Bir hedef noktayı görebiliyor muyum? (Aşama 4+: diğer oyuncuları saklamak için)
export function hasLineOfSight(grid, x1, y1, x2, y2, step = 8) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.ceil(dist / step);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (isWall(grid, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

// Sis katmanını çizer: her yeri karart, sonra görünen çokgeni "sil" (yumuşak kenarlı).
// Sis dokusu dünyanın 1/scale boyutundadır (küçük = hızlı); ekrana büyütülünce kenarlar yumuşar.
export function drawFog(ctx, poly, ox, oy, radius, scale, w, h, alpha = 1, offX = 0, offY = 0) {
  // offX/offY: canvas'ın dünyadaki sol üst köşesi (sis sadece kamera bölgesini kaplar)
  const X = (v) => (v - offX) / scale, Y = (v) => (v - offY) / scale;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = `rgba(4,7,14,${alpha})`;       // saf siyah değil: koyu lacivert karanlık
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(X(ox), Y(oy), 0, X(ox), Y(oy), radius / scale);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.62, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(X(poly[0]), Y(poly[1]));
  for (let i = 2; i < poly.length; i += 2) ctx.lineTo(X(poly[i]), Y(poly[i + 1]));
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

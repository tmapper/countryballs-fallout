// ============================================================
// MapPainter.js - Haritayı CANVAS ile çizer (Phaser'dan bağımsız)
// ============================================================
// Resim dosyası yok; her şey kodla çizilir. Phaser tarafı (MapRenderer) bu
// canvas'ları doku (texture) yapıp sahneye koyar. Phaser'dan bağımsız olduğu için
// tarayıcıda tek başına test edilip gözle kontrol edilebilir.
import { ROOMS, PROPS, CORRIDORS, WALL_FACE } from './BunkerMap.js';
import { PROP_IMG } from './PropImages.js';

// Duvar bantları: [genişleme (px), renk]. Dıştan içe: koyu -> açık => kabartmalı duvar görünümü
// Among Us tarzı kalın duvar: dış kontur -> açık renk duvar üstü -> içe doğru koyulaşan yan yüz
export const WALL_BANDS = [
  [64, '#000000', 0.35],                    // boşluğa düşen gölge
  [50, '#06080b', 1],                       // dış kontur
  [46, '#6c7683', 1], [40, '#8d97a4', 1],   // duvarın üstü (kalınlık)
  [16, '#6f7986', 1],                       // iç kenar
  [11, '#3d444e', 1], [6, '#2a3038', 1], [2, '#15181c', 1]   // yan duvarın iç yüzü (gölgeli)
];

// ---------- Yardımcılar ----------
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// Doku çözünürlük çarpanı: ekranda dünya 1:1'den büyük görünüyorsa dokular daha yüksek
// çözünürlükte çizilir (MapRenderer.setTexScale ayarlar, görüntüyü 1/TEX ile küçültür).
let TEX = 1;
export function setTexScale(s) { TEX = s; }
export const texScale = () => TEX;
const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * TEX); c.height = Math.ceil(h * TEX); c._s = TEX;
  if (TEX !== 1) c.getContext('2d').scale(TEX, TEX);
  return c;
};

function shade(hex, f) { // '#rrggbb' rengini f kadar aydınlat/karart (f: 0.5 = yarı koyu, 1.3 = açık)
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function rrect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// Tile'ın kenarından taşan şeyi karşı kenara da çiz (kesintisiz döşeme için)
function wrap(size, fn, x, y, pad) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    const ox = x + dx, oy = y + dy;
    if (ox > -pad && ox < size + pad && oy > -pad && oy < size + pad) fn(ox, oy);
  }
}
// 2.5D kutu: gölge + üst yüz + ön yüz
function box(c, x, y, w, h, { top = '#667', depth = 10, r = 5, shadow = 0.35, stroke = 'rgba(0,0,0,0.55)' } = {}) {
  c.save();
  c.fillStyle = `rgba(0,0,0,${shadow})`; rrect(c, x + 5, y + 8, w, h, r); c.fill();
  c.fillStyle = shade(top, 0.62); rrect(c, x, y + Math.min(depth, h * 0.5), w, h - Math.min(depth, h * 0.5) + 0, r); c.fill();
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(top, 1.18)); g.addColorStop(1, shade(top, 0.92));
  c.fillStyle = g; rrect(c, x, y, w, h - depth, r); c.fill();
  c.lineWidth = 2; c.strokeStyle = stroke; rrect(c, x, y, w, h, r); c.stroke();
  c.restore();
}
function disc(c, x, y, r, fill, { stroke = 'rgba(0,0,0,.55)', lw = 2, shadow = 0.3 } = {}) {
  c.save();
  if (shadow) { c.fillStyle = `rgba(0,0,0,${shadow})`; c.beginPath(); c.ellipse(x + 5, y + 8, r, r * 0.95, 0, 0, 7); c.fill(); }
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  c.restore();
}
function radial(c, x, y, r, inner, outer, comp = 'source-over') {
  c.save(); c.globalCompositeOperation = comp;
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore();
}
function hazard(c, x, y, w, h, a = 0.9) { // sarı-siyah uyarı şeridi
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.globalAlpha = a;
  c.fillStyle = '#e8b400'; c.fillRect(x, y, w, h); c.fillStyle = '#16181b';
  for (let i = -h; i < w + h; i += 28) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 14, y + h); c.lineTo(x + i + 14 + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
  c.restore();
}
function led(c, x, y, color, r = 3) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); radial(c, x, y, r * 4, color.replace(')', ',0.35)').replace('rgb', 'rgba'), 'rgba(0,0,0,0)', 'lighter'); }
function poly(c, pts, lw, col, hi) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = lw + 6; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + 3, y + 5) : c.moveTo(x + 3, y + 5))); c.stroke();
  c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  if (hi) { c.strokeStyle = hi; c.lineWidth = Math.max(2, lw * 0.25); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y - lw * 0.25) : c.moveTo(x, y - lw * 0.25))); c.stroke(); }
  c.restore();
}

// ============================================================
// ZEMİN DOKULARI (kesintisiz döşenir)
// ============================================================
// Binanın dışı: koyu, hafif desenli boşluk (Among Us gibi)
export function paintVoidTile() {
  const S = 256, cv = mk(S, S), c = cv.getContext('2d'), r = rngFrom(21);
  c.fillStyle = '#0b0e14'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) { const x = r() * S, y = r() * S, rad = 60 + r() * 80; wrap(S, (ox, oy) => radial(c, ox, oy, rad, 'rgba(40,55,80,.18)', 'rgba(0,0,0,0)'), x, y, rad); }
  for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, a = 0.15 + r() * 0.5; wrap(S, (ox, oy) => { c.fillStyle = `rgba(200,215,255,${a})`; c.fillRect(ox, oy, 1.4, 1.4); }, x, y, 2); }
  return cv;
}

export function paintSoilTile() {
  const S = 256, cv = mk(S, S), c = cv.getContext('2d'), r = rngFrom(7);
  c.fillStyle = '#4a3523'; c.fillRect(0, 0, S, S);
  // büyük renk lekeleri
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = 25 + r() * 55, tone = r() < 0.5 ? '58,40,26' : '84,60,38';
    wrap(S, (ox, oy) => radial(c, ox, oy, rad, `rgba(${tone},0.45)`, `rgba(${tone},0)`), x, y, rad);
  }
  // ince taneler
  const cols = ['#3b2a1c', '#5a4129', '#6b4e32', '#33241a', '#7a5a3a'];
  for (let i = 0; i < 1300; i++) {
    const x = r() * S, y = r() * S, s = 1 + r() * 2.6;
    c.fillStyle = cols[(r() * cols.length) | 0]; c.globalAlpha = 0.5 + r() * 0.5;
    wrap(S, (ox, oy) => c.fillRect(ox, oy, s, s), x, y, 4);
  }
  c.globalAlpha = 1;
  // çakıl taşları
  for (let i = 0; i < 34; i++) {
    const x = r() * S, y = r() * S, a = 3 + r() * 6, b = a * (0.6 + r() * 0.4), rot = r() * 3;
    wrap(S, (ox, oy) => {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(ox + 2, oy + 3, a, b, rot, 0, 7); c.fill();
      c.fillStyle = r() < 0.5 ? '#7d6a58' : '#6a5a4b'; c.beginPath(); c.ellipse(ox, oy, a, b, rot, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(ox - a * 0.25, oy - b * 0.3, a * 0.45, b * 0.35, rot, 0, 7); c.fill();
    }, x, y, 14);
  }
  // kökler / çatlaklar
  c.strokeStyle = 'rgba(25,16,10,0.5)'; c.lineWidth = 1.6; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    let x = r() * S, y = r() * S, ang = r() * 6.28;
    wrap(S, (ox, oy) => { c.beginPath(); c.moveTo(ox, oy); let px = ox, py = oy, a = ang; for (let k = 0; k < 5; k++) { a += (r() - 0.5) * 0.9; px += Math.cos(a) * 12; py += Math.sin(a) * 12; c.lineTo(px, py); } c.stroke(); }, x, y, 70);
  }
  return cv;
}

export function paintGrassTile() {
  const S = 128, cv = mk(S, S), c = cv.getContext('2d'), r = rngFrom(11);
  c.fillStyle = '#3f8a2e'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) { const x = r() * S, y = r() * S, rad = 20 + r() * 30; wrap(S, (ox, oy) => radial(c, ox, oy, rad, r() < 0.5 ? 'rgba(80,150,50,0.4)' : 'rgba(30,90,25,0.4)', 'rgba(0,0,0,0)'), x, y, rad); }
  const greens = ['#2f7222', '#4aa238', '#58b042', '#276a1d', '#63bb4a'];
  c.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = r() * S, y = r() * S, h = 3 + r() * 5, lean = (r() - 0.5) * 4;
    c.strokeStyle = greens[(r() * greens.length) | 0]; c.lineWidth = 1.2;
    wrap(S, (ox, oy) => { c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + lean, oy - h); c.stroke(); }, x, y, 8);
  }
  for (let i = 0; i < 5; i++) { const x = r() * S, y = r() * S; wrap(S, (ox, oy) => { c.fillStyle = r() < 0.5 ? '#f4e04d' : '#fafafa'; c.beginPath(); c.arc(ox, oy, 1.8, 0, 7); c.fill(); }, x, y, 4); }
  return cv;
}

const FLOOR_PAINTERS = {
  // beton karolar
  hall(c, S, r) { c.fillStyle = '#6a6f77'; c.fillRect(0, 0, S, S); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const t = 0.92 + r() * 0.16; c.fillStyle = shade('#6a6f77', t); c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62); c.strokeRect(65, 1, 62, 62); c.strokeRect(1, 65, 62, 62); c.strokeRect(65, 65, 62, 62); },
  // koyu çelik zemin + perçinler
  reactor(c, S, r) { c.fillStyle = '#4a3a3a'; c.fillRect(0, 0, S, S); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.fillStyle = shade('#4a3a3a', 0.9 + r() * 0.2); c.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); c.fillStyle = 'rgba(255,255,255,.18)'; [[8, 8], [56, 8], [8, 56], [56, 56]].forEach(([dx, dy]) => { c.beginPath(); c.arc(x * 64 + dx, y * 64 + dy, 2.2, 0, 7); c.fill(); }); } c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; c.strokeRect(0, 0, S, S); c.strokeRect(64, 0, 0, S); c.strokeRect(0, 64, S, 0); },
  // turkuaz ızgara
  o2(c, S, r) { c.fillStyle = '#2f5459'; c.fillRect(0, 0, S, S); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; for (let i = 0; i <= S; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); } c.fillStyle = 'rgba(120,230,230,.06)'; for (let i = 0; i < 12; i++) c.fillRect(((r() * 8) | 0) * 16, ((r() * 8) | 0) * 16, 16, 16); },
  // sarımsı beton + kablo oluğu
  electrical(c, S, r) { c.fillStyle = '#5a5836'; c.fillRect(0, 0, S, S); for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; c.fillRect(r() * S, r() * S, 3, 3); } c.fillStyle = '#3d3b22'; c.fillRect(0, 60, S, 8); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, 60, S, 2); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(0, 0, S, S); },
  // koyu mavi halı
  security(c, S, r) { c.fillStyle = '#2f3b4d'; c.fillRect(0, 0, S, S); for (let i = 0; i < 400; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.08)'; c.fillRect(r() * S, r() * S, 2, 2); } c.strokeStyle = 'rgba(80,120,190,.25)'; c.lineWidth = 2; c.strokeRect(0, 0, S, S); c.strokeRect(0, 0, 64, 64); c.strokeRect(64, 64, 64, 64); },
  // kontrol odası: koyu zemin + ışıklı şerit
  control(c, S, r) { c.fillStyle = '#262c36'; c.fillRect(0, 0, S, S); c.fillStyle = '#2f3643'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64); c.fillStyle = 'rgba(60,200,255,.22)'; c.fillRect(0, 62, S, 4); c.fillRect(62, 0, 4, S); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2; c.strokeRect(0, 0, S, S); },
  // tahta (depo) / ahşap
  storage(c, S, r) { c.fillStyle = '#5c4a35'; c.fillRect(0, 0, S, S); for (let i = 0; i < 4; i++) { c.fillStyle = shade('#5c4a35', 0.88 + r() * 0.22); c.fillRect(0, i * 32 + 1, S, 30); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, i * 32, S, 2); c.fillStyle = 'rgba(0,0,0,.22)'; for (let k = 0; k < 6; k++) c.fillRect(r() * S, i * 32 + 4 + r() * 22, 8 + r() * 20, 1); c.fillRect(((r() * 3) | 0) * 40 + 20, i * 32, 2, 32); } },
  // yatakhane: parke
  dorm(c, S, r) { c.fillStyle = '#6b4a2f'; c.fillRect(0, 0, S, S); for (let i = 0; i < 8; i++) { c.fillStyle = shade('#6b4a2f', 0.85 + r() * 0.3); c.fillRect(0, i * 16, S, 15); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, i * 16 + 15, S, 1); c.fillRect(((r() * S) | 0), i * 16, 1, 15); } },
  // revir: temiz beyaz-yeşil karo
  medbay(c, S, r) { c.fillStyle = '#b9c9c4'; c.fillRect(0, 0, S, S); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = shade('#b9c9c4', 0.96 + r() * 0.08); c.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } c.fillStyle = 'rgba(40,120,100,.18)'; c.fillRect(0, 0, S, 4); c.fillRect(0, 0, 4, S); },
  // jeneratör: yağlı ızgara plaka
  generator(c, S, r) { c.fillStyle = '#41454a'; c.fillRect(0, 0, S, S); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3; for (let i = -S; i < S * 2; i += 14) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S, S); c.stroke(); } c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; for (let i = -S + 5; i < S * 2; i += 14) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S, S); c.stroke(); } },
  // yemekhane: krem-turkuaz dama karo
  cafeteria(c, S, r) { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const base = (x + y) % 2 ? '#d8cfb8' : '#4f8f8a'; c.fillStyle = shade(base, 0.93 + r() * 0.12); c.fillRect(x * 32, y * 32, 32, 32); } c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; for (let i = 0; i <= S; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); } for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(60,40,20,${0.04 + r() * 0.06})`; c.beginPath(); c.arc(r() * S, r() * S, 2 + r() * 5, 0, 7); c.fill(); } },
  // laboratuvar: beyaz-mavi temiz karo, ince derz
  lab(c, S, r) { c.fillStyle = '#c9d6dc'; c.fillRect(0, 0, S, S); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.fillStyle = shade('#c9d6dc', 0.95 + r() * 0.07); c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } c.strokeStyle = 'rgba(40,90,120,.25)'; c.lineWidth = 2; c.strokeRect(1, 1, 126, 126); c.beginPath(); c.moveTo(64, 0); c.lineTo(64, S); c.moveTo(0, 64); c.lineTo(S, 64); c.stroke(); c.fillStyle = 'rgba(80,200,140,.10)'; c.fillRect(0, 0, S, 3); },
  // iletişim: koyu yükseltilmiş zemin panelleri (delikli)
  comms(c, S, r) { c.fillStyle = '#232a35'; c.fillRect(0, 0, S, S); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.fillStyle = shade('#2b3442', 0.92 + r() * 0.15); c.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); c.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 5; k++) for (let m = 0; m < 5; m++) { c.beginPath(); c.arc(x * 64 + 12 + k * 10, y * 64 + 12 + m * 10, 1.6, 0, 7); c.fill(); } } c.fillStyle = 'rgba(80,170,255,.18)'; c.fillRect(0, 62, S, 3); c.fillRect(62, 0, 3, S); },
  // koridor: çelik ızgara
  corridor(c, S, r) { c.fillStyle = '#464b52'; c.fillRect(0, 0, S, S); c.fillStyle = '#3a3e44'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c.fillRect(x * 16 + 3, y * 16 + 3, 10, 10); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; for (let i = 0; i <= S; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.stroke(); } }
};
export const FLOOR_TYPES = Object.keys(FLOOR_PAINTERS);

export function paintFloorTile(type) {
  const S = 128, cv = mk(S, S), c = cv.getContext('2d');
  FLOOR_PAINTERS[type](c, S, rngFrom(hashStr(type)));
  return cv;
}

// ============================================================
// EŞYA ÇİZİCİLERİ (p: dünya koordinatlı prop, c: oda canvas'ı, ox/oy: oda başlangıcı)
// ============================================================
const PROP = {
  tree(c, p) {
    const r = rngFrom(hashStr('t' + p.x + p.y));
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 14, p.y + 22, 66, 54, 0, 0, 7); c.fill();
    disc(c, p.x, p.y, 16, '#5b3e22', { shadow: 0 });
    const cols = ['#2c6a22', '#38802b', '#43932f', '#2a5f1f'];
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 14 + r() * 28; disc(c, p.x + Math.cos(a) * d, p.y - 30 + Math.sin(a) * d * 0.8, 24 + r() * 14, cols[i % 4], { stroke: 'rgba(0,0,0,.25)', lw: 1, shadow: 0 }); }
    disc(c, p.x - 10, p.y - 44, 20, 'rgba(255,255,255,.12)', { stroke: null, shadow: 0 });
  },
  bush(c, p) { const r = rngFrom(hashStr('bu' + p.x + p.y)); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x + 4, p.y + 14, p.r * 1.3, p.r * 0.6, 0, 0, 7); c.fill(); for (let i = 0; i < 5; i++) disc(c, p.x + (r() - 0.5) * p.r, p.y - 6 + (r() - 0.5) * p.r * 0.6, p.r * (0.55 + r() * 0.3), ['#2c6a22', '#38802b', '#43932f'][i % 3], { shadow: 0 }); },
  sandbag(c, p) { for (let i = 0; i < 3; i++) { box(c, p.x + i * (p.w / 3), p.y + (i % 2) * 2, p.w / 3 + 4, p.h, { top: '#b7a272', depth: 6, r: 12, shadow: 0.25 }); } },
  startpost(c, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    radial(c, cx - 20, cy + 40, 150, 'rgba(60,255,120,0.20)', 'rgba(60,255,120,0)', 'lighter');
    box(c, p.x, p.y, p.w, p.h, { top: '#3a4048', depth: 14, r: 4 });
    disc(c, cx, cy - 8, 13, '#1f9d48', { shadow: 0 }); disc(c, cx - 3, cy - 11, 5, 'rgba(255,255,255,.55)', { stroke: null, shadow: 0 });
    radial(c, cx, cy - 8, 40, 'rgba(80,255,140,.45)', 'rgba(0,0,0,0)', 'lighter');
  },
  bench(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#8c6a3f', depth: 10, r: 4 }); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; for (let x = p.x + 20; x < p.x + p.w; x += 24) { c.beginPath(); c.moveTo(x, p.y + 3); c.lineTo(x, p.y + p.h - 12); c.stroke(); } },
  rock(c, p) { const r = rngFrom(hashStr('r' + p.x)); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 6, p.y + 12, p.r * 1.25, p.r, 0, 0, 7); c.fill(); c.fillStyle = '#7b7f84'; c.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28, d = p.r * (0.95 + r() * 0.5); c[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.85); } c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2; c.stroke(); c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.5, p.r * 0.3, 0, 0, 7); c.fill(); },
  barrel(c, p) { const col = ['#a8321f', '#2d5fa8', '#bfa21f'][hashStr('b' + p.x + p.y) % 3]; disc(c, p.x, p.y, p.r, shade(col, 0.9)); disc(c, p.x, p.y, p.r * 0.78, col, { stroke: 'rgba(0,0,0,.35)', lw: 1.5, shadow: 0 }); disc(c, p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.22, 'rgba(255,255,255,.35)', { stroke: null, shadow: 0 }); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r * 0.5, 0, 7); c.stroke(); },
  path(c, p) { const r = rngFrom(5); c.fillStyle = 'rgba(150,140,120,.5)'; c.fillRect(p.x, p.y, p.w, p.h); for (let y = p.y; y < p.y + p.h; y += 36) for (let x = p.x + ((y / 36) % 2) * 20; x < p.x + p.w - 10; x += 56) { c.fillStyle = shade('#9a917e', 0.85 + r() * 0.3); rrect(c, x + 2, y + 2, 50, 30, 6); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.2; c.stroke(); } },
  trefoil(c, p) { c.save(); c.globalAlpha = 0.35; c.translate(p.x, p.y); disc(c, 0, 0, p.r, 'rgba(0,0,0,0)', { stroke: '#e8b400', lw: 10, shadow: 0 }); for (let i = 0; i < 3; i++) { c.rotate((Math.PI * 2) / 3); c.fillStyle = '#e8b400'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, p.r * 0.78, -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52); c.closePath(); c.fill(); } c.restore(); },
  stools(c, p) { for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + 0.2; disc(c, p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, 20, '#3d434b', { shadow: 0.3 }); disc(c, p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, 12, '#555d68', { shadow: 0, stroke: null }); } },
  roundtable(c, p) {
    disc(c, p.x, p.y, p.r, '#2c3037', { lw: 4 });
    disc(c, p.x, p.y, p.r - 14, '#3c424b', { shadow: 0, stroke: 'rgba(255,255,255,.1)' });
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r - 40, 0, 7); c.stroke();
    // acil durum düğmesi
    disc(c, p.x, p.y, 38, '#5a0c0c', { shadow: 0.4 }); disc(c, p.x, p.y - 4, 29, '#e02020', { shadow: 0, stroke: '#7a1010', lw: 3 }); disc(c, p.x - 9, p.y - 13, 9, 'rgba(255,255,255,.45)', { stroke: null, shadow: 0 });
    radial(c, p.x, p.y, 120, 'rgba(255,40,40,.18)', 'rgba(255,0,0,0)', 'lighter');
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; led(c, p.x + Math.cos(a) * (p.r - 24), p.y + Math.sin(a) * (p.r - 24), 'rgb(255,190,60)', 2.5); }
  },
  pillar(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#8a9099', depth: 14, r: 4 }); hazard(c, p.x + 2, p.y + p.h - 22, p.w - 4, 8, 0.8); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.strokeRect(p.x + 8, p.y + 6, p.w - 16, p.h - 30); },
  shelf(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#5d6670', depth: 14, r: 3 }); const r = rngFrom(hashStr('s' + p.x + p.y)); const cs = ['#c24a3a', '#d6b13f', '#4a8fc2', '#6bb26b', '#b0b6bd']; const horiz = p.w > p.h; for (let i = 0; i < (horiz ? p.w / 22 : p.h / 24); i++) { c.fillStyle = cs[(r() * cs.length) | 0]; if (horiz) c.fillRect(p.x + 6 + i * 22, p.y + 8, 16, p.h - 30); else c.fillRect(p.x + 8, p.y + 6 + i * 24, p.w - 16, 18); } },
  vending(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#c23a3a', depth: 12, r: 5 }); c.fillStyle = '#9fe3ff'; c.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 40); radial(c, p.x + p.w / 2, p.y + p.h / 2, 60, 'rgba(150,230,255,.3)', 'rgba(0,0,0,0)', 'lighter'); },
  board(c, p) { c.fillStyle = '#8a6a3a'; c.fillRect(p.x, p.y, p.w, p.h); const r = rngFrom(3); for (let i = 0; i < 9; i++) { c.fillStyle = ['#fff', '#ffe58a', '#a8d8ff'][i % 3]; c.fillRect(p.x + 10 + i * 38, p.y + 3, 22, 14); } },
  hazardring(c, p) { c.save(); c.translate(p.x, p.y); c.lineWidth = 14; for (let i = 0; i < 40; i++) { c.strokeStyle = i % 2 ? '#16181b' : '#e8b400'; c.globalAlpha = 0.55; c.beginPath(); c.arc(0, 0, p.r, (i / 40) * 6.283, ((i + 1) / 40) * 6.283); c.stroke(); } c.restore(); },
  core(c, p) {
    disc(c, p.x, p.y, p.r + 28, '#26292e', { lw: 5, shadow: 0.45 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; disc(c, p.x + Math.cos(a) * (p.r + 8), p.y + Math.sin(a) * (p.r + 8), 8, '#d9a400', { shadow: 0, lw: 1 }); }
    disc(c, p.x, p.y, p.r, '#15171a', { shadow: 0, lw: 4, stroke: '#d9a400' });
    radial(c, p.x, p.y, p.r - 6, 'rgba(255,220,120,1)', 'rgba(255,90,0,0.95)');
    c.strokeStyle = 'rgba(40,10,0,.6)'; c.lineWidth = 3; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(p.x, p.y, (p.r - 6) * i / 4, 0, 7); c.stroke(); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.4; disc(c, p.x + Math.cos(a) * p.r * 0.6, p.y + Math.sin(a) * p.r * 0.6, 9, '#2b2f35', { shadow: 0, lw: 1.5 }); }
    radial(c, p.x, p.y, p.r * 2.4, 'rgba(255,140,30,.38)', 'rgba(255,60,0,0)', 'lighter');
  },
  console(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#3a4552', depth: 12, r: 5 }); const horiz = p.w >= p.h; const r = rngFrom(hashStr('c' + p.x + p.y)); const n = Math.floor((horiz ? p.w : p.h) / 24); for (let i = 0; i < n; i++) { const col = ['rgb(60,255,120)', 'rgb(255,200,60)', 'rgb(255,70,70)', 'rgb(80,200,255)'][(r() * 4) | 0]; led(c, horiz ? p.x + 14 + i * 24 : p.x + p.w / 2, horiz ? p.y + p.h * 0.35 : p.y + 14 + i * 24, col, 3); } c.fillStyle = 'rgba(0,0,0,.35)'; if (horiz) c.fillRect(p.x + 8, p.y + p.h * 0.55, p.w - 16, 8); else c.fillRect(p.x + p.w * 0.55, p.y + 8, 8, p.h - 16); },
  pipe(c, p) { poly(c, p.pts, 16, '#6b727a', 'rgba(255,255,255,.35)'); p.pts.forEach(([x, y]) => disc(c, x, y, 11, '#59606a', { shadow: 0, lw: 1.5 })); },
  cable(c, p) { poly(c, p.pts, 7, '#1d1f22', 'rgba(255,200,0,.5)'); },
  monitorbank(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#2a2f38', depth: 14, r: 5 }); const n = Math.floor(p.w / 80); const r = rngFrom(hashStr('m' + p.x + p.y)); for (let i = 0; i < n; i++) { const x = p.x + 10 + i * (p.w - 20) / n, w = (p.w - 20) / n - 8, h = p.h - 36; c.fillStyle = '#05080c'; c.fillRect(x, p.y + 8, w, h); const col = ['60,170,255', '60,255,150', '255,180,60'][(r() * 3) | 0]; c.fillStyle = `rgba(${col},.55)`; c.fillRect(x + 3, p.y + 11, w - 6, h - 6); c.strokeStyle = `rgba(${col},1)`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 5, p.y + 11 + h * 0.7); for (let k = 1; k <= 6; k++) c.lineTo(x + 5 + (w - 10) * k / 6, p.y + 11 + h * (0.3 + r() * 0.5)); c.stroke(); radial(c, x + w / 2, p.y + p.h + 10, 70, `rgba(${col},.18)`, 'rgba(0,0,0,0)', 'lighter'); } },
  desk(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#59616b', depth: 12, r: 5 }); for (let i = 0; i < 3; i++) disc(c, p.x + 50 + i * ((p.w - 100) / 2), p.y + p.h + 26, 18, '#2a2f38', { shadow: 0.3 }); for (let i = 0; i < 3; i++) { c.fillStyle = '#10151b'; c.fillRect(p.x + 24 + i * ((p.w - 100) / 2), p.y + 8, 52, 24); c.fillStyle = 'rgba(80,200,255,.6)'; c.fillRect(p.x + 27 + i * ((p.w - 100) / 2), p.y + 11, 46, 18); } },
  rack(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#262b33', depth: 12, r: 3 }); const r = rngFrom(hashStr('k' + p.x)); for (let y = p.y + 10; y < p.y + p.h - 18; y += 12) { c.fillStyle = '#12161b'; c.fillRect(p.x + 6, y, p.w - 12, 8); led(c, p.x + 12, y + 4, r() < 0.7 ? 'rgb(60,255,120)' : 'rgb(255,170,40)', 2); } },
  locker(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#76808c', depth: 12, r: 3 }); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; const v = p.w < p.h; if (v) { c.beginPath(); c.moveTo(p.x + p.w / 2, p.y + 4); c.lineTo(p.x + p.w / 2, p.y + p.h - 14); c.stroke(); } else for (let x = p.x + 40; x < p.x + p.w; x += 40) { c.beginPath(); c.moveTo(x, p.y + 4); c.lineTo(x, p.y + p.h - 14); c.stroke(); } c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 3; i++) c.fillRect(p.x + 8, p.y + 10 + i * 4, p.w * 0.3, 2); },
  stripes(c, p) { hazard(c, p.x, p.y, p.w, p.h, 0.5); },
  tank(c, p) {
    disc(c, p.x, p.y, p.r, '#4b8d99', { lw: 4, shadow: 0.4 });
    const g = c.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.35, 4, p.x, p.y, p.r); g.addColorStop(0, '#d8f6fb'); g.addColorStop(0.45, '#7ec8d6'); g.addColorStop(1, '#2e6874');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r - 6, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, p.r * 0.55, 0, 7); c.stroke();
    disc(c, p.x, p.y, 13, '#c9ced3', { shadow: 0, lw: 2 }); c.fillStyle = 'rgba(255,255,255,.7)'; c.font = `bold ${Math.round(p.r * 0.32)}px Arial`; c.textAlign = 'center'; c.fillText('O₂', p.x, p.y + p.r * 0.75);
  },
  filter(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#5d737a', depth: 14, r: 4 }); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3; for (let x = p.x + 14; x < p.x + p.w - 8; x += 14) { c.beginPath(); c.moveTo(x, p.y + 10); c.lineTo(x, p.y + p.h - 24); c.stroke(); } led(c, p.x + p.w - 14, p.y + p.h - 12, 'rgb(60,255,120)', 3); },
  valve(c, p) { disc(c, p.x, p.y, p.r, '#9b2a20', { lw: 3 }); c.strokeStyle = '#e24c3c'; c.lineWidth = 5; for (let i = 0; i < 4; i++) { const a = (i / 4) * 3.14159; c.beginPath(); c.moveTo(p.x + Math.cos(a) * p.r * 0.85, p.y + Math.sin(a) * p.r * 0.85); c.lineTo(p.x - Math.cos(a) * p.r * 0.85, p.y - Math.sin(a) * p.r * 0.85); c.stroke(); } disc(c, p.x, p.y, 7, '#555', { shadow: 0, lw: 1 }); },
  generator(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#4f6b3f', depth: 16, r: 6 }); disc(c, p.x + 56, p.y + (p.h - 16) / 2, 40, '#20262b', { shadow: 0, lw: 3 }); c.strokeStyle = 'rgba(160,170,180,.7)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + 0.5; c.beginPath(); c.moveTo(p.x + 56, p.y + (p.h - 16) / 2); c.lineTo(p.x + 56 + Math.cos(a) * 34, p.y + (p.h - 16) / 2 + Math.sin(a) * 34); c.stroke(); } disc(c, p.x + 56, p.y + (p.h - 16) / 2, 7, '#8b929a', { shadow: 0, lw: 1 }); for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(p.x + 110, p.y + 18 + i * 20, 62, 8); } hazard(c, p.x + 110, p.y + p.h - 34, 70, 10, 0.85); led(c, p.x + p.w - 14, p.y + 14, 'rgb(60,255,120)', 3); },
  oil(c, p) { const r = rngFrom(9); c.fillStyle = 'rgba(8,8,10,.5)'; c.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, d = p.r * (0.7 + r() * 0.5); c[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.75); } c.closePath(); c.fill(); },
  bed(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#e8eef0', depth: 10, r: 6 }); c.fillStyle = '#4a86c8'; rrect(c, p.x + 4, p.y + 5, p.w * 0.66, p.h - 20, 5); c.fill(); c.fillStyle = '#fff'; rrect(c, p.x + p.w * 0.72, p.y + 8, p.w * 0.24, p.h - 26, 6); c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.5; c.stroke(); },
  scanner(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#d3dbe0', depth: 14, r: 10 }); disc(c, p.x + p.w / 2, p.y + (p.h - 14) / 2 - 8, p.w * 0.32, '#12171c', { shadow: 0, lw: 3, stroke: '#7aa' }); disc(c, p.x + p.w / 2, p.y + (p.h - 14) / 2 - 8, p.w * 0.2, '#2a3a46', { shadow: 0, stroke: null }); led(c, p.x + p.w - 14, p.y + 12, 'rgb(60,255,120)', 3); },
  cabinet(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#e1e6e8', depth: 10, r: 4 }); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x + p.w / 2, p.y + 4); c.lineTo(p.x + p.w / 2, p.y + p.h - 12); c.stroke(); c.fillStyle = '#2e9e6a'; c.fillRect(p.x + p.w / 2 - 14, p.y + 8, 10, 3); c.fillRect(p.x + p.w / 2 - 11, p.y + 5, 4, 9); },
  cross(c, p) { c.save(); c.globalAlpha = 0.38; c.fillStyle = '#2e9e6a'; c.fillRect(p.x - p.r * 0.3, p.y - p.r, p.r * 0.6, p.r * 2); c.fillRect(p.x - p.r, p.y - p.r * 0.3, p.r * 2, p.r * 0.6); c.restore(); },
  panel(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#5c6068', depth: 14, r: 3 }); const r = rngFrom(hashStr('p' + p.x)); for (let x = p.x + 12; x < p.x + p.w - 12; x += 18) { c.fillStyle = '#15181c'; c.fillRect(x, p.y + 8, 10, 14); c.fillStyle = r() < 0.5 ? '#e0b030' : '#d84a3a'; c.fillRect(x + 1, p.y + (r() < 0.5 ? 9 : 15), 8, 6); } led(c, p.x + 10, p.y + p.h - 22, 'rgb(255,200,60)', 3); },
  transformer(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#6c7480', depth: 16, r: 5 }); for (let i = 0; i < 3; i++) { disc(c, p.x + 26 + i * ((p.w - 52) / 2), p.y + 30, 15, '#2c3238', { shadow: 0, lw: 2 }); disc(c, p.x + 26 + i * ((p.w - 52) / 2), p.y + 30, 6, '#b8a24a', { shadow: 0, stroke: null }); } hazard(c, p.x + 6, p.y + p.h - 34, p.w - 12, 10, 0.85); },
  bunk(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#5a6068', depth: 12, r: 4 }); for (let i = 0; i < 2; i++) { const y = p.y + 8 + i * (p.h / 2 - 8); c.fillStyle = ['#7a3a3a', '#3a5f7a'][(hashStr('u' + p.x) + i) % 2]; rrect(c, p.x + 8, y, p.w - 16, p.h / 2 - 22, 6); c.fill(); c.fillStyle = '#e8e8e0'; rrect(c, p.x + 12, y + 3, p.w - 24, 22, 6); c.fill(); } },
  table(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#8a6a45', depth: 12, r: 5 }); disc(c, p.x + 40, p.y + 30, 11, '#d8d0b8', { shadow: 0.1, lw: 1 }); disc(c, p.x + p.w - 40, p.y + 30, 11, '#d8d0b8', { shadow: 0.1, lw: 1 }); },
  rug(c, p) { c.fillStyle = '#7a2f2f'; rrect(c, p.x, p.y, p.w, p.h, 10); c.fill(); c.strokeStyle = '#d6b45c'; c.lineWidth = 4; rrect(c, p.x + 8, p.y + 8, p.w - 16, p.h - 16, 6); c.stroke(); c.strokeStyle = 'rgba(214,180,92,.5)'; c.lineWidth = 2; rrect(c, p.x + 20, p.y + 20, p.w - 40, p.h - 40, 4); c.stroke(); },
  plant(c, p) { disc(c, p.x, p.y + 6, p.r * 0.75, '#6b4a2f', { lw: 2 }); const r = rngFrom(hashStr('pl' + p.x + p.y)); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = p.r * 0.45; disc(c, p.x + Math.cos(a) * d, p.y - 8 + Math.sin(a) * d * 0.7, p.r * (0.45 + r() * 0.2), ['#2f7a2a', '#3d9435', '#4caa3f'][i % 3], { shadow: 0, lw: 1 }); } },
  dish(c, p) {
    disc(c, p.x, p.y, p.r, '#9aa3ad', { lw: 3, shadow: 0.4 });
    const g = c.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 4, p.x, p.y, p.r); g.addColorStop(0, '#f2f5f7'); g.addColorStop(1, '#8c96a0');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r - 8, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(p.x, p.y, (p.r - 8) * i / 4, 0, 7); c.stroke(); }
    c.strokeStyle = '#4a525b'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2.094; c.beginPath(); c.moveTo(p.x + Math.cos(a) * (p.r - 10), p.y + Math.sin(a) * (p.r - 10)); c.lineTo(p.x, p.y - 4); c.stroke(); }
    disc(c, p.x, p.y - 4, 9, '#d84a3a', { shadow: 0, lw: 2 }); led(c, p.x, p.y - 4, 'rgb(255,80,60)', 3);
  },
  longtable(c, p) {
    const chair = (x, y) => box(c, x, y, 34, 26, { top: '#4a525c', depth: 8, r: 5, shadow: 0.25 });
    for (let x = p.x + 18; x < p.x + p.w - 30; x += 54) { chair(x, p.y); chair(x, p.y + p.h - 26); }
    box(c, p.x, p.y + 20, p.w, p.h - 40, { top: '#a9b3bd', depth: 10, r: 6 });
    const r = rngFrom(hashStr('lt' + p.x + p.y));
    for (let x = p.x + 35; x < p.x + p.w - 20; x += 54) { if (r() < 0.75) { disc(c, x, p.y + 33, 10, '#f2efe6', { shadow: 0.1, lw: 1 }); disc(c, x, p.y + 33, 5, ['#d9a441', '#c9583e', '#7fb04a'][(r() * 3) | 0], { shadow: 0, stroke: null }); } if (r() < 0.6) disc(c, x + 6, p.y + p.h - 46, 7, '#7ec8e3', { shadow: 0.1, lw: 1 }); }
  },
  counter(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#b9c2cb', depth: 14, r: 5 }); c.fillStyle = '#2b3138'; c.fillRect(p.x + 12, p.y + 8, 60, 26); c.fillStyle = 'rgba(255,140,40,.6)'; c.fillRect(p.x + 16, p.y + 12, 52, 18); disc(c, p.x + p.w - 40, p.y + 22, 14, '#d0d6dc', { shadow: 0.1, lw: 2 }); },
  vat(c, p) {
    disc(c, p.x, p.y, p.r, '#3d4650', { lw: 4, shadow: 0.4 });
    const g = c.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 3, p.x, p.y, p.r - 8); g.addColorStop(0, '#d9ffb8'); g.addColorStop(0.5, '#62d34a'); g.addColorStop(1, '#1f6b2a');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r - 8, 0, 7); c.fill();
    const r = rngFrom(hashStr('v' + p.x + p.y)); c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(p.x + (r() - 0.5) * p.r, p.y + (r() - 0.5) * p.r, 2 + r() * 4, 0, 7); c.fill(); }
    radial(c, p.x, p.y, p.r * 2.2, 'rgba(110,255,120,.28)', 'rgba(0,0,0,0)', 'lighter');
  },
  vent(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#5b636d', depth: 4, r: 4, shadow: 0.15 }); c.fillStyle = 'rgba(0,0,0,.55)'; for (let y = p.y + 8; y < p.y + p.h - 8; y += 10) c.fillRect(p.x + 8, y, p.w - 16, 5); },
  puddle(c, p) { const r = rngFrom(hashStr('pu' + p.x)); c.fillStyle = 'rgba(70,110,140,.35)'; c.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, d = p.r * (0.7 + r() * 0.5); c[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.6); } c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(p.x - p.r * 0.2, p.y - p.r * 0.15, p.r * 0.35, p.r * 0.12, 0, 0, 7); c.fill(); },
  forklift(c, p) { box(c, p.x, p.y + 40, p.w, p.h - 40, { top: '#e0a321', depth: 16, r: 8 }); c.fillStyle = '#2b2f35'; c.fillRect(p.x + 20, p.y + 55, p.w - 40, 40); c.fillStyle = '#7a8088'; c.fillRect(p.x + 18, p.y, 12, 50); c.fillRect(p.x + p.w - 30, p.y, 12, 50); hazard(c, p.x + 8, p.y + p.h - 34, p.w - 16, 10, 0.9); disc(c, p.x + 10, p.y + p.h - 20, 12, '#1d1f22', { shadow: 0 }); disc(c, p.x + p.w - 10, p.y + p.h - 20, 12, '#1d1f22', { shadow: 0 }); },
  crate(c, p) { box(c, p.x, p.y, p.w, p.h, { top: '#9a7a46', depth: 12, r: 3 }); c.strokeStyle = 'rgba(60,40,15,.7)'; c.lineWidth = 3; c.strokeRect(p.x + 6, p.y + 6, p.w - 12, p.h - 24); c.beginPath(); c.moveTo(p.x + 6, p.y + 6); c.lineTo(p.x + p.w - 6, p.y + p.h - 18); c.moveTo(p.x + p.w - 6, p.y + 6); c.lineTo(p.x + 6, p.y + p.h - 18); c.stroke(); }
};


// ============================================================
// GÖRSEL EŞYALAR (assets/props/*.png) - varsa kodla çizilenin yerine kullanılır
// ============================================================
// mode 'w': genişlik = fn(p) · 'h': yükseklik = fn(p) · 'c': merkeze çiz (masa, reaktör)
// tile: uzun dikdörtgende yan yana tekrarla · tallOnly: sadece dikey/kare eşyada kullan
// Çarpışma kutusu aynı kalır (BunkerMap); görsel kutunun ÜSTÜNE doğru taşar (3/4 görünüm).
const IMG_SPEC = {
  tree:        { img: 'agac',      mode: 'h', size: (p) => p.r * 6.2, dy: (p) => p.r * 0.8 },
  bush:        { img: 'agac',      mode: 'w', size: (p) => p.r * 2.8, dy: (p) => p.r * 0.8 },
  rock:        { img: 'kaya',      mode: 'w', size: (p) => p.r * 3.0, dy: (p) => p.r * 0.7 },
  sandbag:     { img: 'kum',       mode: 'w', size: (p) => p.w * 1.1, dy: (p) => p.h + 6 },
  barrel:      { img: 'varil',     mode: 'h', size: (p) => p.r * 3.4, dy: (p) => p.r * 0.9 },
  tank:        { img: 'oksijen',   mode: 'h', size: (p) => p.r * 2.7, dy: (p) => p.r * 0.9 },
  crate:       { img: 'sandik',    mode: 'w', size: (p) => p.w * 1.25, dy: (p) => p.h + 4 },
  shelf:       { img: 'raf',       mode: 'w', size: (p) => p.w * 0.8, dy: (p) => p.h + 6, tallOnly: false, horizOnly: true },
  vending:     { img: 'otomat',    mode: 'h', size: (p) => p.h * 1.7, dy: (p) => p.h + 4 },
  generator:   { img: 'jenerator', mode: 'w', size: (p) => p.w * 1.0, dy: (p) => p.h + 4 },
  bed:         { img: 'revir',     mode: 'w', size: (p) => p.w * 1.12, dy: (p) => p.h + 6 },
  monitorbank: { img: 'monitor',   mode: 'h', size: (p) => p.h * 1.45, dy: (p) => p.h + 8, tile: true },
  locker:      { img: 'dolap',     mode: 'h', size: (p) => (p.h > p.w ? p.h * 1.15 : p.h * 2), dy: (p) => p.h + 4, tile: true },
  panel:       { img: 'salter_paneli', mode: 'h', size: (p) => p.h * 1.4, dy: (p) => p.h + 4, tile: true },
  roundtable:  { img: 'masa',      mode: 'c', size: (p) => p.r * 2.35 },
  bunk:        { img: 'ranza',     mode: 'w', size: (p) => p.w * 1.05, dy: (p) => p.h + 10 },
  core:        { img: 'reaktor',   mode: 'c', size: (p) => (p.r + 28) * 2.15, glow: true }
};

function drawPropImage(c, p) {
  const sp = IMG_SPEC[p.type], im = sp && PROP_IMG[sp.img];
  if (!im) return false;
  if (sp.horizOnly && p.h > p.w * 1.4) return false;   // dikey raf: eski çizim
  const asp = im.naturalWidth / im.naturalHeight;
  const sz = sp.size(p);
  let w = sp.mode === 'h' ? sz * asp : sz, h = sp.mode === 'h' ? sz : sz / asp;
  if (sp.mode === 'c') {
    c.drawImage(im, p.x - w / 2, p.y - h / 2, w, h);
    if (sp.glow) radial(c, p.x, p.y, p.r * 2.4, 'rgba(255,140,30,.30)', 'rgba(255,60,0,0)', 'lighter');
    return true;
  }
  const n = sp.tile ? Math.max(1, Math.floor(p.w / w + 0.25)) : 1;
  const cell = sp.tile ? p.w / n : w;
  const cx0 = p.shape === 'circle' ? p.x : p.x + (sp.tile ? cell / 2 : p.w / 2);
  const bottom = p.y + sp.dy(p);
  for (let i = 0; i < n; i++) {
    const cx = cx0 + i * cell;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(cx + 4, bottom - 2, w * 0.42, Math.max(6, w * 0.09), 0, 0, 7); c.fill();
    c.drawImage(im, cx - w / 2, bottom - h, w, h);
  }
  return true;
}

// Çizim sırası: önce zemine yapışık süsler, sonra borular/kablolar, sonra katı eşyalar (yukarıdan aşağı)
const LAYER = { trefoil: 0, hazardring: 0, path: 0, oil: 0, cross: 0, stripes: 0, rug: 0, vent: 0, puddle: 0, stools: 1, pipe: 2, cable: 2 };

// ============================================================
// ZEMİN EFEKTLERİ: tavan ışıkları, kir/aşınma, duvar dibi gölgeleri
// ============================================================
// Oda başına ışık rengi (tavan lambalarının zemine düşen ışığı)
const ROOM_LIGHT = {
  hall: '255,236,200', reactor: '255,140,60', security: '110,150,255', control: '90,180,255', o2: '120,235,255',
  comms: '110,190,255', generator: '255,200,120', cafeteria: '255,224,170', medbay: '220,255,240', lab: '150,255,180',
  electrical: '255,220,110', dorm: '255,196,140', storage: '255,210,150'
};

function edgeShade(c, w, h, top = 0.5) {
  // üst duvarın gölgesi güçlü, yanlar ve alt hafif
  const s = (x0, y0, x1, y1, a, rx, ry, rw, rh) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(rx, ry, rw, rh); };
  s(0, 0, 0, 110, top, 0, 0, w, 110);
  s(0, 0, 46, 0, 0.28, 0, 0, 46, h);
  s(w, 0, w - 46, 0, 0.28, w - 46, 0, 46, h);
  s(0, h, 0, h - 30, 0.22, 0, h - 30, w, 30);
}

function grime(c, w, h, seed, amount = 1) {
  const r = rngFrom(seed);
  for (let i = 0; i < (w * h) / 9000 * amount; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 70;
    radial(c, x, y, rad, `rgba(20,15,10,${0.05 + r() * 0.09})`, 'rgba(20,15,10,0)');
  }
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineCap = 'round';
  for (let i = 0; i < (w * h) / 26000 * amount; i++) {
    const x = r() * w, y = r() * h, a = r() * 6.28, l = 14 + r() * 40; c.lineWidth = 1 + r() * 1.5;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
}

function ceilingLights(c, w, h, col) {
  if (!col) return;
  const nx = Math.max(1, Math.round(w / 420)), ny = Math.max(1, Math.round(h / 420));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * w / nx, y = (j + 0.5) * h / ny + 20;
    radial(c, x, y, Math.min(w / nx, h / ny) * 0.75, `rgba(${col},.16)`, `rgba(${col},0)`, 'lighter');
  }
}

function paintFloorFx(c, R, id) {
  if (id === 'entrance') {   // yüzey: güneş ışığı + kenarlarda koyu çimen
    radial(c, R.w * 0.5, R.h * 0.45, R.w * 0.7, 'rgba(255,240,180,.10)', 'rgba(0,0,0,0)', 'lighter');
    edgeShade(c, R.w, R.h, 0.35);
    return;
  }
  grime(c, R.w, R.h, hashStr('g' + id));
  ceilingLights(c, R.w, R.h, ROOM_LIGHT[id]);
  edgeShade(c, R.w, R.h);
}

// Koridor süsü: kenar şeritleri, yer ışıkları, kir (koridor boyutunda şeffaf canvas)
export function paintCorridorDecor(cor) {
  const cv = mk(cor.w, cor.h), c = cv.getContext('2d');
  const horiz = cor.w >= cor.h, L = horiz ? cor.w : cor.h, T = horiz ? cor.h : cor.w;
  if (!horiz) { c.translate(cor.w, 0); c.rotate(Math.PI / 2); }   // dikeyi yataya çevirip aynı kodla çiz
  grime(c, L, T, hashStr('cor' + cor.id), 0.8);
  // kenarlarda koyu bant + sarı-siyah şerit
  const band = (y) => { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, L, 14); hazard(c, 0, y + (y ? 0 : 14) - (y ? 6 : 0), L, 6, 0.55); };
  band(0); band(T - 14);
  // ortada kesik çizgi
  c.fillStyle = 'rgba(255,214,90,.35)'; for (let x = 20; x < L - 20; x += 60) c.fillRect(x, T / 2 - 2, 30, 4);
  // kenar ledleri
  for (let x = 30; x < L - 10; x += 90) { led(c, x, 22, 'rgb(120,220,255)', 2.2); led(c, x + 45, T - 22, 'rgb(120,220,255)', 2.2); }
  // üst kenar gölgesi (yatay koridorda duvarın gölgesi)
  if (horiz) { const g = c.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, L, 60); }
  return cv;
}

// Duvarın ön yüzü (odanın üst kenarında görünen beton/çelik duvar). Yatay tekrar eder.
export function paintWallFaceTile() {
  const W = 384, H = WALL_FACE, cv = mk(W, H), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9aa4b1'); g.addColorStop(0.5, '#7e8895'); g.addColorStop(1, '#5d6673');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // büyük paneller
  for (let x = 0; x < W; x += 128) {
    c.fillStyle = 'rgba(255,255,255,.06)'; rrect(c, x + 8, 10, 112, H - 34, 6); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; rrect(c, x + 8, 10, 112, H - 34, 6); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 12, 12); c.lineTo(x + 116, 12); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, 0, 3, H);
  }
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 0, W, 3);          // üst kenar ışığı
  c.fillStyle = '#3a414b'; c.fillRect(0, H - 22, W, 22);                   // süpürgelik
  c.fillStyle = '#272c33'; c.fillRect(0, H - 6, W, 6);
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, H - 22, W, 2);
  // havalandırma ızgarası + lamba (tile başına)
  c.fillStyle = '#2f353d'; rrect(c, 40, 30, 56, 30, 4); c.fill(); c.fillStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 4; i++) c.fillRect(45, 35 + i * 6, 46, 3);
  c.fillStyle = '#20252b'; rrect(c, W / 2 + 40, 18, 60, 16, 4); c.fill();
  c.fillStyle = '#fff3c4'; rrect(c, W / 2 + 44, 21, 52, 9, 3); c.fill();
  radial(c, W / 2 + 70, 28, 80, 'rgba(255,230,160,.35)', 'rgba(0,0,0,0)', 'lighter');
  const r = rngFrom(77); for (let i = 0; i < 8; i++) radial(c, r() * W, H * 0.2 + r() * H * 0.5, 6 + r() * 14, 'rgba(60,40,20,.18)', 'rgba(60,40,20,0)');
  return cv;
}

// Bir odanın tüm eşyalarını ve ışıklarını tek bir şeffaf canvas'a çizer (oda boyutunda)
export function paintRoomDecor(roomId) {
  const R = ROOMS[roomId], cv = mk(R.w, R.h), c = cv.getContext('2d');
  paintFloorFx(c, R, roomId);
  c.translate(-R.x, -R.y);
  const items = PROPS.filter((p) => p.room === roomId);
  const layerOf = (p) => (LAYER[p.type] !== undefined ? LAYER[p.type] : 3);
  items.sort((a, b) => layerOf(a) - layerOf(b) || (a.y + (a.h || 0)) - (b.y + (b.h || 0)));
  items.forEach((p) => { if (!drawPropImage(c, p) && PROP[p.type]) PROP[p.type](c, p); });
  return cv;
}

// Sığınak giriş kapısı (yüzey kapısı): giriş odasının üst kenarında, koridorun ucunda
export function paintBunkerDoor() {
  const W = 420, H = 150, cv = mk(W, H), c = cv.getContext('2d');
  // beton çerçeve
  box(c, 0, 20, W, 110, { top: '#6b727b', depth: 18, r: 10 });
  // kapı boşluğu (açık, içerisi karanlık)
  c.fillStyle = '#07090b'; c.fillRect(120, 30, 180, 76);
  const g = c.createLinearGradient(0, 30, 0, 106); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,70,80,.45)'); c.fillStyle = g; c.fillRect(120, 30, 180, 76);
  // açılmış kapı kanatları
  box(c, 60, 34, 62, 70, { top: '#4d545c', depth: 10, r: 4 }); box(c, 298, 34, 62, 70, { top: '#4d545c', depth: 10, r: 4 });
  disc(c, 91, 69, 16, '#8b929a', { shadow: 0, lw: 2 }); disc(c, 329, 69, 16, '#8b929a', { shadow: 0, lw: 2 });
  c.strokeStyle = '#2a2f35'; c.lineWidth = 4; for (let i = 0; i < 4; i++) { const a = (i / 4) * 3.14159; [[91, 69], [329, 69]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); c.lineTo(x - Math.cos(a) * 12, y - Math.sin(a) * 12); c.stroke(); }); }
  hazard(c, 12, 108, W - 24, 14, 0.95);
  led(c, 40, 50, 'rgb(60,255,120)', 4); led(c, W - 40, 50, 'rgb(60,255,120)', 4);
  radial(c, W / 2, 130, 140, 'rgba(120,255,160,.20)', 'rgba(0,0,0,0)', 'lighter');
  return cv;
}

// BAŞLAT bölgesi: zeminde parlayan halka (sadece kurucuya ipucu)
export function paintStartPad(radius) {
  const S = radius * 2 + 20, cv = mk(S, S), c = cv.getContext('2d');
  radial(c, S / 2, S / 2, radius, 'rgba(80,255,140,.14)', 'rgba(80,255,140,0)', 'lighter');
  c.strokeStyle = 'rgba(80,255,140,.55)'; c.lineWidth = 4; c.setLineDash([18, 14]); c.beginPath(); c.arc(S / 2, S / 2, radius * 0.9, 0, 7); c.stroke();
  return cv;
}

// Sınır tüneli kapağı (yer kapağı). Aşama 5'te Katil dışındakilere gizlenecek.
export function paintTunnelHatch() {
  const W = 96, H = 64, cv = mk(W, H), c = cv.getContext('2d');
  const im = PROP_IMG.tunel;
  if (im) {   // gerçek görsel: üstten bakış için hafif basık çiz
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(W / 2 + 3, H / 2 + 5, 44, 26, 0, 0, 7); c.fill();
    c.drawImage(im, 2, 2, W - 4, H - 4);
    return cv;
  }
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(W / 2 + 3, H / 2 + 5, 40, 22, 0, 0, 7); c.fill();
  c.fillStyle = '#3a4a2a'; c.beginPath(); c.ellipse(W / 2, H / 2, 40, 22, 0, 0, 7); c.fill();
  c.fillStyle = '#0c0f0a'; c.beginPath(); c.ellipse(W / 2, H / 2, 33, 17, 0, 0, 7); c.fill();
  c.strokeStyle = '#7f9a4a'; c.lineWidth = 3; c.beginPath(); c.ellipse(W / 2, H / 2, 40, 22, 0, 0, 7); c.stroke();
  c.strokeStyle = '#6b7f3a'; c.lineWidth = 3; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(W / 2 + i * 9, H / 2 - 15); c.lineTo(W / 2 + i * 9, H / 2 + 15); c.stroke(); }
  return cv;
}

// Bomba sonrası: kapatılmış sığınak kapısı (koridorun ucunu mühürler)
export function paintSealedDoor() {
  const W = 220, H = 120, cv = mk(W, H), c = cv.getContext('2d');
  box(c, 0, 10, W, 100, { top: '#4a5058', depth: 16, r: 8 });
  box(c, 14, 24, W - 28, 70, { top: '#6b727b', depth: 10, r: 6 });
  hazard(c, 20, 30, W - 40, 12, 0.95); hazard(c, 20, 76, W - 40, 12, 0.95);
  disc(c, W / 2, 60, 20, '#8b929a', { shadow: 0, lw: 3 });
  c.strokeStyle = '#2a2f35'; c.lineWidth = 5; for (let i = 0; i < 4; i++) { const a = (i / 4) * 3.14159; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * 16, 60 + Math.sin(a) * 16); c.lineTo(W / 2 - Math.cos(a) * 16, 60 - Math.sin(a) * 16); c.stroke(); }
  led(c, 30, 60, 'rgb(255,50,40)', 5); led(c, W - 30, 60, 'rgb(255,50,40)', 5);
  return cv;
}

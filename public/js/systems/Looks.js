import { net } from './Net.js';
// ============================================================
// Looks.js - Canlı gözler + şapkalar (kodla çizilir, her çözünürlükte keskin)
// ============================================================
// GÖZLER: animasyon videolarındaki göz paketi (beyaz göz + ince koyu çerçeve):
//   round  : yuvarlak açık göz (normal)         squint : kısık/sinsi göz (öldüren gibi)
//   half   : yarı kapalı (rol videosu gibi)      closed : kırpma çizgisi
//   happy  : ^ ^ mutlu                           x      : ölü (X)
//   'wide' = round ama büyük (şaşkın)
// Gözlerin her karedeki yeri tools/eyes.py ile baked.json'a yazıldı (eyes, tops).
//
// ŞAPKALAR: HATS listesi. Her şapka 512x512 tuvale çizilir, taban ortası (256, 470).
//   Oyuncu şapkası profile kaydedilir (cfs.hat), çevrimiçi odada sunucu herkese iletir.

export const EYE_STYLES = ['round', 'squint', 'half', 'closed', 'happy', 'x'];
const LINE = '#1d1d1d';

function eyeCanvas(style) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.lineJoin = 'round'; x.lineCap = 'round';
  x.strokeStyle = LINE; x.fillStyle = '#ffffff'; x.lineWidth = 5;
  const fillStroke = () => { x.fill(); x.stroke(); };
  switch (style) {
    case 'round':
      x.beginPath(); x.ellipse(64, 64, 56, 58, 0, 0, Math.PI * 2); fillStroke(); break;
    case 'squint':   // sol göz; sağ göz aynası. İç köşe aşağıda, üst kenar düz -> sinsi bakış
      x.beginPath(); x.moveTo(8, 56); x.lineTo(120, 74); x.quadraticCurveTo(70, 104, 14, 80); x.quadraticCurveTo(4, 70, 8, 56); x.closePath(); fillStroke(); break;
    case 'half':     // üst göz kapağı düz
      x.beginPath(); x.moveTo(10, 44); x.lineTo(118, 44); x.quadraticCurveTo(124, 112, 64, 116); x.quadraticCurveTo(4, 112, 10, 44); x.closePath(); fillStroke(); break;
    case 'closed':
      x.lineWidth = 8; x.beginPath(); x.moveTo(12, 70); x.quadraticCurveTo(64, 98, 116, 70); x.stroke(); break;
    case 'happy':
      x.lineWidth = 9; x.beginPath(); x.moveTo(14, 84); x.quadraticCurveTo(64, 20, 114, 84); x.stroke(); break;
    case 'x':
      x.lineWidth = 11; x.beginPath(); x.moveTo(22, 22); x.lineTo(106, 106); x.moveTo(106, 22); x.lineTo(22, 106); x.stroke(); break;
  }
  c._s = 1;
  return c;
}

export function ensureLookTextures(scene) {
  EYE_STYLES.forEach((s) => { const k = 'eye_' + s; if (!scene.textures.exists(k)) scene.textures.addCanvas(k, eyeCanvas(s)); });
}

// ---------------- Şapkalar ----------------
// draw(x): 512x512 tuval, taban ortası (256,470). w: dünyadaki genişlik (top genişliği 256 birim üzerinden)
// sink: tepe noktasından ne kadar aşağı otursun (birim). tilt: derece.
const R = (x, a, b, c, d, r) => { x.beginPath(); x.roundRect(a, b, c, d, r); };
const grad = (x, y0, y1, c0, c1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
const out = (x, w = 7) => { x.lineWidth = w; x.strokeStyle = LINE; x.lineJoin = 'round'; x.stroke(); };
const fo = (x, fill, w) => { x.fillStyle = fill; x.fill(); out(x, w); };
function brim(x, w, h, y, fill) { x.beginPath(); x.ellipse(256, y, w, h, 0, 0, Math.PI * 2); fo(x, fill); }
function shine(x, a, b, c, d) { x.fillStyle = 'rgba(255,255,255,.28)'; R(x, a, b, c, d, 12); x.fill(); }

export const HATS = [
  { id: 'none' },
  { id: 'tophat', w: 150, sink: 20, draw(x) { brim(x, 200, 34, 452, '#1b1b1f'); R(x, 136, 150, 240, 300, 18); fo(x, grad(x, 150, 450, '#34343c', '#141418')); x.fillStyle = '#b3202a'; x.fillRect(140, 380, 232, 44); x.strokeRect(140, 380, 232, 44); shine(x, 160, 170, 30, 190); } },
  { id: 'cowboy', w: 210, sink: 30, draw(x) { x.beginPath(); x.moveTo(20, 420); x.quadraticCurveTo(256, 520, 492, 420); x.quadraticCurveTo(470, 470, 256, 486); x.quadraticCurveTo(42, 470, 20, 420); fo(x, '#8a5a2b'); x.beginPath(); x.moveTo(140, 450); x.bezierCurveTo(120, 240, 200, 210, 256, 270); x.bezierCurveTo(312, 210, 392, 240, 372, 450); x.closePath(); fo(x, grad(x, 220, 450, '#b07a3e', '#7a4c22')); x.fillStyle = '#3b2412'; x.fillRect(146, 400, 220, 30); } },
  { id: 'crown', w: 150, sink: 18, draw(x) { x.beginPath(); x.moveTo(110, 460); x.lineTo(96, 230); x.lineTo(176, 330); x.lineTo(256, 190); x.lineTo(336, 330); x.lineTo(416, 230); x.lineTo(402, 460); x.closePath(); fo(x, grad(x, 190, 460, '#ffe066', '#d49a00')); [[176, 400, '#e5484d'], [256, 395, '#3e8bff'], [336, 400, '#46c46a']].forEach(([a, b, c]) => { x.beginPath(); x.arc(a, b, 22, 0, 7); fo(x, c, 5); }); [96, 256, 416].forEach((a, i) => { x.beginPath(); x.arc(a, [230, 190, 230][i], 16, 0, 7); fo(x, '#fff3b0', 5); }); } },
  { id: 'beanie', w: 175, sink: 34, draw(x) { x.beginPath(); x.moveTo(90, 440); x.bezierCurveTo(80, 190, 432, 190, 422, 440); x.closePath(); fo(x, grad(x, 200, 440, '#e5484d', '#a51d24')); R(x, 80, 400, 352, 70, 26); fo(x, '#c22e35'); for (let i = 0; i < 10; i++) { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 5; x.beginPath(); x.moveTo(110 + i * 32, 408); x.lineTo(110 + i * 32, 462); x.stroke(); } x.beginPath(); x.arc(256, 222, 46, 0, 7); fo(x, '#f2f2f2'); } },
  { id: 'cap_red', w: 175, sink: 30, draw(x) { capDraw(x, '#d23b33', '#8f1d18'); } },
  { id: 'cap_blue', w: 175, sink: 30, draw(x) { capDraw(x, '#2f6fd6', '#183f86'); } },
  { id: 'fedora', w: 190, sink: 28, draw(x) { brim(x, 230, 40, 440, '#55585f'); x.beginPath(); x.moveTo(130, 440); x.bezierCurveTo(120, 250, 210, 230, 256, 280); x.bezierCurveTo(302, 230, 392, 250, 382, 440); x.closePath(); fo(x, grad(x, 240, 440, '#7a7e86', '#4a4d54')); x.fillStyle = '#1f2024'; x.fillRect(132, 392, 248, 34); } },
  { id: 'party', w: 120, sink: 16, tilt: 8, draw(x) { x.save(); x.beginPath(); x.moveTo(140, 465); x.lineTo(256, 90); x.lineTo(372, 465); x.closePath(); x.clip(); for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#ffd23f' : '#9b5de5'; x.save(); x.translate(256, 300); x.rotate(-0.5); x.fillRect(-300, -260 + i * 64, 600, 32); x.restore(); } x.restore(); x.beginPath(); x.moveTo(140, 465); x.lineTo(256, 90); x.lineTo(372, 465); x.closePath(); out(x); x.beginPath(); x.arc(256, 84, 32, 0, 7); fo(x, '#ff5d8f'); } },
  { id: 'chef', w: 165, sink: 26, draw(x) { [[170, 240, 90], [256, 190, 104], [342, 240, 90]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); fo(x, '#ffffff'); }); R(x, 138, 270, 236, 196, 16); fo(x, grad(x, 270, 466, '#ffffff', '#dfe3e8')); } },
  { id: 'viking', w: 185, sink: 30, draw(x) { [[1, 120], [-1, 392]].forEach(([s, bx]) => { x.beginPath(); x.moveTo(bx, 380); x.quadraticCurveTo(bx - 110 * s, 300, bx - 80 * s, 140); x.quadraticCurveTo(bx - 20 * s, 280, bx + 40 * s, 330); x.closePath(); fo(x, grad(x, 140, 380, '#fff7e0', '#cbb98c')); }); x.beginPath(); x.moveTo(110, 460); x.bezierCurveTo(100, 210, 412, 210, 402, 460); x.closePath(); fo(x, grad(x, 220, 460, '#b9c0c8', '#6d747c')); x.fillStyle = '#8d6a3a'; x.fillRect(108, 410, 296, 40); x.strokeRect(108, 410, 296, 40); x.fillRect(240, 250, 32, 160); } },
  { id: 'army', w: 205, sink: 40, draw(x) { x.beginPath(); x.moveTo(60, 450); x.bezierCurveTo(70, 180, 442, 180, 452, 450); x.quadraticCurveTo(256, 480, 60, 450); fo(x, grad(x, 200, 470, '#6b7d3e', '#3d4a22')); x.fillStyle = 'rgba(0,0,0,.18)'; [[170, 300], [300, 260], [360, 360], [210, 390]].forEach(([a, b]) => { x.beginPath(); x.ellipse(a, b, 34, 20, 0.4, 0, 7); x.fill(); }); } },
  { id: 'hardhat', w: 200, sink: 36, draw(x) { brim(x, 210, 30, 446, '#e0a800'); x.beginPath(); x.moveTo(84, 446); x.bezierCurveTo(84, 200, 428, 200, 428, 446); x.closePath(); fo(x, grad(x, 210, 446, '#ffd23f', '#d49a00')); R(x, 230, 205, 52, 240, 14); fo(x, '#f5c518', 5); x.fillStyle = '#1b1b1b'; x.beginPath(); x.arc(256, 360, 34, 0, 7); x.fill(); x.fillStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(256, 360); x.arc(256, 360, 30, i * 2.094 - 0.52, i * 2.094 + 0.52); x.fill(); } x.fillStyle = '#1b1b1b'; x.beginPath(); x.arc(256, 360, 8, 0, 7); x.fill(); } },
  { id: 'fez', w: 115, sink: 14, draw(x) { x.beginPath(); x.moveTo(160, 465); x.lineTo(180, 230); x.lineTo(332, 230); x.lineTo(352, 465); x.closePath(); fo(x, grad(x, 230, 465, '#d1262f', '#8f141b')); x.beginPath(); x.ellipse(256, 230, 76, 18, 0, 0, 7); fo(x, '#b81d26'); x.strokeStyle = '#1b1b1b'; x.lineWidth = 7; x.beginPath(); x.moveTo(256, 226); x.quadraticCurveTo(330, 240, 340, 330); x.stroke(); x.beginPath(); x.ellipse(342, 350, 14, 30, 0, 0, 7); fo(x, '#1b1b1b', 3); } },
  { id: 'beret', w: 185, sink: 30, tilt: -10, draw(x) { x.beginPath(); x.ellipse(240, 380, 200, 90, -0.1, 0, 7); fo(x, grad(x, 290, 470, '#2a2a30', '#111114')); R(x, 130, 420, 250, 44, 20); fo(x, '#1c1c20'); x.beginPath(); x.arc(250, 290, 14, 0, 7); fo(x, '#2a2a30', 4); } },
  { id: 'santa', w: 180, sink: 32, tilt: 6, draw(x) { x.beginPath(); x.moveTo(100, 430); x.bezierCurveTo(130, 160, 330, 90, 440, 250); x.quadraticCurveTo(400, 300, 412, 430); x.closePath(); fo(x, grad(x, 120, 430, '#e33b3b', '#9f1717')); x.beginPath(); x.arc(440, 262, 40, 0, 7); fo(x, '#ffffff'); R(x, 80, 400, 352, 74, 36); fo(x, '#ffffff'); } },
  { id: 'witch', w: 210, sink: 26, tilt: -6, draw(x) { brim(x, 240, 40, 446, '#3a2550'); x.beginPath(); x.moveTo(150, 446); x.quadraticCurveTo(220, 260, 236, 120); x.quadraticCurveTo(300, 60, 360, 110); x.quadraticCurveTo(300, 120, 300, 200); x.quadraticCurveTo(330, 330, 362, 446); x.closePath(); fo(x, grad(x, 80, 446, '#6a3fa0', '#3a2550')); x.fillStyle = '#46c46a'; x.fillRect(160, 392, 196, 34); x.strokeRect(160, 392, 196, 34); R(x, 236, 390, 40, 40, 6); fo(x, '#ffd23f', 5); } },
  { id: 'pirate', w: 210, sink: 30, draw(x) { x.beginPath(); x.moveTo(30, 400); x.quadraticCurveTo(130, 330, 256, 230); x.quadraticCurveTo(382, 330, 482, 400); x.quadraticCurveTo(256, 500, 30, 400); fo(x, grad(x, 230, 470, '#2a2a2e', '#0f0f12')); x.strokeStyle = '#d4a017'; x.lineWidth = 9; x.beginPath(); x.moveTo(60, 405); x.quadraticCurveTo(256, 480, 452, 405); x.stroke(); x.fillStyle = '#f2f2f2'; x.beginPath(); x.arc(256, 345, 34, 0, 7); x.fill(); x.fillStyle = '#111'; [[244, 340], [268, 340]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 8, 0, 7); x.fill(); }); x.strokeStyle = '#f2f2f2'; x.lineWidth = 9; x.beginPath(); x.moveTo(206, 380); x.lineTo(306, 420); x.moveTo(306, 380); x.lineTo(206, 420); x.stroke(); } },
  { id: 'grad', w: 190, sink: 30, draw(x) { x.beginPath(); x.moveTo(140, 470); x.lineTo(150, 330); x.lineTo(362, 330); x.lineTo(372, 470); x.closePath(); fo(x, '#1c1f26'); x.beginPath(); x.moveTo(256, 230); x.lineTo(480, 300); x.lineTo(256, 370); x.lineTo(32, 300); x.closePath(); fo(x, grad(x, 230, 370, '#30343c', '#15171c')); x.strokeStyle = '#ffd23f'; x.lineWidth = 7; x.beginPath(); x.moveTo(256, 300); x.lineTo(410, 330); x.lineTo(410, 420); x.stroke(); x.beginPath(); x.arc(410, 430, 14, 0, 7); x.fillStyle = '#ffd23f'; x.fill(); } },
  { id: 'headphones', w: 250, sink: 70, draw(x) { x.strokeStyle = LINE; x.lineWidth = 50; x.beginPath(); x.arc(256, 420, 200, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); x.strokeStyle = '#2b2d33'; x.lineWidth = 36; x.stroke(); [[70, 420], [442, 420]].forEach(([a, b]) => { R(x, a - 50, b - 90, 100, 150, 40); fo(x, grad(x, b - 90, b + 60, '#e5484d', '#9f1d24')); }); } },
  { id: 'flowers', w: 220, sink: 46, draw(x) { x.strokeStyle = '#3d7a2e'; x.lineWidth = 14; x.beginPath(); x.ellipse(256, 420, 210, 46, 0, Math.PI, Math.PI * 2); x.stroke(); ['#ff5d8f', '#ffd23f', '#ffffff', '#9b5de5', '#ff8c42', '#5bc0eb', '#ff5d8f'].forEach((c, i) => { const a = Math.PI + (i + 0.5) * Math.PI / 7, cx = 256 + Math.cos(a) * 210, cy = 420 + Math.sin(a) * 46; for (let p = 0; p < 5; p++) { x.beginPath(); x.arc(cx + Math.cos(p * 1.256) * 20, cy + Math.sin(p * 1.256) * 20, 17, 0, 7); fo(x, c, 4); } x.beginPath(); x.arc(cx, cy, 12, 0, 7); fo(x, '#ffd23f', 4); }); } },
  { id: 'halo', w: 170, sink: -46, float: true, draw(x) { x.shadowColor = '#ffe066'; x.shadowBlur = 40; x.lineWidth = 30; x.strokeStyle = '#ffe066'; x.beginPath(); x.ellipse(256, 380, 200, 52, 0, 0, 7); x.stroke(); x.shadowBlur = 0; x.lineWidth = 8; x.strokeStyle = '#d49a00'; x.stroke(); } },
  { id: 'propeller', w: 170, sink: 30, draw(x) { x.beginPath(); x.moveTo(110, 450); x.bezierCurveTo(100, 230, 412, 230, 402, 450); x.closePath(); x.save(); x.clip(); ['#e5484d', '#ffd23f', '#3e8bff', '#46c46a'].forEach((c, i) => { x.fillStyle = c; x.fillRect(100 + i * 78, 200, 78, 260); }); x.restore(); x.beginPath(); x.moveTo(110, 450); x.bezierCurveTo(100, 230, 412, 230, 402, 450); x.closePath(); out(x); x.fillStyle = '#555'; x.fillRect(248, 190, 16, 70); x.beginPath(); x.ellipse(170, 190, 90, 20, 0.08, 0, 7); fo(x, '#e5484d', 5); x.beginPath(); x.ellipse(342, 190, 90, 20, -0.08, 0, 7); fo(x, '#3e8bff', 5); x.beginPath(); x.arc(256, 190, 16, 0, 7); fo(x, '#ffd23f', 4); } },
  { id: 'bowler', w: 165, sink: 26, draw(x) { brim(x, 190, 30, 450, '#2a2018'); x.beginPath(); x.moveTo(110, 450); x.bezierCurveTo(100, 210, 412, 210, 402, 450); x.closePath(); fo(x, grad(x, 220, 450, '#4a3a2c', '#211810')); x.fillStyle = '#111'; x.fillRect(112, 405, 288, 30); shine(x, 160, 270, 30, 90); } },
  { id: 'sombrero', w: 270, sink: 28, draw(x) { brim(x, 250, 56, 430, '#e2b24f'); x.strokeStyle = '#c0392b'; x.lineWidth = 10; x.beginPath(); x.ellipse(256, 430, 230, 46, 0, 0, 7); x.stroke(); x.beginPath(); x.moveTo(170, 432); x.bezierCurveTo(170, 210, 342, 210, 342, 432); x.closePath(); fo(x, grad(x, 220, 432, '#f0c96b', '#c48f2c')); x.fillStyle = '#2e9e4a'; x.fillRect(172, 380, 168, 28); x.strokeRect(172, 380, 168, 28); } },
  { id: 'ushanka', w: 215, sink: 40, draw(x) { [[96, 1], [416, -1]].forEach(([a]) => { R(x, a - 46, 330, 92, 170, 40); fo(x, '#6b4a2e'); }); x.beginPath(); x.moveTo(100, 420); x.bezierCurveTo(100, 200, 412, 200, 412, 420); x.closePath(); fo(x, grad(x, 210, 420, '#8a8f99', '#575c66')); R(x, 70, 360, 372, 90, 40); fo(x, grad(x, 360, 450, '#8b6544', '#5d4128')); x.beginPath(); x.arc(256, 300, 26, 0, 7); fo(x, '#d4a017', 5); } },
  { id: 'bunny', w: 200, sink: 48, draw(x) { [[180, -0.25], [332, 0.25]].forEach(([a, r]) => { x.save(); x.translate(a, 440); x.rotate(r); x.beginPath(); x.ellipse(0, -170, 48, 170, 0, 0, 7); fo(x, '#ffffff'); x.beginPath(); x.ellipse(0, -170, 22, 130, 0, 0, 7); x.fillStyle = '#ffb3c7'; x.fill(); x.restore(); }); } },
  { id: 'cat', w: 210, sink: 40, draw(x) { [[150, -1], [362, 1]].forEach(([a, s]) => { x.beginPath(); x.moveTo(a - 80, 450); x.lineTo(a + 20 * s, 250); x.lineTo(a + 80, 450); x.closePath(); fo(x, '#2b2b30'); x.beginPath(); x.moveTo(a - 44, 440); x.lineTo(a + 12 * s, 310); x.lineTo(a + 44, 440); x.closePath(); x.fillStyle = '#ff9fbf'; x.fill(); }); } },
  { id: 'antenna', w: 150, sink: 30, draw(x) { [[180, 150], [332, 150]].forEach(([a, b], i) => { x.strokeStyle = LINE; x.lineWidth = 16; x.beginPath(); x.moveTo(256 + (i ? 50 : -50), 470); x.quadraticCurveTo(a, 300, a, b); x.stroke(); x.strokeStyle = '#7dff9a'; x.lineWidth = 8; x.stroke(); x.beginPath(); x.arc(a, b, 36, 0, 7); fo(x, '#7dff9a'); }); } },
  { id: 'gasmask', w: 175, sink: 26, draw(x) { x.beginPath(); x.moveTo(96, 470); x.bezierCurveTo(90, 220, 422, 220, 416, 470); x.closePath(); fo(x, grad(x, 230, 470, '#5d6b4a', '#36402a')); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(256, 360, 46, 0, 7); x.fill(); out(x, 5); x.fillStyle = '#1b1b1b'; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(256, 360); x.arc(256, 360, 40, i * 2.094 - 0.52, i * 2.094 + 0.52); x.fill(); } x.beginPath(); x.arc(256, 360, 10, 0, 7); x.fill(); } }
];

function capDraw(x, c0, c1) {
  x.beginPath(); x.moveTo(250, 440); x.quadraticCurveTo(440, 420, 500, 456); x.quadraticCurveTo(420, 486, 250, 472); x.closePath(); fo(x, c1);
  x.beginPath(); x.moveTo(90, 460); x.bezierCurveTo(80, 220, 432, 220, 422, 460); x.closePath(); fo(x, grad(x, 230, 460, c0, c1));
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 6; x.beginPath(); x.moveTo(256, 240); x.lineTo(256, 456); x.stroke();
  x.beginPath(); x.arc(256, 238, 16, 0, 7); fo(x, c0, 5); shine(x, 140, 280, 30, 100);
}

export const HAT_IDS = HATS.map((h) => h.id);
export const hatDef = (id) => HATS.find((h) => h.id === id) || HATS[0];

const hatCanvases = {};
export function getHatCanvas(id) {
  if (hatCanvases[id]) return hatCanvases[id];
  const def = hatDef(id), c = document.createElement('canvas'); c.width = c.height = 512;
  if (def.draw) { const x = c.getContext('2d'); x.lineJoin = 'round'; x.lineCap = 'round'; def.draw(x); }
  return (hatCanvases[id] = c);
}
export function ensureHatTexture(scene, id) {
  const k = 'hat_' + id;
  if (id && id !== 'none' && !scene.textures.exists(k)) scene.textures.addCanvas(k, getHatCanvas(id));
  return k;
}
// Seçici için küçük resim (data URL)
const thumbs = {};
export function getHatThumb(id) {
  if (thumbs[id]) return thumbs[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  if (id !== 'none') c.getContext('2d').drawImage(getHatCanvas(id), 0, 0, 512, 512, 0, 0, 128, 128);
  return (thumbs[id] = c.toDataURL());
}

const HAT_KEY = 'cfs.hat';
// Kayıtlı şapka; hesapta alınmamışsa (ya da misafirsen ve ücretliyse) şapkasız
export function loadHat() { let h = 'none'; try { h = localStorage.getItem(HAT_KEY) || 'none'; } catch (e) { /* yoksay */ } return HAT_IDS.includes(h) && ownsHat(net.account, h) ? h : 'none'; }
export function saveHat(id) { try { localStorage.setItem(HAT_KEY, id); } catch (e) { /* yoksay */ } }
export function randomHat() { return Math.random() < 0.25 ? 'none' : HAT_IDS[1 + Math.floor(Math.random() * (HAT_IDS.length - 1))]; }

// Botların şapkası: ÜLKESİNE UYGUN şapkalar (Norveç viking, Türkiye fes...) ve botların çoğu şapkasız.
// Bayraktan türetilir: lobide ve maçta, her cihazda aynı (ayrıca göndermeye gerek yok).
export const BOT_HATS = {
  TR: ['fez'], AZ: ['fez'], DE: ['army', 'chef'], FR: ['beret', 'chef'], IT: ['chef'], ES: ['sombrero'], PT: ['beret'],
  GB: ['tophat', 'crown', 'bowler'], NL: ['flowers'], PL: ['ushanka'], CZ: ['bowler'], GR: ['flowers'], CH: ['chef'],
  SE: ['viking'], NO: ['viking'], FI: ['viking', 'ushanka'], UA: ['ushanka'], RU: ['ushanka', 'army'], US: ['cowboy', 'cap_blue', 'grad'],
  MX: ['sombrero'], BR: ['party'], AR: ['cowboy'], JP: ['headphones'], CN: ['army'], IN: ['flowers']
};
export function botHat(flag) {
  // Her gün değişir (bugün Türkiye fesli, yarın şapkasız olabilir); aynı gün herkeste aynı
  const day = new Date().toISOString().slice(0, 10);
  let h = 0; for (const ch of String(flag) + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const list = BOT_HATS[flag];
  if (!list || h % 100 >= 35) return 'none';           // botların ~%65'i şapkasız
  return list[(h >>> 3) % list.length];
}

// ---------------- Jeton fiyatları (sunucudaki HAT_PRICE ile aynı) ----------------
export const HAT_PRICE = {"none":0,"cap_red":0,"cap_blue":0,"beanie":0,"fedora":100,"party":100,"chef":100,"beret":100,"bowler":100,"army":100,"hardhat":100,"cowboy":250,"fez":250,"santa":250,"grad":250,"headphones":250,"flowers":250,"ushanka":250,"cat":250,"bunny":250,"tophat":500,"viking":500,"witch":500,"pirate":500,"propeller":500,"sombrero":500,"antenna":500,"gasmask":500,"crown":1000,"halo":1000};
export const hatPrice = (id) => HAT_PRICE[id] ?? 0;
// Bu şapka takılabilir mi? (bedava ya da hesapta alınmış)
export const ownsHat = (account, id) => hatPrice(id) === 0 || !!(account && account.hats && account.hats.includes(id));

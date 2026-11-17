// ============================================================
// Flags.js - Bayrakları KODLA çizer (resim dosyası gerekmez)
// ============================================================
// Her bayrak 450x300'lük mantıksal ölçüde çizilir; tuval 2 kat büyüktür (900x600)
// ki 2K ekranda ve rol animasyonunda net görünsün. İleride gerçek resim kullanmak
// istersen sadece getFlagCanvas() fonksiyonunu değiştirmen yeter.

import { assetUrl } from './Assets.js';

const W = 450, H = 300, HD = 2;
const STORAGE_KEY = 'cfs_flag';

export const FLAG_LIST = [
  'TR', 'AZ', 'KZ', 'UZ', 'TM', 'KG', 'PK', 'SA', 'EG', 'IQ', 'IR', 'GE',
  'DE', 'FR', 'IT', 'ES', 'PT', 'GB', 'NL', 'PL', 'CZ', 'GR', 'CH', 'AT', 'HU',
  'SE', 'NO', 'FI', 'DK', 'IE', 'BE', 'UA', 'RU', 'CR', 'RO', 'BG', 'RS', 'HR',
  'US', 'MX', 'BR', 'AR', 'CA', 'AU', 'JP', 'KR', 'CN', 'IN', 'ID', 'MY', 'TH'
];

const cache = {};

function stripesH(c, colors, weights = colors.map(() => 1)) {
  const total = weights.reduce((a, b) => a + b, 0);
  let y = 0;
  colors.forEach((col, i) => {
    const h = (H * weights[i]) / total;
    c.fillStyle = col; c.fillRect(0, y, W, Math.ceil(h) + 1); y += h;
  });
}
function stripesV(c, colors, weights = colors.map(() => 1)) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = 0;
  colors.forEach((col, i) => {
    const w = (W * weights[i]) / total;
    c.fillStyle = col; c.fillRect(x, 0, Math.ceil(w) + 1, H); x += w;
  });
}
function star(c, cx, cy, r, color, points = 5, inner = 0.4, rot = 0) {
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + rot + (i * Math.PI) / points;
    c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  c.closePath(); c.fill();
}
function circle(c, x, y, r, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
// İskandinav haçı: x = dikey kolun sol kenarı, t = kalınlık
function nordic(c, bg, cross, x, t, inner, innerT) {
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.fillStyle = cross; c.fillRect(x, 0, t, H); c.fillRect(0, (H - t) / 2, W, t);
  if (inner) {
    const o = (t - innerT) / 2;
    c.fillStyle = inner; c.fillRect(x + o, 0, innerT, H); c.fillRect(0, (H - innerT) / 2, W, innerT);
  }
}

const DRAW = {
  NONE: (c) => { c.fillStyle = '#1fd91f'; c.fillRect(0, 0, W, H); },
  TR: (c) => {
    c.fillStyle = '#e30a17'; c.fillRect(0, 0, W, H);
    circle(c, W * 0.38, H / 2, H * 0.25, '#fff');
    circle(c, W * 0.43, H / 2, H * 0.2, '#e30a17');
    star(c, W * 0.55, H / 2, H * 0.12, '#fff', 5, 0.4, -Math.PI / 2);
  },
  AZ: (c) => {
    stripesH(c, ['#00b5e2', '#ef3340', '#509e2f']);
    circle(c, W * 0.46, H / 2, H * 0.15, '#fff');
    circle(c, W * 0.49, H / 2, H * 0.123, '#ef3340');
    star(c, W * 0.56, H / 2, H * 0.065, '#fff', 8, 0.45);
  },
  DE: (c) => stripesH(c, ['#000', '#dd0000', '#ffce00']),
  FR: (c) => stripesV(c, ['#0055a4', '#fff', '#ef4135']),
  IT: (c) => stripesV(c, ['#009246', '#fff', '#ce2b37']),
  ES: (c) => stripesH(c, ['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]),
  PT: (c) => {
    stripesV(c, ['#046a38', '#da291c'], [2, 3]);
    c.strokeStyle = '#ffe900'; c.lineWidth = 10;
    c.beginPath(); c.arc(W * 0.4, H / 2, H * 0.2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(W * 0.4 - 30, H / 2 - 36, 60, 70);
    c.fillStyle = '#da291c'; c.fillRect(W * 0.4 - 22, H / 2 - 28, 44, 54);
  },
  GB: (c) => {
    c.fillStyle = '#012169'; c.fillRect(0, 0, W, H);
    c.lineCap = 'butt';
    const diag = (w, col) => {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      c.moveTo(0, 0); c.lineTo(W, H); c.moveTo(W, 0); c.lineTo(0, H); c.stroke();
    };
    diag(60, '#fff'); diag(24, '#c8102e');
    c.fillStyle = '#fff'; c.fillRect(W / 2 - 45, 0, 90, H); c.fillRect(0, H / 2 - 45, W, 90);
    c.fillStyle = '#c8102e'; c.fillRect(W / 2 - 27, 0, 54, H); c.fillRect(0, H / 2 - 27, W, 54);
  },
  NL: (c) => stripesH(c, ['#ae1c28', '#fff', '#21468b']),
  PL: (c) => stripesH(c, ['#fff', '#dc143c']),
  CZ: (c) => {
    stripesH(c, ['#fff', '#d7141a']);
    c.fillStyle = '#11457e'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.5, H / 2); c.lineTo(0, H); c.closePath(); c.fill();
  },
  GR: (c) => {
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#fff' : '#0d5eaf'; c.fillRect(0, (H / 9) * i, W, Math.ceil(H / 9) + 1); }
    const s = (H / 9) * 5;
    c.fillStyle = '#0d5eaf'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#fff'; c.fillRect(s / 2 - H / 18, 0, H / 9, s); c.fillRect(0, s / 2 - H / 18, s, H / 9);
  },
  CH: (c) => {
    c.fillStyle = '#da291c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    c.fillRect(W / 2 - H * 0.1, H * 0.18, H * 0.2, H * 0.64);
    c.fillRect(W / 2 - H * 0.32, H / 2 - H * 0.1, H * 0.64, H * 0.2);
  },
  SE: (c) => nordic(c, '#006aa7', '#fecc00', W * 0.3, H * 0.18),
  NO: (c) => nordic(c, '#ba0c2f', '#fff', W * 0.27, H * 0.25, '#00205b', H * 0.125),
  FI: (c) => nordic(c, '#fff', '#002f6c', W * 0.27, H * 0.27),
  UA: (c) => stripesH(c, ['#0057b7', '#ffd700']),
  RU: (c) => stripesH(c, ['#fff', '#0039a6', '#d52b1e']),
  // Kırım bayrağı: üst mavi ince, ortada geniş beyaz, alt kırmızı ince (1:4:1)
  CR: (c) => stripesH(c, ['#006fb0', '#fff', '#da251d'], [1, 4, 1]),
  US: (c) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#fff' : '#b22234'; c.fillRect(0, (H / 13) * i, W, Math.ceil(H / 13) + 1); }
    c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, W * 0.4, H * (7 / 13));
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) {
      star(c, W * 0.4 * ((k + 0.5) / 6), H * (7 / 13) * ((r + 0.5) / 5), 8, '#fff');
    }
  },
  MX: (c) => {
    stripesV(c, ['#006847', '#fff', '#ce1126']);
    c.strokeStyle = '#4f8a3a'; c.lineWidth = 8;
    c.beginPath(); c.arc(W / 2, H / 2, H * 0.17, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    circle(c, W / 2, H / 2 - 8, H * 0.11, '#8c5a2b');
    circle(c, W / 2 + 10, H / 2 - 24, H * 0.04, '#5e3a1a');
  },
  BR: (c) => {
    c.fillStyle = '#009c3b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffdf00'; c.beginPath();
    c.moveTo(W * 0.08, H / 2); c.lineTo(W / 2, H * 0.1); c.lineTo(W * 0.92, H / 2); c.lineTo(W / 2, H * 0.9);
    c.closePath(); c.fill();
    circle(c, W / 2, H / 2, H * 0.26, '#002776');
    c.save(); c.beginPath(); c.arc(W / 2, H / 2, H * 0.26, 0, Math.PI * 2); c.clip();
    c.strokeStyle = '#fff'; c.lineWidth = 10;
    c.beginPath(); c.arc(W / 2 - 40, H / 2 + 160, 190, Math.PI * 1.25, Math.PI * 1.85); c.stroke();
    c.restore();
  },
  AR: (c) => {
    stripesH(c, ['#74acdf', '#fff', '#74acdf']);
    star(c, W / 2, H / 2, H * 0.12, '#f6b40e', 16, 0.62);
    circle(c, W / 2, H / 2, H * 0.065, '#f6b40e');
    circle(c, W / 2, H / 2, H * 0.05, '#e8a00a');
  },
  JP: (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); circle(c, W / 2, H / 2, H * 0.3, '#bc002d'); },
  CN: (c) => {
    c.fillStyle = '#de2910'; c.fillRect(0, 0, W, H);
    star(c, W * 0.17, H * 0.27, H * 0.15, '#ffde00');
    [[0.34, 0.1], [0.41, 0.2], [0.41, 0.35], [0.34, 0.45]].forEach(([x, y]) => star(c, W * x, H * y, H * 0.05, '#ffde00'));
  },
  IN: (c) => {
    stripesH(c, ['#ff9933', '#fff', '#138808']);
    c.strokeStyle = '#000080'; c.lineWidth = 4;
    const r = H * 0.13;
    c.beginPath(); c.arc(W / 2, H / 2, r, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    }
    c.stroke();
    circle(c, W / 2, H / 2, 6, '#000080');
  },

  // ---------- TARİHİ BAYRAKLAR (Sığınak Bileti kasalarından çıkar) ----------
  OTT: (c) => {                                     // Osmanlı İmparatorluğu
    c.fillStyle = '#e30a17'; c.fillRect(0, 0, W, H);
    circle(c, W * 0.38, H / 2, H * 0.25, '#fff');
    circle(c, W * 0.43, H / 2, H * 0.2, '#e30a17');
    star(c, W * 0.56, H / 2, H * 0.13, '#fff', 8, 0.55, 0);
  },
  BRE: (c) => {                                     // Britanya İmparatorluğu (Red Ensign)
    c.fillStyle = '#c8102e'; c.fillRect(0, 0, W, H);
    c.save(); c.beginPath(); c.rect(0, 0, W / 2, H / 2); c.clip(); c.scale(0.5, 0.5); DRAW.GB(c); c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, W / 2 - 3, H / 2 - 3);
  },
  ROM: (c) => {                                     // Roma İmparatorluğu (SPQR)
    c.fillStyle = '#8c0b14'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#f2c14e'; c.lineWidth = 8; c.strokeRect(14, 14, W - 28, H - 28);
    c.fillStyle = '#f2c14e'; c.font = 'bold 104px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SPQR', W / 2, H / 2 + 4);
    c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  },
  HRE: (c) => {                                     // Kutsal Roma İmparatorluğu (çift başlı kartal)
    c.fillStyle = '#fcd116'; c.fillRect(0, 0, W, H);
    const k = 1.35, cx = W / 2, cy = H / 2 + 6;
    c.fillStyle = '#111'; c.strokeStyle = '#111'; c.lineCap = 'round';
    const poly = (pts, m) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(cx + m * x * k, cy + y * k) : c.moveTo(cx + m * x * k, cy + y * k))); c.closePath(); c.fill(); };
    [-1, 1].forEach((m) => {
      poly([[-22, -5], [-90, -45], [-82, -10], [-90, 10], [-72, 28], [-76, 48], [-50, 40], [-40, 62], [-22, 38]].map(([x, y]) => [-x, y]), m);
      c.lineWidth = 13 * k; c.beginPath(); c.moveTo(cx + m * 8 * k, cy - 25 * k); c.lineTo(cx + m * 32 * k, cy - 58 * k); c.stroke();
      c.beginPath(); c.arc(cx + m * 34 * k, cy - 62 * k, 11 * k, 0, Math.PI * 2); c.fill();
      poly([[44, -66], [60, -58], [44, -56]], m);
    });
    poly([[0, -30], [25, -10], [20, 40], [0, 60], [-20, 40], [-25, -10]], 1);
    poly([[-14, 45], [0, 85], [14, 45]], 1);
    c.fillStyle = '#d62612'; c.beginPath(); c.arc(cx, cy + 4 * k, 9 * k, 0, Math.PI * 2); c.fill();
  },
  BYZ: (c) => {                                     // Bizans İmparatorluğu
    c.fillStyle = '#6b1a3a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f2c14e'; c.fillRect(W / 2 - 14, 0, 28, H); c.fillRect(0, H / 2 - 14, W, 28);
    c.font = 'bold 70px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    [[W * 0.25, H * 0.25], [W * 0.75, H * 0.25], [W * 0.25, H * 0.75], [W * 0.75, H * 0.75]].forEach(([x, y]) => c.fillText('β', x, y));
    c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  },
  SOV: (c) => {                                     // SSCB
    c.fillStyle = '#cc0000'; c.fillRect(0, 0, W, H);
    const g = '#ffd700', cx = W * 0.3, cy = H * 0.44;
    c.save(); c.translate(cx, cy); c.scale(1.4, 1.4); c.translate(-cx, -cy);
    c.strokeStyle = g; c.fillStyle = g; c.lineCap = 'round'; c.lineWidth = 9;
    c.beginPath(); c.moveTo(cx - 36, cy + 46); c.lineTo(cx + 30, cy - 22); c.stroke();                       // çekiç sapı
    c.save(); c.translate(cx + 26, cy - 26); c.rotate(-Math.PI / 4); c.fillRect(-26, -10, 52, 18); c.restore(); // çekiç başı
    c.lineWidth = 8; c.beginPath(); c.arc(cx + 2, cy + 8, 40, Math.PI * 0.9, Math.PI * 2.05); c.stroke();     // orak
    c.beginPath(); c.moveTo(cx + 36, cy + 26); c.lineTo(cx + 12, cy + 52); c.stroke();
    star(c, cx, cy - 66, 22, g, 5, 0.4, 0);
    c.restore();
  },
  JPE: (c) => {                                     // Japon İmparatorluğu (16 ışınlı doğan güneş)
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    const cx = W * 0.4, cy = H / 2;
    for (let i = 0; i < 16; i += 2) {
      c.fillStyle = '#bc002d'; c.beginPath(); c.moveTo(cx, cy);
      c.arc(cx, cy, W, (i * Math.PI) / 8, ((i + 1) * Math.PI) / 8); c.closePath(); c.fill();
    }
    circle(c, cx, cy, H * 0.17, '#bc002d'); circle(c, cx, cy, H * 0.12, '#bc002d');
  },
  FRK: (c) => {                                     // Fransız Krallığı (zambak)
    c.fillStyle = '#0a3a8c'; c.fillRect(0, 0, W, H);
    const s = 105, cx = W / 2, cy = H / 2 - 12; c.fillStyle = '#f2c14e';
    c.beginPath(); c.moveTo(cx, cy - s); c.bezierCurveTo(cx + s * 0.35, cy - s * 0.55, cx + s * 0.3, cy - s * 0.1, cx, cy + s * 0.15); c.bezierCurveTo(cx - s * 0.3, cy - s * 0.1, cx - s * 0.35, cy - s * 0.55, cx, cy - s); c.fill();
    [-1, 1].forEach((m) => { c.beginPath(); c.moveTo(cx + m * s * 0.05, cy + s * 0.1); c.bezierCurveTo(cx + m * s * 0.2, cy - s * 0.35, cx + m * s * 0.75, cy - s * 0.45, cx + m * s * 0.85, cy - s * 0.05); c.bezierCurveTo(cx + m * s * 0.9, cy + s * 0.2, cx + m * s * 0.55, cy + s * 0.3, cx + m * s * 0.25, cy + s * 0.15); c.closePath(); c.fill(); });
    c.fillRect(cx - s * 0.5, cy + s * 0.2, s, s * 0.13);
    c.beginPath(); c.moveTo(cx - s * 0.2, cy + s * 0.33); c.lineTo(cx + s * 0.2, cy + s * 0.33); c.lineTo(cx + s * 0.32, cy + s * 0.72); c.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.32, cy + s * 0.72); c.closePath(); c.fill();
  },
  RUE: (c) => stripesH(c, ['#111', '#ffd700', '#fff']),   // Rus İmparatorluğu (siyah-sarı-beyaz)
  BGK: (c) => {                                     // Bulgar Krallığı
    stripesH(c, ['#fff', '#00966e', '#d62612']);
    c.fillStyle = '#f2c14e'; c.fillRect(28, 46, 70, 22);
    [[28, 46], [57, 46], [86, 46]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y - 22); c.lineTo(x + 12, y); c.closePath(); c.fill(); });
  },
  ESE: (c) => {                                     // İspanya İmparatorluğu (Burgonya haçı)
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#c60b1e'; c.lineWidth = 30; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, H); c.moveTo(W, 0); c.lineTo(0, H); c.stroke();
    c.fillStyle = '#c60b1e';
    for (let i = 1; i <= 7; i++) {                  // budaklı gövde
      [[i / 8, i / 8, 1], [1 - i / 8, i / 8, -1]].forEach(([u, v, d]) => {
        c.save(); c.translate(u * W, v * H); c.rotate(d * Math.atan2(H, W) + Math.PI / 2); c.fillRect(-3, -24, 6, 48); c.restore();
      });
    }
  },
  GEN: (c) => {                                     // Ceneviz Cumhuriyeti (Aziz Yorgi haçı)
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#d4002a'; c.fillRect(W / 2 - 24, 0, 48, H); c.fillRect(0, H / 2 - 24, W, 48);
  },
  MON: (c) => {                                     // Moğol İmparatorluğu (Soyombo benzeri)
    c.fillStyle = '#0a5c2e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f2c14e';
    // soyombo stilize
    const cx = W/2, cy = H/2;
    c.beginPath(); c.arc(cx, cy - 40, 18, 0, Math.PI*2); c.fill(); // güneş
    c.fillRect(cx - 6, cy - 20, 12, 50); // dikey
    c.fillRect(cx - 28, cy + 10, 56, 10); // yatay
    c.beginPath(); c.moveTo(cx - 20, cy + 30); c.lineTo(cx, cy + 55); c.lineTo(cx + 20, cy + 30); c.closePath(); c.fill(); // ok
  },
  PER: (c) => {                                     // Pers İmparatorluğu (Ahameniş)
    c.fillStyle = '#8b0000'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f2c14e';
    c.font = 'bold 48px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('𐎠𐎧𐎠', W/2, H/2 - 10);
    c.font = 'bold 22px Georgia, serif';
    c.fillText('PERSIA', W/2, H/2 + 40);
    c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  },
  ABB: (c) => {                                     // Abbasî Halifeliği
    c.fillStyle = '#111'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    c.font = 'bold 90px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('ع', W/2, H/2 + 8);
    c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  },
  SEL: (c) => {                                     // Büyük Selçuklu
    c.fillStyle = '#1a3a6e'; c.fillRect(0, 0, W, H);
    // çift başlı kartal stilize
    c.fillStyle = '#f2c14e';
    const cx = W/2, cy = H/2;
    c.beginPath(); c.arc(cx - 25, cy - 15, 18, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(cx + 25, cy - 15, 18, 0, Math.PI*2); c.fill();
    c.fillRect(cx - 35, cy, 70, 40);
    c.beginPath(); c.moveTo(cx - 40, cy + 40); c.lineTo(cx, cy + 70); c.lineTo(cx + 40, cy + 40); c.closePath(); c.fill();
  },

  // ---- Yeni eklenen bayraklar ----
  KZ: (c) => { // Kazakhstan
    c.fillStyle = '#00afca'; c.fillRect(0, 0, W, H);
    // golden sun
    circle(c, W/2, H*0.38, H*0.13, '#ffc20e');
    // sun rays
    c.strokeStyle = '#ffc20e'; c.lineWidth = 4;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2 - Math.PI/2;
      c.beginPath();
      c.moveTo(W/2 + Math.cos(a)*H*0.15, H*0.38 + Math.sin(a)*H*0.15);
      c.lineTo(W/2 + Math.cos(a)*H*0.22, H*0.38 + Math.sin(a)*H*0.22);
      c.stroke();
    }
    // eagle (simplified)
    c.fillStyle = '#ffc20e';
    c.beginPath();
    c.moveTo(W/2 - 40, H*0.62); c.lineTo(W/2, H*0.48); c.lineTo(W/2 + 40, H*0.62);
    c.lineTo(W/2 + 25, H*0.72); c.lineTo(W/2, H*0.62); c.lineTo(W/2 - 25, H*0.72);
    c.closePath(); c.fill();
    // vertical ornament left
    c.fillStyle = '#ffc20e';
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.ellipse(28, H*(0.15 + i*0.12), 10, 18, 0, 0, Math.PI*2);
      c.fill();
    }
  },
  UZ: (c) => { // Uzbekistan
    stripesH(c, ['#1eb53a', '#fff', '#0099b5'], [1, 0.2, 1]);
    // red thin lines
    c.fillStyle = '#ce1126';
    c.fillRect(0, H*0.32 - 2, W, 4);
    c.fillRect(0, H*0.68 - 2, W, 4);
    // crescent + stars
    circle(c, W*0.18, H*0.18, H*0.08, '#fff');
    circle(c, W*0.21, H*0.18, H*0.065, '#1eb53a');
    for (let i = 0; i < 12; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      star(c, W*(0.28 + col*0.06), H*(0.12 + row*0.06), 6, '#fff');
    }
  },
  TM: (c) => { // Turkmenistan
    c.fillStyle = '#28ae66'; c.fillRect(0, 0, W, H);
    // vertical stripe
    c.fillStyle = '#d22630'; c.fillRect(0, 0, W*0.22, H);
    // five carpet guls (simplified)
    c.fillStyle = '#fff';
    const gy = [0.12, 0.28, 0.44, 0.60, 0.76];
    gy.forEach((y, i) => {
      c.beginPath();
      c.moveTo(W*0.11, H*y);
      c.lineTo(W*0.16, H*(y+0.04));
      c.lineTo(W*0.11, H*(y+0.08));
      c.lineTo(W*0.06, H*(y+0.04));
      c.closePath(); c.fill();
    });
    // crescent + stars
    circle(c, W*0.55, H*0.35, H*0.12, '#fff');
    circle(c, W*0.58, H*0.35, H*0.09, '#28ae66');
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI/2 + i * (Math.PI*2/5);
      star(c, W*0.55 + Math.cos(a)*H*0.18, H*0.35 + Math.sin(a)*H*0.18, 8, '#fff');
    }
  },
  KG: (c) => { // Kyrgyzstan
    c.fillStyle = '#e8112d'; c.fillRect(0, 0, W, H);
    // sun
    circle(c, W/2, H/2, H*0.22, '#ffef00');
    // 40 rays
    c.strokeStyle = '#ffef00'; c.lineWidth = 5;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      c.beginPath();
      c.moveTo(W/2 + Math.cos(a)*H*0.24, H/2 + Math.sin(a)*H*0.24);
      c.lineTo(W/2 + Math.cos(a)*H*0.38, H/2 + Math.sin(a)*H*0.38);
      c.stroke();
    }
    // tunduk (yurt crown)
    c.strokeStyle = '#e8112d'; c.lineWidth = 6;
    c.beginPath(); c.arc(W/2, H/2, H*0.14, 0, Math.PI*2); c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      c.beginPath();
      c.moveTo(W/2, H/2);
      c.lineTo(W/2 + Math.cos(a)*H*0.14, H/2 + Math.sin(a)*H*0.14);
      c.stroke();
    }
  },
  PK: (c) => { // Pakistan
    c.fillStyle = '#01411c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; c.fillRect(0, 0, W*0.25, H);
    // crescent
    circle(c, W*0.55, H/2, H*0.22, '#fff');
    circle(c, W*0.60, H/2, H*0.18, '#01411c');
    star(c, W*0.68, H*0.42, H*0.09, '#fff');
  },
  SA: (c) => { // Saudi Arabia
    c.fillStyle = '#165d31'; c.fillRect(0, 0, W, H);
    // simplified shahada area + sword
    c.fillStyle = '#fff';
    c.font = 'bold 28px Arial';
    c.textAlign = 'center';
    c.fillText('لا إله إلا الله', W/2, H*0.38);
    c.fillText('محمد رسول الله', W/2, H*0.52);
    // sword
    c.fillRect(W*0.25, H*0.68, W*0.5, 8);
    c.beginPath();
    c.moveTo(W*0.75, H*0.68); c.lineTo(W*0.82, H*0.72); c.lineTo(W*0.75, H*0.76);
    c.closePath(); c.fill();
    // hilt
    c.fillRect(W*0.22, H*0.65, 12, 18);
  },
  EG: (c) => { // Egypt
    stripesH(c, ['#ce1126', '#fff', '#000']);
    // eagle of Saladin (simplified)
    c.fillStyle = '#c09300';
    c.beginPath();
    c.moveTo(W/2, H*0.28);
    c.lineTo(W/2 + 35, H*0.42);
    c.lineTo(W/2 + 25, H*0.55);
    c.lineTo(W/2, H*0.70);
    c.lineTo(W/2 - 25, H*0.55);
    c.lineTo(W/2 - 35, H*0.42);
    c.closePath(); c.fill();
    // shield
    c.fillStyle = '#ce1126';
    c.fillRect(W/2 - 12, H*0.42, 24, 22);
  },
  IQ: (c) => { // Iraq
    stripesH(c, ['#ce1126', '#fff', '#000']);
    c.fillStyle = '#007a3d';
    c.font = 'bold 42px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('الله أكبر', W/2, H/2);
  },
  IR: (c) => { // Iran
    stripesH(c, ['#239f40', '#fff', '#da0000']);
    // emblem
    c.fillStyle = '#da0000';
    c.beginPath();
    c.moveTo(W/2, H*0.28);
    c.lineTo(W/2 + 18, H*0.55);
    c.lineTo(W/2, H*0.70);
    c.lineTo(W/2 - 18, H*0.55);
    c.closePath(); c.fill();
    // tulip-like
    circle(c, W/2, H*0.38, 10, '#da0000');
  },
  GE: (c) => { // Georgia
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    // large cross
    c.fillStyle = '#ff0000';
    c.fillRect(W/2 - 22, 0, 44, H);
    c.fillRect(0, H/2 - 22, W, 44);
    // four small crosses
    const positions = [[0.2,0.2],[0.8,0.2],[0.2,0.8],[0.8,0.8]];
    positions.forEach(([px,py]) => {
      c.fillRect(W*px - 8, H*py - 20, 16, 40);
      c.fillRect(W*px - 20, H*py - 8, 40, 16);
    });
  },
  KR: (c) => { // South Korea
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    // taegeuk
    circle(c, W/2, H/2, H*0.22, '#cd2e3a');
    c.beginPath();
    c.arc(W/2, H/2, H*0.22, Math.PI, 0); c.fillStyle = '#0047a0'; c.fill();
    circle(c, W/2 - H*0.11, H/2, H*0.11, '#cd2e3a');
    circle(c, W/2 + H*0.11, H/2, H*0.11, '#0047a0');
    // trigrams (simplified bars)
    c.fillStyle = '#000';
    const bars = [
      [0.18,0.18, true],[0.18,0.78,false],[0.82,0.18,false],[0.82,0.78,true]
    ];
    bars.forEach(([px,py,solid]) => {
      for (let i=0;i<3;i++) {
        const y = H*py + (i-1)*14;
        if (solid || i!==1) c.fillRect(W*px-28, y-4, 56, 8);
        else {
          c.fillRect(W*px-28, y-4, 24, 8);
          c.fillRect(W*px+4, y-4, 24, 8);
        }
      }
    });
  },
  CA: (c) => { // Canada
    stripesV(c, ['#ff0000', '#fff', '#ff0000'], [1, 2, 1]);
    // maple leaf (simplified)
    c.fillStyle = '#ff0000';
    c.beginPath();
    c.moveTo(W/2, H*0.18);
    c.lineTo(W/2 + 18, H*0.35);
    c.lineTo(W/2 + 40, H*0.32);
    c.lineTo(W/2 + 22, H*0.48);
    c.lineTo(W/2 + 30, H*0.70);
    c.lineTo(W/2, H*0.58);
    c.lineTo(W/2 - 30, H*0.70);
    c.lineTo(W/2 - 22, H*0.48);
    c.lineTo(W/2 - 40, H*0.32);
    c.lineTo(W/2 - 18, H*0.35);
    c.closePath(); c.fill();
    // stem
    c.fillRect(W/2 - 4, H*0.58, 8, H*0.2);
  },
  AU: (c) => { // Australia
    c.fillStyle = '#00008b'; c.fillRect(0, 0, W, H);
    // Union Jack canton
    c.save(); c.beginPath(); c.rect(0,0,W/2,H/2); c.clip();
    c.scale(0.5,0.5); DRAW.GB(c); c.restore();
    // Commonwealth star
    star(c, W*0.25, H*0.72, H*0.12, '#fff', 7, 0.4);
    // Southern Cross
    const sc = [[0.72,0.22],[0.82,0.38],[0.68,0.52],[0.78,0.68],[0.62,0.42]];
    sc.forEach(([x,y],i) => star(c, W*x, H*y, i===4?7:10, '#fff'));
  },
  IE: (c) => stripesV(c, ['#169b62', '#fff', '#ff883e']),
  BE: (c) => stripesV(c, ['#000', '#fdda24', '#ef3340']),
  AT: (c) => stripesH(c, ['#ed2939', '#fff', '#ed2939']),
  HU: (c) => stripesH(c, ['#ce2939', '#fff', '#477050']),
  RO: (c) => stripesV(c, ['#002b7f', '#fcd116', '#ce1126']),
  BG: (c) => stripesH(c, ['#fff', '#00966e', '#d62612']),
  RS: (c) => { // Serbia
    stripesH(c, ['#c6363c', '#0c4076', '#fff']);
    // coat of arms simplified
    c.fillStyle = '#c6363c';
    c.fillRect(W*0.18, H*0.22, W*0.2, H*0.45);
    c.fillStyle = '#fff';
    c.fillRect(W*0.22, H*0.28, W*0.12, H*0.12);
    c.fillStyle = '#c6363c';
    // double-headed eagle hint
    circle(c, W*0.25, H*0.55, 8, '#fff');
    circle(c, W*0.31, H*0.55, 8, '#fff');
  },
  HR: (c) => { // Croatia
    stripesH(c, ['#ff0000', '#fff', '#171796']);
    // checkerboard
    const s = 18;
    for (let row=0; row<5; row++) for (let col=0; col<5; col++) {
      c.fillStyle = (row+col)%2===0 ? '#ff0000' : '#fff';
      c.fillRect(W/2 - 2.5*s + col*s, H/2 - 2.5*s + row*s, s, s);
    }
  },
  DK: (c) => nordic(c, '#c8102e', '#fff', W*0.32, H*0.18),
  ID: (c) => stripesH(c, ['#ff0000', '#fff']),
  MY: (c) => { // Malaysia
    // 14 stripes
    for (let i=0;i<14;i++) {
      c.fillStyle = i%2===0 ? '#cc0001' : '#fff';
      c.fillRect(0, (H/14)*i, W, Math.ceil(H/14)+1);
    }
    // blue canton
    c.fillStyle = '#000066'; c.fillRect(0,0,W*0.5, H*(8/14));
    // crescent + star
    circle(c, W*0.22, H*(4/14), H*0.12, '#ffcc00');
    circle(c, W*0.26, H*(4/14), H*0.095, '#000066');
    star(c, W*0.32, H*(4/14), H*0.1, '#ffcc00', 14, 0.45);
  },
  TH: (c) => stripesH(c, ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], [1,1,2,1,1]),

};

// Tarihi bayraklar: kasadan çıkar. Nadirlik sunucudaki HFLAGS ile AYNI olmalı.
export const HIST_RARITY = { OTT: 'mystic', BRE: 'legendary', ROM: 'legendary', MAM: 'legendary', AND: 'legendary', GOK: 'legendary', HRE: 'epic', BYZ: 'epic', SOV: 'epic', JPE: 'epic', FRK: 'epic', RUE: 'epic', VEN: 'epic', PRU: 'epic', AQY: 'epic', QRN: 'epic', BGK: 'rare', ESE: 'rare', GEN: 'rare', HAZ: 'rare', MON: 'epic', PER: 'epic', ABB: 'legendary', SEL: 'legendary' };
export const HIST_FLAGS = Object.keys(HIST_RARITY);
// Resim dosyası olan modern bayraklar (assets/flags/<KOD>.webp)
export const IMAGE_FLAGS = [
  'KZ', 'UZ', 'TM', 'KG', 'PK', 'SA', 'EG', 'IQ', 'IR', 'GE',
  'AT', 'HU', 'DK', 'IE', 'BE', 'RO', 'BG', 'RS', 'HR',
  'KR', 'CA', 'AU', 'ID', 'MY', 'TH'
];
export const ALL_FLAGS = [...FLAG_LIST, ...HIST_FLAGS];

// Tarihi bayraklar artık gerçek resimlerden çizilir: assets/flags/<KOD>.webp (900x600).
// Resim yüklenemezse yukarıdaki kodla çizilmiş eski hali yedek olarak kullanılır.
const FLAG_IMG = {};
export function loadFlagImages() {
  const codes = [...HIST_FLAGS, ...IMAGE_FLAGS];
  return Promise.all(codes.map((code) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { FLAG_IMG[code] = img; delete cache[code]; resolve(); };
    img.onerror = () => resolve();      // yedek çizim kullanılır
    img.src = assetUrl(`assets/flags/${code}.webp`);
  })));
}

export function getFlagCanvas(code) {
  const key = code || 'NONE';
  if (!cache[key]) {
    const cv = document.createElement('canvas');
    cv.width = W * HD; cv.height = H * HD;
    const c = cv.getContext('2d');
    c.scale(HD, HD);
    if (FLAG_IMG[key]) c.drawImage(FLAG_IMG[key], 0, 0, W, H);
    else if (DRAW[key]) DRAW[key](c);
    else DRAW.NONE(c);
    cache[key] = cv;
  }
  return cache[key];
}

// Lobi için küçük bayrak resmi (data URL)
const thumbCache = {};
export function getFlagThumb(code, w = 60, h = 40) {
  const k = `${code}_${w}x${h}`;
  if (!thumbCache[k]) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(getFlagCanvas(code), 0, 0, w, h);
    thumbCache[k] = cv.toDataURL();
  }
  return thumbCache[k];
}

export function getSavedFlag() {
  try {
    const f = localStorage.getItem(STORAGE_KEY);
    if (ALL_FLAGS.includes(f)) return f;
  } catch (e) { /* yoksay */ }
  return 'TR';
}
export function saveFlag(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* yoksay */ }
}

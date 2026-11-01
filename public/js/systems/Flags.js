// ============================================================
// Flags.js - Bayrakları KODLA çizer (resim dosyası gerekmez)
// ============================================================
// Her bayrak 450x300'lük mantıksal ölçüde çizilir; tuval 2 kat büyüktür (900x600)
// ki 2K ekranda ve rol animasyonunda net görünsün. İleride gerçek resim kullanmak
// istersen sadece getFlagCanvas() fonksiyonunu değiştirmen yeter.

const W = 450, H = 300, HD = 2;
const STORAGE_KEY = 'cfs_flag';

export const FLAG_LIST = [
  'TR', 'AZ', 'DE', 'FR', 'IT', 'ES', 'PT', 'GB', 'NL', 'PL', 'CZ', 'GR', 'CH',
  'SE', 'NO', 'FI', 'UA', 'RU', 'US', 'MX', 'BR', 'AR', 'JP', 'CN', 'IN'
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
  }
};

export function getFlagCanvas(code) {
  const key = DRAW[code] ? code : 'NONE';
  if (!cache[key]) {
    const cv = document.createElement('canvas');
    cv.width = W * HD; cv.height = H * HD;
    const c = cv.getContext('2d');
    c.scale(HD, HD);
    DRAW[key](c);
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
    if (FLAG_LIST.includes(f)) return f;
  } catch (e) { /* yoksay */ }
  return 'TR';
}
export function saveFlag(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* yoksay */ }
}

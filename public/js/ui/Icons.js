// ============================================================
// Icons.js - Oyunun kendi ikon seti (emoji yerine)
// ============================================================
// Hepsi 24x24 SVG, rengi "currentColor": yazının rengini alır (terminalde yeşil, butonda beyaz...).
//   DOM:    icon('gear')            -> '<svg class="ic">...</svg>' (innerHTML içine)
//           coinHtml(120)           -> jeton resmi + sayı
//   Phaser: await iconTextures(scene) -> 'ic_<ad>' dokuları (beyaz, 128 px) hazır olur
// Yeni ikon eklemek: aşağıdaki P nesnesine bir satır.

import { assetUrl } from '../systems/Assets.js';

// Radyasyon yoncası ve dişli programla çizilir (simetrik)
const r1 = (n) => Math.round(n * 100) / 100;
function sector(cx, cy, ri, ro, a0, a1) {
  const p = (r, a) => `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
  return `M${p(ri, a0)}L${p(ro, a0)}A${ro} ${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri} ${ri} 0 0 0 ${p(ri, a0)}Z`;
}
const RAD = [90, 210, 330].map((d) => { const a = d * Math.PI / 180; return sector(12, 12, 3.4, 10, a - 0.52, a + 0.52); }).join('');
function gearPath() {
  let d = ''; const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
    const pts = [[8, a - w * 1.5], [10.6, a - w * 0.8], [10.6, a + w * 0.8], [8, a + w * 1.5]];
    pts.forEach(([r, t], k) => { d += (i === 0 && k === 0 ? 'M' : 'L') + r1(12 + r * Math.cos(t)) + ' ' + r1(12 + r * Math.sin(t)); });
  }
  return d + 'Z';
}

const F = 'fill="currentColor" stroke="none"';
const P = {
  radiation: `<circle cx="12" cy="12" r="2.3" ${F}/><path ${F} d="${RAD}"/>`,
  gear: `<path d="${gearPath()}"/><circle cx="12" cy="12" r="3.2"/>`,
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.2c3 .3 5.2 2.5 5.2 5.8"/>',
  ticket: '<path d="M3.5 6.5h17v3.6a2 2 0 0 0 0 3.8v3.6h-17v-3.6a2 2 0 0 0 0-3.8z"/><path d="M15 7v10" stroke-dasharray="1.6 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v3.5M9 20.5h6M10 16.5h4v4h-4z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  robot: `<rect x="5" y="8" width="14" height="10.5" rx="3"/><path d="M12 5v3M3 12v3M21 12v3"/><circle cx="12" cy="4" r="1.3" ${F}/><circle cx="9.3" cy="12.5" r="1.5" ${F}/><circle cx="14.7" cy="12.5" r="1.5" ${F}/><path d="M9.5 15.8h5"/>`,
  power: '<path d="M12 3v8"/><path d="M7 6.4a7.5 7.5 0 1 0 10 0"/>',
  knife: `<path ${F} d="M20.5 3.2c.6.6-.4 3.2-2.7 5.5L10.6 16l-2.6-2.6 7.2-7.2c2.3-2.3 4.9-3.6 5.3-3z"/><path d="M8 13.4 3.6 17.8a1.6 1.6 0 0 0 0 2.2l.4.4a1.6 1.6 0 0 0 2.2 0l4.4-4.4M6.6 12l5.4 5.4"/>`,
  crosshair: `<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="1.7" ${F}/><path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5"/>`,
  hatch: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M7.5 9.2h9M7.5 12h9M7.5 14.8h9"/><circle cx="5.6" cy="7.6" r=".6" ${F}/><circle cx="18.4" cy="16.4" r=".6" ${F}/>`,
  megaphone: '<path d="M3.5 10v4h3l8.5 4.6V5.4L6.5 10z"/><path d="m6.5 14 1.6 5.5h2.6l-1.2-4.4"/><path d="M18 9.2a3.8 3.8 0 0 1 0 5.6M20.2 6.8a7.2 7.2 0 0 1 0 10.4"/>',
  hand: '<path d="M8 12.5V5.8a1.5 1.5 0 0 1 3 0V11M11 10.5V4.3a1.5 1.5 0 0 1 3 0V11M14 10.8V5.8a1.5 1.5 0 0 1 3 0V14c0 4.2-2.6 7-6 7-2.6 0-4.1-1.2-5.4-3.3L3.5 14.2a1.5 1.5 0 0 1 2.6-1.6L8 15.3"/>',
  wrench: '<path d="M14.6 3.4a5 5 0 0 0-4.5 7L3.6 16.9a2 2 0 0 0 2.8 2.8l6.5-6.5a5 5 0 0 0 7-4.5l-3 3-2.9-.6-.6-2.9z"/>',
  siren: `<path d="M6 18.2v-5a6 6 0 0 1 12 0v5"/><rect x="4" y="18.2" width="16" height="3" rx="1"/><path d="M12 2.2v2M3.6 6 5 7.4M20.4 6 19 7.4"/><path d="M12 10.5a2.6 2.6 0 0 0-2.6 2.6"/>`,
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  gamepad: `<path d="M6.5 8h11a4.5 4.5 0 0 1 4.5 4.5v1.8a3 3 0 0 1-5.3 1.9L15 14H9l-1.7 2.2A3 3 0 0 1 2 14.3v-1.8A4.5 4.5 0 0 1 6.5 8z"/><path d="M7 10.5v3.5M5.25 12.25h3.5"/><circle cx="16" cy="11.3" r="1.1" ${F}/><circle cx="18.3" cy="13.4" r="1.1" ${F}/>`,
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  chat: '<path d="M4 4.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z"/><path d="M7.5 9.5h9M7.5 12.5h6"/>',
  send: '<path d="M3 11.2 21 3.5l-7.6 18-2.6-7.8z"/><path d="M10.8 13.7 21 3.5"/>',
  crown: `<path ${F} d="M3 7.5 7.6 12 12 4.8l4.4 7.2L21 7.5 19.2 18H4.8z"/><path d="M4.8 20.5h14.4"/>`,
  hat: '<path d="M7 16.2V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5v9.7"/><path d="M2.8 17.6c0-1 4.1-1.6 9.2-1.6s9.2.6 9.2 1.6-4.1 1.9-9.2 1.9-9.2-.9-9.2-1.9z"/><path d="M7 13h10"/>',
  flag: '<path d="M5 21V3.8"/><path d="M5 4.5h12.5l-2.2 4 2.2 4H5"/>',
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/><circle cx="12" cy="15.5" r="1.5" ${F}/>`,
  shield: '<path d="M12 2.8 4.5 5.6V11c0 4.8 3.2 8.6 7.5 10.2 4.3-1.6 7.5-5.4 7.5-10.2V5.6z"/><path d="m8.6 12 2.4 2.4 4.4-4.6"/>',
  ban: '<circle cx="12" cy="12" r="8.6"/><path d="m5.9 5.9 12.2 12.2"/>',
  kick: '<path d="M13.5 4H5.5v16h8"/><path d="M10 12h11M17.4 8.4 21 12l-3.6 3.6"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.4 7l1 13.2h9.2l1-13.2M10 11v5.6M14 11v5.6"/>',
  key: '<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21M18 12v3.2M21 12v2.6"/>',
  crate: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/><path d="m7.7 5.5 8.5 4"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.6 4.6 6.4 4.2 6.6 6.5 6.8 8 12 8 12 8zm0 0c1.4-3.4 5.6-3.8 5.4-1.5C17.2 8 12 8 12 8z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m4.5 12.5 4.8 4.8L19.5 7"/>',
  star: `<path ${F} d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>`,
  scales: '<path d="M12 4v16M7 20.5h10M5 7h14M12 4.5l-.01 0"/><path d="m5 7-2.8 6.2a2.8 2.8 0 0 0 5.6 0zM19 7l-2.8 6.2a2.8 2.8 0 0 0 5.6 0z"/>',
  ghost: `<path d="M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.4-1.7-2.3 1.7-2.3-1.7-2.3 1.7-2.3-1.7z"/><circle cx="9.5" cy="11" r="1.3" ${F}/><circle cx="14.5" cy="11" r="1.3" ${F}/>`,
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-4 3.4-7 7.5-7s7.5 3 7.5 7"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  bolt: `<path ${F} d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6z"/>`,
  rocket: '<path d="M12 2.8c3.4 2.2 5 5.6 5 9.4v3.3H7v-3.3c0-3.8 1.6-7.2 5-9.4z"/><circle cx="12" cy="9.6" r="1.8"/><path d="M7 12.5 4 16v3l3-1.5M17 12.5l3 3.5v3l-3-1.5M10 18.5l2 3 2-3"/>',
  refresh: '<path d="M20 11A8 8 0 0 0 5.6 6.6L3.5 9M4 13a8 8 0 0 0 14.4 4.4l2.1-2.4"/><path d="M3.5 4v5h5M20.5 20v-5h-5"/>',
  gauge: '<path d="M3.5 17a8.5 8.5 0 1 1 17 0"/><path d="m12 15 4.5-5"/><circle cx="12" cy="15.5" r="1.3"/><path d="M6 17h1.8M16.2 17H18"/>',
};
export const ICON_NAMES = Object.keys(P);

export function icon(name, cls = '') {
  const body = P[name] || P.radiation;
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// Jeton: projedeki coin.png kullanılır (emoji değil)
export const COIN_IMG = `<img class="ic-coin" src="${assetUrl('assets/menu/coin.png?v=2')}" alt="" width="16" height="16">`;
export const coinHtml = (n) => `${COIN_IMG}${n === undefined ? '' : ' ' + n}`;

// ---------------- Phaser dokuları ----------------
// SVG'yi beyaz renkte 128 px bir tuvale çizip 'ic_<ad>' dokusu olarak ekler (bir kez).
let texPromise = null;
export function iconTextures(scene, size = 128) {
  const tex = scene.textures;
  if (tex.exists('ic_radiation')) return Promise.resolve();
  if (texPromise) return texPromise;
  texPromise = Promise.all(ICON_NAMES.map((name) => new Promise((done) => {
    const svg = icon(name).replace('class="ic"', `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" color="#ffffff"`).replace(/currentColor/g, '#ffffff');
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const c = cv.getContext('2d');
      c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = size * 0.05; c.shadowOffsetY = size * 0.02;
      c.drawImage(img, 0, 0, size, size);
      try { if (!tex.exists('ic_' + name)) tex.addCanvas('ic_' + name, cv); } catch (e) { /* yoksay */ }
      done();
    };
    img.onerror = () => done();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }))).then(() => { texPromise = null; });
  return texPromise;
}

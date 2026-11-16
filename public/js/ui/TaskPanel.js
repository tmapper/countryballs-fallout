// ============================================================
// TaskPanel.js - Görev mini oyunları (HTML/SVG, oyunun üstünde açılır)
// ============================================================
// open(tip, { onDone, onClose })  /  close()  /  isOpen
// Tipler: wires · levers · valve · geiger · filter · keypad · simon · swipe · align · download/upload
//         + yeni: fuel (yakıt) · order (sıralı düğme) · pipes (boru) · waste (atık) · freq (frekans) · scan (tarama)
// Her mini oyun kendi küçük fonksiyonu; bitince done() çağırır.
// Görsel: assets/props/*.webp (kablo panosu ve şalter paneli gerçek resmin üstüne çizilir).
import { i18n } from '../systems/I18n.js';
import { assetUrl } from '../systems/Assets.js';
import { sfx, startLoop, stopLoop } from '../systems/Sound.js';

const NS = 'http://www.w3.org/2000/svg';
const COLORS = { red: '#e53935', blue: '#1e88e5', yellow: '#fdd835', pink: '#ec407a' };
const S = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (parent) parent.appendChild(e); return e; };
const H = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
const img = (name, cls, parent) => { const e = H('img', cls, parent); e.src = assetUrl(`assets/props/${name}.webp`); e.alt = ''; e.draggable = false; return e; };
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------- Kablo: soldaki terminali sürükle, aynı renkli sağdakine bırak ----------------
function wires(body, done) {
  const stage = H('div', 'tp-stage', body); img('kablo_panosu', 'tp-bg', stage);
  const svg = S('svg', { viewBox: '0 0 512 488', class: 'tp-svg' }, stage);
  const ys = [128, 204, 280, 355], xl = 216, xr = 385;       // resimde ölçülen terminal konumları
  const L = ['red', 'blue', 'yellow', 'pink'], R = ['blue', 'pink', 'red', 'yellow'];
  const lines = S('g', {}, svg);
  const connected = new Set();
  let drag = null;
  const pt = (ev) => { const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 512, y: (ev.clientY - r.top) / r.height * 488 }; };
  L.forEach((c, i) => {
    const hit = S('circle', { cx: xl, cy: ys[i], r: 28, fill: 'rgba(255,255,255,0.001)', style: 'cursor:grab' }, svg);
    hit.addEventListener('pointerdown', (ev) => {
      if (connected.has(c)) return;
      ev.preventDefault(); svg.setPointerCapture(ev.pointerId);
      drag = { c, line: S('line', { x1: xl, y1: ys[i], x2: xl, y2: ys[i], stroke: COLORS[c], 'stroke-width': 13, 'stroke-linecap': 'round' }, lines) };
    });
  });
  svg.addEventListener('pointermove', (ev) => { if (!drag) return; const p = pt(ev); drag.line.setAttribute('x2', p.x); drag.line.setAttribute('y2', p.y); });
  const end = (ev) => {
    if (!drag) return;
    const p = pt(ev);
    const j = R.findIndex((c, k) => c === drag.c && Math.hypot(p.x - xr, p.y - ys[k]) < 36);
    if (j >= 0) {
      drag.line.setAttribute('x2', xr); drag.line.setAttribute('y2', ys[j]);
      connected.add(drag.c);
      sfx('wire_connect');
      if (connected.size === 4) done();
    } else drag.line.remove();
    drag = null;
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}

// ---------------- Şalter: hepsini yukarı çevir ----------------
function levers(body, done) {
  const stage = H('div', 'tp-stage', body); img('salter_paneli', 'tp-bg', stage);
  const svg = S('svg', { viewBox: '0 0 512 337', class: 'tp-svg' }, stage);
  const xs = [85, 170, 258, 340, 425], top = 111, bot = 243;
  let st = xs.map(() => (Math.random() < 0.45 ? 1 : 0));
  if (st.filter((v) => !v).length < 2) st = [1, 0, 1, 0, 0];
  const gs = xs.map((cx, i) => {
    const g = S('g', { style: 'cursor:pointer' }, svg);
    S('rect', { x: cx - 34, y: top - 2, width: 68, height: bot - top + 4, rx: 9, fill: '#2f333b', stroke: '#15181c', 'stroke-width': 4 }, g);
    S('rect', { x: cx - 18, y: top + 10, width: 36, height: bot - top - 20, rx: 6, fill: '#14171b' }, g);
    g.lamp = S('circle', { cx, cy: 75, r: 18, stroke: '#1b1d21', 'stroke-width': 4 }, g);
    g.knob = S('rect', { x: cx - 22, width: 44, height: 50, rx: 9, fill: '#e53935', stroke: '#7a1010', 'stroke-width': 3 }, g);
    g.shine = S('rect', { x: cx - 14, width: 14, height: 8, rx: 4, fill: 'rgba(255,255,255,.45)' }, g);
    g.addEventListener('pointerdown', (ev) => { ev.preventDefault(); st[i] = st[i] ? 0 : 1; sfx('lever'); draw(); if (st.every(Boolean)) done(); });
    return g;
  });
  const draw = () => gs.forEach((g, i) => {
    const y = st[i] ? top + 14 : bot - 14 - 50;
    g.knob.setAttribute('y', y); g.shine.setAttribute('y', y + 6);
    g.lamp.setAttribute('fill', st[i] ? '#9dff4a' : '#4a4f56');
  });
  draw();
}

// ---------------- Vana: çarkı basılı tut, ibreyi yeşilde tut ----------------
function valve(body, done, onCleanup) {
  const stage = H('div', 'tp-stage', body); img('vana_paneli', 'tp-bg', stage);
  const svg = S('svg', { viewBox: '0 0 499 512', class: 'tp-svg' }, stage);
  const cx = 250, cy = 160;
  const th = (p) => (200 - 220 * p) * Math.PI / 180;
  const pos = (r, p) => [cx + r * Math.cos(th(p)), cy - r * Math.sin(th(p))];
  S('circle', { cx, cy, r: 76, fill: '#eef3f6', stroke: '#1b1d21', 'stroke-width': 5 }, svg);
  const band = (p0, p1, col) => { const [x0, y0] = pos(56, p0), [x1, y1] = pos(56, p1); S('path', { d: `M${x0} ${y0} A56 56 0 ${(p1 - p0) * 220 > 180 ? 1 : 0} 1 ${x1} ${y1}`, fill: 'none', stroke: col, 'stroke-width': 14 }, svg); };
  const LO = 0.56, HI = 0.76;
  band(0, LO, '#4a90d9'); band(LO, HI, '#43c463'); band(HI, 1, '#e5473d');
  const needle = S('line', { x1: cx, y1: cy, stroke: '#1b1d21', 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
  S('circle', { cx, cy, r: 9, fill: '#1b1d21' }, svg);
  // çark: resimdekini örten kendi çarkımız (döner)
  const wy = 380;
  S('circle', { cx, cy: wy, r: 112, fill: '#50555c' }, svg);
  const wheel = S('g', { style: 'cursor:pointer' }, svg);
  S('circle', { cx, cy: wy, r: 98, fill: 'rgba(0,0,0,.001)' }, wheel);
  S('circle', { cx, cy: wy, r: 90, fill: 'none', stroke: '#c62828', 'stroke-width': 16 }, wheel);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; S('line', { x1: cx, y1: wy, x2: cx + 84 * Math.cos(a), y2: wy + 84 * Math.sin(a), stroke: '#c62828', 'stroke-width': 14, 'stroke-linecap': 'round' }, wheel); }
  S('circle', { cx, cy: wy, r: 22, fill: '#e53935', stroke: '#7a1010', 'stroke-width': 4 }, wheel);
  const bar = H('div', 'tp-bar', body); const fill = H('div', 'tp-bar-fill', bar);
  let p = 0.1, held = false, ok = 0, ang = 0, last = performance.now(), raf = 0, fin = false;
  wheel.addEventListener('pointerdown', (ev) => { ev.preventDefault(); wheel.setPointerCapture(ev.pointerId); held = true; startLoop('valve_turn'); });
  const up = () => { held = false; stopLoop('valve_turn'); };
  wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    p = Math.max(0, Math.min(1, p + (held ? 0.42 : -0.2) * dt));
    if (held) ang += 200 * dt;
    ok = p >= LO && p <= HI ? ok + dt : Math.max(0, ok - dt * 1.5);
    const [nx, ny] = pos(52, p); needle.setAttribute('x2', nx); needle.setAttribute('y2', ny);
    wheel.setAttribute('transform', `rotate(${ang} ${cx} ${wy})`);
    fill.style.width = Math.min(100, ok / 2.2 * 100) + '%';
    if (ok >= 2.2 && !fin) { fin = true; stopLoop('valve_turn'); done(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => { cancelAnimationFrame(raf); stopLoop('valve_turn'); });
}

// ---------------- Geiger: kaydırıcıyla ibreyi ortaya getir ve tut ----------------
function geiger(body, done, onCleanup) {
  const row = H('div', 'tp-geiger', body);
  img('sigorta_kutusu', 'tp-side', row);
  const svg = S('svg', { viewBox: '0 0 300 190', class: 'tp-dial' }, row);
  const cx = 150, cy = 160;
  const th = (p) => Math.PI * (1 - p);
  const pos = (r, p) => [cx + r * Math.cos(th(p)), cy - r * Math.sin(th(p))];
  S('path', { d: 'M20 160 A130 130 0 0 1 280 160 Z', fill: '#e9efe4', stroke: '#1b1d21', 'stroke-width': 5 }, svg);
  const band = (p0, p1, col) => { const [x0, y0] = pos(100, p0), [x1, y1] = pos(100, p1); S('path', { d: `M${x0} ${y0} A100 100 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: col, 'stroke-width': 18 }, svg); };
  band(0, 0.42, '#d9a400'); band(0.42, 0.58, '#43c463'); band(0.58, 1, '#d9a400');
  const needle = S('line', { x1: cx, y1: cy, stroke: '#c62828', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
  S('circle', { cx, cy, r: 9, fill: '#1b1d21' }, svg);
  const slider = H('input', 'tp-slider', body); slider.type = 'range'; slider.min = 0; slider.max = 100;
  const target = rnd(15, 85); slider.value = target < 50 ? 95 : 5;
  const bar = H('div', 'tp-bar', body); const fill = H('div', 'tp-bar-fill', bar);
  let ok = 0, last = performance.now(), raf = 0, fin = false;
  startLoop('geiger_loop');
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    const read = Math.max(0, Math.min(1, 0.5 + (slider.value - target) / 70 + Math.sin(now / 90) * 0.02));
    const [nx, ny] = pos(95, read); needle.setAttribute('x2', nx); needle.setAttribute('y2', ny);
    ok = read > 0.42 && read < 0.58 ? ok + dt : Math.max(0, ok - dt * 2);
    fill.style.width = Math.min(100, ok / 1.4 * 100) + '%';
    if (ok >= 1.4 && !fin) { fin = true; stopLoop('geiger_loop'); done(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => { cancelAnimationFrame(raf); stopLoop('geiger_loop'); });
}

// ---------------- Filtre: tozları tek tek temizle ----------------
function filter(body, done) {
  const svg = S('svg', { viewBox: '0 0 360 250', class: 'tp-dial tp-filter' }, body);
  S('rect', { x: 6, y: 6, width: 348, height: 238, rx: 14, fill: '#5d737a', stroke: '#1b1d21', 'stroke-width': 5 }, svg);
  for (let x = 24; x < 340; x += 18) S('line', { x1: x, y1: 18, x2: x, y2: 232, stroke: '#32444a', 'stroke-width': 5 }, svg);
  for (let y = 30; y < 230; y += 26) S('line', { x1: 14, y1: y, x2: 346, y2: y, stroke: '#32444a', 'stroke-width': 3 }, svg);
  let left = 9;
  const counter = H('div', 'tp-count', body); counter.textContent = left;
  for (let i = 0; i < 9; i++) {
    const r = rnd(15, 24);
    const g = S('g', { style: 'cursor:pointer' }, svg);
    S('circle', { cx: rnd(34, 326), cy: rnd(34, 216), r, fill: '#6b5a3d', opacity: 0.92, stroke: '#3a2f1c', 'stroke-width': 3 }, g);
    g.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); if (g.dataset.gone) return; g.dataset.gone = 1;
      sfx('dust_wipe');
      g.style.transition = 'opacity .25s'; g.style.opacity = 0; setTimeout(() => g.remove(), 260);
      counter.textContent = --left; if (left === 0) done();
    });
  }
}

// ---------------- Tuş takımı: ekrandaki kodu gir ----------------
function keypad(body, done) {
  const code = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
  const wrap = H('div', 'tp-keypad', body);
  const note = H('div', 'tp-kp-note', wrap); note.textContent = code;
  const scr = H('div', 'tp-kp-screen', wrap);
  const grid = H('div', 'tp-kp-grid', wrap);
  let typed = '';
  const show = () => { scr.textContent = typed.padEnd(5, '•'); };
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✔'].forEach((k) => {
    const b = H('button', 'tp-kp-key' + (k === 'C' ? ' clr' : k === '✔' ? ' ok' : ''), grid); b.type = 'button'; b.textContent = k;
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); sfx('ui_click', 0.8);
      if (k === 'C') typed = '';
      else if (k === '✔') {
        if (typed === code) { scr.classList.add('good'); done(); return; }
        scr.classList.remove('bad'); void scr.offsetWidth; scr.classList.add('bad'); typed = '';
      } else if (typed.length < 5) typed += k;
      show();
    });
  });
  show();
}

// ---------------- Hafıza: yanan sırayı tekrarla (3 tur) ----------------
function simon(body, done, onCleanup) {
  const wrap = H('div', 'tp-simon', body);
  const lights = H('div', 'tp-sm-lights', wrap);
  const grid = H('div', 'tp-sm-grid', wrap);
  const cells = Array.from({ length: 9 }, (_, i) => { const b = H('button', 'tp-sm-cell', grid); b.type = 'button'; b.dataset.i = i; return b; });
  const ROUNDS = [3, 4, 5];
  const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 9));
  const leds = ROUNDS.map(() => H('i', '', lights));
  let round = 0, pos = 0, busy = true, timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  onCleanup(() => timers.forEach(clearTimeout));
  const flash = (i, cls = 'on', ms = 380) => { cells[i].classList.add(cls); later(ms, () => cells[i].classList.remove(cls)); };
  const playRound = () => {
    busy = true; pos = 0;
    grid.classList.add('watch');
    for (let k = 0; k < ROUNDS[round]; k++) later(600 + k * 560, () => { flash(seq[k]); sfx('vote', 0.5); });
    later(600 + ROUNDS[round] * 560, () => { busy = false; grid.classList.remove('watch'); });
  };
  cells.forEach((c, i) => c.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (busy) return;
    if (i === seq[pos]) {
      flash(i, 'on', 200); sfx('ui_click', 0.7); pos++;
      if (pos >= ROUNDS[round]) {
        leds[round].classList.add('ok'); round++;
        if (round >= ROUNDS.length) { busy = true; done(); return; }
        busy = true; later(500, playRound);
      }
    } else {
      flash(i, 'bad', 400); grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake');
      busy = true; later(700, playRound);
    }
  }));
  playRound();
}

// ---------------- Kart okut: kartı doğru hızda kaydır ----------------
function swipe(body, done) {
  const wrap = H('div', 'tp-swipe', body);
  const msg = H('div', 'tp-sw-msg', wrap); msg.textContent = i18n.t('tasks.swipeMsg.ready');
  const track = H('div', 'tp-sw-track', wrap);
  const card = H('div', 'tp-sw-card', track); card.innerHTML = '<b>ID</b><i></i>';
  let drag = null;
  const W = () => track.clientWidth - card.clientWidth;
  card.addEventListener('pointerdown', (ev) => { ev.preventDefault(); card.setPointerCapture(ev.pointerId); drag = { x0: ev.clientX, t0: performance.now(), max: 0 }; card.style.transition = 'none'; });
  card.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const x = Math.max(0, Math.min(W(), ev.clientX - drag.x0)); drag.max = Math.max(drag.max, x);
    card.style.transform = `translateX(${x}px)`;
  });
  const end = () => {
    if (!drag) return;
    const dt = (performance.now() - drag.t0) / 1000, full = drag.max >= W() - 4;
    drag = null;
    card.style.transition = 'transform .25s'; 
    let key = 'bad';
    if (full && dt >= 0.45 && dt <= 1.3) { key = 'ok'; msg.textContent = i18n.t('tasks.swipeMsg.ok'); msg.className = 'tp-sw-msg good'; sfx('wire_connect'); done(); return; }
    if (!full) key = 'short'; else if (dt < 0.45) key = 'fast'; else key = 'slow';
    msg.textContent = i18n.t('tasks.swipeMsg.' + key); msg.className = 'tp-sw-msg bad';
    card.style.transform = 'translateX(0)';
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
}

// ---------------- Hizala: tüm göstergeleri yukarı çevir ----------------
function align(body, done) {
  const wrap = H('div', 'tp-align', body);
  const n = 5;
  let rot = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 3));
  rot[Math.floor(Math.random() * n)] = 0;
  Array.from({ length: n }, (_, i) => {
    const b = H('button', 'tp-al-dial', wrap); b.type = 'button';
    b.innerHTML = '<span></span>';
    const draw = () => { b.firstChild.style.transform = `rotate(${rot[i] * 90}deg)`; b.classList.toggle('ok', rot[i] % 4 === 0); };
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); rot[i]++; draw(); sfx('lever', 0.6);
      if (rot.every((r) => r % 4 === 0)) done();
    });
    draw();
    return b;
  });
}

// ---------------- Veri indir / yükle: ilerleme dolana kadar bekle ----------------
function data(kind) {
  return (body, done, onCleanup) => {
    const wrap = H('div', 'tp-data ' + kind, body);
    const icons = H('div', 'tp-dt-icons', wrap);
    icons.innerHTML = kind === 'download' ? '<span>🗄</span><em></em><span>💾</span>' : '<span>💾</span><em></em><span>📡</span>';
    const files = icons.querySelector('em');
    const bar = H('div', 'tp-bar', wrap); const fill = H('div', 'tp-bar-fill', bar);
    const pct = H('div', 'tp-count', wrap);
    const btn = H('button', 'tp-dt-btn', wrap); btn.type = 'button'; btn.textContent = i18n.t(kind === 'download' ? 'tasks.dlBtn' : 'tasks.ulBtn');
    let p = 0, raf = 0, last = 0, running = false;
    const tick = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      p = Math.min(1, p + dt / 6);
      fill.style.width = (p * 100) + '%'; pct.textContent = Math.floor(p * 100) + '%';
      if (Math.random() < 0.25) { const f = document.createElement('i'); f.textContent = '📄'; files.appendChild(f); setTimeout(() => f.remove(), 900); }
      if (p >= 1) { done(); return; }
      raf = requestAnimationFrame(tick);
    };
    btn.addEventListener('click', () => { if (running) return; running = true; btn.disabled = true; last = performance.now(); raf = requestAnimationFrame(tick); sfx('ui_click'); });
    onCleanup(() => cancelAnimationFrame(raf));
  };
}

// ---------------- Yakıt: seviye inip çıkar, yeşil çizgideyken KİLİTLE'ye bas (3 tur) ----------------
function fuel(body, done, onCleanup) {
  const svg = S('svg', { viewBox: '0 0 220 300', class: 'tp-dial tp-fuel' }, body);
  S('rect', { x: 50, y: 14, width: 120, height: 262, rx: 16, fill: '#10151b', stroke: '#3a4452', 'stroke-width': 6 }, svg);
  const liquid = S('rect', { x: 56, width: 108, rx: 10, fill: '#e8a317' }, svg);
  const band = S('rect', { x: 46, width: 128, height: 26, fill: 'rgba(76,208,106,.35)', stroke: '#4cd06a', 'stroke-width': 3 }, svg);
  const TOP = 22, BOT = 268;                         // sıvının çıkabileceği alan
  const leds = H('div', 'tp-sm-lights', body); const dots = [0, 1, 2].map(() => H('i', '', leds));
  const btn = H('button', 'tp-dt-btn', body); btn.type = 'button'; btn.textContent = i18n.t('tasks.fuelBtn');
  let round = 0, level = 0, dir = 1, raf = 0, last = performance.now(), fin = false, target = 0.6;
  const newTarget = () => { target = rnd(0.3, 0.85); band.setAttribute('y', BOT - target * (BOT - TOP) - 13); };
  newTarget();
  const speed = () => 0.55 + round * 0.3;
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    level += dir * speed() * dt;
    if (level >= 1) { level = 1; dir = -1; } else if (level <= 0) { level = 0; dir = 1; }
    const h = level * (BOT - TOP);
    liquid.setAttribute('y', BOT - h); liquid.setAttribute('height', Math.max(1, h));
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); if (fin) return;
    if (Math.abs(level - target) <= 0.07) {
      dots[round].classList.add('ok'); sfx('valve_turn', 0.6); round++;
      if (round >= 3) { fin = true; cancelAnimationFrame(raf); done(); return; }
      newTarget();
    } else { sfx('ui_click', 0.6); svg.classList.remove('shake'); void svg.getBoundingClientRect(); svg.classList.add('shake'); }
  });
}

// ---------------- Sıralı düğmeler: 1'den 9'a sırayla bas ----------------
function order(body, done) {
  const wrap = H('div', 'tp-order', body);
  const msg = H('div', 'tp-count', wrap);
  const grid = H('div', 'tp-or-grid', wrap);
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  let next = 1;
  msg.textContent = next;
  nums.forEach((n) => {
    const b = H('button', 'tp-or-btn', grid); b.type = 'button'; b.textContent = n;
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (b.classList.contains('ok')) return;
      if (n === next) {
        b.classList.add('ok'); sfx('ui_click', 0.8); next++;
        if (next > 9) { done(); return; }
        msg.textContent = next;
      } else {
        next = 1; msg.textContent = next; sfx('lever', 0.5);
        grid.querySelectorAll('.ok').forEach((x) => x.classList.remove('ok'));
        grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake');
      }
    });
  });
}

// ---------------- Borular: kareleri çevirip soldan sağa yol aç ----------------
function pipes(body, done) {
  const COLS = 4, ROWS = 4, T = 80;
  const svg = S('svg', { viewBox: `0 0 ${COLS * T + 60} ${ROWS * T}`, class: 'tp-dial tp-pipes' }, body);
  const OPEN = { straight: [0, 2], corner: [0, 1] };         // yönler: 0 üst, 1 sağ, 2 alt, 3 sol
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ type: Math.random() < 0.5 ? 'straight' : 'corner', rot: Math.floor(Math.random() * 4) })));
  // Çözüm yolu: her sütunda rastgele bir satıra in/çık, sonra sağa geç
  let r = Math.floor(Math.random() * ROWS); const r0 = r; const path = [];
  for (let c = 0; c < COLS; c++) {
    const r2 = Math.floor(Math.random() * ROWS), step = r2 >= r ? 1 : -1;
    for (let y = r; ; y += step) { path.push({ c, y, goes: y === r2 ? (c === COLS - 1 ? 1 : 1) : (step > 0 ? 2 : 0) }); if (y === r2) break; }
    r = r2;
  }
  path.forEach((p, i) => {
    const entry = i === 0 ? 3 : (path[i - 1].goes + 2) % 4, exit = p.goes;
    grid[p.y][p.c].type = (entry + 2) % 4 === exit ? 'straight' : 'corner';
  });
  const opens = (t) => OPEN[t.type].map((d) => (d + t.rot) % 4);
  const trace = () => {
    const lit = new Set(); let c = 0, y = r0, from = 3;
    for (let n = 0; n < 40; n++) {
      const o = opens(grid[y][c]);
      if (!o.includes(from)) return { ok: false, lit };
      lit.add(c + ',' + y);
      const out = o[0] === from ? o[1] : o[0];
      if (c === COLS - 1 && out === 1) return { ok: true, lit };
      const nc = c + DX[out], ny = y + DY[out];
      if (nc < 0 || nc >= COLS || ny < 0 || ny >= ROWS) return { ok: false, lit };
      c = nc; y = ny; from = (out + 2) % 4;
    }
    return { ok: false, lit };
  };
  // Başlangıçta çözülmüş olmasın
  let guard = 0; while (trace().ok && guard++ < 10) { const p = path[Math.floor(Math.random() * path.length)]; grid[p.y][p.c].rot = (grid[p.y][p.c].rot + 1) % 4; }
  S('rect', { x: 0, y: r0 * T + T / 2 - 9, width: 30, height: 18, fill: '#4a90d9' }, svg);
  const cells = [];
  const draw = () => {
    const { lit } = trace();
    cells.forEach(({ g, t, c, y, line }) => {
      g.setAttribute('transform', `rotate(${t.rot * 90} ${30 + c * T + T / 2} ${y * T + T / 2})`);
      line.setAttribute('stroke', lit.has(c + ',' + y) ? '#6be38a' : '#8a96a3');
    });
  };
  for (let y = 0; y < ROWS; y++) for (let c = 0; c < COLS; c++) {
    const t = grid[y][c], x0 = 30 + c * T, y0 = y * T, cx = x0 + T / 2, cy = y0 + T / 2;
    const tile = S('g', { style: 'cursor:pointer' }, svg);
    S('rect', { x: x0 + 3, y: y0 + 3, width: T - 6, height: T - 6, rx: 8, fill: '#141a22', stroke: '#2a323d', 'stroke-width': 2 }, tile);
    const g = S('g', {}, tile);
    const d = t.type === 'straight' ? `M${cx} ${y0 + 4} L${cx} ${y0 + T - 4}` : `M${cx} ${y0 + 4} L${cx} ${cy} L${x0 + T - 4} ${cy}`;
    const line = S('path', { d, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    cells.push({ g, t, c, y, line });
    tile.addEventListener('pointerdown', (ev) => { ev.preventDefault(); t.rot = (t.rot + 1) % 4; sfx('lever', 0.5); draw(); if (trace().ok) { sfx('valve_turn', 0.5); done(); } });
  }
  S('rect', { x: 30 + COLS * T, y: 0, width: 30, height: ROWS * T, fill: 'none' }, svg);
  draw();
}

// ---------------- Atık ayrıştırma: tehlikeli mi, normal mi? ----------------
function waste(body, done) {
  const HAZ = ['☢️', '🧪', '🔋', '☣️', '🛢️'], NOR = ['🥫', '📦', '🍞', '🧻', '📰', '🥤', '🍎'];
  const NEED = 8;
  const wrap = H('div', 'tp-waste', body);
  const item = H('div', 'tp-ws-item', wrap);
  const row = H('div', 'tp-ws-row', wrap);
  const bh = H('button', 'tp-ws-bin haz', row); bh.type = 'button'; bh.textContent = i18n.t('tasks.wasteHaz');
  const bn = H('button', 'tp-ws-bin nor', row); bn.type = 'button'; bn.textContent = i18n.t('tasks.wasteNor');
  const bar = H('div', 'tp-bar', wrap); const fill = H('div', 'tp-bar-fill', bar);
  let ok = 0, cur = null, fin = false;
  const pick = () => { const haz = Math.random() < 0.5; const arr = haz ? HAZ : NOR; cur = { haz, e: arr[Math.floor(Math.random() * arr.length)] }; item.textContent = cur.e; item.classList.remove('pop'); void item.offsetWidth; item.classList.add('pop'); };
  const answer = (haz) => {
    if (fin) return;
    if (haz === cur.haz) { ok++; sfx('ui_click', 0.7); } else { ok = Math.max(0, ok - 2); sfx('lever', 0.5); item.classList.remove('bad'); void item.offsetWidth; item.classList.add('bad'); }
    fill.style.width = (ok / NEED * 100) + '%';
    if (ok >= NEED) { fin = true; done(); return; }
    pick();
  };
  bh.addEventListener('pointerdown', (ev) => { ev.preventDefault(); answer(true); });
  bn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); answer(false); });
  pick();
}

// ---------------- Frekans: dalga boyunu ve yüksekliği hedefe uydur ----------------
function freq(body, done, onCleanup) {
  const svg = S('svg', { viewBox: '0 0 360 160', class: 'tp-dial tp-freq' }, body);
  S('rect', { x: 2, y: 2, width: 356, height: 156, rx: 10, fill: '#07140b', stroke: '#1f3a26', 'stroke-width': 3 }, svg);
  S('line', { x1: 8, y1: 80, x2: 352, y2: 80, stroke: '#17321e', 'stroke-width': 2 }, svg);
  const tgt = S('path', { fill: 'none', stroke: '#ffd23f', 'stroke-width': 3, 'stroke-dasharray': '7 6', opacity: 0.9 }, svg);
  const cur = S('path', { fill: 'none', stroke: '#6bff8f', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
  const mk = (label) => { const l = H('label', 'tp-fr-row', body); H('span', '', l).textContent = label; const i = H('input', 'tp-slider', l); i.type = 'range'; i.min = 0; i.max = 100; return i; };
  const sA = mk(i18n.t('tasks.freqAmp')), sF = mk(i18n.t('tasks.freqRate'));
  const tA = rnd(0.3, 0.9), tF = rnd(1.5, 4.5);
  sA.value = tA > 0.55 ? 8 : 92; sF.value = tF > 3 ? 8 : 92;
  const bar = H('div', 'tp-bar', body); const fill = H('div', 'tp-bar-fill', bar);
  const wave = (A, F, ph) => { let d = ''; for (let x = 0; x <= 340; x += 4) { const y = 80 - Math.sin(x / 340 * Math.PI * 2 * F + ph) * A * 62; d += (x ? 'L' : 'M') + (10 + x) + ' ' + y.toFixed(1); } return d; };
  let ok = 0, last = performance.now(), raf = 0, fin = false;
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    const A = 0.2 + sA.value / 100 * 0.8, F = 1 + sF.value / 100 * 4;
    const ph = now / 500;
    tgt.setAttribute('d', wave(tA, tF, ph)); cur.setAttribute('d', wave(A, F, ph));
    const match = Math.abs(A - tA) < 0.07 && Math.abs(F - tF) < 0.22;
    ok = match ? ok + dt : Math.max(0, ok - dt * 2);
    fill.style.width = Math.min(100, ok / 1.3 * 100) + '%';
    if (ok >= 1.3 && !fin) { fin = true; done(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
}

// ---------------- Tarama: elini tarayıcıda basılı tut ----------------
function scan(body, done, onCleanup) {
  const wrap = H('div', 'tp-scan', body);
  const pad = H('div', 'tp-sc-pad', wrap); pad.innerHTML = '<span>🖐</span><i></i>';
  const bar = H('div', 'tp-bar', wrap); const fill = H('div', 'tp-bar-fill', bar);
  const txt = H('div', 'tp-count', wrap); txt.textContent = i18n.t('tasks.scanIdle');
  let p = 0, held = false, last = performance.now(), raf = 0, fin = false;
  pad.addEventListener('pointerdown', (ev) => { ev.preventDefault(); pad.setPointerCapture(ev.pointerId); held = true; pad.classList.add('on'); });
  const up = () => { held = false; pad.classList.remove('on'); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    p = Math.max(0, Math.min(1, p + (held ? dt / 5 : -dt / 2.5)));
    fill.style.width = (p * 100) + '%';
    txt.textContent = held ? i18n.t('tasks.scanBusy') + ' ' + Math.floor(p * 100) + '%' : i18n.t('tasks.scanIdle');
    if (p >= 1 && !fin) { fin = true; done(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
}


// ================= YENİ GÖREVLER (v0.9.22) =================

// ---------------- Kahve: DOLDUR'a basılı tut, çizgiler arasında bırak (taşarsa döküp baştan) ----------------
function coffee(body, done, onCleanup) {
  const wrap = H('div', 'tp-cof', body);
  const cup = H('div', 'tp-cof-cup', wrap); const liq = H('div', 'tp-cof-liq', cup); const zone = H('div', 'tp-cof-zone', cup);
  const LO = 0.78, HI = 0.9; zone.style.bottom = (LO * 100) + '%'; zone.style.height = ((HI - LO) * 100) + '%';
  const btn = H('button', 'tp-dt-btn tp-cof-btn', wrap); btn.type = 'button'; btn.textContent = i18n.t('tasks.coffeeBtn');
  const msg = H('div', 'tp-count', wrap);
  let lvl = 0, held = false, last = performance.now(), raf = 0, fin = false;
  const down = (ev) => { ev.preventDefault(); if (fin) return; held = true; btn.classList.add('on'); try { btn.setPointerCapture(ev.pointerId); } catch (e) {} };
  const up = () => {
    if (!held || fin) return; held = false; btn.classList.remove('on');
    if (lvl >= LO && lvl <= HI) { fin = true; sfx('task_done', 0.4); done(); }
    else if (lvl > 0.05) { msg.textContent = i18n.t(lvl < LO ? 'tasks.coffeeLow' : 'tasks.coffeeHigh'); }
  };
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (held) lvl += dt * 0.32;
    if (lvl > 1) { lvl = 0; held = false; btn.classList.remove('on'); msg.textContent = i18n.t('tasks.coffeeSpill'); cup.classList.add('shake'); setTimeout(() => cup.classList.remove('shake'), 400); }
    liq.style.height = (lvl * 100) + '%';
    if (!fin) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
}

// ---------------- İlaç: hapa dokun, sonra aynı renkteki şişeye ----------------
function medicine(body, done) {
  const wrap = H('div', 'tp-med', body);
  const tray = H('div', 'tp-med-tray', wrap); const shelf = H('div', 'tp-med-shelf', wrap);
  const cols = ['red', 'blue', 'yellow'];
  const pills = [...cols, ...cols].sort(() => Math.random() - 0.5);
  let sel = null, left = pills.length;
  pills.forEach((c) => {
    const p = H('button', 'tp-med-pill', tray); p.type = 'button'; p.style.background = COLORS[c]; p.dataset.c = c;
    p.style.transform = `rotate(${Math.round(rnd(-40, 40))}deg)`;
    p.addEventListener('click', () => { tray.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); sel = p; p.classList.add('sel'); sfx('ui_click', 0.4); });
  });
  cols.forEach((c) => {
    const b = H('button', 'tp-med-bottle', shelf); b.type = 'button'; b.dataset.c = c;
    H('i', '', b).style.background = COLORS[c]; H('span', '', b).textContent = '0';
    b.addEventListener('click', () => {
      if (!sel) return;
      if (sel.dataset.c !== c) { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 350); return; }
      sel.remove(); sel = null; left--; const n = b.querySelector('span'); n.textContent = String(Number(n.textContent) + 1);
      sfx('wire_connect', 0.5);
      if (!left) done();
    });
  });
}

// ---------------- Krank: kolu tutup daire çizerek 3 tur çevir (saat yönü) ----------------
function crank(body, done) {
  const wrap = H('div', 'tp-crk', body);
  const wheel = H('div', 'tp-crk-wheel', wrap); const arm = H('div', 'tp-crk-arm', wheel); H('div', 'tp-crk-knob', arm);
  const bar = H('div', 'tp-bar', wrap); const fill = H('div', 'tp-bar-fill', bar);
  const txt = H('div', 'tp-count', wrap); txt.textContent = i18n.t('tasks.crankHint');
  const NEED = Math.PI * 2 * 3;
  let total = 0, lastA = null, ang = -Math.PI / 2, fin = false;
  const center = () => { const r = wheel.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  wheel.addEventListener('pointerdown', (ev) => { ev.preventDefault(); wheel.setPointerCapture(ev.pointerId); const c = center(); lastA = Math.atan2(ev.clientY - c.y, ev.clientX - c.x); });
  wheel.addEventListener('pointermove', (ev) => {
    if (lastA === null || fin) return;
    const c = center(); const a = Math.atan2(ev.clientY - c.y, ev.clientX - c.x);
    let d = a - lastA; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    lastA = a; ang = a;
    if (d > 0) total += d; else total = Math.max(0, total + d * 0.5);         // ters çevirmek geri sarar
    arm.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    fill.style.width = Math.min(100, total / NEED * 100) + '%';
    txt.textContent = `${Math.min(3, Math.floor(total / (Math.PI * 2)))} / 3`;
    if (total >= NEED && !fin) { fin = true; done(); }
  });
  const up = () => { lastA = null; };
  wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
}

// ---------------- Bitki: saksıya basılı tutarak sula, yeşil bölgede bırak (fazlası çürütür) ----------------
function plants(body, done, onCleanup) {
  const wrap = H('div', 'tp-pla', body);
  const pots = [0, 1, 2].map(() => {
    const p = H('button', 'tp-pla-pot', wrap); p.type = 'button';
    H('div', 'tp-pla-leaf', p).textContent = '🌱';
    const g = H('div', 'tp-pla-gauge', p); const f = H('div', 'tp-pla-fill', g); H('div', 'tp-pla-zone', g);
    const o = { el: p, f, v: rnd(0.05, 0.3), held: false, ok: false };
    p.addEventListener('pointerdown', (ev) => { ev.preventDefault(); try { p.setPointerCapture(ev.pointerId); } catch (e) {} o.held = true; p.classList.add('on'); });
    const up = () => { o.held = false; p.classList.remove('on'); };
    p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);
    return o;
  });
  const txt = H('div', 'tp-count', wrap);
  let last = performance.now(), raf = 0, fin = false;
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    pots.forEach((o) => {
      if (o.held) o.v += dt * 0.45;
      if (o.v > 1) { o.v = 0.35; o.held = false; o.el.classList.remove('on'); txt.textContent = i18n.t('tasks.plantsOver'); }
      o.ok = o.v >= 0.6 && o.v <= 0.9;
      o.f.style.height = (o.v * 100) + '%';
      o.el.classList.toggle('good', o.ok && !o.held);
    });
    if (!fin && pots.every((o) => o.ok && !o.held)) { fin = true; done(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
}

// ---------------- Yatak: battaniyeyi soldan sağa sürükleyerek düzelt (4 yatak) ----------------
function beds(body, done) {
  const wrap = H('div', 'tp-bed', body);
  let left = 4;
  for (let i = 0; i < 4; i++) {
    const bed = H('div', 'tp-bed-row', wrap); H('div', 'tp-bed-pillow', bed);
    const blanket = H('div', 'tp-bed-blanket', bed); blanket.style.width = Math.round(rnd(22, 42)) + '%';
    let sx = null, w0 = 0, fin = false;
    bed.addEventListener('pointerdown', (ev) => { if (fin) return; ev.preventDefault(); bed.setPointerCapture(ev.pointerId); sx = ev.clientX; w0 = blanket.getBoundingClientRect().width; });
    bed.addEventListener('pointermove', (ev) => {
      if (sx === null || fin) return;
      const full = bed.getBoundingClientRect().width * 0.82;
      const w = Math.max(w0, Math.min(full, w0 + ev.clientX - sx));
      blanket.style.width = (w / bed.getBoundingClientRect().width * 100) + '%';
      if (w >= full - 2) { fin = true; sx = null; bed.classList.add('done'); sfx('wire_connect', 0.5); if (--left === 0) done(); }
    });
    const up = () => { sx = null; };
    bed.addEventListener('pointerup', up); bed.addEventListener('pointercancel', up);
  }
}

const GAMES = { wires, levers, valve, geiger, filter, keypad, simon, swipe, align, fuel, order, pipes, waste, freq, scan, coffee, medicine, crank, plants, beds, download: data('download'), upload: data('upload') };

export class TaskPanel {
  constructor() { this.root = null; this.cleanups = []; this.isOpen = false; this.handlers = null; }

  open(type, handlers) {
    this.close(true);
    this.handlers = handlers;
    const root = this.root = H('div', 'taskov', document.body);
    const box = H('div', 'taskbox', root);
    const head = H('div', 'task-head', box);
    H('h2', '', head).textContent = i18n.t('tasks.' + type);
    const x = H('button', 'btn sheet-close', head); x.type = 'button'; x.textContent = '✕';
    x.addEventListener('click', () => this.close());
    H('p', 'task-hint', box).textContent = i18n.t('tasks.hint.' + type);
    const body = H('div', 'task-body', box);
    this.isOpen = true;
    let finished = false;
    const done = () => {
      if (finished) return; finished = true;
      body.classList.add('tp-done');
      const ok = H('div', 'tp-ok', body); ok.textContent = '✔';
      setTimeout(() => {
        const h = this.handlers; this.close(true);
        try { if (h && h.onDone) h.onDone(); } catch (e) { console.error(e); }
        finally { if (h && h.onClose) h.onClose(); }   // hata olsa bile kilit açılsın
      }, 700);
    };
    (GAMES[type] || GAMES.wires)(body, done, (fn) => this.cleanups.push(fn));   // bilinmeyen tür: kablo görevi (çökmesin)
  }

  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.cleanups.forEach((f) => { try { f(); } catch (e) {} }); this.cleanups = [];
    if (this.root) this.root.remove();
    this.root = null;
    // Tarayıcıda kalmış pointer capture / seçim kilidi (donma önlemi)
    try { if (window.getSelection) window.getSelection().removeAllRanges(); } catch (e) {}
    try { document.body.style.pointerEvents = ''; } catch (e) {}
    const h = this.handlers; this.handlers = null;
    if (!silent && h && h.onClose) h.onClose();
  }
}

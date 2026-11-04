// ============================================================
// MiniMap.js - Sağ üstte küçük harita: konumun, görevlerin, sabotaj yeri
// ============================================================
// Harita bir kez çizilir (odalar + koridorlar); her güncellemede üstüne noktalar konur.
// Tıklayınca büyür / küçülür. GameScene update() içinden update(state) çağırır.
//   state = { me: {x,y,alive}, tasks: [{x,y,done}], sabotage: {x,y}|null, room }
import { WORLD, ROOMS, CORRIDORS } from '../map/BunkerMap.js';
import { i18n } from '../systems/I18n.js';

const ROOM_COLOR = {
  entrance: '#2f5a2a', hall: '#4b5260', reactor: '#5a3a33', security: '#2f3b52', control: '#2b3444', o2: '#2c5157',
  comms: '#28324a', generator: '#454a50', cafeteria: '#3e5a57', medbay: '#5e6c6a', lab: '#58686f',
  electrical: '#55542f', dorm: '#5a4430', storage: '#554634'
};

export class MiniMap {
  constructor() {
    this.root = null;
    this.big = false;
    this.last = 0;
  }

  // Harita normalde KAPALI: sağ üstteki 🗺 butonu (ya da Tab / Q) ile büyük harita açılır, tekrar basınca kapanır.
  // Kapalıyken hiç çizilmez (performans) ve ekranda dokunmaları engellemez.
  build() {
    const r = this.root = document.createElement('div');
    r.className = 'minimap big hidden';
    r.innerHTML = '<canvas></canvas><div class="minimap-label"></div><button class="mapclose" type="button">✕</button>';
    document.body.appendChild(r);
    this.canvas = r.querySelector('canvas');
    this.label = r.querySelector('.minimap-label');
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.close(); });
    const b = this.btn = document.createElement('button');
    b.type = 'button'; b.className = 'mapbtn hidden'; b.innerHTML = '🗺<span></span>';
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.toggle(); });
    document.body.appendChild(b);
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.repeat) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Tab' || e.code === 'KeyQ') { e.preventDefault(); this.toggle(); }
      else if (e.code === 'Escape' && this.open) { e.stopPropagation(); this.close(); }
    }, true);
    i18n.onChange(() => { if (this.btn) this.btn.querySelector('span').textContent = i18n.t('ui.map'); });
    this.btn.querySelector('span').textContent = i18n.t('ui.map');
  }

  toggle() { if (this.open) this.close(); else { this.open = true; this.big = true; this.root.classList.remove('hidden'); this.btn.classList.add('on'); this.base = null; this.last = 0; } }
  close() { this.open = false; if (this.root) this.root.classList.add('hidden'); if (this.btn) this.btn.classList.remove('on'); }
  show() { if (!this.root) this.build(); this.active = true; this.btn.classList.remove('hidden'); }
  hide() { if (!this.root) return; this.active = false; this.close(); this.btn.classList.add('hidden'); }

  // Statik harita (oda/koridor) bir kez çizilir
  drawBase(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const s = this.scale;
    c.fillStyle = 'rgba(8,10,14,.85)'; c.fillRect(0, 0, w, h);
    c.lineJoin = 'round';
    const rect = (r, fill) => { c.fillStyle = fill; c.fillRect(r.x * s, r.y * s, r.w * s, r.h * s); };
    // duvar konturu
    [...Object.values(ROOMS), ...CORRIDORS].forEach((r) => { c.fillStyle = '#9aa4b1'; c.fillRect(r.x * s - 2, r.y * s - 2, r.w * s + 4, r.h * s + 4); });
    CORRIDORS.forEach((r) => rect(r, '#3a3f47'));
    Object.entries(ROOMS).forEach(([id, r]) => rect(r, ROOM_COLOR[id] || '#444'));
    if (this.big) {
      c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `bold ${Math.max(10, Math.round(w / 70))}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
      Object.entries(ROOMS).forEach(([id, r]) => c.fillText(i18n.t('rooms.' + id), (r.x + r.w / 2) * s, (r.y + r.h / 2) * s));
    }
    return cv;
  }

  update(st, force = false) {
    if (!this.root || this.root.classList.contains('hidden')) return;
    const now = performance.now();
    if (!force && now - this.last < 90) return;   // ~11 kare/sn yeter
    this.last = now;
    const css = this.root.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.root.style.setProperty('--mm-ar', (WORLD.w / WORLD.h).toFixed(3));   // büyük harita ekrana sığsın
    const w = Math.max(10, Math.round(css.width * dpr)), h = Math.round(w * WORLD.h / WORLD.w);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.base = null; }
    this.scale = w / WORLD.w;
    if (!this.base) this.base = this.drawBase(w, h);
    const c = this.canvas.getContext('2d');
    const s = this.scale;
    c.drawImage(this.base, 0, 0);
    const blink = (Math.sin(now / 160) + 1) / 2;
    // görevler
    (st.tasks || []).forEach((t) => {
      if (t.done) return;
      c.fillStyle = '#ffd23f'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * dpr;
      c.beginPath(); c.arc(t.x * s, t.y * s, 3.2 * dpr, 0, 7); c.fill(); c.stroke();
    });
    // sabotaj tamir noktası
    if (st.sabotage) {
      const r = (5 + blink * 5) * dpr;
      c.fillStyle = `rgba(255,60,50,${0.35 + blink * 0.5})`; c.beginPath(); c.arc(st.sabotage.x * s, st.sabotage.y * s, r, 0, 7); c.fill();
      c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(st.sabotage.x * s, st.sabotage.y * s, 3.5 * dpr, 0, 7); c.fill();
    }
    // sen
    if (st.me) {
      const x = st.me.x * s, y = st.me.y * s;
      c.fillStyle = `rgba(80,200,255,${0.25 + blink * 0.3})`; c.beginPath(); c.arc(x, y, 9 * dpr, 0, 7); c.fill();
      c.fillStyle = st.me.alive ? '#4fc3ff' : 'rgba(200,220,255,.7)'; c.strokeStyle = '#fff'; c.lineWidth = 2 * dpr;
      c.beginPath(); c.arc(x, y, 4.5 * dpr, 0, 7); c.fill(); c.stroke();
    }
    this.label.textContent = st.room ? i18n.t('rooms.' + st.room) : '';
  }
}

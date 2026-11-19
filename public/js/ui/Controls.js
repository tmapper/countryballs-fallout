// ============================================================
// Controls.js - Tuş atama penceresi (PC) + Buton yerleri düzenleyici (mobil)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { ACTIONS, getBinds, setBind, resetBinds, captureNext, cancelCapture, keyLabel } from '../systems/Keys.js';
import { BUTTON_IDS, getButtonPos, getButtonScale, saveLayout, resetLayout, defaultPositions } from '../systems/ButtonLayout.js';
import { RES } from '../systems/Resolution.js';
import { isMobileHw } from '../systems/Device.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- TUŞ ATAMA ----------------
class KeyBindPanel {
  constructor() { this.root = null; }
  get isOpen() { return !!this.root && !this.root.classList.contains('hidden'); }
  open() {
    if (!this.root) {
      const r = this.root = document.createElement('div');
      r.className = 'ctl-panel hidden';
      document.body.appendChild(r);
      r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    }
    this.root.classList.remove('hidden');
    this.render();
  }
  close() { cancelCapture(); if (this.root) this.root.classList.add('hidden'); }
  render() {
    const b = getBinds();
    this.root.innerHTML = `<div class="ctl-card">
      <div class="ctl-head"><h2>${esc(i18n.t('controls.keysTitle'))}</h2><button class="ctl-x" type="button">✕</button></div>
      <p class="ctl-hint">${esc(i18n.t('controls.keysHint'))}</p>
      <div class="ctl-list">${ACTIONS.map((a) => `<div class="ctl-row"><span>${esc(i18n.t('controls.a_' + a))}</span>
        <button type="button" class="ctl-key" data-a="${a}" data-s="0">${esc(keyLabel(b[a][0]))}</button>
        <button type="button" class="ctl-key alt" data-a="${a}" data-s="1">${esc(keyLabel(b[a][1]))}</button></div>`).join('')}</div>
      <div class="ctl-foot"><button type="button" class="ctl-btn ctl-reset">${esc(i18n.t('controls.reset'))}</button><button type="button" class="ctl-btn primary ctl-done">${esc(i18n.t('controls.done'))}</button></div>
    </div>`;
    const q = (s) => this.root.querySelector(s);
    q('.ctl-x').addEventListener('click', () => this.close());
    q('.ctl-done').addEventListener('click', () => this.close());
    q('.ctl-reset').addEventListener('click', () => { resetBinds(); this.render(); });
    this.root.querySelectorAll('.ctl-key').forEach((k) => k.addEventListener('click', () => {
      this.root.querySelectorAll('.ctl-key.wait').forEach((x) => x.classList.remove('wait'));
      k.classList.add('wait'); k.textContent = i18n.t('controls.pressKey');
      captureNext((code) => {
        if (code === 'Escape') { this.render(); return; }                       // vazgeç
        const ok = setBind(k.dataset.a, Number(k.dataset.s), code === 'Backspace' || code === 'Delete' ? '' : code);   // sil
        this.render();
        if (ok === false) { const h = this.root.querySelector('.ctl-hint'); h.textContent = i18n.t('controls.reserved', { k: keyLabel(code) }); h.classList.add('warn'); }
      });
    }));
  }
}
export const keyBindPanel = new KeyBindPanel();

// ---------------- MOBİL BUTON YERLERİ ----------------
class ButtonEditor {
  constructor() { this.root = null; }
  get isOpen() { return !!this.root && !this.root.classList.contains('hidden'); }
  open() {
    if (!this.root) {
      const r = this.root = document.createElement('div');
      r.className = 'btned hidden';
      document.body.appendChild(r);
    }
    this.scale = getButtonScale();
    this.pos = {};
    this.cleared = false;
    this.root.classList.remove('hidden');
    this.render();
  }
  close() { if (this.root) this.root.classList.add('hidden'); }
  render() {
    if (!this.escWired) { this.escWired = true; window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true); }
    const W = window.innerWidth, H = window.innerHeight;
    const small = Math.min(RES.cssW || W, RES.cssH || H) < 520;
    const R = (small ? 46 : 54) * (isMobileHw() ? 1.2 : 1) * this.scale;
    const def = defaultPositions(W, H, R);
    const ICON = { action: '🔪', tunnel: '🕳', use: '✋', report: '📢', sabotage: '☢' };
    this.root.innerHTML = `<div class="btned-bar">
        <b>${esc(i18n.t('controls.layoutTitle'))}</b>
        <label>${esc(i18n.t('controls.size'))} <input type="range" class="btned-size" min="70" max="150" value="${Math.round(this.scale * 100)}"><span>${Math.round(this.scale * 100)}%</span></label>
        <button type="button" class="ctl-btn btned-reset">${esc(i18n.t('controls.reset'))}</button>
        <button type="button" class="ctl-btn btned-cancel">${esc(i18n.t('controls.cancel'))}</button>
        <button type="button" class="ctl-btn primary btned-save">${esc(i18n.t('controls.save'))}</button>
      </div>
      <div class="btned-hint">${esc(i18n.t('controls.layoutHint'))}<small>${esc(i18n.t('controls.layoutRoleNote'))}</small></div>
      <div class="btned-joy">${esc(i18n.t('controls.joyZone'))}</div>
      ${BUTTON_IDS.map((id) => {
        const p = this.pos[id] || (this.cleared ? null : getButtonPos(id));
        const d = def[id], x = p ? p.x * W : d.x, y = p ? p.y * H : d.y;
        return `<div class="btned-b" data-id="${id}" style="left:${x - d.r}px;top:${y - d.r}px;width:${d.r * 2}px;height:${d.r * 2}px"><i>${ICON[id]}</i><span>${esc(i18n.t('controls.b_' + id))}</span></div>`;
      }).join('')}`;
    const q = (s) => this.root.querySelector(s);
    q('.btned-size').addEventListener('input', (e) => { this.scale = Number(e.target.value) / 100; this.capture(); this.render(); });
    q('.btned-reset').addEventListener('click', () => { this.pos = {}; this.scale = 1; this.cleared = true; this.render(); });   // Kaydet'e basınca geçerli olur
    q('.btned-cancel').addEventListener('click', () => this.close());
    q('.btned-save').addEventListener('click', () => { this.capture(); if (this.cleared) resetLayout(); saveLayout({ ...(this.cleared ? {} : this.savedPos()), ...this.pos }, this.scale); this.close(); });
    this.root.querySelectorAll('.btned-b').forEach((el) => this.drag(el));
    this.markJoy();
  }
  // Joystick alanına (sol yarı) konan buton kırmızı görünür: orada dokunuş joystick'e de gidebilir
  markJoy() {
    const W = window.innerWidth;
    let any = false;
    this.root.querySelectorAll('.btned-b').forEach((el) => { const r = el.getBoundingClientRect(); const bad = r.left + r.width / 2 < W * 0.5; el.classList.toggle('joy', bad); any = any || bad; });
    const h = this.root.querySelector('.btned-joy'); if (h) h.classList.toggle('warn', any);
  }
  savedPos() { const o = {}; BUTTON_IDS.forEach((id) => { const p = getButtonPos(id); if (p) o[id] = p; }); return o; }
  // Ekrandaki yerleri oran olarak al (boyut değişince kaybolmasın)
  capture() {
    const W = window.innerWidth, H = window.innerHeight;
    this.root.querySelectorAll('.btned-b.moved').forEach((el) => {
      const r = el.getBoundingClientRect();
      this.pos[el.dataset.id] = { x: (r.left + r.width / 2) / W, y: (r.top + r.height / 2) / H };
    });
  }
  drag(el) {
    let sx = 0, sy = 0, ox = 0, oy = 0, id = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      id = e.pointerId; el.setPointerCapture(id);
      sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
      el.classList.add('drag');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const W = window.innerWidth, H = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.max(0, Math.min(W - w, ox + e.clientX - sx)) + 'px';
      el.style.top = Math.max(0, Math.min(H - h, oy + e.clientY - sy)) + 'px';
      el.classList.add('moved');
    });
    const up = (e) => { if (e.pointerId !== id) return; id = null; el.classList.remove('drag'); this.capture(); this.markJoy(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
}
export const buttonEditor = new ButtonEditor();

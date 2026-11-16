// ============================================================
// Controls.js - Tuş atama penceresi (PC) + Buton yerleri düzenleyici (mobil)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { ACTIONS, getBinds, setBind, resetBinds, captureNext, cancelCapture, keyLabel } from '../systems/Keys.js';
import { BUTTON_IDS, getButtonPos, getButtonScale, saveLayout, resetLayout, defaultPositions } from '../systems/ButtonLayout.js';
import { RES } from '../systems/Resolution.js';
import { isMobile } from '../systems/Device.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- TUŞ ATAMA ----------------
class KeyBindPanel {
  constructor() { this.root = null; }
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
        setBind(k.dataset.a, Number(k.dataset.s), code === 'Backspace' || code === 'Delete' ? '' : code);   // sil
        this.render();
      });
    }));
  }
}
export const keyBindPanel = new KeyBindPanel();

// ---------------- MOBİL BUTON YERLERİ ----------------
class ButtonEditor {
  constructor() { this.root = null; }
  open() {
    if (!this.root) {
      const r = this.root = document.createElement('div');
      r.className = 'btned hidden';
      document.body.appendChild(r);
    }
    this.scale = getButtonScale();
    this.pos = {};
    this.root.classList.remove('hidden');
    this.render();
  }
  close() { if (this.root) this.root.classList.add('hidden'); }
  render() {
    const W = window.innerWidth, H = window.innerHeight;
    const small = Math.min(RES.cssW || W, RES.cssH || H) < 520;
    const R = (small ? 46 : 54) * (isMobile() ? 1.2 : 1) * this.scale;
    const def = defaultPositions(W, H, R);
    const ICON = { action: '🔪', tunnel: '🕳', use: '✋', report: '📢', sabotage: '☢' };
    this.root.innerHTML = `<div class="btned-bar">
        <b>${esc(i18n.t('controls.layoutTitle'))}</b>
        <label>${esc(i18n.t('controls.size'))} <input type="range" class="btned-size" min="70" max="150" value="${Math.round(this.scale * 100)}"><span>${Math.round(this.scale * 100)}%</span></label>
        <button type="button" class="ctl-btn btned-reset">${esc(i18n.t('controls.reset'))}</button>
        <button type="button" class="ctl-btn btned-cancel">${esc(i18n.t('controls.cancel'))}</button>
        <button type="button" class="ctl-btn primary btned-save">${esc(i18n.t('controls.save'))}</button>
      </div>
      <div class="btned-hint">${esc(i18n.t('controls.layoutHint'))}</div>
      <div class="btned-joy">${esc(i18n.t('controls.joyZone'))}</div>
      ${BUTTON_IDS.map((id) => {
        const p = this.pos[id] || getButtonPos(id);
        const d = def[id], x = p ? p.x * W : d.x, y = p ? p.y * H : d.y;
        return `<div class="btned-b" data-id="${id}" style="left:${x - d.r}px;top:${y - d.r}px;width:${d.r * 2}px;height:${d.r * 2}px"><i>${ICON[id]}</i><span>${esc(i18n.t('controls.b_' + id))}</span></div>`;
      }).join('')}`;
    const q = (s) => this.root.querySelector(s);
    q('.btned-size').addEventListener('input', (e) => { this.scale = Number(e.target.value) / 100; this.capture(); this.render(); });
    q('.btned-reset').addEventListener('click', () => { this.pos = {}; this.scale = 1; resetLayout(); this.render(); });
    q('.btned-cancel').addEventListener('click', () => this.close());
    q('.btned-save').addEventListener('click', () => { this.capture(); saveLayout({ ...this.savedPos(), ...this.pos }, this.scale); this.close(); });
    this.root.querySelectorAll('.btned-b').forEach((el) => this.drag(el));
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
    const up = (e) => { if (e.pointerId !== id) return; id = null; el.classList.remove('drag'); this.capture(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
}
export const buttonEditor = new ButtonEditor();

// ============================================================
// Suggest.js - Ana menüden öneri kutusu
// ============================================================
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';

class Suggest {
  constructor() { this.root = null; this.isOpen = false; this.imageData = null; }

  ensure() { if (!this.root) this.build(); }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'suggest hidden';
    r.innerHTML = `
      <div class="sg-card">
        <div class="sg-head"><h2 data-t="suggest.title">ÖNERİ KUTUSU</h2><button class="sg-x" type="button">✕</button></div>
        <p class="sg-hint" data-t="suggest.hint">Oyuna dair fikir, hata bildirimi veya isteğini yaz.</p>
        <p class="sg-warn">Gereksiz mesajlar ban sebebidir!</p>
        <textarea class="sg-txt" maxlength="280" rows="5" placeholder="..."></textarea>
        <div class="sg-img-row">
          <label class="sg-img-btn">📷 Görsel ekle<input type="file" class="sg-file" accept="image/*" hidden></label>
          <img class="sg-img-preview" alt="">
          <button type="button" class="sg-img-btn sg-img-clear" hidden>Kaldır</button>
        </div>
        <div class="sg-foot">
          <span class="sg-count">0/280</span>
          <button class="sg-send mm-tbtn primary" type="button" data-t="suggest.send">GÖNDER</button>
        </div>
        <div class="sg-msg"></div>
      </div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.sg-x').addEventListener('click', () => this.close());
    const ta = r.querySelector('.sg-txt');
    ta.addEventListener('input', () => { r.querySelector('.sg-count').textContent = `${ta.value.length}/280`; });
    r.querySelector('.sg-send').addEventListener('click', () => this.send());
    const file = r.querySelector('.sg-file');
    const prev = r.querySelector('.sg-img-preview');
    const clr = r.querySelector('.sg-img-clear');
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 1.5e6) { this.msg('Görsel en fazla 1.5 MB olmalı', true); file.value = ''; return; }
      const rd = new FileReader();
      rd.onload = () => {
        // Küçült: max 800px kenar
        const im = new Image();
        im.onload = () => {
          const max = 800; let w = im.width, h = im.height;
          if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, 0, 0, w, h);
          this.imageData = cv.toDataURL('image/jpeg', 0.72);
          prev.src = this.imageData; prev.classList.add('show'); clr.hidden = false;
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    });
    clr.addEventListener('click', () => {
      this.imageData = null; file.value = ''; prev.removeAttribute('src'); prev.classList.remove('show'); clr.hidden = true;
    });
    r.addEventListener('keydown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    net.on('suggestOk', () => this.msg(i18n.t('suggest.thanks') || 'Teşekkürler, önerin kaydedildi!'));
    i18n.onChange(() => this.isOpen && this.render());
  }

  render() {
    const r = this.root;
    r.querySelector('h2').textContent = i18n.t('suggest.title') || 'ÖNERİ KUTUSU';
    r.querySelector('.sg-hint').textContent = i18n.t('suggest.hint') || 'Oyuna dair fikir, hata bildirimi veya isteğini yaz.';
    r.querySelector('.sg-send').textContent = i18n.t('suggest.send') || 'GÖNDER';
    r.querySelector('.sg-txt').placeholder = i18n.t('suggest.placeholder') || 'Önerini yaz...';
  }

  msg(text, bad) {
    const e = this.root.querySelector('.sg-msg');
    e.textContent = text;
    e.classList.toggle('bad', !!bad);
    clearTimeout(this._t);
    this._t = setTimeout(() => { e.textContent = ''; }, 4000);
  }

  send() {
    const ta = this.root.querySelector('.sg-txt');
    const text = (ta.value || '').trim();
    if (text.length < 3) { this.msg(i18n.t('suggest.short') || 'En az 3 karakter yaz', true); return; }
    net.connect();
    net.send({ t: 'suggest', text, image: this.imageData || null });
    ta.value = '';
    this.root.querySelector('.sg-count').textContent = '0/280';
    this.imageData = null;
    const prev = this.root.querySelector('.sg-img-preview');
    const file = this.root.querySelector('.sg-file');
    const clr = this.root.querySelector('.sg-img-clear');
    if (prev) { prev.removeAttribute('src'); prev.classList.remove('show'); }
    if (file) file.value = '';
    if (clr) clr.hidden = true;
  }

  open() {
    this.ensure();
    this.render();
    this.root.classList.remove('hidden');
    this.isOpen = true;
    setTimeout(() => this.root.querySelector('.sg-txt').focus(), 50);
  }

  close() {
    if (this.root) this.root.classList.add('hidden');
    this.isOpen = false;
  }
}

export const suggest = new Suggest();

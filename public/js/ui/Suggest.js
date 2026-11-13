// ============================================================
// Suggest.js - Ana menüden öneri kutusu
// ============================================================
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';

class Suggest {
  constructor() { this.root = null; this.isOpen = false; }

  ensure() { if (!this.root) this.build(); }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'suggest hidden';
    r.innerHTML = `
      <div class="sg-card">
        <div class="sg-head"><h2 data-t="suggest.title">ÖNERİ KUTUSU</h2><button class="sg-x" type="button">✕</button></div>
        <p class="sg-hint" data-t="suggest.hint">Oyuna dair fikir, hata bildirimi veya isteğini yaz.</p>
        <textarea class="sg-txt" maxlength="280" rows="5" placeholder="..."></textarea>
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
    net.send({ t: 'suggest', text });
    ta.value = '';
    this.root.querySelector('.sg-count').textContent = '0/280';
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

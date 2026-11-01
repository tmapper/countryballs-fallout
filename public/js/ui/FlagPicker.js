// ============================================================
// FlagPicker.js - BM direğinde açılan bayrak seçme ekranı
// ============================================================
//   flagPicker.open({ current, taken: Set, onPick(code) })
// Başka oyuncuların (ya da botların) kullandığı bayraklar seçilemez.
import { i18n } from '../systems/I18n.js';
import { FLAG_LIST, getFlagThumb } from '../systems/Flags.js';

class FlagPicker {
  constructor() { this.root = null; this.isOpen = false; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'flagpick hidden';
    r.innerHTML = `<div class="fp-card"><div class="fp-head"><span class="fp-un"></span><h2></h2><button class="fp-x" type="button">✕</button></div>
      <p class="fp-sub"></p><div class="fp-grid"></div></div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.fp-x').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
  }

  open({ current, taken = new Set(), onPick }) {
    if (!this.root) this.build();
    const r = this.root;
    r.querySelector('h2').textContent = i18n.t('lobby.pickFlag');
    r.querySelector('.fp-sub').textContent = i18n.t('lobby.flagTakenHint');
    const grid = r.querySelector('.fp-grid');
    grid.innerHTML = '';
    FLAG_LIST.forEach((code, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fp-flag' + (code === current ? ' on' : '');
      b.style.setProperty('--i', i);
      b.disabled = taken.has(code) && code !== current;
      b.title = i18n.t('countries.' + code);
      b.innerHTML = `<img alt="" src="${getFlagThumb(code, 72, 48)}"><span>${i18n.t('countries.' + code)}</span>`;
      b.addEventListener('click', () => { if (b.disabled) return; this.close(); onPick(code); });
      grid.appendChild(b);
    });
    r.classList.remove('hidden');
    this.isOpen = true;
  }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; }
}

export const flagPicker = new FlagPicker();

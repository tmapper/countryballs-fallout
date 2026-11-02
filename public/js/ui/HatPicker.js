// ============================================================
// HatPicker.js - Lobideki şapka dolabında açılan şapka seçme ekranı
// ============================================================
//   hatPicker.open({ current, flag, onPick(id) })   (şapkalar topun üstünde önizlenir)
import { i18n } from '../systems/I18n.js';
import { getFlagThumb } from '../systems/Flags.js';
import { HAT_IDS, getHatThumb, hatPrice, ownsHat } from '../systems/Looks.js';
import { net } from '../systems/Net.js';
import { sfx } from '../systems/Sound.js';

class HatPicker {
  constructor() { this.root = null; this.isOpen = false; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'flagpick hatpick hidden';
    r.innerHTML = `<div class="fp-card hp-card"><div class="fp-head"><span class="hp-ico">🎩</span><h2></h2><button class="fp-x" type="button">✕</button></div>
      <div class="hp-bar"><span class="hp-coins"></span><span class="hp-msg"></span></div>
      <p class="fp-sub"></p><div class="fp-grid hp-grid"></div></div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.fp-x').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    // Satın alma sonucu: bakiye güncellenir, alınan şapka hemen takılır
    net.on('account', (m) => { if (!this.isOpen) return; if (m.bought && this.onPick) { sfx('task_done'); this.current = m.bought; this.onPick(m.bought); } this.render(); });
    net.on('shopError', (m) => { if (this.isOpen) this.msg(i18n.t('shop.' + m.code), true); });
  }

  msg(text, bad) {
    const e = this.root.querySelector('.hp-msg');
    e.textContent = text; e.classList.toggle('bad', !!bad);
    e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  }

  open({ current, flag, onPick }) {
    if (!this.root) this.build();
    this.current = current; this.flag = flag; this.onPick = onPick;
    this.root.querySelector('.hp-msg').textContent = '';
    this.render();
    this.root.classList.remove('hidden');
    this.isOpen = true;
  }

  render() {
    const r = this.root, acc = net.account;
    r.querySelector('h2').textContent = i18n.t('lobby.pickHat');
    r.querySelector('.fp-sub').textContent = acc ? i18n.t('shop.sub') : i18n.t('shop.guest');
    r.querySelector('.hp-coins').textContent = acc ? `🪙 ${acc.coins ?? 0}` : '🪙 —';
    const grid = r.querySelector('.fp-grid');
    grid.innerHTML = '';
    const ball = getFlagThumb(this.flag || 'TR', 72, 48);
    HAT_IDS.forEach((id, i) => {
      const owned = ownsHat(acc, id), price = hatPrice(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fp-flag hp-hat' + (id === this.current ? ' on' : '') + (owned ? '' : ' locked');
      b.style.setProperty('--i', i);
      const tag = owned ? (price === 0 ? i18n.t('shop.free') : i18n.t('shop.owned')) : `🪙 ${price}`;
      b.innerHTML = `<div class="hp-prev"><span class="hp-ball" style="background-image:url(${ball})"><i></i><i></i></span>${id === 'none' ? '' : `<img alt="" src="${getHatThumb(id)}">`}</div><span>${i18n.t('hats.' + id)}</span><em class="hp-price${owned ? ' own' : ''}">${tag}</em>`;
      b.addEventListener('click', () => {
        if (owned) { this.close(); this.onPick(id); return; }
        if (!acc) { this.msg(i18n.t('shop.needLogin'), true); return; }
        if ((acc.coins ?? 0) < price) { this.msg(i18n.t('shop.noCoins'), true); return; }
        if (b.dataset.confirm) { net.buyHat(id); this.msg(i18n.t('shop.buying')); return; }
        grid.querySelectorAll('[data-confirm]').forEach((x) => { delete x.dataset.confirm; x.querySelector('.hp-price').textContent = `🪙 ${hatPrice(HAT_IDS[Number(x.style.getPropertyValue('--i'))])}`; });
        b.dataset.confirm = '1';
        b.querySelector('.hp-price').textContent = i18n.t('shop.confirm', { n: price });
      });
      grid.appendChild(b);
    });
  }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; }
}

export const hatPicker = new HatPicker();

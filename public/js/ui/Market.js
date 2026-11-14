// ============================================================
// Market.js - Oyuncular arası pazar yeri (bayrak / şapka satış)
// ============================================================
//   market.open()   (giriş gerekli)
// Sekmeler: PAZAR (ilanlar) | İLAN VER (kendi eşyalarını koy) | BENİM İLANLARIM
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { getFlagThumb, HIST_FLAGS, HIST_RARITY } from '../systems/Flags.js';
import { HATS, HAT_PRICE, ownsHat } from '../systems/Looks.js';
import { RARITY_COLOR } from '../systems/Pass.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

class Market {
  constructor() {
    this.root = null;
    this.isOpen = false;
    this.tab = 'browse';
    this.list = [];
    this.sellKind = 'flag';
    this.sellItem = '';
    this.sellPrice = 200;
  }

  ensure() { if (!this.root) this.build(); }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'market hidden';
    r.innerHTML = `
      <div class="mk-card">
        <div class="mk-head">
          <h2 data-t="market.title">PAZAR YERİ</h2>
          <div class="mk-coins">🪙 0</div>
          <button class="mk-x" type="button" aria-label="kapat">✕</button>
        </div>
        <div class="mk-tabs">
          <button type="button" data-tab="browse" class="on" data-t="market.tabBrowse">PAZAR</button>
          <button type="button" data-tab="sell" data-t="market.tabSell">İLAN VER</button>
          <button type="button" data-tab="mine" data-t="market.tabMine">İLANLARIM</button>
        </div>
        <div class="mk-body" data-scroll></div>
        <div class="mk-msg"></div>
      </div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.mk-x').addEventListener('click', () => this.close());
    r.querySelectorAll('.mk-tabs button').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      this.render();
    }));
    r.addEventListener('keydown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    net.on('market', (m) => { this.list = m.list || []; if (this.isOpen) this.render(); });
    net.on('account', () => { if (this.isOpen) this.render(); });
    net.on('shopError', (m) => this.msg(i18n.t('market.err_' + m.code) || i18n.t('shop.err_' + m.code) || m.code, true));
    i18n.onChange(() => this.isOpen && this.render());
  }

  msg(text, bad) {
    const card = this.cardEl();
    const e = card && card.querySelector('.mk-msg');
    if (!e) return;
    e.textContent = text;
    e.classList.toggle('bad', !!bad);
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => { e.textContent = ''; }, 4000);
  }

  open() {
    this.ensure();
    this.tab = 'browse';
    this.root.classList.remove('hidden');
    this.isOpen = true;
    // Sığınak bileti pazarın üstüne binmesin
    document.querySelectorAll('.sp-root, .flagpick.sp-root').forEach((el) => {
      el.style.zIndex = '50';
      el.classList.add('behind-market');
    });
    this.root.querySelectorAll('.mk-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === this.tab));
    net.connect();
    net.send({ t: 'marketList' });
    this.render();
    clearInterval(this.poll);
    this.poll = setInterval(() => { if (!document.hidden && this.isOpen) net.send({ t: 'marketList' }); }, 10000);
  }

  close() {
    if (this.root) this.root.classList.add('hidden');
    this.isOpen = false;
    this.embedded = false;
    clearInterval(this.poll);
    document.querySelectorAll('.sp-root, .flagpick.sp-root').forEach((el) => {
      el.style.zIndex = '';
      el.classList.remove('behind-market');
    });
  }

  // Sığınak bileti içine gömülü: ayrı overlay açmaz
  openEmbedded(host) {
    this.ensure();
    this.embedded = true;
    this.tab = 'browse';
    this.isOpen = true;
    // Modal kapalı, içerik host'a taşınır
    this.root.classList.add('hidden');
    const card = this.root.querySelector('.mk-card');
    if (!host || !card) return this.open();
    host.innerHTML = '';
    host.appendChild(card);
    card.classList.add('mk-embedded');
    // X gizle (üst pass zaten var)
    const x = card.querySelector('.mk-x');
    if (x) x.style.display = 'none';
    this.render();
    net.send({ t: 'marketList' });
    clearInterval(this.poll);
    this.poll = setInterval(() => { if (this.isOpen) net.send({ t: 'marketList' }); }, 8000);
  }

  // Kartı modal root'a geri al
  unembed() {
    if (!this.embedded) return;
    this.embedded = false;
    const card = document.querySelector('.mk-card.mk-embedded');
    if (card && this.root) {
      card.classList.remove('mk-embedded');
      const x = card.querySelector('.mk-x');
      if (x) x.style.display = '';
      this.root.appendChild(card);
    }
  }

  itemLabel(type, item) {
    if (type === 'flag') return i18n.t('countries.' + item) || item;
    const h = HATS.find((x) => x.id === item);
    return h ? (i18n.t('hats.' + item) || h.name || item) : item;
  }

  ownedFlags() {
    const acc = net.account;
    if (!acc || !Array.isArray(acc.flags)) return [];
    return HIST_FLAGS.filter((f) => acc.flags.includes(f) && HIST_RARITY[f] !== 'mystic');
  }

  ownedHats() {
    const acc = net.account;
    if (!acc) return [];
    return HATS.filter((h) => h.id !== 'none' && HAT_PRICE[h.id] > 0 && ownsHat(acc, h.id)).map((h) => h.id);
  }

  myListings() {
    const key = net.account && (net.accountKey || null);
    // server sends seller as account key; we compare via name if key unknown
    const me = net.account && net.account.name;
    return this.list.filter((x) => x.sellerName === me || (net.account && x.seller === net.account._key));
  }

  // Gömülü veya modal: her zaman .mk-card üzerinden seç (card host'a taşınabiliyor)
  cardEl() {
    return document.querySelector('.mk-card') || (this.root && this.root.querySelector('.mk-card'));
  }

  render() {
    const card = this.cardEl();
    if (!card) return;
    const body = card.querySelector('.mk-body');
    const acc = net.account;
    const coinsEl = card.querySelector('.mk-coins');
    if (coinsEl) coinsEl.textContent = `🪙 ${acc ? (acc.coins ?? 0) : 0}`;
    const h2 = card.querySelector('h2');
    if (h2) h2.textContent = i18n.t('market.title') || 'PAZAR YERİ';
    card.querySelectorAll('.mk-tabs button').forEach((b) => {
      const keys = { browse: 'market.tabBrowse', sell: 'market.tabSell', mine: 'market.tabMine' };
      b.textContent = i18n.t(keys[b.dataset.tab]) || b.dataset.tab;
      b.classList.toggle('on', b.dataset.tab === this.tab);
    });

    if (!body) return;
    if (!acc) {
      body.innerHTML = `<p class="mk-empty">${esc(i18n.t('market.needLogin') || 'Giriş yapmalısın')}</p>`;
      return;
    }

    if (this.tab === 'browse') this.renderBrowse(body);
    else if (this.tab === 'sell') this.renderSell(body);
    else this.renderMine(body);
  }

  renderBrowse(body) {
    if (!this.list.length) {
      body.innerHTML = `<p class="mk-empty">${esc(i18n.t('market.empty') || 'Henüz ilan yok. İlk ilanı sen ver!')}</p>`;
      return;
    }
    const me = net.account && net.account.name;
    body.innerHTML = `<div class="mk-grid">${this.list.slice().reverse().map((x) => {
      const mine = x.sellerName === me;
      const thumb = x.type === 'flag'
        ? `<img class="mk-thumb" alt="" src="${getFlagThumb(x.item, 72, 48)}">`
        : `<span class="mk-hat-ico">🎩</span>`;
      const rar = x.type === 'flag' ? (HIST_RARITY[x.item] || '') : '';
      const col = rar ? (RARITY_COLOR[rar] || '#9fb3c8') : '#9fb3c8';
      return `<div class="mk-item" style="--rc:${col}">
        ${thumb}
        <div class="mk-info">
          <b>${esc(this.itemLabel(x.type, x.item))}</b>
          <small>${x.type === 'flag' ? (i18n.t('pass.rarity.' + rar) || rar) : (i18n.t('market.hat') || 'Şapka')} · ${esc(x.sellerName)}</small>
          <div class="mk-price">🪙 ${x.price}</div>
        </div>
        ${mine
          ? `<button type="button" class="mk-btn ghost" data-cancel="${esc(x.id)}">${esc(i18n.t('market.cancel') || 'İptal')}</button>`
          : `<button type="button" class="mk-btn primary" data-buy="${esc(x.id)}">${esc(i18n.t('market.buy') || 'SATIN AL')}</button>`}
      </div>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      net.send({ t: 'marketBuy', id: b.dataset.buy });
      setTimeout(() => net.send({ t: 'marketList' }), 400);
    }));
    body.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => {
      net.send({ t: 'marketCancel', id: b.dataset.cancel });
      setTimeout(() => net.send({ t: 'marketList' }), 400);
    }));
  }

  renderSell(body) {
    const flags = this.ownedFlags();
    const hats = this.ownedHats();
    const kind = this.sellKind;
    const items = kind === 'flag' ? flags : hats;
    if (!this.sellItem || !items.includes(this.sellItem)) this.sellItem = items[0] || '';

    body.innerHTML = `
      <div class="mk-sell">
        <p class="mk-hint">${esc(i18n.t('market.sellHint') || 'Sahip olduğun tarihi bayrak veya şapkayı sat. Mistik bayraklar satılamaz.')}</p>
        <div class="mk-kind">
          <button type="button" class="mk-chip ${kind === 'flag' ? 'on' : ''}" data-kind="flag">${esc(i18n.t('market.kindFlag') || 'Bayrak')}</button>
          <button type="button" class="mk-chip ${kind === 'hat' ? 'on' : ''}" data-kind="hat">${esc(i18n.t('market.kindHat') || 'Şapka')}</button>
        </div>
        ${!items.length
          ? `<p class="mk-empty">${esc(i18n.t('market.noItems') || 'Satılacak eşyan yok')}</p>`
          : `
        <div class="mk-pick">
          ${items.map((id) => {
            const sel = id === this.sellItem ? ' on' : '';
            if (kind === 'flag') {
              return `<button type="button" class="mk-pick-item${sel}" data-item="${esc(id)}" style="--rc:${RARITY_COLOR[HIST_RARITY[id]] || '#9fb3c8'}">
                <img alt="" src="${getFlagThumb(id, 64, 42)}"><span>${esc(this.itemLabel('flag', id))}</span>
              </button>`;
            }
            return `<button type="button" class="mk-pick-item${sel}" data-item="${esc(id)}">
              <span class="mk-hat-ico">🎩</span><span>${esc(this.itemLabel('hat', id))}</span>
            </button>`;
          }).join('')}
        </div>
        <label class="mk-price-row">
          <span>${esc(i18n.t('market.price') || 'Fiyat (jeton)')}</span>
          <input type="number" class="mk-price-in" min="50" max="50000" step="10" value="${this.sellPrice}">
        </label>
        <p class="mk-hint small">${esc(i18n.t('market.priceHint') || 'Min 50 · Max 50.000')}</p>
        <button type="button" class="mk-btn primary mk-list-btn" ${this.sellItem ? '' : 'disabled'}>${esc(i18n.t('market.listBtn') || 'İLANI YAYINLA')}</button>
        `}
      </div>`;

    body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      this.sellKind = b.dataset.kind;
      this.sellItem = '';
      this.render();
    }));
    body.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => {
      this.sellItem = b.dataset.item;
      this.render();
    }));
    const priceIn = body.querySelector('.mk-price-in');
    if (priceIn) priceIn.addEventListener('change', () => {
      this.sellPrice = Math.max(50, Math.min(50000, Math.floor(Number(priceIn.value) || 50)));
      priceIn.value = this.sellPrice;
    });
    const listBtn = body.querySelector('.mk-list-btn');
    if (listBtn) listBtn.addEventListener('click', () => {
      const price = Math.max(50, Math.min(50000, Math.floor(Number(priceIn && priceIn.value) || this.sellPrice)));
      if (!this.sellItem) return;
      net.send({ t: 'marketSell', kind: this.sellKind, item: this.sellItem, price });
      this.msg(i18n.t('market.listed') || 'İlan yayınlandı');
      this.sellItem = '';
      setTimeout(() => { net.send({ t: 'marketList' }); this.tab = 'mine'; this.root.querySelectorAll('.mk-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'mine')); this.render(); }, 500);
    });
  }

  renderMine(body) {
    const me = net.account && net.account.name;
    const mine = this.list.filter((x) => x.sellerName === me);
    if (!mine.length) {
      body.innerHTML = `<p class="mk-empty">${esc(i18n.t('market.noMine') || 'Aktif ilanın yok')}</p>`;
      return;
    }
    body.innerHTML = `<div class="mk-grid">${mine.map((x) => {
      const thumb = x.type === 'flag'
        ? `<img class="mk-thumb" alt="" src="${getFlagThumb(x.item, 72, 48)}">`
        : `<span class="mk-hat-ico">🎩</span>`;
      return `<div class="mk-item">
        ${thumb}
        <div class="mk-info">
          <b>${esc(this.itemLabel(x.type, x.item))}</b>
          <div class="mk-price">🪙 ${x.price}</div>
        </div>
        <button type="button" class="mk-btn ghost" data-cancel="${esc(x.id)}">${esc(i18n.t('market.cancel') || 'İptal')}</button>
      </div>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => {
      net.send({ t: 'marketCancel', id: b.dataset.cancel });
      setTimeout(() => net.send({ t: 'marketList' }), 400);
    }));
  }
}

export const market = new Market();

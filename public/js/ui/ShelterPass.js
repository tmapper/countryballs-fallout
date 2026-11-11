// ============================================================
// ShelterPass.js - Sığınak Bileti ekranı (30 günlük sezon, barlar, kasalar, bayrak koleksiyonu)
// ============================================================
//   shelterPass.open()      (giriş yapılmış olmalı; ödüller ve kasalar sunucuda)
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { sfx } from '../systems/Sound.js';
import { getFlagThumb, HIST_FLAGS, HIST_RARITY } from '../systems/Flags.js';
import { PASS, CRATE_TIERS, CRATE_ICON, CRATE_ODDS, RARITY_COLOR, RARITY_ORDER, passReward, passStatus } from '../systems/Pass.js';

class ShelterPass {
  constructor() { this.root = null; this.isOpen = false; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'flagpick sp-root hidden';
    r.innerHTML = `<div class="fp-card sp-card">
      <div class="fp-head"><span class="hp-ico">🎟</span><h2></h2><button class="fp-x" type="button">✕</button></div>
      <div class="sp-top"><span class="sp-season"></span><span class="hp-coins"></span><span class="hp-msg"></span></div>
      <div class="sp-xp"><i></i><b></b></div>
      <p class="fp-sub sp-how"></p>
      <div class="sp-actions"><button class="mm-tbtn primary sp-all" type="button"></button></div>
      <div class="sp-grid"></div>
      <h3 class="sp-h sp-h-crates"></h3><div class="sp-crates"></div>
      <h3 class="sp-h sp-h-coll"></h3><div class="sp-coll"></div>
      <div class="sp-reveal hidden"></div>
    </div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.fp-x').addEventListener('click', () => this.close());
    r.querySelector('.sp-all').addEventListener('click', () => net.send({ t: 'passClaimAll' }));
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') { if (!this.root.querySelector('.sp-reveal').classList.contains('hidden')) this.hideReveal(); else this.close(); } });
    net.on('account', (m) => {
      if (!this.isOpen) return;
      if (m.crate) { this.reveal(m.crate); }
      else if (m.claimed && m.claimed.length) { sfx('task_done'); this.msg(i18n.t('pass.claimedN', { n: m.claimed.length })); }
      this.render();
    });
    net.on('shopError', (m) => { if (this.isOpen) this.msg(i18n.t('shop.' + m.code), true); });
    i18n.onChange(() => { if (this.isOpen) this.render(); });
  }

  msg(text, bad) {
    const e = this.root.querySelector('.hp-msg');
    e.textContent = text; e.classList.toggle('bad', !!bad);
    e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  }

  open() {
    if (!this.root) this.build();
    this.root.querySelector('.hp-msg').textContent = '';
    this.hideReveal();
    this.render();
    this.root.classList.remove('hidden');
    this.isOpen = true;
    net.connect();
  }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; }

  hideReveal() { const v = this.root.querySelector('.sp-reveal'); v.classList.add('hidden'); v.innerHTML = ''; }

  // Kasa açıldı: bayrak ışıltılı şekilde gösterilir
  reveal(c) {
    sfx(c.rarity === 'legendary' || c.rarity === 'epic' ? 'task_done' : 'wire_connect');
    const v = this.root.querySelector('.sp-reveal');
    const col = RARITY_COLOR[c.rarity];
    v.style.setProperty('--rc', col);
    v.innerHTML = `<div class="sp-rv-card"><div class="sp-rv-crate">${CRATE_ICON[c.tier]} ${i18n.t('pass.tier.' + c.tier)}</div>
      <img alt="" src="${getFlagThumb(c.flag, 240, 160)}">
      <div class="sp-rv-rar">${i18n.t('pass.rarity.' + c.rarity)}</div>
      <div class="sp-rv-name">${i18n.t('countries.' + c.flag)}</div>
      <div class="sp-rv-note">${c.dupe ? i18n.t('pass.dupe', { n: c.coins }) : i18n.t('pass.newFlag')}</div>
      <button class="mm-tbtn primary" type="button">${i18n.t('pass.ok')}</button></div>`;
    v.classList.remove('hidden');
    v.querySelector('button').addEventListener('click', () => this.hideReveal());
  }

  render() {
    const r = this.root, acc = net.account;
    if (!acc) { this.close(); return; }
    const st = passStatus(acc);
    r.querySelector('h2').textContent = i18n.t('pass.title');
    r.querySelector('.sp-season').textContent = `${i18n.t('pass.season', { n: st.season })} · ${i18n.t('pass.daysLeft', { n: st.daysLeft })}`;
    r.querySelector('.hp-coins').textContent = `🪙 ${acc.coins ?? 0}`;
    r.querySelector('.sp-xp i').style.width = Math.min(100, (st.xp / PASS.MAX_XP) * 100) + '%';
    r.querySelector('.sp-xp b').textContent = `${st.xp} / ${PASS.MAX_XP} XP · ${i18n.t('pass.bars', { a: st.reached, b: PASS.LEVELS })}`;
    r.querySelector('.sp-how').textContent = i18n.t('pass.how', { n: PASS.BAR_XP });
    const all = r.querySelector('.sp-all');
    all.textContent = st.claimable ? `${i18n.t('pass.claimAll')} (${st.claimable})` : i18n.t('pass.claimAll');
    all.disabled = !st.claimable;

    // --- barlar
    const grid = r.querySelector('.sp-grid'); grid.innerHTML = '';
    for (let L = 1; L <= PASS.LEVELS; L++) {
      const rw = passReward(L), done = st.claimed.includes(L), ready = !done && L <= st.reached;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sp-tile' + (done ? ' done' : ready ? ' ready' : ' lock') + (rw.crate ? ' crate' : '');
      const ico = rw.crate ? CRATE_ICON[rw.crate] : '🪙';
      const txt = rw.crate ? i18n.t('pass.tier.' + rw.crate) : `+${rw.coins}`;
      b.innerHTML = `<i>${L}</i><span class="sp-ico">${ico}</span><span class="sp-txt">${txt}</span><em>${done ? '✔' : ready ? i18n.t('pass.claim') : `${L * PASS.BAR_XP} XP`}</em>`;
      if (ready) b.addEventListener('click', () => net.send({ t: 'passClaim', level: L }));
      else b.disabled = true;
      grid.appendChild(b);
    }

    // --- kasalar
    r.querySelector('.sp-h-crates').textContent = i18n.t('pass.crates');
    const cr = r.querySelector('.sp-crates'); cr.innerHTML = '';
    CRATE_TIERS.forEach((t) => {
      const n = (acc.crates && acc.crates[t]) || 0;
      const odds = Object.entries(CRATE_ODDS[t]).map(([rr, w]) => `${i18n.t('pass.rarity.' + rr)} %${w}`).join(' · ');
      const d = document.createElement('div');
      d.className = 'sp-crate' + (n ? ' has' : '');
      d.innerHTML = `<div class="sp-cico">${CRATE_ICON[t]}</div><b>${i18n.t('pass.tier.' + t)} ×${n}</b><small>${odds}</small><button class="mm-tbtn small primary" type="button">${i18n.t('pass.open')}</button>`;
      const btn = d.querySelector('button'); btn.disabled = !n;
      btn.addEventListener('click', () => net.send({ t: 'crateOpen', tier: t }));
      cr.appendChild(d);
    });

    // --- koleksiyon
    const owned = new Set(acc.flags || []);
    r.querySelector('.sp-h-coll').textContent = `${i18n.t('pass.collection')} · ${owned.size}/${HIST_FLAGS.length}`;
    const coll = r.querySelector('.sp-coll'); coll.innerHTML = '';
    RARITY_ORDER.forEach((rar) => HIST_FLAGS.filter((f) => HIST_RARITY[f] === rar).forEach((f) => {
      const d = document.createElement('div');
      d.className = 'sp-flag' + (owned.has(f) ? ' own' : '');
      d.style.setProperty('--rc', RARITY_COLOR[rar]);
      d.title = i18n.t('countries.' + f);
      d.innerHTML = `<img alt="" src="${getFlagThumb(f, 72, 48)}"><span>${i18n.t('countries.' + f)}</span><small>${i18n.t('pass.rarity.' + rar)}</small>`;
      coll.appendChild(d);
    }));
  }
}

export const shelterPass = new ShelterPass();

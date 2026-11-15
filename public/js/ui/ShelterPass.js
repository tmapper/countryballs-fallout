// ============================================================
// ShelterPass.js - Sığınak Bileti ekranı (30 günlük sezon, SAĞA KAYDIRMALI bar yolu, kasalar, bayrak koleksiyonu)
// ============================================================
//   shelterPass.open()      (giriş yapılmış olmalı; ödüller ve kasalar sunucuda)
// Ekran tek parça sığar (kaydırma yok): üstte başlık + XP, ortada sekmeler (BİLET / KASALAR / KOLEKSİYON).
// BİLET sekmesi: 30 bar yatay bir yol üzerinde dizilir; parmakla / fareyle sürükleyerek, tekerlekle, ok
// butonlarıyla ya da ← → tuşlarıyla sağa doğru ilerlenir. Açılınca kaldığın (ulaştığın / alınabilir) bara ortalanır.
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { sfx } from '../systems/Sound.js';
import { assetUrl } from '../systems/Assets.js';
import { getFlagThumb, HIST_FLAGS, HIST_RARITY } from '../systems/Flags.js';
import { PASS, CRATE_TIERS, CRATE_ICON, CRATE_ODDS, CRATE_PRICE, RARITY_COLOR, RARITY_ORDER, passReward, passStatus } from '../systems/Pass.js';
import { market } from './Market.js';
import { icon, COIN_IMG, coinHtml } from './Icons.js';

const TABS = ['pass', 'crates', 'coll', 'market'];
// İsteğe bağlı görseller (public/assets/menu/): yoksa emoji ve kodla çizilen arka plan kullanılır.
// Dosya adları: pass_bg.jpg (arka plan), crate_common.png, crate_rare.png, crate_grand.png, coin.png. Promptlar: docs/GORSEL_PROMPTLARI.md (D bölümü)
const ART_DIR = 'assets/menu/';
const ART_FILES = { bg: 'pass_bg.jpg', common: 'crate_common.png', rare: 'crate_rare.png', grand: 'crate_grand.png', coin: 'coin.png' };

class ShelterPass {
  constructor() { this.root = null; this.isOpen = false; this.tab = 'pass'; this.centered = false; this.art = {}; }

  // Görsel dosyaları varsa yükler; yüklenince ekranı yeniden çizer
  probeArt() {
    Object.entries(ART_FILES).forEach(([k, f]) => {
      const im = new Image();
      im.onload = () => {
        this.art[k] = im.src;
        if (k === 'bg' && this.root) this.root.querySelector('.pass-card').style.setProperty('--pass-bg', `url("${im.src}")`);
        if (k !== 'bg' && this.isOpen) this.render();
      };
      im.src = assetUrl(ART_DIR + f);
    });
  }

  // Ödül simgesi: görsel varsa <img>, yoksa emoji
  icon(kind) {
    if (this.art[kind]) return `<img class="sp-art" alt="" src="${this.art[kind]}">`;
    return kind === 'coin' ? COIN_IMG : icon(kind === 'rare' ? 'gift' : kind === 'grand' ? 'crown' : 'crate');
  }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'flagpick sp-root hidden';
    r.innerHTML = `<div class="pass-card">
      <div class="pass-head"><span class="hp-ico">${icon('ticket')}</span><h2></h2><span class="sp-season"></span><span class="hp-coins"></span><span class="hp-msg"></span><button class="fp-x" type="button">✕</button></div>
      <div class="pass-xprow"><div class="sp-xp"><i></i><b></b></div><button class="mm-tbtn primary sp-all" type="button"></button></div>
      <div class="pass-tabs">${TABS.map((t) => `<button type="button" data-tab="${t}"></button>`).join('')}</div>
      <div class="pass-body">
        <section class="pass-pane" data-pane="pass">
          <button class="pass-arrow l" type="button" aria-label="prev">‹</button>
          <div class="pass-track" data-scroll><div class="pass-rail"></div></div>
          <button class="pass-arrow r" type="button" aria-label="next">›</button>
        </section>
        <section class="pass-pane sp-crates" data-pane="crates"></section>
        <section class="pass-pane sp-coll" data-pane="coll"></section>
      <section class="pass-pane sp-market-pane" data-pane="market"></section>
      </div>
      <p class="pass-how"></p>
    </div>
    <div class="sp-reveal hidden"></div>`;
    document.body.appendChild(r);
    this.track = r.querySelector('.pass-track');
    this.probeArt();
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.fp-x').addEventListener('click', () => this.close());
    r.querySelector('.sp-all').addEventListener('click', () => net.send({ t: 'passClaimAll' }));
    r.querySelectorAll('.pass-tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    r.querySelector('.pass-arrow.l').addEventListener('click', () => this.page(-1));
    r.querySelector('.pass-arrow.r').addEventListener('click', () => this.page(1));
    this.bindTrack();
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { if (!r.querySelector('.sp-reveal').classList.contains('hidden')) this.hideReveal(); else this.close(); }
      else if (this.tab === 'pass' && e.key === 'ArrowRight') this.page(1);
      else if (this.tab === 'pass' && e.key === 'ArrowLeft') this.page(-1);
    });
    net.on('account', (m) => {
      if (!this.isOpen) return;
      if (m.crate) { this.reveal(m.crate); }
      else if (m.claimed && m.claimed.length) { sfx('task_done'); this.msg(i18n.t('pass.claimedN', { n: m.claimed.length })); }
      else if (m.boughtCrate) {
        sfx('task_done');
        const b = m.boughtCrate;
        this.msg(i18n.t('pass.boughtCrate', { tier: i18n.t('pass.tier.' + b.tier), n: b.n, cost: b.cost }) || `+${b.n} kasa (−${b.cost})`);
      }
      this.render();
    });
    net.on('shopError', (m) => { if (this.isOpen) this.msg(i18n.t('shop.' + m.code), true); });
    i18n.onChange(() => { if (this.isOpen) this.render(); });
  }

  // Yol üzerinde: fare sürükleme (dokunmatik zaten kendi kayar), tekerlek dikey -> yatay
  bindTrack() {
    const t = this.track;
    let drag = null, moved = 0;
    const zoomOf = () => (t.offsetWidth ? t.getBoundingClientRect().width / t.offsetWidth : 1) || 1;
    t.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, sl: t.scrollLeft, z: zoomOf() }; moved = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) { t.classList.add('drag'); t.scrollLeft = drag.sl - dx / drag.z; }
    });
    const end = () => { if (drag) { drag = null; setTimeout(() => t.classList.remove('drag'), 0); } };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    t.addEventListener('click', (e) => { if (moved > 5) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
    t.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { t.scrollLeft += e.deltaY / zoomOf(); e.preventDefault(); }
    }, { passive: false });
    t.addEventListener('scroll', () => this.updateArrows(), { passive: true });
  }

  page(dir) {
    const t = this.track;
    t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: 'smooth' });
  }

  updateArrows() {
    const t = this.track; if (!t) return;
    const max = t.scrollWidth - t.clientWidth - 2;
    this.root.querySelector('.pass-arrow.l').classList.toggle('off', t.scrollLeft <= 2);
    this.root.querySelector('.pass-arrow.r').classList.toggle('off', t.scrollLeft >= max);
  }

  // Bir barı yolun ortasına getirir
  centerOn(level, smooth) {
    const el = this.root.querySelector(`.pass-step[data-l="${level}"]`);
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }

  setTab(t) {
    this.tab = t;
    this.root.querySelectorAll('.pass-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    this.root.querySelectorAll('.pass-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === t));
    if (t === 'pass') { this.updateArrows(); if (!this.centered) { this.centered = true; this.centerOn(this.focusLevel, false); } }
    if (t === 'market') {
      const pane = this.root && this.root.querySelector('.sp-market-pane');
      if (pane) market.openEmbedded(pane);
    } else {
      try { market.unembed(); market.close(); } catch (e) {}
    }
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
    this.centered = false;
    this.tab = 'pass';
    this.render();
    this.root.classList.remove('hidden');
    this.isOpen = true;
    this.setTab('pass');
    requestAnimationFrame(() => { this.centered = true; this.centerOn(this.focusLevel, false); this.updateArrows(); });
    net.connect();
  }

  close() {
    try { market.unembed(); market.close(); } catch (e) {}
 if (this.root) this.root.classList.add('hidden'); this.isOpen = false; }

  hideReveal() { clearTimeout(this._spinTimer); clearInterval(this._spinTick); const v = this.root.querySelector('.sp-reveal'); v.classList.add('hidden'); v.innerHTML = ''; }

  // Kasa açıldı: önce hızlı dönen bayrak şeridi, yavaşlayarak ortadaki bayrakta durur
  reveal(c) {
    const v = this.root.querySelector('.sp-reveal');
    // Sürpriz bozulmasın: nadirlik rengi (mor vs) dönüş sırasında gösterilmez
    v.style.setProperty('--rc', '#5b92e5');

    const odds = CRATE_ODDS[c.tier] || {};
    const pool = HIST_FLAGS.filter((f) => odds[HIST_RARITY[f]]);
    const list = pool.length ? pool : HIST_FLAGS.slice();

    const ITEM_W = 120;
    const VISIBLE = 5;
    const total = 48;
    const winIdx = 38 + Math.floor(Math.random() * 4);
    const strip = [];
    for (let i = 0; i < total; i++) {
      strip.push(i === winIdx ? c.flag : list[Math.floor(Math.random() * list.length)]);
    }

    v.innerHTML = `
      <div class="sp-spin">
        <div class="sp-spin-title">${this.icon(c.tier)} ${i18n.t('pass.tier.' + c.tier)}</div>
        <div class="sp-spin-window">
          <div class="sp-spin-pointer"></div>
          <div class="sp-spin-track" style="--item-w:${ITEM_W}px"></div>
        </div>
        <div class="sp-spin-hint">${i18n.t('pass.spinning') || 'Dönüyor...'}</div>
      </div>`;
    v.classList.remove('hidden');

    const track = v.querySelector('.sp-spin-track');
    strip.forEach((code, i) => {
      const cell = document.createElement('div');
      cell.className = 'sp-spin-item';
      cell.innerHTML = `<img alt="" src="${getFlagThumb(code, 100, 66)}"><span>${i18n.t('countries.' + code)}</span>`;
      track.appendChild(cell);
    });

    const centerOffset = (VISIBLE / 2 - 0.5) * ITEM_W;
    const targetX = -(winIdx * ITEM_W - centerOffset);
    track.style.transform = 'translateX(0)';
    track.style.transition = 'none';
    void track.offsetWidth;

    const duration = 4200 + Math.random() * 800;
    track.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.75, 0.18, 1)`;
    track.style.transform = `translateX(${targetX}px)`;

    // Dönüş sesi: her bayrak geçişinde tick, pitch 1.05 → 0.95'e yaklaşır
    clearInterval(this._spinTick);
    clearTimeout(this._spinTimer);
    const t0 = performance.now();
    let lastIdx = -1;
    this._spinTick = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / duration);
      // cubic-bezier yaklaşık ilerleme
      const eased = 1 - Math.pow(1 - p, 2.4);
      const x = targetX * eased;
      const idx = Math.round((-x + centerOffset) / ITEM_W);
      if (idx !== lastIdx && idx >= 0 && idx < total) {
        lastIdx = idx;
        // sonlara doğru pitch 0.95'e yaklaşır
        const pitch = 1.05 - p * 0.10 + (Math.random() * 0.04 - 0.02);
        sfx('crate_spin', 0.55 + (1 - p) * 0.25, Math.max(0.92, Math.min(1.08, pitch)));
      }
      if (p >= 1) clearInterval(this._spinTick);
    }, 30);

    const finish = () => {
      clearInterval(this._spinTick);
      const items = track.querySelectorAll('.sp-spin-item');
      items.forEach((el, i) => el.classList.toggle('landed', i === winIdx));
      // Nadirlik çıkış sesi
      const rarSfx = { rare: 'crate_rare', epic: 'crate_epic', legendary: 'crate_legendary', mystic: 'crate_legendary' };
      sfx(rarSfx[c.rarity] || 'crate_rare', 1);
      setTimeout(() => this.showRevealCard(c, v), 650);
    };
    track.addEventListener('transitionend', finish, { once: true });
    this._spinTimer = setTimeout(finish, duration + 200);
  }

  showRevealCard(c, v) {
    clearTimeout(this._spinTimer);
    const col = RARITY_COLOR[c.rarity];
    v.style.setProperty('--rc', col);
    v.innerHTML = `<div class="sp-rv-card"><div class="sp-rv-crate">${this.icon(c.tier)} ${i18n.t('pass.tier.' + c.tier)}</div>
      <img alt="" src="${getFlagThumb(c.flag, 240, 160)}">
      <div class="sp-rv-rar">${i18n.t('pass.rarity.' + c.rarity)}</div>
      <div class="sp-rv-name">${i18n.t('countries.' + c.flag)}</div>
      <div class="sp-rv-note">${c.dupe ? i18n.t('pass.dupe', { n: c.coins }) : i18n.t('pass.newFlag')}</div>
      <button class="mm-tbtn primary" type="button">${i18n.t('pass.ok')}</button></div>`;
    v.querySelector('button').addEventListener('click', () => this.hideReveal());
  }

  render() {
    const r = this.root, acc = net.account;
    if (!acc) { this.close(); return; }
    const st = passStatus(acc);
    r.querySelector('h2').textContent = i18n.t('pass.title');
    r.querySelector('.sp-season').textContent = `${i18n.t('pass.season', { n: st.season })} · ${i18n.t('pass.daysLeft', { n: st.daysLeft })}`;
    r.querySelector('.hp-coins').innerHTML = coinHtml(Number(acc.coins ?? 0));
    r.querySelector('.sp-xp i').style.width = Math.min(100, (st.xp / PASS.MAX_XP) * 100) + '%';
    r.querySelector('.sp-xp b').textContent = `${st.xp} / ${PASS.MAX_XP} XP · ${i18n.t('pass.bars', { a: st.reached, b: PASS.LEVELS })}`;
    r.querySelector('.pass-how').textContent = i18n.t('pass.how', { n: PASS.BAR_XP });
    const all = r.querySelector('.sp-all');
    all.textContent = st.claimable ? `${i18n.t('pass.claimAll')} (${st.claimable})` : i18n.t('pass.claimAll');
    all.disabled = !st.claimable;
    const tx = (k) => String(i18n.t(k) || '').replace(/</g, '&lt;');
    const names = { pass: icon('ticket') + tx('pass.tabPass'), crates: `${icon('crate')}${tx('pass.tabCrates')}${st.crates ? ` (${st.crates})` : ''}`, coll: icon('flag') + tx('pass.tabColl'), market: icon('scales') + (i18n.t('pass.tabMarket') || 'PAZAR') };
    r.querySelectorAll('.pass-tabs button').forEach((b) => { b.innerHTML = names[b.dataset.tab]; b.classList.toggle('on', b.dataset.tab === this.tab); });
    r.querySelectorAll('.pass-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === this.tab));

    // --- bar yolu (yatay, sağa doğru)
    const rail = r.querySelector('.pass-rail');
    const keep = this.track.scrollLeft;
    rail.innerHTML = '';
    let firstReady = 0;
    for (let L = 1; L <= PASS.LEVELS; L++) {
      const rw = passReward(L), done = st.claimed.includes(L), ready = !done && L <= st.reached;
      if (ready && !firstReady) firstReady = L;
      const step = document.createElement('div');
      step.className = 'pass-step' + (L <= st.reached ? ' reached' : '') + (L < st.reached ? ' thru' : '') + (L === st.reached + 1 ? ' next' : '');
      step.dataset.l = L;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sp-tile' + (done ? ' done' : ready ? ' ready' : ' lock') + (rw.crate ? ' crate' : '') + (rw.flag ? ' flag' : '');
      let ico, txt;
      if (rw.flag) {
        ico = `<img class="sp-art" alt="" src="${getFlagThumb(rw.flag, 48, 32)}" style="width:36px;height:24px;border-radius:3px">`;
        txt = i18n.t('countries.' + rw.flag);
      } else if (rw.crate) {
        ico = this.icon(rw.crate);
        txt = i18n.t('pass.tier.' + rw.crate);
      } else {
        ico = this.icon('coin');
        txt = `+${rw.coins}`;
      }
      b.innerHTML = `<span class="sp-ico">${ico}</span><span class="sp-txt">${txt}</span><em>${done ? '✔' : ready ? i18n.t('pass.claim') : `${L * PASS.BAR_XP} XP`}</em>`;
      if (ready) b.addEventListener('click', () => net.send({ t: 'passClaim', level: L }));
      else b.disabled = true;
      step.innerHTML = `<div class="pass-node"><i>${L}</i></div>`;
      step.appendChild(b);
      rail.appendChild(step);
    }
    // Açılışta odaklanılacak bar: alınabilir ilk ödül, yoksa ulaşılan bar (en az 1)
    this.focusLevel = firstReady || Math.max(1, Math.min(PASS.LEVELS, st.reached));
    const cur = rail.querySelector(`.pass-step[data-l="${Math.max(1, st.reached)}"] .pass-node`);
    if (cur && st.reached > 0) { cur.classList.add('cur'); cur.dataset.here = i18n.t('pass.here'); }
    this.track.scrollLeft = keep;
    this.updateArrows();

    // --- kasalar (aç + jetonla satın al)
    const cr = r.querySelector('.sp-crates'); cr.innerHTML = '';
    CRATE_TIERS.forEach((t) => {
      const n = (acc.crates && acc.crates[t]) || 0;
      const price = CRATE_PRICE[t] || 0;
      const canBuy = (acc.coins || 0) >= price;
      const odds = Object.entries(CRATE_ODDS[t]).map(([rr, w]) => `<span style="color:${RARITY_COLOR[rr]}">${i18n.t('pass.rarity.' + rr)} %${w}</span>`).join(' · ');
      const d = document.createElement('div');
      d.className = 'sp-crate' + (n ? ' has' : '');
      d.innerHTML = `<div class="sp-cico">${this.icon(t)}</div>
        <b>${i18n.t('pass.tier.' + t)} ×${n}</b>
        <small>${odds}</small>
        <div class="sp-crate-acts">
          <button class="mm-tbtn small primary sp-open" type="button">${i18n.t('pass.open')}</button>
          <button class="mm-tbtn small sp-buy" type="button" title="${i18n.t('pass.buyCrateHint') || ''}">${coinHtml(price)}</button>
        </div>`;
      const openBtn = d.querySelector('.sp-open');
      openBtn.disabled = !n;
      openBtn.addEventListener('click', () => { sfx('crate_click', 1); net.send({ t: 'crateOpen', tier: t }); });
      const buyBtn = d.querySelector('.sp-buy');
      buyBtn.disabled = !canBuy;
      buyBtn.addEventListener('click', () => net.send({ t: 'buyCrate', tier: t, n: 1 }));
      cr.appendChild(d);
    });

    // --- koleksiyon
    const owned = new Set(acc.flags || []);
    const coll = r.querySelector('.sp-coll'); coll.innerHTML = '';
    const ch = document.createElement('div'); ch.className = 'sp-coll-h';
    ch.textContent = `${i18n.t('pass.collection')} · ${HIST_FLAGS.filter((f) => owned.has(f)).length}/${HIST_FLAGS.length}`;
    coll.appendChild(ch);
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

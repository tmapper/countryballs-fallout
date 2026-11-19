// ============================================================
// MainMenu.js - Ana menü: nükleer sığınak terminali
// ============================================================
// Görünüm: arka planda radyoaktif reaktör salonu (görsel varsa assets/menu/menu_bg_reactor.jpg, yoksa kodla
// çizilen hafif sahne), önde duvara monte edilmiş yeşil fosforlu CRT terminal. Menü satırları
// terminal komutu gibi; ok tuşları + Enter ile de seçilir. Sağ üstte KİMLİK KARTI (hesap).
//   menu.show({ onOnline, onCreate, onSolo })   menu.hide()
// İsteğe bağlı görseller (yoksa kodla çizilir): assets/menu/menu_bg_reactor.jpg, assets/menu/logo.png
import { gameSettings } from './GameSettings.js';
import { social } from './Social.js';
import { exitGame } from '../systems/ExitGame.js';
import { shelterPass } from './ShelterPass.js';
import { market } from './Market.js';
import { suggest } from './Suggest.js';
import { achievementsPanel } from './AchievementsPanel.js';
import { questsPanel } from './QuestsPanel.js';
import { passStatus } from '../systems/Pass.js';
import { i18n } from '../systems/I18n.js';
import { net, Net } from '../systems/Net.js';
import { isMuted, toggleMute, sfx, setSfxVolume, setMusicVolume, getVolumes } from '../systems/Sound.js';
import { assetUrl } from '../systems/Assets.js';
import { getQuality, setQuality } from '../systems/Resolution.js';
import { perfHud } from '../systems/PerfHud.js';
import { icon, coinHtml } from './Icons.js';
import { modPanel } from './ModPanel.js';
import { titleName, xpPercent, winRate, nextTitle } from '../systems/Levels.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function loadOptional(path) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = assetUrl(path); });
}

const ITEMS = [
  { act: 'online', key: 'menu.play', icon: 'radiation' },
  { act: 'social', key: 'menu.social', icon: 'users' },
  { act: 'pass', key: 'menu.pass', icon: 'ticket' },
  { act: 'ach', key: 'menu.ach', icon: 'trophy' },
  { act: 'suggest', key: 'menu.suggest', icon: 'mail' },
  { act: 'solo', key: 'menu.solo', icon: 'robot' },
  { act: 'replays', key: 'menu.replays', icon: 'trophy' },
  { act: 'settings', key: 'menu.settings', icon: 'gear' },
  { act: 'exit', key: 'menu.exit', icon: 'power' }
];

export class MainMenu {
  constructor() { this.root = null; this.raf = 0; this.handlers = {}; this.sel = 0; this.authMode = 'login'; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'mainmenu hidden';
    r.innerHTML = `
      <canvas class="mm-scene"></canvas>
      <div class="mm-photo"></div>
      <div class="mm-vignette"></div>
      <div class="mm-ui">
        <header class="mm-top">
          <div class="mm-brand">
            <div class="mm-presents" data-t="menu.presents"></div>
            <img class="mm-logo hidden" alt="">
            <div class="mm-logotext"><div class="mm-kicker" data-t="menu.kicker"></div><h1 class="mm-title" data-t="menu.title"></h1></div>
          </div>
          <div class="mm-id">
            <div class="mm-id-head"><span>${icon('radiation')}</span><b data-t="menu.idCard"></b><i class="mm-id-no"></i></div>
            <div class="mm-id-body">
              <div class="mm-id-photo">?</div>
              <div class="mm-id-info"><div class="mm-id-name"></div><div class="mm-id-title"></div><div class="mm-id-level"></div><div class="mm-id-xp"><i></i></div></div>
            </div>
            <div class="mm-id-actions"></div>
          </div>
        </header>
        <section class="mm-terminal">
          <div class="mm-bezel">
            <span class="mm-screw tl"></span><span class="mm-screw tr"></span><span class="mm-screw bl"></span><span class="mm-screw br"></span>
            <div class="mm-plate">BUNKER-07 · TERMINAL</div>
            <div class="mm-crt">
              <div class="mm-crt-head"><span data-t="menu.termHead"></span><span class="mm-clock"></span></div>
              <div class="mm-crt-line mm-tagline" data-t="menu.tagline"></div>
              <nav class="mm-nav"></nav>
              <div class="mm-crt-status"><span class="mm-status"></span><span class="mm-geiger"></span></div>
            </div>
            <div class="mm-leds"><i class="g"></i><i class="y"></i><i class="r"></i></div>
          </div>
        </section>
        <footer class="mm-foot"><div class="mm-hazard"></div><span data-t="menu.version"></span><a class="mm-legal" href="legal/gizlilik.html" target="_blank" rel="noopener" data-t="menu.privacy"></a><a class="mm-legal" href="legal/kullanim.html" target="_blank" rel="noopener" data-t="menu.terms"></a><button class="mm-lang" type="button"></button></footer>
      </div>
      <div class="mm-modal hidden" data-m="auth"><div class="mm-card term">
        <h2 class="mm-auth-title"></h2>
        <label class="mm-field"><span data-t="menu.username"></span><input class="mm-user" maxlength="16" autocomplete="username" spellcheck="false"></label>
        <label class="mm-field"><span data-t="menu.password"></span><input class="mm-pass" type="password" maxlength="64" autocomplete="current-password"></label>
        <label class="mm-field mm-pass2-row"><span data-t="menu.password2"></span><input class="mm-pass2" type="password" maxlength="64" autocomplete="new-password"></label>
        <p class="mm-auth-err"></p>
        <p class="mm-legal-note"></p>
        <button class="mm-tbtn primary mm-auth-go" type="button"></button>
        <button class="mm-link mm-auth-switch" type="button"></button>
        <button class="mm-link mm-close" type="button" data-t="menu.back"></button>
      </div></div>
      <div class="mm-modal hidden" data-m="profile"><div class="mm-card term mm-profile-card"><div class="pf-body"></div><button class="mm-tbtn mm-close" type="button" data-t="menu.back"></button></div></div>
      <div class="mm-modal hidden" data-m="settings"><div class="mm-card term mm-settings-card">
        <h2 data-t="menu.settings"></h2>
        <div class="mm-row"><span data-t="menu.language"></span><button class="mm-chip mm-set-lang" type="button"></button></div>
        <div class="mm-row"><span data-t="menu.sound"></span><button class="mm-chip mm-set-sound" type="button"></button></div>
        <div class="mm-row"><span data-t="menu.sfxVol">Ses efektleri</span><input type="range" class="mm-slider mm-sfx-vol" min="0" max="100" value="80"></div>
        <div class="mm-row"><span data-t="menu.musicVol">Müzik</span><input type="range" class="mm-slider mm-music-vol" min="0" max="100" value="70"></div>
        <div class="mm-row"><span data-t="menu.graphics">Grafik</span>
          <select class="mm-select mm-graphics"><option value="high">Yüksek</option><option value="med">Orta</option><option value="low">Düşük</option></select>
        </div>
        <label class="mm-row"><span data-t="ui.showFps">FPS göster</span><input type="checkbox" class="mm-check mm-fps"></label>
        <label class="mm-field"><span data-t="menu.redeem">Kod</span>
          <div class="mm-redeem-row">
            <input class="mm-redeem" type="text" autocomplete="off" spellcheck="false" enterkeyhint="done">
            <button class="mm-tbtn primary mm-redeem-go" type="button" data-t="menu.redeemGo">Kullan</button>
          </div>
        </label>
        <p class="mm-hint mm-redeem-msg"></p>
        <button class="mm-tbtn primary mm-save" type="button" data-t="menu.save"></button>
      </div></div>
      <div class="mm-modal hidden" data-m="howto"><div class="mm-card term"><h2 data-t="menu.howto"></h2><p class="mm-howto"></p><button class="mm-tbtn mm-close" type="button" data-t="menu.back"></button></div></div>`;
    document.body.appendChild(r);
    this.canvas = r.querySelector('.mm-scene');
    const nav = r.querySelector('.mm-nav');
    ITEMS.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mm-item'; b.dataset.act = it.act; b.dataset.i = i;
      b.innerHTML = `<span class="mm-caret">&gt;</span><span class="mm-ico">${icon(it.icon)}</span><span class="mm-txt" data-t="${it.key}"></span><span class="mm-cursor">█</span>`;
      b.addEventListener('mouseenter', () => this.select(i));
      b.addEventListener('click', () => { this.select(i); this.act(it.act); });
      nav.appendChild(b);
    });
    // Kimlik kartına tıkla: girişliysen PROFİL (istatistikler), değilsen giriş
    r.querySelector('.mm-id-body').addEventListener('click', () => { if (net.account) this.openModal('profile'); else this.openAuth('login'); });
    net.on('matchReward', () => { this.renderAccount(); this.renderProfile(); });
    r.querySelector('.mm-lang').addEventListener('click', () => i18n.toggle());
    r.querySelector('.mm-set-lang').addEventListener('click', () => i18n.toggle());
    r.querySelector('.mm-set-sound').addEventListener('click', () => { toggleMute(); this.render(); });
    const loadVol = () => {
      try {
        const v = getVolumes();
        r.querySelector('.mm-sfx-vol').value = Math.round((v.sfx ?? 1) * 100);
        r.querySelector('.mm-music-vol').value = Math.round((v.music ?? 1) * 100);
        r.querySelector('.mm-graphics').value = getQuality();
        r.querySelector('.mm-fps').checked = perfHud.enabled;
      } catch (e) {}
    };
    loadVol();
    const applyVol = () => {
      const sv = Number(r.querySelector('.mm-sfx-vol').value) / 100;
      const mv = Number(r.querySelector('.mm-music-vol').value) / 100;
      try { localStorage.setItem('cfs.sfxVol', r.querySelector('.mm-sfx-vol').value); localStorage.setItem('cfs.musicVol', r.querySelector('.mm-music-vol').value); } catch (e) {}
      setSfxVolume(sv); setMusicVolume(mv);
    };
    r.querySelector('.mm-sfx-vol').addEventListener('input', applyVol);
    r.querySelector('.mm-music-vol').addEventListener('input', applyVol);
    r.querySelector('.mm-fps').addEventListener('change', (e) => perfHud.setEnabled(e.target.checked));
    r.querySelector('.mm-graphics').addEventListener('change', () => {
      setQuality(r.querySelector('.mm-graphics').value);   // HATA DÜZELTMESİ: eskiden sadece kaydediliyor, hiçbir şeyi değiştirmiyordu
    });
    const doRedeem = () => {
      const inp = r.querySelector('.mm-redeem');
      const el = r.querySelector('.mm-redeem-msg');
      const code = (inp && inp.value || '').trim();
      if (!code) { el.textContent = i18n.tf('menu.redeemEmpty', 'Kod gir'); return; }
      if (!net.account) { el.textContent = i18n.tf('shop.needLogin', 'Giriş yapmalısın'); return; }
      if (net.status !== 'online') {
        el.textContent = i18n.tf('menu.connecting', 'Sunucuya bağlanıyor...');
        net.connect();
        // bağlanınca tekrar dene
        const once = () => {
          if (net.status === 'online') {
            net.off('status', once);
            el.textContent = '...';
            (net.redeem ? net.redeem(code) : net.send({ t: 'redeem', code }));
          }
        };
        net.on('status', once);
        setTimeout(() => { try { net.off('status', once); } catch (e) {} }, 8000);
        return;
      }
      el.textContent = '...';
      if (net.redeem) net.redeem(code); else net.send({ t: 'redeem', code });
    };
    r.querySelector('.mm-redeem-go').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); doRedeem(); });
    r.querySelector('.mm-redeem').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); doRedeem(); }
    });
    net.on('account', () => {
      this.renderAccount();
      if (!r.querySelector('[data-m="profile"]').classList.contains('hidden')) this.renderProfile();
    });
    net.on('redeem', (m) => {
      const el = r.querySelector('.mm-redeem-msg');
      if (!el) return;
      if (m.ok) {
        el.innerHTML = esc(i18n.tf('menu.redeemOk', 'Kod kabul edildi!')) + ' +' + coinHtml(Number(m.coins) || 0);
        r.querySelector('.mm-redeem').value = '';
        if (m.account) net.account = m.account;
        this.renderAccount();
      } else {
        const err = m.err === 'used' ? (i18n.tf('menu.redeemUsed', 'Bu kod zaten kullanıldı'))
          : m.err === 'login' ? (i18n.tf('shop.needLogin', 'Giriş yapmalısın'))
          : m.err === 'error' ? 'Sunucu hatası'
          : (i18n.tf('menu.redeemFail', 'Geçersiz kod'));
        el.textContent = err;
      }
    });
    r.querySelector('.mm-save').addEventListener('click', () => { this.closeModal(); });
    r.querySelectorAll('.mm-close').forEach((b) => b.addEventListener('click', () => this.closeModal()));
    r.querySelectorAll('.mm-modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) this.closeModal(); }));
    r.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && i.closest('[data-m="auth"]')) this.submitAuth(); }));
    r.querySelector('.mm-auth-go').addEventListener('click', () => this.submitAuth());
    r.querySelector('.mm-auth-switch').addEventListener('click', () => { this.authMode = this.authMode === 'login' ? 'register' : 'login'; this.renderAuth(); });
    // Klavye: yukarı/aşağı + Enter
    this.onKey = (e) => {
      if (!this.root || this.root.classList.contains('hidden')) return;
      if ([...this.root.querySelectorAll('.mm-modal')].some((m) => !m.classList.contains('hidden'))) { if (e.key === 'Escape') this.closeModal(); return; }
      if (e.key === 'ArrowDown' || e.key === 's') { this.select((this.sel + 1) % ITEMS.length); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'w') { this.select((this.sel + ITEMS.length - 1) % ITEMS.length); e.preventDefault(); }
      else if (e.key === 'Enter') this.act(ITEMS[this.sel].act);
    };
    window.addEventListener('keydown', this.onKey);
    i18n.onChange(() => this.render());
    net.on('status', () => this.renderStatus());
    net.on('list', (m) => { this.onlineCount = m.online; this.renderStatus(); });
    net.on('account', () => { this.renderAccount(); if (net.account && this.authPending) { const fn = this.authPending; this.authPending = null; this.closeModal(); fn(); } else if (net.account) this.closeModal(); });
    net.on('authError', (m) => { if (!m.silent) { const e = this.root.querySelector('.mm-auth-err'); e.textContent = i18n.t('menu.authErr.' + m.code); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); } });
    // İsteğe bağlı görseller
    loadOptional('assets/menu/menu_bg_reactor.jpg').then((im) => { if (im) { this.hasPhoto = true; r.querySelector('.mm-photo').style.backgroundImage = `url("${im.src}")`; r.classList.add('photo'); } });
    loadOptional('assets/menu/logo.png').then((im) => { if (im) { const l = r.querySelector('.mm-logo'); l.src = im.src; l.classList.remove('hidden'); r.querySelector('.mm-logotext').classList.add('hidden'); } });
    modPanel.attach(this);   // sol üst: ŞİFRE GİR / MODERATÖR
  }

  select(i) {
    if (i !== this.sel) sfx('ui_click', 0.35);
    this.sel = i;
    this.root.querySelectorAll('.mm-item').forEach((b, k) => b.classList.toggle('sel', k === i));
  }

  // Alınabilir bilet ödülü + açılmamış kasa sayısı menüde rozet olarak görünür
  updatePassBadge() {
    const b = this.root && this.root.querySelector('.mm-item[data-act="pass"] .mm-txt');
    if (!b) return;
    const st = net.account ? passStatus(net.account) : null;
    const n = st ? st.claimable + st.crates : 0;
    b.dataset.badge = n > 0 ? String(n) : '';
  }

  setSocialBadge(n) {
    const b = this.root && this.root.querySelector('.mm-item[data-act="social"] .mm-txt');
    if (b) b.dataset.badge = n > 0 ? String(n) : '';
  }

  act(a) {
    if (a === 'settings') { gameSettings.open({}); return; }   // her yerde AYNI ayarlar penceresi (ui/GameSettings.js)
    if (a === 'howto') { this.openModal('howto'); return; }
    if (a === 'exit') { exitGame(); return; }
    if (a === 'pass') {
      const open = () => shelterPass.open();
      if (!net.account) { this.authPending = open; this.openAuth('login'); return; }
      open(); return;
    }
    if (a === 'social') {
      const open = () => { net.connect(); social.open('friends'); };
      if (!net.account) { this.authPending = open; this.openAuth('login'); return; }
      open(); return;
    }
    if (a === 'market') {
      const open = () => { net.connect(); market.open(); };
      if (!net.account) { this.authPending = open; this.openAuth('login'); return; }
      open(); return;
    }
    if (a === 'suggest') {
      suggest.open();
      return;
    }
    if (a === 'ach') {
      const open = () => achievementsPanel.open();
      if (!net.account) { this.authPending = open; this.openAuth('login'); return; }
      open(); return;
    }
    if (a === 'tutorial') {
      this.openModal('howto');
      const how = this.root.querySelector('.mm-howto');
      if (how) how.innerHTML = i18n.tf('menu.tutorialText', i18n.tf('menu.howtoText', '')).replace(/\n/g, '<br>');
      return;
    }
    if (a === 'replays') {
      import('./ReplaysPanel.js').then((m) => m.replaysPanel.show());
      return;
    }
    const fn = { online: this.handlers.onOnline, create: this.handlers.onCreate, solo: this.handlers.onSolo }[a];
    if (!fn) return;
    // Çevrimiçi oyun için hesap gerekli
    if ((a === 'online' || a === 'create') && !net.account) { this.authPending = fn; this.openAuth('login'); return; }
    fn();
  }

  openAuth(mode) { this.authMode = mode; this.openModal('auth'); this.renderAuth(); setTimeout(() => this.root.querySelector('.mm-user').focus(), 50); }

  submitAuth() {
    const r = this.root, u = r.querySelector('.mm-user').value.trim(), p = r.querySelector('.mm-pass').value, p2 = r.querySelector('.mm-pass2').value;
    const err = r.querySelector('.mm-auth-err');
    if (this.authMode === 'register' && p !== p2) { err.textContent = i18n.t('menu.authErr.mismatch'); return; }
    if (net.status !== 'online') net.connect();
    err.textContent = i18n.t('menu.connecting');
    if (this.authMode === 'register') net.register(u, p); else net.login(u, p);
  }

  renderAuth() {
    const r = this.root, reg = this.authMode === 'register';
    r.querySelector('.mm-auth-title').textContent = i18n.t(reg ? 'menu.register' : 'menu.login');
    r.querySelector('.mm-auth-go').textContent = i18n.t(reg ? 'menu.registerBtn' : 'menu.loginBtn');
    r.querySelector('.mm-auth-switch').textContent = i18n.t(reg ? 'menu.haveAccount' : 'menu.noAccount');
    r.querySelector('.mm-pass2-row').classList.toggle('hidden', !reg);
    r.querySelector('.mm-auth-err').textContent = reg ? i18n.t('menu.nameRules') : '';
    // Kayıt olurken: şartlar + gizlilik bağlantıları (yeni sekmede)
    const note = r.querySelector('.mm-legal-note');
    note.classList.toggle('hidden', !reg);
    note.innerHTML = i18n.t('menu.legalNote', { terms: `<a href="legal/kullanim.html" target="_blank" rel="noopener">${i18n.t('menu.terms')}</a>`, privacy: `<a href="legal/gizlilik.html" target="_blank" rel="noopener">${i18n.t('menu.privacy')}</a>` });
  }

  renderAccount() {
    const r = this.root;
    if (!r) return;
    modPanel.refresh();
    const a = net.account;
    r.querySelector('.mm-id').classList.toggle('guest', !a);
    r.querySelector('.mm-id-name').textContent = a ? a.name : i18n.t('menu.guest');
    const photo = r.querySelector('.mm-id-photo');
    let av = '';
    try { av = localStorage.getItem('cfs.avatar') || ''; } catch (e) {}
    if (a && av) { photo.innerHTML = `<img class="pf-avatar-img" src="${av}" alt="">`; }
    else { photo.textContent = a ? a.name.slice(0, 1).toUpperCase() : '?'; }
    r.querySelector('.mm-id-title').innerHTML = a ? esc(titleName(a.title)) + (a.admin ? ` · <span class="mm-adm">${esc(i18n.t('profile.admin'))}</span>` : '') : '';
    this.updatePassBadge();
    r.querySelector('.mm-id-level').innerHTML = a ? `${i18n.t('menu.level', { n: a.level })} · <img class="mm-coin ic-coin" src="${assetUrl('assets/menu/coin.png?v=2')}" alt="" width="16" height="16"> ${a.coins ?? 0}` : i18n.t('menu.guestHint');
    r.querySelector('.mm-id-xp i').style.width = xpPercent(a) + '%';
    r.querySelector('.mm-id-no').textContent = a ? '#' + String(Math.abs(a.created || 0) % 100000).padStart(5, '0') : '';
    const act = r.querySelector('.mm-id-actions');
    act.innerHTML = a ? `<button class="mm-link" type="button" data-a="logout">${esc(i18n.t('menu.logout'))}</button>`
      : `<button class="mm-tbtn small" type="button" data-a="login">${esc(i18n.t('menu.login'))}</button><button class="mm-tbtn small primary" type="button" data-a="register">${esc(i18n.t('menu.register'))}</button>`;
    act.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.a === 'logout') { net.logout(); this.renderAccount(); } else this.openAuth(b.dataset.a); }));
  }

  // Profil penceresi: seviye, XP çubuğu, maç istatistikleri (hepsi sunucudan gelen net.account'tan)
  renderProfile() {
    const r = this.root;
    if (!r) return;
    const box = r.querySelector('.pf-body');
    const a = net.account;
    if (!a) { box.innerHTML = `<p class="pf-guest">${esc(i18n.t('profile.guest'))}</p>`; return; }
    const st = a.stats || {}, wr = winRate(st), T = (k) => esc(i18n.t('profile.' + k));
    const cell = (k, v, cls = '') => `<div class="pf-stat ${cls}"><b>${v}</b><span>${T(k)}</span></div>`;
    const nt = nextTitle(a);
    box.innerHTML = `
      <h2>${T('title')}</h2>
      <div class="pf-head">
        <div class="pf-photo">${this.avatarHtml(a.name)}</div>
        <div class="pf-meta">
          <div class="pf-name">${esc(a.name)}</div>
          <div class="pf-title">${esc(titleName(a.title))}${a.admin ? ' · ADMIN' : ''}</div>
          <div class="pf-coins"><img class="mm-coin ic-coin" src="${assetUrl('assets/menu/coin.png?v=2')}" alt="" width="16" height="16"> ${a.coins ?? 0}</div>
        </div>
        <div class="pf-lvl"><b>${a.level}</b><span>LVL</span></div>
      </div>
      <div class="pf-xp"><i style="width:${xpPercent(a)}%"></i></div>
      <div class="pf-xptext">${a.level >= 100 ? esc(i18n.t('levels.max')) : esc(i18n.t('levels.xpText', { a: a.xpInto, b: a.xpNeed }))}</div>
      <div class="pf-edit">
        <label>${esc(i18n.tf('profile.photo', 'Profil fotoğrafı'))}</label>
        <div class="pf-edit-row">
          <input type="file" accept="image/*" class="pf-photo-file" hidden>
          <button type="button" class="mm-tbtn small pf-photo-btn">${esc(i18n.tf('profile.pickPhoto', 'Fotoğraf seç'))}</button>
          <button type="button" class="mm-tbtn small pf-photo-clear">${esc(i18n.tf('profile.clearPhoto', 'Kaldır'))}</button>
        </div>
        <p class="pf-edit-msg mm-hint">${esc(i18n.tf('profile.photoHint', 'Sadece bu cihazda görünür'))}</p>
      </div>
      <div class="pf-grid">
        ${cell('played', st.played || 0)}${cell('wins', st.wins || 0, 'hi')}${cell('losses', st.losses || 0, 'lo')}
        ${cell('winrate', wr === null ? '—' : wr + '%')}${cell('streak', st.streak || 0)}${cell('bestStreak', st.bestStreak || 0)}
      </div>
      <div class="pf-sub">${T('roles')}</div>
      <div class="pf-grid">
        ${cell('asImpostor', st.asImpostor || 0)}${cell('asSheriff', st.asSheriff || 0)}${cell('asCrew', st.asCrew || 0)}
        ${cell('winsCrew', st.winsCrew || 0)}${cell('winsImpostor', st.winsImpostor || 0)}${cell('tasks', st.tasks || 0)}
        ${cell('kills', st.kills || 0)}
      </div>`;
    const file = box.querySelector('.pf-photo-file');
    const btn = box.querySelector('.pf-photo-btn');
    const clr = box.querySelector('.pf-photo-clear');
    if (btn && file) btn.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 800000) { box.querySelector('.pf-edit-msg').textContent = i18n.tf('profile.photoBig', 'Dosya çok büyük (max ~800KB)'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try { localStorage.setItem('cfs.avatar', reader.result); } catch (e) { box.querySelector('.pf-edit-msg').textContent = 'Kayıt başarısız'; return; }
        this.renderProfile();
        this.renderAccount();
      };
      reader.readAsDataURL(f);
    });
    if (clr) clr.addEventListener('click', () => { try { localStorage.removeItem('cfs.avatar'); } catch (e) {} this.renderProfile(); this.renderAccount(); });
  }

  avatarHtml(name) {
    let av = '';
    try { av = localStorage.getItem('cfs.avatar') || ''; } catch (e) {}
    if (av) return `<img class="pf-avatar-img" src="${av}" alt="">`;
    return esc((name || '?').slice(0, 1).toUpperCase());
  }

  openModal(m) { this.closeModal(); this.root.querySelector(`.mm-modal[data-m="${m}"]`).classList.remove('hidden'); if (m === 'profile') this.renderProfile(); this.render(); }
  closeModal() { this.root.querySelectorAll('.mm-modal').forEach((x) => x.classList.add('hidden')); }

  render() {
    const r = this.root;
    if (!r) return;
    document.documentElement.lang = i18n.lang;
    r.querySelectorAll('[data-t]').forEach((n) => { n.textContent = i18n.t(n.dataset.t); });
    r.querySelector('.mm-lang').textContent = i18n.t('ui.languageName');
    r.querySelector('.mm-set-lang').textContent = i18n.t('ui.languageName');
    r.querySelector('.mm-set-sound').textContent = i18n.t(isMuted() ? 'menu.soundOff' : 'menu.soundOn');
    r.querySelector('.mm-howto').textContent = i18n.t('menu.howtoText');
    if (!r.querySelector('[data-m="auth"]').classList.contains('hidden')) this.renderAuth();
    this.renderAccount();
    if (!r.querySelector('[data-m="profile"]').classList.contains('hidden')) this.renderProfile();
    this.renderStatus();
  }

  renderStatus() {
    if (!this.root) return;
    const s = net.status;
    const el = this.root.querySelector('.mm-status');
    el.dataset.s = s;
    el.textContent = s === 'online' ? i18n.t('menu.online', { n: this.onlineCount || 1 }) : s === 'connecting' ? i18n.t('menu.connecting') : s === 'noServer' ? i18n.t('menu.noServer') : i18n.t('menu.offline');
  }

  show(handlers) {
    try { questsPanel.show(); } catch (e) { /* yoksay */ }

    if (!this.root) this.build();
    this.handlers = handlers || this.handlers;
    const r = this.root;
        r.classList.remove('hidden', 'leaving');
    // Uzun giriş animasyonu sadece ilk açılışta; menüye geri dönünce hemen görünsün
    r.classList.remove('intro');
    if (!this.introDone) { void r.offsetWidth; r.classList.add('intro'); this.introDone = true; }
    this.closeModal();
    this.select(this.sel);
    this.render();
    net.connect();
    net.list();
    clearInterval(this.pollT);
    this.pollT = setInterval(() => net.list(), 8000);
    // Saat + Geiger sayacı (saniyede 2 kez, çok hafif)
    clearInterval(this.tickT);
    const clock = r.querySelector('.mm-clock'), geiger = r.querySelector('.mm-geiger');
    this.tickT = setInterval(() => {
      const d = new Date();
      clock.textContent = d.toTimeString().slice(0, 8);
      geiger.textContent = '☢ ' + (0.12 + Math.random() * 0.09).toFixed(2) + ' mSv/h';
    }, 500);
    if (!this.hasPhoto) this.startScene();
  }

  hide() {
    try { questsPanel.hide(); } catch (e) { /* yoksay */ }

    if (!this.root || this.root.classList.contains('hidden')) return;
    clearInterval(this.pollT); clearInterval(this.tickT);
    this.root.classList.add('leaving');
    setTimeout(() => { this.root.classList.add('hidden'); this.root.classList.remove('leaving'); cancelAnimationFrame(this.raf); this.raf = 0; }, 450);
  }


  // ---------------- Sinematik sahne: radyoaktif reaktör sığınağı (hafif) ----------------
  // Ağır parçalar (salon, reaktör gövdesi, ışık/sis lekeleri) ekran boyutu değişince BİR KEZ
  // çizilir; her karede sadece çekirdek parıltısı, kabarcıklar, buhar, uyarı ışıkları ve
  // parçacıklar eklenir. Kare hızı 30 ile sınırlı, sekme görünmüyorsa hiç çizilmez.
  buildLayers(W, H, fx = 0.665) {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
    const lerp = (a, b, k) => a + (b - a) * k;
    const u = Math.min(W, H), lw = Math.max(2, u * 0.0042), ink = '#061010';
    const L = { W, H };

    // ---- yerleşim ----
    // fx: reaktörün yatay konumu (terminal sağdaysa reaktör sola alınır)
    const bx1 = W * (fx - 0.265), bx2 = W * (fx + 0.265), by1 = H * 0.12, by2 = H * 0.70;   // arka duvar
    const rect = (k) => ({ x1: lerp(0, bx1, k), y1: lerp(0, by1, k), x2: lerp(W, bx2, k), y2: lerp(H, by2, k) });
    const cx = (bx1 + bx2) / 2, fy = H * 0.86;                              // reaktör ekseni + zemin
    const R = Math.min(W * 0.115, H * 0.2), r = R * 0.6, e = r * 0.28;
    const topY = H * 0.17, gy1 = H * 0.30, gy2 = fy - R * 0.78;
    Object.assign(L, { cx, fy, R, r, e, topY, gy1, gy2, bx1, bx2, by1, by2 });

    const poly = (c, pts, fill, stroke = ink, w = lw) => {
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); }
    };
    const trefoil = (c, x, y, s, bg = '#e8b923', fg = '#141414') => {
      c.fillStyle = bg; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); c.strokeStyle = ink; c.lineWidth = lw; c.stroke();
      c.fillStyle = fg;
      [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6].forEach((a) => { c.beginPath(); c.arc(x, y, s * 0.82, a - 0.52, a + 0.52); c.arc(x, y, s * 0.24, a + 0.52, a - 0.52, true); c.closePath(); c.fill(); });
      c.beginPath(); c.arc(x, y, s * 0.14, 0, 7); c.fill();
    };
    const metal = (c, x1, x2, dark = 0) => {
      const g = c.createLinearGradient(x1, 0, x2, 0);
      const t = dark ? ['#1a2322', '#3f4c4a', '#2a3534', '#0e1414'] : ['#26312f', '#6d7c78', '#41504d', '#141b1b'];
      g.addColorStop(0, t[0]); g.addColorStop(0.28, t[1]); g.addColorStop(0.5, t[2]); g.addColorStop(1, t[3]); return g;
    };
    // önden görünen silindir (üst elips + gövde + alt yay)
    const cyl = (c, x, yT, yB, rad, dark = 0, top = true) => {
      const ee = rad * 0.28;
      c.beginPath(); c.moveTo(x - rad, yT); c.lineTo(x - rad, yB); c.ellipse(x, yB, rad, ee, 0, Math.PI, 0, true); c.lineTo(x + rad, yT); c.ellipse(x, yT, rad, ee, 0, 0, Math.PI, true); c.closePath();
      c.fillStyle = metal(c, x - rad, x + rad, dark); c.fill(); c.strokeStyle = ink; c.lineWidth = lw; c.stroke();
      if (top) { c.beginPath(); c.ellipse(x, yT, rad, ee, 0, 0, 7); c.fillStyle = dark ? '#2c3836' : '#55635f'; c.fill(); c.stroke(); }
    };
    const rivets = (c, x, y, rad, n) => {
      c.fillStyle = '#9fb0aa';
      for (let i = 0; i < n; i++) { const a = Math.PI * (i + 0.5) / n; c.beginPath(); c.arc(x - Math.cos(a) * rad * 0.92, y + Math.sin(a) * rad * 0.26, Math.max(1.5, rad * 0.035), 0, 7); c.fill(); }
    };
    const pipe = (c, pts, w, col = '#3c4a47', hi = '#7d8f8a') => {
      const path = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
      c.lineCap = 'round'; c.lineJoin = 'round';
      path(); c.strokeStyle = ink; c.lineWidth = w + lw * 2; c.stroke();
      path(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
      c.save(); c.translate(-w * 0.18, -w * 0.18); path(); c.strokeStyle = hi; c.lineWidth = w * 0.22; c.globalAlpha = 0.6; c.stroke(); c.restore();
    };
    const hazardClip = (c, pts, step) => {
      c.save(); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      c.fillStyle = '#d9a91c'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#151515'; c.lineWidth = step * 0.5;
      for (let x = -H; x < W + H; x += step) { c.beginPath(); c.moveTo(x, H); c.lineTo(x + H * 0.9, 0); c.stroke(); }
      c.restore(); poly(c, pts, null);
    };

    // ================= SALON (arka plan) =================
    L.bg = mk(W, H); let c = L.bg.getContext('2d');
    c.fillStyle = '#071010'; c.fillRect(0, 0, W, H);
    // tavan, zemin, yan duvarlar, arka duvar
    let g = c.createLinearGradient(0, 0, 0, by1); g.addColorStop(0, '#0a1514'); g.addColorStop(1, '#13221f');
    poly(c, [[0, 0], [W, 0], [bx2, by1], [bx1, by1]], g);
    g = c.createLinearGradient(0, by2, 0, H); g.addColorStop(0, '#1b2e2a'); g.addColorStop(1, '#0d1918');
    poly(c, [[0, H], [W, H], [bx2, by2], [bx1, by2]], g);
    g = c.createLinearGradient(0, 0, bx1, 0); g.addColorStop(0, '#0b1615'); g.addColorStop(1, '#172825');
    poly(c, [[0, 0], [bx1, by1], [bx1, by2], [0, H]], g);
    g = c.createLinearGradient(W, 0, bx2, 0); g.addColorStop(0, '#0c1716'); g.addColorStop(1, '#1a2c29');
    poly(c, [[W, 0], [bx2, by1], [bx2, by2], [W, H]], g);
    g = c.createLinearGradient(0, by1, 0, by2); g.addColorStop(0, '#1d302c'); g.addColorStop(1, '#223833');
    poly(c, [[bx1, by1], [bx2, by1], [bx2, by2], [bx1, by2]], g);
    // arka duvar beton panelleri
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = lw * 0.6;
    for (let i = 1; i < 6; i++) { const x = lerp(bx1, bx2, i / 6); c.beginPath(); c.moveTo(x, by1); c.lineTo(x, by2); c.stroke(); }
    for (let j = 1; j < 4; j++) { const y = lerp(by1, by2, j / 4); c.beginPath(); c.moveTo(bx1, y); c.lineTo(bx2, y); c.stroke(); }
    // tavan kirişleri + yan duvar kolonları (perspektif)
    [0.12, 0.38, 0.6, 0.8].forEach((k) => {
      const a = rect(k), b = rect(k + 0.05);
      poly(c, [[a.x1, a.y1], [a.x2, a.y1], [b.x2, b.y1], [b.x1, b.y1]], '#1c2c29');
      poly(c, [[a.x1, a.y1], [b.x1, b.y1], [b.x1, b.y2], [a.x1, a.y2]], '#1f312d');
      poly(c, [[a.x2, a.y1], [b.x2, b.y1], [b.x2, b.y2], [a.x2, a.y2]], '#22352f');
    });
    // yan duvar boruları (uzaklaştıkça incelir)
    const wallPipe = (side, f, w0, col) => {
      const a = rect(0), b = rect(1), x0 = side ? a.x2 : a.x1, x1 = side ? b.x2 : b.x1;
      const y0 = lerp(a.y1, a.y2, f), y1 = lerp(b.y1, b.y2, f), w1 = w0 * (b.y2 - b.y1) / (a.y2 - a.y1);
      poly(c, [[x0, y0 - w0], [x1, y1 - w1], [x1, y1 + w1], [x0, y0 + w0]], col);
      c.strokeStyle = 'rgba(200,230,220,.25)'; c.lineWidth = Math.max(1, lw * 0.6); c.beginPath(); c.moveTo(x0, y0 - w0 * 0.45); c.lineTo(x1, y1 - w1 * 0.45); c.stroke();
    };
    wallPipe(1, 0.2, u * 0.022, '#34433f'); wallPipe(1, 0.27, u * 0.013, '#5a3f22'); wallPipe(1, 0.62, u * 0.018, '#34433f');
    wallPipe(0, 0.22, u * 0.018, '#2c3a37'); wallPipe(0, 0.3, u * 0.01, '#2c3a37');
    // zemin şeritleri (sarı-siyah)
    const fl = (k, s) => { const q = rect(k); return [lerp(q.x1, q.x2, s), q.y2]; };
    hazardClip(c, [fl(0, 0.17), fl(0, 0.2), fl(1, 0.2), fl(1, 0.17)], u * 0.05);
    hazardClip(c, [fl(0, 0.94), fl(0, 0.97), fl(1, 0.97), fl(1, 0.94)], u * 0.05);
    // zemindeki çatlaklar / su birikintisi
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = lw * 0.7;
    [[0.3, 0.92, 0.36, 0.95, 0.42, 0.93], [0.8, 0.97, 0.86, 0.94, 0.9, 0.96]].forEach(([a, b, d, e2, f2, h2]) => { c.beginPath(); c.moveTo(W * a, H * b); c.lineTo(W * d, H * e2); c.lineTo(W * f2, H * h2); c.stroke(); });
    // arka duvar: uyarı tabelaları + kontrol konsolları
    const sign = (x, y, s) => { poly(c, [[x - s, y - s * 1.1], [x + s, y - s * 1.1], [x + s, y + s * 1.1], [x - s, y + s * 1.1]], '#1a1a14'); trefoil(c, x, y, s * 0.78); };
    sign(lerp(bx1, bx2, 0.12), lerp(by1, by2, 0.3), u * 0.04);
    sign(lerp(bx1, bx2, 0.88), lerp(by1, by2, 0.3), u * 0.04);
    L.panels = [];
    [0.06, 0.78].forEach((f) => {
      const x = lerp(bx1, bx2, f), y = lerp(by1, by2, 0.6), w = (bx2 - bx1) * 0.16, h = (by2 - by1) * 0.3;
      poly(c, [[x, y], [x + w, y], [x + w, by2], [x, by2]], '#2b3a37');
      poly(c, [[x + w * 0.1, y + h * 0.12], [x + w * 0.9, y + h * 0.12], [x + w * 0.9, y + h * 0.5], [x + w * 0.1, y + h * 0.5]], '#0a1a12');
      L.panels.push({ x: x + w * 0.1, y: y + h * 0.12, w: w * 0.8, h: h * 0.38, lx: x + w * 0.15, ly: y + h * 0.68, lw: w * 0.7 });
    });
    // tavan lambaları
    L.lamps = [];
    [0.22, 0.5].forEach((k) => { const q = rect(k); [0.2, 0.8].forEach((s) => { const x = lerp(q.x1, q.x2, s), y = q.y1 + (1 - k) * u * 0.02, w = u * 0.05 * (1 - k * 0.6);
      pipe(c, [[x, q.y1 - u * 0.02], [x, y]], Math.max(2, w * 0.08));
      poly(c, [[x - w * 0.35, y], [x + w * 0.35, y], [x + w * 0.6, y + w * 0.35], [x - w * 0.6, y + w * 0.35]], '#3b4a46');
      L.lamps.push([x, y + w * 0.35, w]); }); });
    // asma köprü korkuluğu (arka duvar boyunca)
    const cy0 = lerp(by1, by2, 0.47);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(bx1, cy0 + u * 0.012, bx2 - bx1, u * 0.012);
    c.strokeStyle = '#34443f'; c.lineWidth = Math.max(2, lw * 0.9);
    c.beginPath(); c.moveTo(bx1, cy0); c.lineTo(bx2, cy0); c.moveTo(bx1, cy0 - u * 0.035); c.lineTo(bx2, cy0 - u * 0.035); c.stroke();
    for (let i = 0; i <= 18; i++) { const x = lerp(bx1, bx2, i / 18); c.beginPath(); c.moveTo(x, cy0 - u * 0.035); c.lineTo(x, cy0 + u * 0.012); c.stroke(); }
    // tavandan sarkan kablolar
    c.lineCap = 'round';
    [[0.08, 0.32, 0.09], [0.28, 0.55, 0.06], [0.62, 0.9, 0.08], [0.75, 0.97, 0.05]].forEach(([a, b, sag], i) => {
      const q1 = rect(0.05), x0 = lerp(q1.x1, q1.x2, a), x1 = lerp(q1.x1, q1.x2, b), y0 = q1.y1 + u * 0.01;
      c.strokeStyle = i % 2 ? '#141b1a' : '#0d1312'; c.lineWidth = Math.max(2, u * (0.006 - i * 0.0008));
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, y0 + H * sag * 2, x1, y0); c.stroke();
    });
    c.lineCap = 'butt';
    // köşelerde karanlık (derinlik)
    g = c.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.3, cx, H * 0.5, Math.max(W, H) * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // menünün olduğu taraf: yazılar okunsun diye daha karanlık
    if (fx > 0.5) { g = c.createLinearGradient(0, 0, W * 0.45, 0); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W * 0.45, H); }

    // ================= REAKTÖR GÖVDESİ =================
    L.shell = mk(W, H); c = L.shell.getContext('2d');
    // tavana çıkan borular (kubbenin arkasında)
    pipe(c, [[cx - R * 0.45, topY], [cx - R * 0.45, topY - R * 0.4], [cx - R * 1.3, by1 * 0.6], [cx - R * 1.3, -10]], R * 0.14);
    pipe(c, [[cx + R * 0.45, topY], [cx + R * 0.45, topY - R * 0.5], [cx + R * 1.1, by1 * 0.5], [cx + R * 1.1, -10]], R * 0.14);
    pipe(c, [[cx, topY - R * 0.3], [cx, -10]], R * 0.2);
    // platform: sarı-siyah halka + basamak
    const pr = R * 1.75, pe = pr * 0.22;
    c.beginPath(); c.ellipse(cx, fy + R * 0.05, pr * 1.06, pe * 1.15, 0, 0, 7); c.fillStyle = 'rgba(0,0,0,.5)'; c.fill();
    c.lineWidth = pe * 0.35; c.lineCap = 'butt';
    for (let i = 0; i < 40; i++) { c.strokeStyle = i % 2 ? '#151515' : '#d9a91c'; c.beginPath(); c.ellipse(cx, fy, pr * 0.95, pe * 0.86, 0, (i / 40) * 6.283, ((i + 1) / 40) * 6.283); c.stroke(); }
    c.beginPath(); c.ellipse(cx, fy, pr * 1.02, pe * 1.02, 0, 0, 7); c.strokeStyle = ink; c.lineWidth = lw; c.stroke();
    cyl(c, cx, fy - R * 0.18, fy - R * 0.05, pr * 0.78, 1);
    // yan destek payandaları
    [-1, 1].forEach((sd) => { pipe(c, [[cx + sd * pr * 0.7, fy - R * 0.12], [cx + sd * R * 0.98, gy2 - R * 0.1]], R * 0.1, '#2f3c3a'); });
    // alt gövde
    cyl(c, cx, gy2 + R * 0.05, fy - R * 0.2, R * 0.92);
    rivets(c, cx, gy2 + R * 0.25, R * 0.92, 12); rivets(c, cx, fy - R * 0.32, R * 0.92, 12);
    trefoil(c, cx, (gy2 + fy) / 2 - R * 0.02, R * 0.2);
    // yan bağlantı (yeşil sıvı tüpleri: içi canlı çizilir)
    L.tubes = [
      [[cx - R * 0.9, fy - R * 0.45], [cx - R * 1.6, fy - R * 0.45], [cx - R * 1.6, by2 - R * 0.1], [bx1 + (bx2 - bx1) * 0.06, by2 - R * 0.1]],
      [[cx + R * 0.9, fy - R * 0.45], [cx + R * 1.55, fy - R * 0.45], [cx + R * 1.55, by2 - R * 0.25], [bx2 - (bx2 - bx1) * 0.05, by2 - R * 0.25]],
    ];
    L.tubeW = R * 0.12;
    // cam hazne çerçevesi (iç kısım boş: çekirdek alttan görünür)
    c.strokeStyle = ink; c.lineWidth = lw * 1.2;
    c.beginPath(); c.moveTo(cx - r, gy1); c.lineTo(cx - r, gy2); c.moveTo(cx + r, gy1); c.lineTo(cx + r, gy2); c.stroke();
    // cam parlamaları
    c.globalAlpha = 0.22; c.fillStyle = '#e9fff2';
    c.fillRect(cx - r * 0.78, gy1 + r * 0.2, r * 0.12, gy2 - gy1 - r * 0.4);
    c.globalAlpha = 0.12; c.fillRect(cx - r * 0.55, gy1 + r * 0.2, r * 0.05, gy2 - gy1 - r * 0.4);
    c.fillRect(cx + r * 0.6, gy1 + r * 0.3, r * 0.08, gy2 - gy1 - r * 0.6);
    c.globalAlpha = 1;
    // cam etrafındaki dikey kafes çubukları
    [-0.98, 0.98].forEach((f) => { pipe(c, [[cx + r * f, gy1], [cx + r * f, gy2]], r * 0.07, '#33413e'); });
    // alt + üst bilezik
    cyl(c, cx, gy2 - r * 0.12, gy2 + R * 0.08, r * 1.18);
    rivets(c, cx, gy2, r * 1.18, 10);
    cyl(c, cx, topY, gy1 + r * 0.05, R * 0.82);
    cyl(c, cx, gy1 - r * 0.05, gy1 + r * 0.14, r * 1.18, 0, false);
    rivets(c, cx, gy1 + r * 0.04, r * 1.18, 10); rivets(c, cx, topY + R * 0.18, R * 0.82, 10);
    // kubbe
    c.beginPath(); c.ellipse(cx, topY, R * 0.82, R * 0.42, 0, Math.PI, 0); c.ellipse(cx, topY, R * 0.82, R * 0.82 * 0.28, 0, 0, Math.PI); c.closePath();
    g = c.createRadialGradient(cx - R * 0.3, topY - R * 0.3, R * 0.05, cx, topY, R * 0.9); g.addColorStop(0, '#7f8f8a'); g.addColorStop(1, '#1d2726');
    c.fillStyle = g; c.fill(); c.strokeStyle = ink; c.lineWidth = lw; c.stroke();
    // üst gövdede uyarı şeridi + buhar çıkışları
    hazardClip(c, [[cx - R * 0.82, gy1 - R * 0.28], [cx + R * 0.82, gy1 - R * 0.28], [cx + R * 0.82, gy1 - R * 0.16], [cx - R * 0.82, gy1 - R * 0.16]], R * 0.12);
    L.vents = [[cx - R * 0.95, topY + R * 0.15, -1], [cx + R * 0.95, topY + R * 0.15, 1]];
    L.vents.forEach(([x, y, sd]) => pipe(c, [[x - sd * R * 0.1, y], [x + sd * R * 0.12, y], [x + sd * R * 0.12, y - R * 0.15]], R * 0.09));
    // uyarı lambaları (döner tepe lambası gövdeleri)
    // şablon yazı
    c.save(); c.font = `900 ${Math.round(R * 0.13)}px Impact, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(232,185,35,.85)'; c.fillText('R-07', cx, (topY + R * 0.18 + gy1 - R * 0.28) / 2 + R * 0.015); c.restore();
    L.beacons = [[lerp(bx1, bx2, 0.25), by1 + u * 0.03], [lerp(bx1, bx2, 0.75), by1 + u * 0.03]];
    L.beacons.forEach(([x, y]) => { poly(c, [[x - u * 0.016, y], [x + u * 0.016, y], [x + u * 0.02, y + u * 0.012], [x - u * 0.02, y + u * 0.012]], '#2a3533'); });

    // ---- ışık / sis lekeleri: 128 px, büyütülerek kullanılır ----
    const blob = (col) => { const b = mk(128, 128), x = b.getContext('2d'), gg = x.createRadialGradient(64, 64, 0, 64, 64, 64); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, 128, 128); return b; };
    // PERFORMANS: reaktör katmanı ekranın tamamı değil, sadece reaktörün kapladığı kutu
    {
      const x0 = Math.max(0, Math.floor(cx - R * 2.2)), x1 = Math.min(W, Math.ceil(cx + R * 2.2)), y0 = 0, y1 = Math.min(H, Math.ceil(fy + R * 0.6));
      const crop = mk(x1 - x0, y1 - y0); crop.getContext('2d').drawImage(L.shell, -x0, -y0);
      L.shell = crop; L.shellX = x0; L.shellY = y0;
    }
    // çekirdekten yayılan ışık huzmeleri (bir kez çizilir, sahnede yavaşça döner)
    {
      const S2 = Math.ceil(R * 6), rays = mk(S2, S2), x = rays.getContext('2d'), h = S2 / 2;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.2, w = 0.07 + (i % 3) * 0.03;
        const gg = x.createRadialGradient(h, h, 0, h, h, h); gg.addColorStop(0, 'rgba(120,255,150,.55)'); gg.addColorStop(1, 'rgba(120,255,150,0)');
        x.fillStyle = gg; x.beginPath(); x.moveTo(h, h); x.arc(h, h, h, a - w, a + w); x.closePath(); x.fill();
      }
      // PERFORMANS: huzmeler ve ıslak zemin yansıması arka plana BİR KEZ işlenir (her karede çizilmez)
      const bc = L.bg.getContext('2d');
      bc.globalCompositeOperation = 'lighter';
      bc.globalAlpha = 0.13; bc.drawImage(rays, cx - h, (gy1 + gy2) / 2 - h);
      const refl = blob('rgba(90,255,120,1)');
      bc.globalAlpha = 0.22; bc.drawImage(refl, cx - R * 1.1, fy + R * 0.15, R * 2.2, (H - fy) * 1.6);
      bc.globalAlpha = 0.12; bc.drawImage(refl, cx - R * 2.6, fy - R * 0.1, R * 5.2, R * 0.9);
      bc.globalCompositeOperation = 'source-over'; bc.globalAlpha = 1;
    }
    L.green = blob('rgba(90,255,120,1)'); L.amber = blob('rgba(255,150,30,1)'); L.fog = blob('rgba(170,200,185,1)'); L.warm = blob('rgba(255,235,190,1)');
    return L;
  }

  startScene() {
    if (this.raf) return;
    const cv = this.canvas, c = cv.getContext('2d', { alpha: false });
    const rnd = (a, b) => a + Math.random() * (b - a);
    const motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(1, 2.6), v: rnd(0.006, 0.02), w: rnd(0, 6.28) }));
    const bubbles = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(0.02, 0.06), v: rnd(0.08, 0.22), w: rnd(0, 6.28) }));
    const fog = Array.from({ length: 6 }, () => ({ x: Math.random(), y: rnd(0.75, 1), r: rnd(0.25, 0.45), v: rnd(0.004, 0.01), a: rnd(0.05, 0.1) }));
    const steam = Array.from({ length: 14 }, (_, i) => ({ side: i % 2, p: Math.random(), v: rnd(0.25, 0.45), dx: rnd(-0.3, 0.3) }));
    const t0 = performance.now();
    let L = null, flick = 1, last = 0, lastFx = 0, fx = 0.665, arcT = 3, arcOn = 0;
    const draw = (now) => {
      this.raf = requestAnimationFrame(draw);
      if (this.hasPhoto) { cancelAnimationFrame(this.raf); this.raf = 0; return; }
      const lowQ = getQuality() === 'low';
      if (document.hidden || now - last < (lowQ ? 31 : 12)) return;   // ekranın hızında (en fazla ~80); düşük grafikte 30
      last = now;
      const t = (now - t0) / 1000;
      const dpr = lowQ ? 0.75 : Math.min(getQuality() === 'med' ? 1 : 1.25, window.devicePixelRatio || 1);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      // terminal sağdaysa (telefon yatay düzeni) reaktör sola geçer; saniyede bir kontrol
      if (!L || now - lastFx > 1000) {
        lastFx = now; const tr = this.root && this.root.querySelector('.mm-terminal');
        const b = tr && tr.getBoundingClientRect();
        fx = b && b.width && (b.left + b.right) / 2 > innerWidth * 0.55 ? 0.27 : 0.665;
      }
      if (cv.width !== W || cv.height !== H || !L || L.fx !== fx) { cv.width = W; cv.height = H; L = this.buildLayers(W, H, fx); L.fx = fx; }
      const { cx, fy, R, r, gy1, gy2 } = L;
      // Kamera salınımı sadece Yüksek grafikte (Orta/Düşük: birebir kopyalama, çok daha ucuz)
      const moveCam = getQuality() === 'high';
      const zoom = moveCam ? 1.06 + Math.sin(t * 0.12) * 0.03 : 1, px = moveCam ? Math.sin(t * 0.07) * W * 0.015 : 0, py = moveCam ? Math.cos(t * 0.09) * H * 0.01 : 0;
      c.setTransform(zoom, 0, 0, zoom, W / 2 * (1 - zoom) + px, H / 2 * (1 - zoom) + py);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(L.bg, 0, 0);
      // çekirdek nabzı: yavaş soluma + ara sıra güç dalgalanması
      const surge = Math.max(0, Math.sin(t * 0.9) ** 24) + (Math.random() < 0.015 ? 0.5 : 0);
      flick = Math.random() < 0.02 ? 0.6 : flick + (1 - flick) * 0.12;
      const pulse = (0.75 + 0.25 * Math.sin(t * 2.2)) * flick + surge * 0.6;

      c.globalCompositeOperation = 'lighter';
      // tavan lambası ışıkları
      L.lamps.forEach(([x, y, w], i) => { c.globalAlpha = 0.18 * (i === 1 ? flick : 1); c.drawImage(L.warm, x - w * 2, y - w * 0.6, w * 4, w * 4); });
      // salonu yeşile boyayan reaktör ışığı
      c.globalAlpha = 0.5 * pulse; c.drawImage(L.green, cx - R * 4.5, (gy1 + gy2) / 2 - R * 3.4, R * 9, R * 6.8);
      c.globalAlpha = 0.3 * pulse; c.drawImage(L.green, cx - R * 1.6, gy1 - R * 0.6, R * 3.2, gy2 - gy1 + R * 1.2);
      c.globalAlpha = 0.35 * pulse; c.drawImage(L.green, cx - R * 3.2, fy - R * 0.9, R * 6.4, R * 1.8);
      // döner uyarı lambaları
      L.beacons.forEach(([x, y], i) => {
        const on = Math.max(0, Math.sin(t * 4 + i * Math.PI)) ** 2;
        c.globalAlpha = 0.5 * on; c.drawImage(L.amber, x - R * 1.4, y - R * 0.6, R * 2.8, R * 2.8);
      });
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;

      // ---- cam haznenin içi: parlayan sıvı, yakıt çubukları, kabarcıklar ----
      c.save(); c.beginPath(); c.rect(cx - r, gy1, r * 2, gy2 - gy1); c.clip();
      let g = c.createLinearGradient(cx - r, 0, cx + r, 0);
      const a = Math.min(1, 0.55 + 0.3 * pulse);
      g.addColorStop(0, `rgba(20,110,50,${a})`); g.addColorStop(0.45, `rgba(120,255,140,${a})`); g.addColorStop(1, `rgba(15,90,40,${a})`);
      c.fillStyle = '#04140a'; c.fillRect(cx - r, gy1, r * 2, gy2 - gy1);
      c.fillStyle = g; c.fillRect(cx - r, gy1, r * 2, gy2 - gy1);
      [-0.5, -0.17, 0.17, 0.5].forEach((f, i) => {
        const x = cx + r * f, w = r * 0.16, top = gy1 + (gy2 - gy1) * (0.12 + 0.03 * Math.sin(t * 0.5 + i));
        c.fillStyle = 'rgba(10,40,25,.85)'; c.fillRect(x - w / 2, top, w, gy2 - top);
        c.fillStyle = `rgba(210,255,215,${0.35 + 0.35 * pulse})`; c.fillRect(x - w / 2 - 1, top, 2, gy2 - top); c.fillRect(x + w / 2 - 1, top, 2, gy2 - top);
      });
      c.fillStyle = 'rgba(230,255,235,.75)';
      bubbles.forEach((b) => {
        const y = gy2 - (((b.y + t * b.v) % 1) * (gy2 - gy1)), x = cx + (b.x * 2 - 1) * r * 0.85 + Math.sin(t * 2 + b.w) * r * 0.05;
        c.beginPath(); c.arc(x, y, Math.max(1, r * b.s), 0, 7); c.fill();
      });
      // yüzey dalgası
      c.fillStyle = 'rgba(200,255,210,.35)'; c.beginPath(); c.moveTo(cx - r, gy1 + r * 0.25);
      for (let i = 0; i <= 12; i++) c.lineTo(cx - r + (i / 12) * r * 2, gy1 + r * 0.25 + Math.sin(t * 3 + i) * r * 0.03);
      c.lineTo(cx + r, gy1); c.lineTo(cx - r, gy1); c.fill();
      c.restore();

      // yan tüplerde akan yeşil sıvı
      L.tubes.forEach((pts) => {
        const path = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
        c.lineCap = 'round'; c.lineJoin = 'round';
        path(); c.strokeStyle = '#061010'; c.lineWidth = L.tubeW + 6; c.stroke();
        path(); c.strokeStyle = '#0d3a1e'; c.lineWidth = L.tubeW; c.stroke();
        c.setLineDash([L.tubeW * 0.9, L.tubeW * 1.4]); c.lineDashOffset = -t * L.tubeW * 3;
        path(); c.strokeStyle = `rgba(130,255,150,${0.5 + 0.4 * pulse})`; c.lineWidth = L.tubeW * 0.5; c.stroke();
        c.setLineDash([]);
      });

      // reaktör gövdesi (cam çerçevesi, bilezikler, kubbe)
      c.drawImage(L.shell, L.shellX, L.shellY);
      // ara sıra cam haznede elektrik arkı
      if (!lowQ && (arcT -= 1 / 30) < 0) { arcT = 2 + Math.random() * 4; arcOn = 0.18; }
      if (arcOn > 0) {
        arcOn -= 1 / 30;
        c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(200,255,220,.9)'; c.lineWidth = Math.max(1.5, R * 0.015);
        const side = Math.random() < 0.5 ? -1 : 1; let x = cx + side * r * 0.95, y = gy1 + Math.random() * (gy2 - gy1) * 0.6;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x -= side * r * 0.27; y += (Math.random() - 0.35) * r * 0.35; c.lineTo(x, y); }
        c.stroke(); c.globalAlpha = 0.25; c.drawImage(L.green, x - R * 0.6, y - R * 0.6, R * 1.2, R * 1.2); c.restore();
      }

      // uyarı lambası başlıkları + kontrol paneli ekranları
      L.beacons.forEach(([x, y], i) => {
        const on = Math.max(0, Math.sin(t * 4 + i * Math.PI)) ** 2;
        c.fillStyle = `rgb(${120 + 135 * on | 0},${50 + 100 * on | 0},10)`; c.beginPath(); c.arc(x, y, R * 0.09, Math.PI, 0); c.fill();
      });
      L.panels.forEach((p, i) => {
        c.fillStyle = `rgba(60,255,110,${0.25 + 0.15 * Math.sin(t * 5 + i)})`;
        for (let k = 0; k < 4; k++) c.fillRect(p.x + p.w * 0.08, p.y + p.h * (0.15 + k * 0.2), p.w * (0.3 + 0.5 * ((Math.sin(t * 1.3 + k * 2 + i) + 1) / 2)), Math.max(1, p.h * 0.08));
        for (let k = 0; k < 5; k++) { const on = Math.sin(t * (2 + k) + i * 3) > 0.3; c.fillStyle = on ? (k % 2 ? '#ff4b2b' : '#5dff7a') : '#1d2a26'; c.fillRect(p.lx + k * p.lw / 5, p.ly, p.lw / 9, p.lw / 9); }
      });

      // buhar
      steam.forEach((s) => {
        const [vx, vy, sd] = L.vents[s.side], p = (s.p + t * s.v * 0.3) % 1;
        const x = vx + sd * R * 0.12 + s.dx * R * p, y = vy - R * 0.15 - p * R * 1.6, rr = R * (0.15 + p * 0.55);
        c.globalAlpha = 0.22 * (1 - p); c.drawImage(L.fog, x - rr, y - rr, rr * 2, rr * 2);
      });
      // zemin sisi
      if (!lowQ) fog.forEach((f) => { const x = ((f.x + t * f.v) % 1.4 - 0.2) * W, y = f.y * H, rr = f.r * W; c.globalAlpha = f.a; c.drawImage(L.fog, x - rr, y - rr, rr * 2, rr * 2); });
      // yükselen radyoaktif parçacıklar
      c.globalCompositeOperation = 'lighter';
      motes.forEach((d, i) => {
        if (lowQ && i % 2) return;
        const x = ((d.x + Math.sin(t * 0.3 + d.w) * 0.01) % 1) * W, y = ((d.y - t * d.v) % 1 + 1) % 1 * H;
        c.globalAlpha = 0.25 + 0.45 * Math.sin(t + d.w) ** 2; c.fillStyle = d.w > 3 ? '#9dff9a' : '#ffe6be'; c.fillRect(x, y, d.s * 1.5, d.s * 1.5);
      });
      // güç dalgalanmasında ekran hafifçe yeşile kayar
      if (surge > 0.05) { c.globalAlpha = surge * 0.08; c.fillStyle = '#4dff6a'; c.setTransform(1, 0, 0, 1, 0, 0); c.fillRect(0, 0, W, H); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    };
    this.raf = requestAnimationFrame(draw);
  }
}

export { esc };

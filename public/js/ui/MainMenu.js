// ============================================================
// MainMenu.js - Ana menü: nükleer sığınak terminali
// ============================================================
// Görünüm: arka planda sığınak kasa kapısı (görsel varsa assets/menu/menu_bg.jpg, yoksa kodla
// çizilen hafif sahne), önde duvara monte edilmiş yeşil fosforlu CRT terminal. Menü satırları
// terminal komutu gibi; ok tuşları + Enter ile de seçilir. Sağ üstte KİMLİK KARTI (hesap).
//   menu.show({ onOnline, onCreate, onSolo })   menu.hide()
// İsteğe bağlı görseller (yoksa kodla çizilir): assets/menu/menu_bg.jpg, assets/menu/logo.png
import { social } from './Social.js';
import { shelterPass } from './ShelterPass.js';
import { passStatus } from '../systems/Pass.js';
import { i18n } from '../systems/I18n.js';
import { net, Net } from '../systems/Net.js';
import { isMuted, toggleMute, sfx } from '../systems/Sound.js';
import { assetUrl } from '../systems/Assets.js';
import { titleName, xpPercent, winRate, nextTitle } from '../systems/Levels.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function loadOptional(path) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = assetUrl(path); });
}

const ITEMS = [
  { act: 'online', key: 'menu.play', icon: '☢' },
  { act: 'create', key: 'menu.create', icon: '⊕' },
  { act: 'social', key: 'menu.social', icon: '★' },
  { act: 'pass', key: 'menu.pass', icon: '🎟' },
  { act: 'solo', key: 'menu.solo', icon: '◎' },
  { act: 'settings', key: 'menu.settings', icon: '⚙' },
  { act: 'howto', key: 'menu.howto', icon: '?' }
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
            <div class="mm-id-head"><span>☢</span><b data-t="menu.idCard"></b><i class="mm-id-no"></i></div>
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
        <footer class="mm-foot"><div class="mm-hazard"></div><span data-t="menu.version"></span><button class="mm-lang" type="button"></button></footer>
      </div>
      <div class="mm-modal hidden" data-m="auth"><div class="mm-card term">
        <h2 class="mm-auth-title"></h2>
        <label class="mm-field"><span data-t="menu.username"></span><input class="mm-user" maxlength="16" autocomplete="username" spellcheck="false"></label>
        <label class="mm-field"><span data-t="menu.password"></span><input class="mm-pass" type="password" maxlength="64" autocomplete="current-password"></label>
        <label class="mm-field mm-pass2-row"><span data-t="menu.password2"></span><input class="mm-pass2" type="password" maxlength="64" autocomplete="new-password"></label>
        <p class="mm-auth-err"></p>
        <button class="mm-tbtn primary mm-auth-go" type="button"></button>
        <button class="mm-link mm-auth-switch" type="button"></button>
        <button class="mm-link mm-close" type="button" data-t="menu.back"></button>
      </div></div>
      <div class="mm-modal hidden" data-m="profile"><div class="mm-card term mm-profile-card"><div class="pf-body"></div><button class="mm-tbtn mm-close" type="button" data-t="menu.back"></button></div></div>
      <div class="mm-modal hidden" data-m="settings"><div class="mm-card term">
        <h2 data-t="menu.settings"></h2>
        <div class="mm-row"><span data-t="menu.language"></span><button class="mm-chip mm-set-lang" type="button"></button></div>
        <div class="mm-row"><span data-t="menu.sound"></span><button class="mm-chip mm-set-sound" type="button"></button></div>
        <label class="mm-field"><span data-t="menu.server"></span><input class="mm-server" placeholder="oyunum.onrender.com" autocomplete="off" spellcheck="false"></label>
        <p class="mm-hint" data-t="menu.serverHint"></p>
        <button class="mm-tbtn primary mm-save" type="button" data-t="menu.save"></button>
      </div></div>
      <div class="mm-modal hidden" data-m="howto"><div class="mm-card term"><h2 data-t="menu.howto"></h2><p class="mm-howto"></p><button class="mm-tbtn mm-close" type="button" data-t="menu.back"></button></div></div>`;
    document.body.appendChild(r);
    this.canvas = r.querySelector('.mm-scene');
    const nav = r.querySelector('.mm-nav');
    ITEMS.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mm-item'; b.dataset.act = it.act; b.dataset.i = i;
      b.innerHTML = `<span class="mm-caret">&gt;</span><span class="mm-ico">${it.icon}</span><span class="mm-txt" data-t="${it.key}"></span><span class="mm-cursor">█</span>`;
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
    r.querySelector('.mm-save').addEventListener('click', () => {
      Net.setServerSetting(r.querySelector('.mm-server').value.trim());
      if (net.ws) { try { net.ws.close(); } catch (e) { /* yoksay */ } }
      net.connect();
      this.closeModal();
    });
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
    loadOptional('assets/menu/menu_bg.jpg').then((im) => { if (im) { this.hasPhoto = true; r.querySelector('.mm-photo').style.backgroundImage = `url("${im.src}")`; r.classList.add('photo'); } });
    loadOptional('assets/menu/logo.png').then((im) => { if (im) { const l = r.querySelector('.mm-logo'); l.src = im.src; l.classList.remove('hidden'); r.querySelector('.mm-logotext').classList.add('hidden'); } });
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
    if (a === 'settings') { this.openModal('settings'); return; }
    if (a === 'howto') { this.openModal('howto'); return; }
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
  }

  renderAccount() {
    const r = this.root;
    if (!r) return;
    const a = net.account;
    r.querySelector('.mm-id').classList.toggle('guest', !a);
    r.querySelector('.mm-id-name').textContent = a ? a.name : i18n.t('menu.guest');
    r.querySelector('.mm-id-photo').textContent = a ? a.name.slice(0, 1).toUpperCase() : '?';
    r.querySelector('.mm-id-title').innerHTML = a ? esc(titleName(a.title)) + (a.admin ? ` · <span class="mm-adm">${esc(i18n.t('profile.admin'))}</span>` : '') : '';
    this.updatePassBadge();
    r.querySelector('.mm-id-level').textContent = a ? `${i18n.t('menu.level', { n: a.level })} · 🪙 ${a.coins ?? 0}` : i18n.t('menu.guestHint');
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
        <div class="pf-photo">${esc(a.name.slice(0, 1).toUpperCase())}</div>
        <div><div class="pf-name">${esc(a.name)}</div><div class="pf-title">${esc(titleName(a.title))}</div></div>
        <div class="pf-lvl"><b>${a.level}</b><span>${esc(i18n.t('levels.level', { n: '' }).trim().toUpperCase())}</span></div>
      </div>
      <div class="pf-xp"><i style="width:${xpPercent(a)}%"></i></div>
      <div class="pf-xptext">${a.level >= 100 ? esc(i18n.t('levels.max')) : esc(i18n.t('levels.xpText', { a: a.xpInto, b: a.xpNeed }))}${nt ? ' · ' + esc(i18n.t('profile.nextTitle', { t: titleName(nt.idx), n: nt.level })) : ''}</div>
      <div class="pf-grid">
        ${cell('played', st.played || 0)}${cell('wins', st.wins || 0, 'hi')}${cell('losses', st.losses || 0, 'lo')}
        ${cell('winrate', wr === null ? '—' : wr + '%')}${cell('streak', st.streak || 0)}${cell('bestStreak', st.bestStreak || 0)}
      </div>
      ${st.played ? `<div class="pf-sub">${T('record')}</div><div class="pf-bar"><i style="width:${wr}%"></i></div>` : `<p class="mm-hint">${T('empty')}</p>`}
      <div class="pf-sub">${T('roles')}</div>
      <div class="pf-grid">
        ${cell('asImpostor', st.asImpostor || 0)}${cell('asSheriff', st.asSheriff || 0)}${cell('asCrew', st.asCrew || 0)}
        ${cell('winsCrew', st.winsCrew || 0)}${cell('winsImpostor', st.winsImpostor || 0)}${cell('tasks', st.tasks || 0)}
        ${cell('kills', st.kills || 0)}${cell('left', st.left || 0)}
      </div>
      <p class="mm-hint">${T('howXp')}</p>`;
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
    if (!this.root) this.build();
    this.handlers = handlers || this.handlers;
    const r = this.root;
    r.querySelector('.mm-server').value = Net.serverSetting();
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
    if (!this.root || this.root.classList.contains('hidden')) return;
    clearInterval(this.pollT); clearInterval(this.tickT);
    this.root.classList.add('leaving');
    setTimeout(() => { this.root.classList.add('hidden'); this.root.classList.remove('leaving'); cancelAnimationFrame(this.raf); this.raf = 0; }, 450);
  }

  // ---------------- Sinematik sahne (hafif) ----------------
  // Ağır parçalar (arka plan, kasa kapısı, ışık ve sis lekeleri) ekran boyutu değişince BİR KEZ
  // çizilir; her karede sadece hazır resimler taşınır/döndürülür. Kare hızı 40 ile sınırlı,
  // sekme görünmüyorsa hiç çizilmez.
  buildLayers(W, H) {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
    const L = { W, H };
    // arka plan + duvar panelleri
    L.bg = mk(W, H); let c = L.bg.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05070a'); g.addColorStop(0.6, '#10141b'); g.addColorStop(1, '#07090c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#151a22'; for (let i = -1; i < 9; i++) c.fillRect(i * W * 0.14, 0, 3, H);
    c.fillStyle = 'rgba(255,255,255,.025)'; for (let j = 0; j < 8; j++) c.fillRect(0, j * H * 0.13, W, 2);
    // kasa kapısı (çerçeve + kapak ayrı: kapak döner)
    const R = Math.min(W, H) * 0.33; L.R = R;
    const S = Math.ceil(R * 2.3);
    L.frame = mk(S, S); c = L.frame.getContext('2d'); c.translate(S / 2, S / 2);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(R * 0.05, R * 0.08, R * 1.08, 0, 7); c.fill();
    let rg = c.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.05); rg.addColorStop(0, '#5d6672'); rg.addColorStop(1, '#22272e');
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, R * 1.04, 0, 7); c.fill();
    c.lineWidth = R * 0.09;
    for (let i = 0; i < 36; i++) { c.strokeStyle = i % 2 ? '#151719' : '#d9a400'; c.beginPath(); c.arc(0, 0, R * 0.9, (i / 36) * 6.283, ((i + 1) / 36) * 6.283); c.stroke(); }
    L.lid = mk(S, S); c = L.lid.getContext('2d'); c.translate(S / 2, S / 2);
    rg = c.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R * 0.82); rg.addColorStop(0, '#7b8592'); rg.addColorStop(1, '#2f353d');
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, R * 0.8, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(0, 0, R * 0.8 * k / 4, 0, 7); c.stroke(); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; c.fillStyle = '#9aa4b0'; c.beginPath(); c.arc(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72, R * 0.025, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(217,164,0,.85)';
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2.094; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * 0.26, a - 0.5, a + 0.5); c.closePath(); c.fill(); }
    c.strokeStyle = '#b9c2cc'; c.lineWidth = R * 0.05; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = i * 2.094; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38); c.lineTo(-Math.cos(a) * R * 0.38, -Math.sin(a) * R * 0.38); c.stroke(); }
    c.beginPath(); c.arc(0, 0, R * 0.38, 0, 7); c.stroke();
    c.fillStyle = '#5a636e'; c.beginPath(); c.arc(0, 0, R * 0.09, 0, 7); c.fill();
    // ışık lekeleri (turuncu, kırmızı) ve sis lekesi: 128 px, büyütülerek kullanılır
    const blob = (col) => { const b = mk(128, 128), x = b.getContext('2d'), gg = x.createRadialGradient(64, 64, 0, 64, 64, 64); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, 128, 128); return b; };
    L.orange = blob('rgba(255,140,40,1)'); L.red = blob('rgba(255,50,30,1)'); L.fog = blob('rgba(150,160,175,1)');
    return L;
  }

  startScene() {
    if (this.raf) return;
    const cv = this.canvas, c = cv.getContext('2d', { alpha: false });
    const rnd = (a, b) => a + Math.random() * (b - a);
    const dust = Array.from({ length: 45 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(1, 2.4), v: rnd(0.004, 0.018), w: rnd(0, 6.28) }));
    const fog = Array.from({ length: 7 }, () => ({ x: Math.random(), y: rnd(0.55, 1), r: rnd(0.25, 0.5), v: rnd(0.004, 0.012), a: rnd(0.05, 0.11) }));
    const t0 = performance.now();
    let L = null, flick = 1, last = 0;
    const draw = (now) => {
      this.raf = requestAnimationFrame(draw);
      if (this.hasPhoto) { cancelAnimationFrame(this.raf); this.raf = 0; return; }
      if (document.hidden || now - last < 33) return;   // 30 kare/sn yeter          // ~40 kare/sn yeter
      last = now;
      const t = (now - t0) / 1000;
      const dpr = Math.min(1.25, window.devicePixelRatio || 1);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (cv.width !== W || cv.height !== H || !L) { cv.width = W; cv.height = H; L = this.buildLayers(W, H); }
      const zoom = 1.06 + Math.sin(t * 0.12) * 0.04, px = Math.sin(t * 0.07) * W * 0.02, py = Math.cos(t * 0.09) * H * 0.012;
      c.setTransform(zoom, 0, 0, zoom, W / 2 * (1 - zoom) + px, H / 2 * (1 - zoom) + py);
      c.globalAlpha = 1;
      c.drawImage(L.bg, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
      const cx = W * 0.66, cy = H * 0.55, R = L.R;
      flick = Math.random() < 0.02 ? 0.55 : flick + (1 - flick) * 0.1;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.3 * flick; c.drawImage(L.orange, cx - R * 2.2, cy - R * 2.2, R * 4.4, R * 4.4);
      [[cx - R * 1.35, cy - R * 0.7], [cx + R * 1.35, cy - R * 0.7]].forEach(([lx, ly], i) => {
        const on = (Math.sin(t * 3 + i * Math.PI) + 1) / 2;
        c.globalAlpha = 0.55 * on; c.drawImage(L.red, lx - R * 0.9, ly - R * 0.9, R * 1.8, R * 1.8);
      });
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      const S = L.frame.width;
      c.drawImage(L.frame, cx - S / 2, cy - S / 2);
      c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.25) * 0.05 + t * 0.02); c.drawImage(L.lid, -S / 2, -S / 2); c.restore();
      [[cx - R * 1.35, cy - R * 0.7], [cx + R * 1.35, cy - R * 0.7]].forEach(([lx, ly], i) => {
        const on = (Math.sin(t * 3 + i * Math.PI) + 1) / 2;
        c.fillStyle = `rgb(${120 + 135 * on | 0},30,25)`; c.beginPath(); c.arc(lx, ly, R * 0.06, 0, 7); c.fill();
      });
      fog.forEach((f) => { const x = ((f.x + t * f.v) % 1.4 - 0.2) * W, y = f.y * H, rr = f.r * W; c.globalAlpha = f.a; c.drawImage(L.fog, x - rr, y - rr, rr * 2, rr * 2); });
      c.fillStyle = '#ffe6be';
      dust.forEach((d) => { const x = ((d.x + Math.sin(t * 0.3 + d.w) * 0.01) % 1) * W, y = ((d.y - t * d.v) % 1 + 1) % 1 * H; c.globalAlpha = 0.2 + 0.35 * Math.sin(t + d.w) ** 2; c.fillRect(x, y, d.s, d.s); });
      c.globalAlpha = 1;
    };
    this.raf = requestAnimationFrame(draw);
  }
}

export { esc };

// ============================================================
// OnlineLobby.js - Lobi tarayıcısı (öne çıkanlar, tüm lobiler, kodla katıl, lobi kur)
//                  ve oda içi arayüz (oyuncular, kod, botlar, başlat)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { FLAG_LIST, getFlagThumb, saveFlag } from '../systems/Flags.js';
import { DEFAULT_CFG, CFG_RANGES } from '../systems/RoomConfig.js';
import { MAP_IDS } from '../map/BunkerMap.js';

// Sadece içerik değiştiyse yeniden çiz: basılıyken buton yeniden oluşursa tıklama kayboluyordu
const setHtml = (el, html) => { if (el._html !== html) { el._html = html; el.innerHTML = html; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------------- Lobi tarayıcısı ----------------
export class LobbyBrowser {
  constructor() { this.root = null; this.data = { rooms: [], featured: [] }; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'browser hidden';
    r.innerHTML = `
      <div class="br-panel">
        <header class="br-head">
          <button class="br-back" type="button">‹</button>
          <h1 data-t="online.title"></h1>
          <span class="br-status"></span>
          <button class="br-refresh" type="button" data-t="online.refresh"></button>
        </header>
        <div class="br-body">
          <section class="br-lists">
            <h3 data-t="online.featured"></h3>
            <div class="br-featured"></div>
            <h3 data-t="online.all"></h3>
            <div class="br-all"></div>
          </section>
          <aside class="br-side">
            <div class="br-card">
              <h3 data-t="online.joinCode"></h3>
              <div class="br-joinrow"><input class="br-code" maxlength="5" autocomplete="off" spellcheck="false"><button class="br-btn" data-act="join" type="button" data-t="online.join"></button></div>
            </div>
            <div class="br-card br-create">
              <h3 data-t="online.create"></h3>
              <label><span data-t="online.roomName"></span><input class="br-name" maxlength="28" autocomplete="off"></label>
              <label><span data-t="online.maxPlayers"></span>
                <div class="br-step"><button type="button" data-d="-1">−</button><b class="br-max">25</b><button type="button" data-d="1">+</button></div></label>
              <div class="br-seg"><button type="button" class="on" data-pub="1" data-t="online.public"></button><button type="button" data-pub="0" data-t="online.private"></button></div>
              <button class="br-btn primary" data-act="create" type="button" data-t="online.createBtn"></button>
            </div>
            <div class="br-error"></div>
          </aside>
        </div>
      </div>`;
    document.body.appendChild(r);
    this.max = 25; this.pub = true;
    r.querySelector('.br-back').addEventListener('click', () => this.onBack && this.onBack());
    r.querySelector('.br-refresh').addEventListener('click', () => net.list());
    r.querySelector('[data-act="join"]').addEventListener('click', () => this.joinCode());
    r.querySelector('[data-act="create"]').addEventListener('click', () => {
      net.create({ name: r.querySelector('.br-name').value.trim(), max: this.max, public: this.pub });
    });
    r.querySelectorAll('.br-step button').forEach((b) => b.addEventListener('click', () => { this.max = Math.max(4, Math.min(25, this.max + Number(b.dataset.d))); this.render(); }));
    r.querySelectorAll('.br-seg button').forEach((b) => b.addEventListener('click', () => { this.pub = b.dataset.pub === '1'; this.render(); }));
    r.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && i.classList.contains('br-code')) this.joinCode(); }));
    net.on('list', (m) => { this.data = m; this.renderList(); });
    net.on('status', () => this.renderStatus());
    net.on('error', (m) => this.showError(i18n.t('online.err_' + m.code)));
    i18n.onChange(() => this.root && this.render());
  }

  joinCode() {
    const code = this.root.querySelector('.br-code').value.trim().toUpperCase();
    if (code.length >= 4) net.join(code);
  }

  showError(text) {
    const e = this.root.querySelector('.br-error');
    e.textContent = text;
    e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  }

  render() {
    const r = this.root;
    r.querySelectorAll('[data-t]').forEach((n) => { n.textContent = i18n.t(n.dataset.t); });
    r.querySelector('.br-code').placeholder = i18n.t('online.codePh');
    r.querySelector('.br-name').placeholder = `${net.profile.name || ''}`;
    r.querySelector('.br-max').textContent = this.max;
    r.querySelectorAll('.br-seg button').forEach((b) => b.classList.toggle('on', (b.dataset.pub === '1') === this.pub));
    this.renderList(true);
    this.renderStatus();
  }

  renderStatus() {
    if (!this.root) return;
    const s = net.status;
    const el = this.root.querySelector('.br-status');
    el.dataset.s = s;
    el.textContent = s === 'online' ? i18n.t('menu.online', { n: this.data.online || 1 }) : s === 'connecting' ? i18n.t('menu.connecting') : s === 'noServer' ? i18n.t('menu.noServer') : i18n.t('menu.offline');
  }

  card(room, featured) {
    const full = room.count >= room.max;
    return `<button class="br-room${featured ? ' featured' : ''}${room.state !== 'lobby' || full ? ' busy' : ''}" type="button" data-code="${esc(room.code)}">
      <div class="br-room-main"><b>${esc(room.name)}</b><span>${esc(room.hostName)} · ${esc(room.code)}</span></div>
      <div class="br-room-meta"><span class="br-count">${i18n.t('online.players', { n: room.count, m: room.max })}</span>
      <span class="br-state" data-s="${room.state}">${i18n.t(room.state === 'lobby' ? 'online.waiting' : 'online.inGame')}</span></div>
    </button>`;
  }

  renderList(force) {
    if (!this.root) return;
    const { rooms = [], featured = [] } = this.data;
    // Liste değişmediyse yeniden çizme (tıklarken kartlar kaybolmasın)
    const key = JSON.stringify([rooms, featured, i18n.lang]);
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const feat = rooms.filter((x) => featured.includes(x.code));
    const rest = rooms.filter((x) => !featured.includes(x.code));
    const f = this.root.querySelector('.br-featured');
    const a = this.root.querySelector('.br-all');
    f.innerHTML = feat.length ? feat.map((x) => this.card(x, true)).join('') : `<p class="br-empty">${esc(i18n.t('online.empty'))}</p>`;
    a.innerHTML = rest.map((x) => this.card(x, false)).join('');
    this.root.querySelectorAll('.br-room').forEach((b) => b.addEventListener('click', () => net.join(b.dataset.code)));
  }

  show({ onBack, createFocus } = {}) {
    if (!this.root) this.build();
    this.onBack = onBack;
    this.root.classList.remove('hidden');
    this.root.querySelector('.br-error').textContent = '';
    this.render();
    net.connect();
    net.list();
    clearInterval(this.poll);
    this.poll = setInterval(() => { if (!document.hidden) net.list(); }, 5000);
    if (createFocus) setTimeout(() => { const n = this.root.querySelector('.br-name'); n.focus(); this.root.querySelector('.br-create').classList.add('glow'); setTimeout(() => this.root.querySelector('.br-create').classList.remove('glow'), 1600); }, 50);
  }

  hide() { if (this.root) this.root.classList.add('hidden'); clearInterval(this.poll); }
}

// ---------------- Oda içi arayüz (yürünen lobinin üstünde) ----------------
export class RoomHud {
  constructor() { this.root = null; this.botCount = 4; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'roomhud hidden';
    r.innerHTML = `
      <div class="rh-top">
        <div class="rh-namebox"><div class="rh-name"></div><button class="rh-code" type="button"></button></div>
        <div class="rh-topbtns"><button class="rh-invite" type="button" data-t="social.inviteBtn"></button><button class="rh-leave" type="button" data-t="online.leave"></button></div>
      </div>
      <div class="rh-panel">
        <div class="rh-players"></div>
        <div class="rh-host">
          <label class="rh-toggle"><input type="checkbox" class="rh-bots"><span data-t="online.bots"></span></label>
          <div class="rh-step"><span data-t="online.botCount"></span><button type="button" data-d="-1">−</button><b class="rh-botn"></b><button type="button" data-d="1">+</button></div>
        </div>
        <div class="rh-cfg"><button class="rh-cfg-toggle" type="button"></button><div class="rh-cfg-body hidden"></div></div>

      </div>
      <div class="rh-bottom"><button class="rh-flagbtn hidden" type="button"><span>🇺🇳</span><b data-t="lobby.pickFlagBtn"></b></button><button class="rh-flagbtn rh-hatbtn hidden" type="button"><span>🎩</span><b data-t="lobby.pickHatBtn"></b></button><div class="rh-note"></div><button class="rh-start" type="button" data-t="online.start"></button></div>`;
    document.body.appendChild(r);
    r.querySelector('.rh-leave').addEventListener('click', () => this.onLeave && this.onLeave());
    r.querySelector('.rh-invite').addEventListener('click', () => this.onInvite && this.onInvite());
    r.querySelector('.rh-start').addEventListener('click', () => this.onStart && this.onStart());
    r.querySelector('.rh-code').addEventListener('click', () => {
      const code = net.room && net.room.code;
      if (!code) return;
      const done = () => { const b = r.querySelector('.rh-code'); b.dataset.copied = '1'; setTimeout(() => delete b.dataset.copied, 1200); this.render(); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, done); else done();
    });
    r.querySelector('.rh-bots').addEventListener('change', (e) => net.roomSettings({ bots: e.target.checked }));
    r.querySelectorAll('.rh-step button').forEach((b) => b.addEventListener('click', () => {
      this.botCount = Math.max(1, Math.min(24, this.botCount + Number(b.dataset.d)));
      this.render();
    }));
    r.querySelector('.rh-flagbtn:not(.rh-hatbtn)').addEventListener('click', () => this.onFlag && this.onFlag());
    r.querySelector('.rh-cfg-toggle').addEventListener('click', () => { this.cfgOpen = !this.cfgOpen; this.render(); });
    // Ayar adımları ve oyuncu satırı butonları (kurucu)
    r.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !net.room) return;
      if (b.dataset.cfg) {
        if (!net.isHost) return;
        const key = b.dataset.cfg, room = net.room, cfg = { ...DEFAULT_CFG, ...(room.cfg || {}) };
        if (key === 'map') { net.roomSettings({ cfg: { map: b.dataset.v } }); return; }
        const R = CFG_RANGES[key], dir = Number(b.dataset.d);
        if (key === 'max') { net.roomSettings({ max: Math.max(Math.max(R.min, room.players.length), Math.min(R.max, room.max + dir)) }); return; }
        const v = Math.round((cfg[key] + dir * R.step) * 100) / 100;
        net.roomSettings({ cfg: { [key]: Math.max(R.min, Math.min(R.max, v)) } });
      } else if (b.dataset.kick || b.dataset.host) {
        if (!net.isHost) return;
        // 2 kez bas onayı: liste arada yeniden çizilse de kaybolmasın diye burada tutulur
        const key = b.dataset.kick ? 'kick:' + b.dataset.kick : 'host:' + b.dataset.host;
        if (!this.confirm || this.confirm.key !== key || this.confirm.until < Date.now()) {
          this.confirm = { key, until: Date.now() + 5000 };
          this.render();
          return;
        }
        this.confirm = null;
        if (b.dataset.kick) net.kick(b.dataset.kick); else net.giveHost(b.dataset.host);
      }
    });
    r.querySelector('.rh-hatbtn').addEventListener('click', () => this.onHat && this.onHat());
    i18n.onChange(() => this.root && this.render());
  }

  // Kaç bot eklenecek (host): oda dolana kadar
  botsToAdd() {
    const room = net.room;
    if (!room || !room.bots) return 0;
    return Math.max(0, Math.min(this.botCount, room.max - room.players.length));
  }

  render() {
    const r = this.root, room = net.room;
    if (!r || !room) return;
    r.querySelectorAll('[data-t]').forEach((n) => { n.textContent = i18n.t(n.dataset.t); });
    r.querySelector('.rh-name').textContent = room.name;
    const cb = r.querySelector('.rh-code');
    cb.textContent = cb.dataset.copied ? i18n.t('online.copied') : `${i18n.t('online.code')}: ${room.code} ⧉`;
    setHtml(r.querySelector('.rh-players'), room.players.map((p) => `
      <div class="rh-p${p.id === net.id ? ' me' : ''}">
        <img alt="" src="${getFlagThumb(p.flag, 36, 24)}"><span>${esc(p.name)}${p.id === net.id ? ` <i>(${esc(i18n.t('online.you'))})</i>` : ''}</span>
        ${p.id === room.hostId ? `<b title="${esc(i18n.t('online.host'))}">👑</b>` : ''}
        ${net.isHost && p.id !== net.id ? `<span class="rh-pbtns"><button type="button" class="rh-pbtn${this.isSure('host:' + p.id) ? ' sure' : ''}" data-host="${esc(p.id)}" title="${esc(i18n.t('online.giveHost'))}">${this.isSure('host:' + p.id) ? '?' : '👑'}</button><button type="button" class="rh-pbtn kick${this.isSure('kick:' + p.id) ? ' sure' : ''}" data-kick="${esc(p.id)}" title="${esc(i18n.t('online.kick'))}">${this.isSure('kick:' + p.id) ? '?' : '✕'}</button></span>` : ''}
      </div>`).join('') + (room.bots ? `<div class="rh-p bot"><span>🤖 × ${this.botsToAdd()}</span></div>` : ''));
    const host = net.isHost;
    r.querySelector('.rh-host').classList.toggle('hidden', !host);
    r.querySelector('.rh-bots').checked = !!room.bots;
    r.querySelector('.rh-botn').textContent = this.botCount;
    r.querySelector('.rh-step').classList.toggle('hidden', !room.bots);
    this.renderCfg(room, host);
    const total = room.players.length + this.botsToAdd();
    const canStart = host && total >= 3;
    const st = r.querySelector('.rh-start');
    st.classList.toggle('hidden', !host);
    st.disabled = !canStart;
    r.querySelector('.rh-note').textContent = !host ? i18n.t('online.waitHost') : (!canStart ? i18n.t('online.needPlayers') : '');
  }

  isSure(key) { return !!(this.confirm && this.confirm.key === key && this.confirm.until > Date.now()); }

  // Oda ayarları: kurucu değiştirir, diğerleri sadece görür
  renderCfg(room, host) {
    const cfg = { ...DEFAULT_CFG, ...(room.cfg || {}) };
    const r = this.root;
    r.querySelector('.rh-cfg-toggle').textContent = `⚙ ${i18n.t('online.roomSettings')} ${this.cfgOpen ? '▲' : '▼'}`;
    const body = r.querySelector('.rh-cfg-body');
    body.classList.toggle('hidden', !this.cfgOpen);
    if (!this.cfgOpen) return;
    const dis = host ? '' : 'disabled';
    const auto = (v) => (v ? String(v) : i18n.t('online.auto'));
    const fmt = { speed: (v) => v + 'x', discuss: (v) => v + ' sn', vote: (v) => v + ' sn', killCd: (v) => v + ' sn', imps: auto, sheriffs: auto, max: (v) => String(v) };
    const step = (key, val) => `<div class="rh-crow"><span>${esc(i18n.t('online.cfg_' + key))}</span><button type="button" data-cfg="${key}" data-d="-1" ${dis}>−</button><b>${esc(fmt[key](val))}</b><button type="button" data-cfg="${key}" data-d="1" ${dis}>+</button></div>`;
    setHtml(body, `
      <div class="rh-crow map"><span>${esc(i18n.t('online.cfg_map'))}</span><div class="rh-seg">${MAP_IDS.map((id) => `<button type="button" data-cfg="map" data-v="${id}" class="${cfg.map === id ? 'on' : ''}" ${dis}>${esc(i18n.t('maps.' + id))}</button>`).join('')}</div></div>
      ${step('max', room.max)}${step('speed', cfg.speed)}${step('discuss', cfg.discuss)}${step('vote', cfg.vote)}${step('killCd', cfg.killCd)}${step('imps', cfg.imps)}${step('sheriffs', cfg.sheriffs)}`);
  }

  setFlagReady(on) { if (this.root) this.root.querySelector('.rh-flagbtn:not(.rh-hatbtn)').classList.toggle('hidden', !on); }
  setHatReady(on) { if (this.root) this.root.querySelector('.rh-hatbtn').classList.toggle('hidden', !on); }

  show({ onLeave, onStart, onFlag, onHat, onInvite }) {
    if (!this.root) this.build();
    this.onLeave = onLeave; this.onStart = onStart; this.onFlag = onFlag; this.onHat = onHat; this.onInvite = onInvite;
    this.root.classList.remove('hidden');
    this.render();
  }

  hide() { if (this.root) this.root.classList.add('hidden'); }
}

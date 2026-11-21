// ============================================================
// OnlineLobby.js - Lobi tarayıcısı (öne çıkanlar, tüm lobiler, kodla katıl, lobi kur)
//                  ve oda içi arayüz (oyuncular, kod, botlar, başlat)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { shelterPass } from './ShelterPass.js';
import { net } from '../systems/Net.js';
import { FLAG_LIST, getFlagThumb, saveFlag } from '../systems/Flags.js';
import { DEFAULT_CFG, CFG_RANGES } from '../systems/RoomConfig.js';
import { MAP_IDS } from '../map/BunkerMap.js';
import { icon } from './Icons.js';

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
          <button class="br-gear" type="button" title="Ayarlar">${icon('gear')}</button>
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
    r.querySelector('.br-gear').addEventListener('click', () => import('./GameSettings.js').then((x) => x.gameSettings.open({})).catch(() => {}));
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
        <div class="rh-topbtns"><button class="rh-matchbtn" type="button">${icon('robot')}<span data-t="lobby.matchSettings"></span></button><button class="rh-settings" type="button" title="Ayarlar">${icon('gear')}</button><button class="rh-invite" type="button" data-t="social.inviteBtn"></button><button class="rh-leave" type="button" data-t="online.leave"></button></div>
      </div>
      <div class="rh-panel rh-side-hidden">
        <div class="rh-players"></div>
        <div class="rh-host">
          <label class="rh-toggle"><input type="checkbox" class="rh-bots"><span data-t="online.bots"></span></label>
          <div class="rh-step"><span data-t="online.botCount"></span><button type="button" data-d="-1">−</button><b class="rh-botn"></b><button type="button" data-d="1">+</button></div>
        </div>
      </div>
      <div class="rh-bottom">
        <div class="rh-note"></div>
        <div class="rh-actions">
          <button class="rh-flagbtn hidden" type="button"><span>${icon('flag')}</span><b data-t="lobby.pickFlagBtn"></b></button>
          <button class="rh-flagbtn rh-hatbtn hidden" type="button"><span>${icon('hat')}</span><b data-t="lobby.pickHatBtn"></b></button>
          <button class="rh-passbtn" type="button"><span>🎟</span><b data-t="online.passBtn">Sığınak Bileti</b></button>
          <button class="rh-ready" type="button" data-t="online.ready">Hazır</button>
        </div>
        <button class="rh-start" type="button" data-t="online.start"></button>
      </div>
      <div class="rh-match-sheet sheet settings-sheet hidden" role="dialog">
        <div class="sheet-panel">
          <div class="sheet-head"><h2 data-t="lobby.matchSettings"></h2><button class="btn sheet-close rh-cfg-x" type="button" aria-label="x">✕</button></div>
          <section class="card">
            <h2 data-t="lobby.map"></h2>
            <div class="seg map-seg rh-map-seg"></div>
          </section>
          <section class="card">
            <h2 data-t="online.cfg_max"></h2>
            <div class="stepper rh-max-step">
              <button class="btn btn-step" type="button" data-cfg="max" data-d="-1">−</button>
              <div class="count rh-max-count"></div>
              <button class="btn btn-step" type="button" data-cfg="max" data-d="1">+</button>
              <label class="toggle"><input type="checkbox" class="rh-bots-sheet"><span data-t="lobby.bots"></span></label>
            </div>
            <p class="hint" data-t="lobby.botsHint"></p>
          </section>
          <section class="card">
            <h2 data-t="online.roomSettings"></h2>
            <div class="rh-match-steps"></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(r);
    r.querySelector('.rh-leave').addEventListener('click', () => this.onLeave && this.onLeave());
    r.querySelector('.rh-settings').addEventListener('click', () => {
      import('./GameSettings.js').then((m) => { if (m.gameSettings) m.gameSettings.open({}); }).catch(() => {});
    });
    r.querySelector('.rh-invite').addEventListener('click', () => this.onInvite && this.onInvite());
    r.querySelector('.rh-start').addEventListener('click', () => this.onStart && this.onStart());
    r.querySelector('.rh-ready').addEventListener('click', () => {
      const room = net.room; if (!room) return;
      const me = room.players.find((p) => p.id === net.id);
      const on = !(me && me.ready);
      net.setReady(on);
    });
    r.querySelector('.rh-passbtn').addEventListener('click', () => {
      if (net.account) shelterPass.open();
      else this.root.querySelector('.rh-note').textContent = i18n.tf('shop.needLogin', 'Giriş gerekli');
    });
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
    r.querySelector('.rh-matchbtn')?.addEventListener('click', () => { this.cfgOpen = true; this.render(); });
    r.querySelector('.rh-bots-sheet')?.addEventListener('change', (e) => { if (net.isHost) net.roomSettings({ bots: e.target.checked }); });
    r.querySelector('.rh-cfg-x')?.addEventListener('click', () => { this.cfgOpen = false; this.render(); });
    r.querySelector('.rh-match-sheet')?.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('rh-match-sheet')) { this.cfgOpen = false; this.render(); } });
    // Ayar adımları ve oyuncu satırı butonları (kurucu)
    r.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !net.room) return;
      if (b.dataset.cfg) {
        if (!net.isHost) return;
        const key = b.dataset.cfg, room = net.room, cfg = { ...DEFAULT_CFG, ...(room.cfg || {}) };
        if (key === 'map' || key === 'botDiff') { net.roomSettings({ cfg: { [key]: b.dataset.v } }); return; }
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
      <div class="rh-p${p.id === net.id ? ' me' : ''}${p.ready ? ' ready' : ''}">
        <img alt="" src="${getFlagThumb(p.flag, 36, 24)}"><span>${esc(p.name)}${p.id === net.id ? ` <i>(${esc(i18n.t('online.you'))})</i>` : ''}</span>
        ${p.ready ? `<em class="rh-rdy" title="${esc(i18n.t('online.ready'))}">✓</em>` : `<em class="rh-nrdy" title="${esc(i18n.t('online.notReady'))}">…</em>`}
        ${p.id === room.hostId ? `<b title="${esc(i18n.t('online.host'))}">${icon('crown', 'ic-crown')}</b>` : ''}
        ${net.isHost && p.id !== net.id ? `<span class="rh-pbtns"><button type="button" class="rh-pbtn${this.isSure('host:' + p.id) ? ' sure' : ''}" data-host="${esc(p.id)}" title="${esc(i18n.t('online.giveHost'))}">${this.isSure('host:' + p.id) ? '?' : '👑'}</button><button type="button" class="rh-pbtn kick${this.isSure('kick:' + p.id) ? ' sure' : ''}" data-kick="${esc(p.id)}" title="${esc(i18n.t('online.kick'))}">${this.isSure('kick:' + p.id) ? '?' : '✕'}</button></span>` : ''}
      </div>`).join('') + (room.bots ? `<div class="rh-p bot"><span>${icon('robot')} × ${this.botsToAdd()}</span></div>` : ''));
    const host = net.isHost;
    r.querySelector('.rh-host').classList.toggle('hidden', !host);
    r.querySelector('.rh-bots').checked = !!room.bots;
    r.querySelector('.rh-botn').textContent = this.botCount;
    r.querySelector('.rh-step').classList.toggle('hidden', !room.bots);
    this.renderCfg(room, host);
    
    const total = room.players.length + this.botsToAdd();
    const allReady = room.players.every((p) => p.ready);
    const me = room.players.find((p) => p.id === net.id);
    const meReady = !!(me && me.ready);
    const canStart = host && total >= 3 && allReady;
    const st = r.querySelector('.rh-start');
    st.classList.toggle('hidden', !host);
    st.disabled = !canStart;
    const rb = r.querySelector('.rh-ready');
    if (rb) {
      rb.classList.toggle('on', meReady);
      rb.textContent = meReady ? i18n.t('online.readyOn') : i18n.t('online.ready');
    }
    let note = '';
    if (!host) note = i18n.t('online.waitHost');
    else if (total < 3) note = i18n.t('online.needPlayers');
    else if (!allReady) note = i18n.t('online.needReady');
    r.querySelector('.rh-note').textContent = note;
  }

  isSure(key) { return !!(this.confirm && this.confirm.key === key && this.confirm.until > Date.now()); }

  // Oda ayarları: singleplayer Maç Ayarları menüsü ile aynı deneyim (üstten sheet)
  renderCfg(room, host) {
    const cfg = { ...DEFAULT_CFG, ...(room.cfg || {}) };
    const r = this.root;
    const sheet = r.querySelector('.rh-match-sheet');
    const dis = host ? '' : 'disabled';
    if (sheet) sheet.classList.toggle('hidden', !this.cfgOpen);
    // Yan panel eski toggle metni
    const tog = r.querySelector('.rh-cfg-toggle');
    if (tog) {
      tog.innerHTML = `${icon('gear')} ${esc(i18n.t('online.roomSettings'))}`;
      tog.classList.toggle('on', !!this.cfgOpen);
    }
    // Harita
    const mapSeg = r.querySelector('.rh-map-seg');
    if (mapSeg) {
      const mapFallback = { ring: 'Kavşak', classic: 'Klasik Sığınak', shaft: 'Şaft' };
      mapSeg.innerHTML = MAP_IDS.map((id) =>
        `<button class="seg-btn ${cfg.map === id ? 'on' : ''}" type="button" data-cfg="map" data-v="${id}" ${dis}>${esc(i18n.tf('maps.' + id, mapFallback[id] || id))}</button>`
      ).join('');
    }
    // Bot zorluğu
    let diffRow = r.querySelector('.rh-botdiff');
    if (!diffRow) {
      const mapCard = r.querySelector('.rh-map-seg')?.closest('section');
      if (mapCard) {
        const div = document.createElement('div');
        div.className = 'rh-botdiff';
        div.style.cssText = 'margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center';
        mapCard.appendChild(div);
        diffRow = div;
      }
    }
    if (diffRow) {
      const bd = cfg.botDiff || 'normal';
      const diffLabels = { easy: 'Kolay', normal: 'Normal', hard: 'Zor' };
      diffRow.innerHTML = `<span style="width:100%;font-weight:800;color:#c9d0d8">${esc(i18n.tf('lobby.botDiff', 'Bot Zorluğu'))}</span>` +
        ['easy','normal','hard'].map((d) =>
          `<button class="seg-btn ${bd===d?'on':''}" type="button" data-cfg="botDiff" data-v="${d}" ${dis}>${esc(i18n.tf('lobby.diff_'+d, diffLabels[d] || d))}</button>`
        ).join('');
    }
    // Max oyuncu
    const mc = r.querySelector('.rh-max-count');
    if (mc) mc.textContent = String(room.max);
    r.querySelectorAll('.rh-max-step [data-cfg="max"]').forEach((b) => { b.disabled = !host; });
    const botsSheet = r.querySelector('.rh-bots-sheet');
    if (botsSheet) { botsSheet.checked = !!room.bots; botsSheet.disabled = !host; }
    // Adımlar: speed, discuss, vote, killCd, imps, sheriffs
    const auto = (v) => (v ? String(v) : i18n.t('online.auto'));
    const fmt = {
      speed: (v) => v + 'x', discuss: (v) => v + ' sn', vote: (v) => v + ' sn',
      killCd: (v) => v + ' sn', imps: auto, sheriffs: auto
    };
    const keys = ['speed', 'discuss', 'vote', 'killCd', 'imps', 'sheriffs'];
    const steps = r.querySelector('.rh-match-steps');
    if (steps) {
      steps.innerHTML = keys.map((key) =>
        `<div class="rh-crow"><span>${esc(i18n.t('online.cfg_' + key))}</span>` +
        `<button type="button" data-cfg="${key}" data-d="-1" ${dis}>−</button>` +
        `<b>${esc(fmt[key](cfg[key]))}</b>` +
        `<button type="button" data-cfg="${key}" data-d="1" ${dis}>+</button></div>`
      ).join('');
    }
    // Rol şansları (gösterim)
    const n = room.max || 6;
    const nImp = cfg.imps ? Math.min(cfg.imps, Math.max(1, Math.floor(n / 2))) : Math.max(1, Math.floor(n / 5));
    const nSh = cfg.sheriffs ? Math.min(cfg.sheriffs, n - nImp) : (n >= 6 ? 1 : 0);
    const nCrew = Math.max(0, n - nImp - nSh);
    const chances = r.querySelector('.rh-chances');
    if (chances) {
      const rows = [
        ['impostor', nImp, '#c0392b'],
        ['sheriff', nSh, '#3498db'],
        ['crewmate', nCrew, '#27ae60']
      ];
      chances.innerHTML = rows.map(([role, count, col]) => {
        const pct = Math.round((count / n) * 100);
        return `<div class="chance"><div class="chance-top"><span class="dot" style="background:${col}"></span>` +
          `<span class="chance-name">${esc(i18n.t('roles.' + role))}</span>` +
          `<span class="chance-val">${count}/${n} · %${pct}</span></div>` +
          `<div class="bar"><i style="width:${pct}%;background:${col}"></i></div></div>`;
      }).join('');
    }
    // Oyuncu listesi + test botları sheet içinde
    let pl = r.querySelector('.rh-sheet-players');
    if (!pl) {
      const panel = r.querySelector('.rh-match-sheet .sheet-panel');
      if (panel) {
        const sec = document.createElement('section');
        sec.className = 'card';
        sec.innerHTML = '<h2 data-t="online.players">Oyuncular</h2><div class="rh-sheet-players"></div><div class="rh-sheet-host"></div>';
        panel.insertBefore(sec, panel.firstChild.nextSibling); // after head-ish
        // put after head
        const head = panel.querySelector('.sheet-head');
        if (head && head.nextSibling) panel.insertBefore(sec, head.nextSibling);
        else panel.appendChild(sec);
        pl = sec.querySelector('.rh-sheet-players');
      }
    }
    if (pl) {
      pl.innerHTML = r.querySelector('.rh-players')?.innerHTML || '';
      const hostBox = r.querySelector('.rh-sheet-host');
      if (hostBox) {
        hostBox.innerHTML = host ? `<label class="toggle"><input type="checkbox" class="rh-bots-sheet2" ${room.bots?'checked':''}><span>${esc(i18n.t('online.bots'))}</span></label>
          <div class="rh-step"><span>${esc(i18n.t('online.botCount'))}</span><button type="button" data-botd="-1">−</button><b>${this.botCount}</b><button type="button" data-botd="1">+</button></div>` : '';
        hostBox.querySelector('.rh-bots-sheet2')?.addEventListener('change', (e) => net.roomSettings({ bots: e.target.checked }));
        hostBox.querySelectorAll('[data-botd]').forEach((b) => b.addEventListener('click', () => {
          this.botCount = Math.max(1, Math.min(24, this.botCount + Number(b.dataset.botd)));
          this.render();
        }));
      }
    }
    const sideBody = r.querySelector('.rh-cfg-body');
    if (sideBody) { sideBody.innerHTML = ''; sideBody.classList.add('hidden'); }
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

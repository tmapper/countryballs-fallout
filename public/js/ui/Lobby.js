// ============================================================
// Lobby.js - Lobi arayüzü (HTML), yürünen lobi odasının (LobbyScene) üstünde durur
// ============================================================
// Ekranda: başlık, dil, [Bayrak] [Ayarlar] butonları ve büyük [BAŞLAT].
// Bayrak ve Ayarlar alttan açılan panellerde (sheet). Ayarlar:
//   oyuncu sayısı (4-10), botlar açık/kapalı, rol şansları, rol testi.
// onStart(settings)  : Başlat'a basılınca  { myFlag, botFlags, playerCount, forcedRole, bots }
// onChange(state)    : bayrak/bot değişince (LobbyScene odadaki topları günceller)
import { i18n } from '../systems/I18n.js';
import { FLAG_LIST, getFlagThumb, getSavedFlag, saveFlag } from '../systems/Flags.js';
import { ROLES, ROLE_COLORS, MIN_PLAYERS, MAX_PLAYERS, roleChances } from '../systems/Roles.js';
import { requestSkins } from '../systems/CharacterAtlas.js';

const SETTINGS_KEY = 'cfs_lobby';

// Ayarlar butonu kaldırıldı: tek kişilik maç her zaman 6 kişi (5 bot), rol rastgele
function loadSettings() {
  return { playerCount: 6, forcedRole: 'random', bots: true };
}

const pct = (v) => `%${Math.round(v * 100)}`;

export class Lobby {
  constructor({ onStart, onChange, onMenu, onFlag, onHat }) {
    this.onHat = onHat;
    this.onStart = onStart;
    this.onFlag = onFlag;
    this.onMenu = onMenu;
    this.onChange = onChange || (() => {});
    this.myFlag = getSavedFlag();
    Object.assign(this, loadSettings());
    this.botFlags = [];
    this.root = null;
    i18n.onChange(() => this.root && this.render());
  }

  save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ playerCount: this.playerCount, forcedRole: this.forcedRole, bots: this.bots }));
    } catch (e) { /* yoksay */ }
  }

  state() {
    return { myFlag: this.myFlag, botFlags: this.bots ? [...this.botFlags] : [], playerCount: this.playerCount, forcedRole: this.forcedRole, bots: this.bots };
  }

  // Botlar için benimkinden farklı, birbirinden farklı rastgele bayraklar
  rollBots() {
    const pool = FLAG_LIST.filter((f) => f !== this.myFlag && !this.botFlags.includes(f));
    this.botFlags = this.botFlags.filter((f) => f !== this.myFlag).slice(0, this.playerCount - 1);
    while (this.botFlags.length < this.playerCount - 1) {
      const i = Math.floor(Math.random() * pool.length);
      this.botFlags.push(pool.splice(i, 1)[0]);
    }
  }

  changed() {
    this.save();
    this.render();
    // Maçtaki herkesin karakter dokusu lobideyken arka planda hazırlansın (maç başı donmasın)
    requestSkins([this.myFlag, ...(this.bots ? this.botFlags : [])]);
    this.onChange(this.state());
  }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'lobbyhud hidden';
    r.innerHTML = `
      <header class="lh-top">
        <div class="lh-titlebox">
          <div class="lobby-kicker" data-t="lobby.kicker"></div>
          <div class="lh-title" data-t="game.title"></div>
          <div class="lh-hint"></div>
        </div>
        <div class="lh-topbtns"><button class="btn btn-ghost menu-btn" type="button">‹ ${'MENU'}</button><button class="btn btn-ghost lang-btn" type="button"></button></div>
      </header>
      <div class="lh-actions">
        <button class="btn lh-btn flag-open hidden" type="button"><span class="ico">🇺🇳</span><span data-t="lobby.pickFlagBtn"></span></button>
        <button class="btn lh-btn hat-open hidden" type="button"><span class="ico">🎩</span><span data-t="lobby.pickHatBtn"></span></button>
        <button class="btn btn-start lh-start" type="button" data-t="lobby.start"></button>
      </div>

      <div class="sheet settings-sheet hidden" role="dialog">
        <div class="sheet-panel">
          <div class="sheet-head"><h2 data-t="lobby.settings"></h2><button class="btn sheet-close" type="button" aria-label="x">✕</button></div>
          <section class="card">
            <h2 data-t="lobby.players"></h2>
            <div class="stepper">
              <button class="btn btn-step" type="button" data-step="-1" aria-label="-">−</button>
              <div class="count"></div>
              <button class="btn btn-step" type="button" data-step="1" aria-label="+">+</button>
              <label class="toggle"><input type="checkbox" class="bots-toggle"><span data-t="lobby.bots"></span></label>
            </div>
            <p class="hint bots-hint"></p>
            <div class="chips"></div>
          </section>
          <section class="card">
            <h2 data-t="lobby.chances"></h2>
            <div class="chances"></div>
            <h2 class="mt" data-t="lobby.roleTest"></h2>
            <div class="seg"></div>
            <p class="hint" data-t="lobby.roleTestHint"></p>
          </section>
        </div>
      </div>`;
    document.body.appendChild(r);

    const seg = r.querySelector('.seg');
    ['random', ...ROLES].forEach((role) => {
      const b = document.createElement('button');
      b.className = 'seg-btn';
      b.type = 'button';
      b.dataset.role = role;
      b.addEventListener('click', () => { this.forcedRole = role; this.changed(); });
      seg.appendChild(b);
    });

    r.querySelectorAll('.btn-step').forEach((b) => b.addEventListener('click', () => {
      this.playerCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, this.playerCount + Number(b.dataset.step)));
      this.rollBots();
      this.changed();
    }));
    r.querySelector('.bots-toggle').addEventListener('change', (e) => { this.bots = e.target.checked; this.changed(); });
    r.querySelector('.lang-btn').addEventListener('click', () => i18n.toggle());
    r.querySelector('.menu-btn').addEventListener('click', () => this.onMenu && this.onMenu());
    r.querySelector('.flag-open').addEventListener('click', () => this.onFlag && this.onFlag());
    r.querySelector('.hat-open').addEventListener('click', () => this.onHat && this.onHat());
    r.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => {
      if (e.target === s || e.target.classList.contains('sheet-close')) this.closeSheets();
    }));
    r.querySelector('.lh-start').addEventListener('click', () => {
      this.closeSheets();
      // ÖNEMLİ: rol videosu sesli oynasın diye onStart bu tıklamanın içinde çağrılır
      this.onStart(this.state());
    });
  }

  openSheet(sel) {
    this.closeSheets();
    this.root.querySelector(sel).classList.remove('hidden');
  }

  closeSheets() {
    this.root.querySelectorAll('.sheet').forEach((s) => s.classList.add('hidden'));
  }

  render() {
    const r = this.root;
    document.documentElement.lang = i18n.lang; // büyük harf dönüşümü dile göre (i/İ)
    r.querySelectorAll('[data-t]').forEach((n) => { n.textContent = i18n.t(n.dataset.t); });
    r.querySelector('.lang-btn').textContent = i18n.t('ui.languageName');
    r.querySelector('.menu-btn').textContent = '‹ ' + i18n.t('menu.back');
    r.querySelector('.lh-hint').textContent = i18n.t('lobby.walkHint');
    r.querySelector('.count').textContent = this.playerCount;
    r.querySelector('[data-step="-1"]').disabled = this.playerCount <= MIN_PLAYERS;
    r.querySelector('[data-step="1"]').disabled = this.playerCount >= MAX_PLAYERS;
    r.querySelector('.bots-toggle').checked = this.bots;
    r.querySelector('.bots-hint').textContent = i18n.t(this.bots ? 'lobby.botsOnHint' : 'lobby.botsOffHint');

    const chips = r.querySelector('.chips');
    chips.innerHTML = '';
    [this.myFlag, ...(this.bots ? this.botFlags : [])].forEach((f, i) => {
      const c = document.createElement('div');
      c.className = 'chip' + (i === 0 ? ' chip-me' : '');
      c.innerHTML = `<img alt="" src="${getFlagThumb(f, 30, 20)}"><span>${i === 0 ? i18n.t('ui.you') : i18n.t('countries.' + f)}</span>`;
      chips.appendChild(c);
    });

    const ch = roleChances(this.playerCount);
    const n = this.playerCount;
    r.querySelector('.chances').innerHTML = ROLES.map((role) => {
      const count = Math.round(ch[role] * n);
      return `<div class="chance">
        <div class="chance-top"><span class="dot" style="background:${ROLE_COLORS[role]}"></span>
          <span class="chance-name">${i18n.t('roles.' + role)}</span>
          <span class="chance-val">${count}/${n} · ${pct(ch[role])}</span></div>
        <div class="bar"><i style="width:${ch[role] * 100}%;background:${ROLE_COLORS[role]}"></i></div>
      </div>`;
    }).join('');

    r.querySelectorAll('.seg-btn').forEach((b) => {
      const role = b.dataset.role;
      b.textContent = role === 'random' ? i18n.t('lobby.random') : i18n.t('roles.' + role);
      b.classList.toggle('on', role === this.forcedRole);
      b.style.setProperty('--c', role === 'random' ? '#ffcc00' : ROLE_COLORS[role]);
    });
  }

  show() {
    if (!this.root) this.build();
    if (this.botFlags.length !== this.playerCount - 1) this.rollBots();
    this.closeSheets();
    this.root.classList.remove('hidden');
    // Lobiye dokunarak dönüldüyse aynı dokunuş lobideki bir butona "tıklamasın"
    this.root.classList.add('guard');
    clearTimeout(this.guardTimer);
    this.guardTimer = setTimeout(() => this.root.classList.remove('guard'), 450);
    this.render();
    requestSkins([this.myFlag, ...(this.bots ? this.botFlags : [])]);
  }

  // BM direğinde seçilen bayrak (botlar başka bayraklara geçer)
  pickFlag(code) {
    this.myFlag = code;
    saveFlag(code);
    this.rollBots();
    this.changed();
  }

  // Bayrak butonu sadece BM direğinin yanındayken görünür (dokunmatik için)
  setFlagReady(on) {
    if (this.root) this.root.querySelector('.flag-open').classList.toggle('hidden', !on);
  }

  setHatReady(on) {
    if (this.root) this.root.querySelector('.hat-open').classList.toggle('hidden', !on);
  }

  // Başlat butonu sadece oyuncu kapıdaki başlat bölgesindeyken görünür
  setStartReady(on) {
    if (this.root) this.root.querySelector('.lh-start').classList.toggle('hidden', !on);
  }

  hide() {
    if (this.root) this.root.classList.add('hidden');
  }
}

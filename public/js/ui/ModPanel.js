// ============================================================
// ModPanel.js - Moderatörlük: sol üstte "ŞİFRE GİR" + moderatör paneli
// ============================================================
// - Hesap 20 kez odaya girip çıkınca (sunucu sayar: account.modUnlock) sol üstte kilit butonu çıkar.
// - 15 karakterlik moderatör kodu SUNUCUDA doğrulanır (tarayıcıda kod yok).
// - Moderatör olunca buton kalkana dönüşür ve paneli açar: oyuncu ara, ODADAN AT, BANLA / BANI KALDIR, HESABI SİL.
// Menünün .mm-modal yapısını kullanır (Esc ile kapanır, menü klavyesi araya girmez).
import { net } from '../systems/Net.js';
import { i18n } from '../systems/I18n.js';
import { icon } from './Icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const CODE_LEN = 15;
const T = {
  tr: {
    enterCode: 'ŞİFRE GİR', moderator: 'MODERATÖR', codeTitle: 'Moderatör Kodu', codeHint: '15 karakterlik moderatör kodunu gir. Kod doğruysa hesabın moderatör olur.',
    confirm: 'ONAYLA', back: 'Geri', panelTitle: 'Moderatör Paneli', search: 'Oyuncu ya da hesap ara…', refresh: 'Yenile',
    kick: 'AT', ban: 'BANLA', unban: 'BANI KALDIR', del: 'SİL', sure: 'EMİN MİSİN?', empty: 'Kimse bulunamadı.',
    online: 'çevrimiçi', offline: 'çevrimdışı', guest: 'misafir', banned: 'BANLI', inGame: 'maçta', room: 'oda',
    ok: 'Moderatörlük açıldı!',
    done: { kick: '{n} odadan atıldı', ban: '{n} banlandı', unban: '{n} banı kaldırıldı', delete: '{n} hesabı silindi' },
    err: { needLogin: 'Önce giriş yapmalısın.', locked: 'Henüz kilitli.', tooMany: 'Çok fazla deneme. 10 dakika sonra tekrar dene.', wrong: 'Kod yanlış.', len: 'Kod 15 karakter olmalı.',
      noPerm: 'Yetkin yok.', noUser: 'Oyuncu bulunamadı.', self: 'Kendine işlem yapamazsın.', protected: 'Bu kişi korumalı (moderatör).', notInRoom: 'Oyuncu bir odada değil.', guest: 'Misafirin hesabı yok; sadece odadan atılabilir.', bad: 'Geçersiz işlem.', slow: 'Biraz yavaş: bir saniye bekle.' },
    deleted: 'Hesabın bir moderatör tarafından silindi.',
  },
  en: {
    enterCode: 'ENTER CODE', moderator: 'MODERATOR', codeTitle: 'Moderator Code', codeHint: 'Enter the 15-character moderator code. If it is correct, your account becomes a moderator.',
    confirm: 'CONFIRM', back: 'Back', panelTitle: 'Moderator Panel', search: 'Search player or account…', refresh: 'Refresh',
    kick: 'KICK', ban: 'BAN', unban: 'UNBAN', del: 'DELETE', sure: 'SURE?', empty: 'Nobody found.',
    online: 'online', offline: 'offline', guest: 'guest', banned: 'BANNED', inGame: 'in match', room: 'room',
    ok: 'Moderator access granted!',
    done: { kick: '{n} was kicked', ban: '{n} was banned', unban: '{n} was unbanned', delete: '{n}\'s account was deleted' },
    err: { needLogin: 'Log in first.', locked: 'Still locked.', tooMany: 'Too many tries. Try again in 10 minutes.', wrong: 'Wrong code.', len: 'The code must be 15 characters.',
      noPerm: 'No permission.', noUser: 'Player not found.', self: 'You cannot target yourself.', protected: 'This person is protected (moderator).', notInRoom: 'Player is not in a room.', guest: 'Guests have no account; they can only be kicked.', bad: 'Invalid action.', slow: 'Slow down a little.' },
    deleted: 'Your account was deleted by a moderator.',
  },
  ru: {
    enterCode: 'ВВЕСТИ КОД', moderator: 'МОДЕРАТОР', codeTitle: 'Код модератора', codeHint: 'Введи 15-символьный код модератора. Если код верный, аккаунт станет модераторским.',
    confirm: 'ПОДТВЕРДИТЬ', back: 'Назад', panelTitle: 'Панель модератора', search: 'Поиск игрока или аккаунта…', refresh: 'Обновить',
    kick: 'ВЫГНАТЬ', ban: 'БАН', unban: 'РАЗБАН', del: 'УДАЛИТЬ', sure: 'ТОЧНО?', empty: 'Никого не найдено.',
    online: 'в сети', offline: 'не в сети', guest: 'гость', banned: 'БАН', inGame: 'в матче', room: 'комната',
    ok: 'Права модератора выданы!',
    done: { kick: '{n} выгнан из комнаты', ban: '{n} забанен', unban: '{n} разбанен', delete: 'Аккаунт {n} удалён' },
    err: { needLogin: 'Сначала войди.', locked: 'Ещё заблокировано.', tooMany: 'Слишком много попыток. Попробуй через 10 минут.', wrong: 'Неверный код.', len: 'Код должен быть 15 символов.',
      noPerm: 'Нет прав.', noUser: 'Игрок не найден.', self: 'Нельзя применить к себе.', protected: 'Этот человек защищён (модератор).', notInRoom: 'Игрок не в комнате.', guest: 'У гостя нет аккаунта; можно только выгнать.', bad: 'Неверное действие.', slow: 'Подожди секунду.' },
    deleted: 'Твой аккаунт удалён модератором.',
  },
};
const L = () => T[i18n.lang] || T.en;

class ModPanel {
  constructor() { this.menu = null; this.root = null; this.list = []; this.sure = null; this.q = ''; }

  // MainMenu.build() çağırır: buton + iki pencere menünün içine eklenir
  attach(menu) {
    this.menu = menu;
    const r = this.root = menu.root;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mm-modbtn hidden';
    r.appendChild(btn);
    btn.addEventListener('click', () => (this.isMod() ? this.openPanel() : this.openCode()));
    this.btn = btn;

    const code = document.createElement('div');
    code.className = 'mm-modal hidden'; code.dataset.m = 'modcode';
    code.innerHTML = `<div class="mm-card term mod-card">
      <h2 class="mod-h"></h2><p class="mm-hint mod-hint"></p>
      <div class="mod-code-row"><input class="mod-code" maxlength="${CODE_LEN}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done"><span class="mod-count">0/${CODE_LEN}</span></div>
      <p class="mm-auth-err mod-err"></p>
      <button class="mm-tbtn primary mod-go" type="button" disabled></button>
      <button class="mm-link mod-back" type="button"></button></div>`;
    r.appendChild(code);
    const panel = document.createElement('div');
    panel.className = 'mm-modal hidden'; panel.dataset.m = 'modpanel';
    panel.innerHTML = `<div class="mm-card term mod-card mod-panel">
      <h2 class="mod-h2"></h2>
      <div class="mod-tools"><input class="mod-q" maxlength="24" autocomplete="off" spellcheck="false"><button class="mm-tbtn small mod-refresh" type="button"></button></div>
      <p class="mm-hint mod-msg"></p>
      <div class="mod-list"></div>
      <button class="mm-tbtn mod-back" type="button"></button></div>`;
    r.appendChild(panel);
    this.codeEl = code; this.panelEl = panel;

    // Menünün ok tuşu / Enter dinleyicisi araya girmesin
    [code, panel].forEach((m) => m.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); }));
    const inp = code.querySelector('.mod-code');
    inp.addEventListener('input', () => {
      const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
      if (v !== inp.value) inp.value = v;
      code.querySelector('.mod-count').textContent = `${v.length}/${CODE_LEN}`;
      code.querySelector('.mod-go').disabled = v.length !== CODE_LEN;
      code.querySelector('.mod-err').textContent = '';
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.length === CODE_LEN) this.submit(); });
    code.querySelector('.mod-go').addEventListener('click', () => this.submit());
    r.querySelectorAll('.mod-back').forEach((b) => b.addEventListener('click', () => menu.closeModal()));
    const q = panel.querySelector('.mod-q');
    let qt = 0;
    q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { this.q = q.value.trim(); this.fetch(); }, 250); });
    panel.querySelector('.mod-refresh').addEventListener('click', () => this.fetch());
    panel.querySelector('.mod-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const sureKey = b.dataset.a + ':' + (b.dataset.k || b.dataset.id);
      if ((b.dataset.a === 'delete' || b.dataset.a === 'ban') && this.sure !== sureKey) {      // tehlikeli işlem: iki kez bas
        this.sure = sureKey; clearTimeout(this.sureT); this.sureT = setTimeout(() => { this.sure = null; this.renderList(); }, 3500);
        this.renderList(); return;
      }
      this.sure = null;
      net.send({ t: 'modAct', action: b.dataset.a, key: b.dataset.k || undefined, id: b.dataset.id || undefined, q: this.q });
    });

    net.on('modOk', (m) => {
      if (m.account) net.account = m.account;
      this.refresh(); menu.renderAccount && menu.renderAccount();
      code.querySelector('.mod-err').textContent = '';
      this.flash(L().ok); this.openPanel();
    });
    net.on('modErr', (m) => {
      const msg = L().err[m.code] || L().err.bad;
      if (!code.classList.contains('hidden')) {
        const e = code.querySelector('.mod-err');
        e.textContent = msg + (m.code === 'wrong' && m.left >= 0 ? ` (${m.left})` : '');
        e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake');
      } else this.flash(msg, true);
    });
    net.on('modList', (m) => { this.list = Array.isArray(m.list) ? m.list : []; this.renderList(); });
    net.on('modDone', (m) => { this.flash((L().done[m.action] || '{n}').replace('{n}', m.name || '')); });
    net.on('account', (m) => { this.refresh(); if (m.deleted) setTimeout(() => { try { window.alert(L().deleted); } catch (e) { /* yoksay */ } }, 200); });
    net.on('status', () => this.refresh());
    i18n.onChange(() => this.texts());
    this.texts(); this.refresh();
  }

  isMod() { const a = net.account; return !!(a && (a.mod || a.admin)); }

  // Sol üst buton: kilit (20 giriş-çıkıştan sonra) ya da kalkan (moderatör)
  refresh() {
    if (!this.btn) return;
    const a = net.account, show = !!(a && (a.modUnlock || a.mod || a.admin));
    this.btn.classList.toggle('hidden', !show);
    this.root.classList.toggle('has-mod', show);
    this.btn.classList.toggle('on', this.isMod());
    this.btn.innerHTML = this.isMod() ? `${icon('shield')}<span>${esc(L().moderator)}</span>` : `${icon('lock')}<span>${esc(L().enterCode)}</span>`;
  }

  texts() {
    const t = L(), c = this.codeEl, p = this.panelEl;
    if (!c) return;
    c.querySelector('.mod-h').innerHTML = `${icon('key')} ${esc(t.codeTitle)}`;
    c.querySelector('.mod-hint').textContent = t.codeHint;
    c.querySelector('.mod-go').textContent = t.confirm;
    this.root.querySelectorAll('.mod-back').forEach((b) => { b.textContent = t.back; });
    p.querySelector('.mod-h2').innerHTML = `${icon('shield')} ${esc(t.panelTitle)}`;
    p.querySelector('.mod-q').placeholder = t.search;
    p.querySelector('.mod-refresh').innerHTML = `${icon('refresh')} ${esc(t.refresh)}`;
    this.refresh(); this.renderList();
  }

  openCode() {
    this.menu.openModal('modcode');
    const inp = this.codeEl.querySelector('.mod-code');
    inp.value = ''; inp.dispatchEvent(new Event('input'));
    setTimeout(() => inp.focus(), 50);
  }
  submit() {
    const v = this.codeEl.querySelector('.mod-code').value;
    if (v.length === CODE_LEN) net.send({ t: 'modCode', code: v });
  }
  openPanel() {
    this.menu.openModal('modpanel');
    this.panelEl.querySelector('.mod-msg').textContent = '';
    this.fetch();
  }
  fetch() { net.send({ t: 'modList', q: this.q }); }
  flash(text, bad) {
    const m = this.panelEl && this.panelEl.querySelector('.mod-msg');
    if (!m) return;
    m.textContent = text; m.classList.toggle('bad', !!bad);
    clearTimeout(this.flashT); this.flashT = setTimeout(() => { m.textContent = ''; }, 4000);
  }

  renderList() {
    const box = this.panelEl && this.panelEl.querySelector('.mod-list');
    if (!box) return;
    const t = L();
    if (!this.list.length) { box.innerHTML = `<div class="mod-empty">${esc(t.empty)}</div>`; return; }
    box.innerHTML = this.list.map((p) => {
      const k = p.key ? ` data-k="${esc(p.key)}"` : ` data-id="${esc(p.id)}"`;
      const tag = (cls, txt) => `<i class="mod-tag ${cls}">${esc(txt)}</i>`;
      const tags = [p.online ? tag('on', t.online) : tag('off', t.offline)];
      if (p.room) tags.push(tag('room', `${p.inGame ? t.inGame : t.room} ${p.room}`));
      if (p.guest) tags.push(tag('off', t.guest));
      if (p.banned) tags.push(tag('ban', t.banned));
      if (p.mod || p.admin) tags.push(tag('mod', 'MOD'));
      const prot = (p.mod || p.admin) && !this.isMod(); // yetkili yetkiliye işlem yapabilir
      const b = (a, ic, txt, cls = '') => {
        const sure = this.sure === a + ':' + (p.key || p.id);
        return `<button type="button" class="mod-act ${cls}${sure ? ' sure' : ''}" data-a="${a}"${k}>${icon(ic)}<span>${esc(sure ? t.sure : txt)}</span></button>`;
      };
      const acts = prot ? '' : [
        p.room ? b('kick', 'kick', t.kick) : '',
        p.guest ? '' : (p.banned ? b('unban', 'check', t.unban, 'ok') : b('ban', 'ban', t.ban, 'warn')),
        p.guest ? '' : b('delete', 'trash', t.del, 'bad'),
      ].join('');
      return `<div class="mod-row"><div class="mod-who">${icon(p.guest ? 'user' : 'user')}<b>${esc(p.name)}</b>${p.key && p.key !== String(p.name).toLocaleLowerCase('tr') ? `<small>@${esc(p.key)}</small>` : ''}<span class="mod-tags">${tags.join('')}</span></div><div class="mod-acts">${acts}</div></div>`;
    }).join('');
  }
}

export const modPanel = new ModPanel();

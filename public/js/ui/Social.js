// ============================================================
// Social.js - Arkadaşlar + Sıralama paneli, odaya davet, gelen davet bildirimi
// ============================================================
//   social.open('friends' | 'board')      (ana menüden, giriş gerekir)
//   social.openInvite()                    (odadayken: çevrimiçi arkadaşları davet et)
// Veriler sunucuda (hesapla birlikte). Panel açıkken 8 sn'de bir yenilenir.
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { titleName } from '../systems/Levels.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

class Social {
  constructor() { this.root = null; this.tab = 'friends'; this.period = 'week'; this.data = { friends: [], requests: [] }; this.boards = {}; this.inviteMode = false; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'social hidden';
    r.innerHTML = `<div class="so-card">
      <div class="so-head"><div class="so-tabs"><button type="button" data-tab="friends"></button><button type="button" data-tab="board"></button></div><button class="so-x" type="button">✕</button></div>
      <div class="so-body"></div><div class="so-msg"></div></div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.so-x').addEventListener('click', () => this.close());
    r.querySelectorAll('.so-tabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.refresh(); this.render(); }));
    r.addEventListener('keydown', (e) => e.stopPropagation());
    r.addEventListener('keyup', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    net.on('social', (m) => { this.data = m; this.updateBadge(); if (this.isOpen) this.render(); });
    net.on('board', (m) => { this.boards[m.period] = m; if (this.isOpen) this.render(); });
    net.on('socialOk', (m) => this.msg(i18n.t('social.ok_' + m.code)));
    net.on('socialError', (m) => this.msg(i18n.t('social.err_' + m.code), true));
    // Gelen davet: her ekranda küçük bir kart
    net.on('invite', (m) => this.showInvite(m));
    i18n.onChange(() => this.isOpen && this.render());
  }

  ensure() { if (!this.root) this.build(); }

  msg(text, bad) {
    if (!this.root) return;
    const e = this.root.querySelector('.so-msg');
    e.textContent = text; e.classList.toggle('bad', !!bad);
    clearTimeout(this.msgT); this.msgT = setTimeout(() => { e.textContent = ''; }, 3500);
  }

  refresh() {
    if (this.tab === 'friends' || this.inviteMode) net.social(); else net.board(this.period);
  }

  open(tab = 'friends') {
    this.ensure();
    this.inviteMode = false;
    this.tab = tab;
    this.show();
  }

  openInvite() {
    this.ensure();
    this.inviteMode = true;
    this.tab = 'friends';
    this.show();
  }

  show() {
    this.root.classList.remove('hidden');
    this.root.classList.toggle('invite', this.inviteMode);
    this.isOpen = true;
    this.render();
    this.refresh();
    clearInterval(this.poll);
    this.poll = setInterval(() => { if (!document.hidden) this.refresh(); }, 8000);
  }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; clearInterval(this.poll); }

  updateBadge() { document.dispatchEvent(new CustomEvent('cfs-social', { detail: (this.data.requests || []).length })); }

  render() {
    const r = this.root, body = r.querySelector('.so-body');
    r.querySelectorAll('.so-tabs button').forEach((b) => {
      b.textContent = i18n.t(b.dataset.tab === 'friends' ? (this.inviteMode ? 'social.inviteTitle' : 'social.friends') : 'social.board');
      b.classList.toggle('on', b.dataset.tab === this.tab);
      b.classList.toggle('hidden', this.inviteMode && b.dataset.tab === 'board');
    });
    if (!net.account) { body.innerHTML = `<p class="so-empty">${esc(i18n.t('social.needLogin'))}</p>`; return; }
    if (this.tab === 'board') { this.renderBoard(body); return; }
    const { friends = [], requests = [] } = this.data;
    const sorted = friends.slice().sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
    const list = this.inviteMode ? sorted.filter((f) => f.online) : sorted;
    body.innerHTML = `
      ${this.inviteMode ? '' : `<div class="so-add"><input class="so-name" maxlength="16" placeholder="${esc(i18n.t('social.addPh'))}" autocomplete="off" spellcheck="false"><button class="so-btn primary" data-a="add" type="button">${esc(i18n.t('social.add'))}</button></div>`}
      ${!this.inviteMode && requests.length ? `<h4>${esc(i18n.t('social.requests'))}</h4>${requests.map((n) => `<div class="so-row req"><b>${esc(n)}</b><span></span><button class="so-btn primary" data-a="acc" data-n="${esc(n)}" type="button">✓</button><button class="so-btn" data-a="rej" data-n="${esc(n)}" type="button">✕</button></div>`).join('')}` : ''}
      <h4>${esc(i18n.t(this.inviteMode ? 'social.onlineFriends' : 'social.friendsN', { n: friends.length }))}</h4>
      ${list.length ? list.map((f) => `<div class="so-row"><i class="so-dot${f.online ? ' on' : ''}"></i><b>${esc(f.name)}</b><span>${esc(i18n.t('menu.level', { n: f.level }))} · ${esc(f.online ? (f.inGame ? i18n.t('social.inGame') : f.room ? i18n.t('social.inRoom') : i18n.t('social.online')) : i18n.t('social.offline'))}</span>
        ${this.inviteMode ? `<button class="so-btn primary" data-a="inv" data-n="${esc(f.name)}" type="button">${esc(i18n.t('social.invite'))}</button>`
          : `${f.room && !net.inRoom ? `<button class="so-btn primary" data-a="join" data-c="${esc(f.room)}" type="button">${esc(i18n.t('social.join'))}</button>` : ''}<button class="so-btn ghost" data-a="del" data-n="${esc(f.name)}" type="button" title="${esc(i18n.t('social.remove'))}">🗑</button>`}</div>`).join('')
        : `<p class="so-empty">${esc(i18n.t(this.inviteMode ? 'social.noOnline' : 'social.noFriends'))}</p>`}`;
    const name = body.querySelector('.so-name');
    const add = () => { const v = name.value.trim(); if (v) { net.friendAdd(v); name.value = ''; } };
    if (name) name.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a, n = b.dataset.n;
      if (a === 'add') add();
      else if (a === 'acc' || a === 'rej') net.friendAnswer(n, a === 'acc');
      else if (a === 'del') { if (b.dataset.sure) net.friendRemove(n); else { b.dataset.sure = '1'; b.textContent = i18n.t('social.sure'); } }
      else if (a === 'inv') { net.invite(n); b.disabled = true; setTimeout(() => { b.disabled = false; }, 2500); }
      else if (a === 'join') { this.close(); this.onJoin && this.onJoin(b.dataset.c); }
    }));
  }

  renderBoard(body) {
    const b = this.boards[this.period];
    const seg = `<div class="so-seg"><button type="button" data-p="week" class="${this.period === 'week' ? 'on' : ''}">${esc(i18n.t('social.week'))}</button><button type="button" data-p="all" class="${this.period === 'all' ? 'on' : ''}">${esc(i18n.t('social.all'))}</button></div>`;
    const me = net.account && net.account.name;
    const row = (x) => `<div class="so-rank${x.name === me ? ' me' : ''}${x.rank <= 3 ? ' top' + x.rank : ''}"><em>${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</em><b>${esc(x.name)}</b><span>${esc(i18n.t('menu.level', { n: x.level }))} · ${esc(titleName(x.title))}</span><strong>${x.value} XP</strong></div>`;
    body.innerHTML = seg + (!b ? `<p class="so-empty">…</p>` : b.top.length
      ? b.top.map(row).join('') + (b.me && b.me.rank > b.top.length ? `<div class="so-gap">⋯</div>${row(b.me)}` : '') + `<p class="so-note">${esc(i18n.t(this.period === 'week' ? 'social.weekNote' : 'social.allNote', { n: b.total }))}</p>`
      : `<p class="so-empty">${esc(i18n.t('social.boardEmpty'))}</p>`);
    body.querySelectorAll('[data-p]').forEach((x) => x.addEventListener('click', () => { this.period = x.dataset.p; this.render(); this.refresh(); }));
  }

  // Davet kartı (sağ üstte, 12 sn)
  showInvite(m) {
    const d = document.createElement('div');
    d.className = 'so-invite';
    d.innerHTML = `<div>📨 <b>${esc(m.from)}</b> ${esc(i18n.t('social.invitedYou', { room: m.room }))}</div><div class="so-inv-btns"><button class="so-btn primary" type="button">${esc(i18n.t('social.join'))}</button><button class="so-btn" type="button">${esc(i18n.t('social.ignore'))}</button></div>`;
    document.body.appendChild(d);
    const [yes, no] = d.querySelectorAll('button');
    const done = () => d.remove();
    yes.addEventListener('click', () => { done(); this.close(); if (this.onJoin) this.onJoin(m.code); });
    no.addEventListener('click', done);
    setTimeout(done, 12000);
  }
}

export const social = new Social();

// ============================================================
// MeetingScreen.js - Toplantı / oylama ekranı (HTML)
// ============================================================
// Akışı GameScene yönetir; bu dosya sadece gösterir ve oyuncunun oyunu bildirir.
//   open({ title, sub, reporterFlag, players: [{ id, flag, name, alive, me }], canVote, onVote(id|'skip') })
//   setPhase('discuss'|'vote', saniye)   addChat(flag, name, text)   markVoted(id)
//   showResults({ [id]: [voterFlag...] }, skipVoterFlags)   showEject(line1, line2, flag)   close()
import { i18n } from '../systems/I18n.js';
import { getFlagThumb } from '../systems/Flags.js';
import { wireChatInput, releaseGameKeys } from './Chat.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export class MeetingScreen {
  constructor() { this.root = null; this.opts = null; this.phase = null; this.myVote = null; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'meeting hidden';
    r.innerHTML = `
      <div class="mt-panel">
        <div class="mt-head">
          <img class="mt-reporter" alt="">
          <div><h1 class="mt-title"></h1><div class="mt-sub"></div></div>
          <div class="mt-timer"><span class="mt-phase"></span><b class="mt-time"></b></div>
        </div>
        <div class="mt-body">
          <div class="mt-grid-wrap">
            <div class="mt-grid"></div>
            <div class="mt-quick-panel hidden"></div>
          </div>
          <div class="mt-chat"><div class="mt-chat-title"></div><div class="mt-chat-list"></div>
          <div class="mt-quick">
            <button type="button" class="mt-qbtn" data-q="phrases">💬</button>
            <button type="button" class="mt-qbtn" data-q="suspect">⚠</button>
          </div>
          <div class="mt-chat-row"><input class="mt-chat-input" autocomplete="off" spellcheck="false" enterkeyhint="send"><button class="mt-chat-send" type="button">➤</button></div></div>
        </div>
        <div class="mt-foot">
          <button class="btn mt-skip" type="button"></button>
          <div class="mt-skipvotes"></div>
          <div class="mt-note"></div>
        </div>
      </div>
      <div class="mt-eject hidden"><img alt=""><div class="mt-eject-1"></div><div class="mt-eject-2"></div></div>
      <div class="mt-splash hidden"><img alt=""><div class="mt-splash-text"></div></div>`;
    document.body.appendChild(r);
    r.querySelector('.mt-skip').addEventListener('click', () => this.vote('skip'));
    r.addEventListener('pointerdown', (e) => e.stopPropagation());
    const inp = this.chatInput = r.querySelector('.mt-chat-input');
    const send = (v) => { const now = performance.now(); if (now - (this.lastSend || 0) < 600) return; this.lastSend = now; if (this.opts && this.opts.onChat) this.opts.onChat(v); };
    wireChatInput(inp, send);
    r.querySelector('.mt-chat-send').addEventListener('click', () => { const v = inp.value.trim(); if (v) { send(v); inp.value = ''; } inp.focus(); });
    r.querySelectorAll('.mt-qbtn').forEach((b) => b.addEventListener('click', () => this.openQuick(b.dataset.q)));
  }

  open(opts) {
    if (!this.root) this.build();
    this.opts = opts;
    this.myVote = null;
    const r = this.root;
    r.classList.remove('hidden', 'closing');
    r.querySelector('.mt-eject').classList.add('hidden');
    // Önce Among Us gibi büyük bir giriş ekranı, sonra panel kayarak gelir
    const sp = r.querySelector('.mt-splash');
    sp.querySelector('img').src = getFlagThumb(opts.reporterFlag, 120, 80);
    sp.querySelector('.mt-splash-text').textContent = opts.title;
    sp.dataset.kind = opts.kind || 'body';
    sp.classList.remove('hidden', 'anim'); void sp.offsetWidth; sp.classList.add('anim');
    clearTimeout(this.splashT);
    this.splashT = setTimeout(() => sp.classList.add('hidden'), 1500);
    const panel = r.querySelector('.mt-panel');
    panel.classList.remove('hidden', 'enter'); void panel.offsetWidth; panel.classList.add('enter');
    r.querySelector('.mt-title').textContent = opts.title;
    r.querySelector('.mt-sub').textContent = opts.sub;
    r.querySelector('.mt-reporter').src = getFlagThumb(opts.reporterFlag, 60, 40);
    r.querySelector('.mt-chat-title').textContent = i18n.t('meeting.chat');
    r.querySelector('.mt-chat-list').innerHTML = '';
    this.chatInput.value = '';
    this.chatInput.placeholder = i18n.t(opts.ghost ? 'chat.ghostPlaceholder' : 'chat.placeholder');
    r.querySelector('.mt-chat-row').classList.toggle('hidden', !opts.onChat);
    r.querySelector('.mt-chat').classList.toggle('ghost', !!opts.ghost);
    releaseGameKeys();
    r.querySelector('.mt-skip').textContent = i18n.t('meeting.skip');
    r.querySelector('.mt-skipvotes').innerHTML = '';
    r.querySelector('.mt-note').textContent = opts.canVote ? '' : i18n.t('meeting.ghostNoVote');
    const grid = r.querySelector('.mt-grid');
    grid.innerHTML = opts.players.map((p, i) => `
      <button style="--i:${i}" class="mt-player${p.alive ? '' : ' dead'}${p.me ? ' me' : ''}" type="button" data-id="${p.id}" ${p.alive ? '' : 'disabled'}>
        <span class="mt-ball" style="background-image:url(${getFlagThumb(p.flag, 60, 40)})"></span>
        <span class="mt-name">${esc(p.name)}${p.me ? ` <i>(${esc(i18n.t('ui.you'))})</i>` : ''}</span>
        <span class="mt-voted">${esc(i18n.t('meeting.voted'))}</span>
        <span class="mt-votes"></span>
      </button>`).join('');
    grid.querySelectorAll('.mt-player').forEach((b) => b.addEventListener('click', () => this.vote(b.dataset.id)));
    this.setPhase('discuss', 0);
  }

  setPhase(phase, secs) {
    if (!this.root) return;
    this.phase = phase;
    const r = this.root;
    r.dataset.phase = phase;
    r.querySelector('.mt-phase').textContent = i18n.t(phase === 'vote' ? 'meeting.vote' : phase === 'results' ? 'meeting.results' : 'meeting.discuss');
    r.querySelector('.mt-time').textContent = secs > 0 ? i18n.t('meeting.timeLeft', { s: Math.ceil(secs) }) : '';
    const canVote = this.opts && this.opts.canVote && phase === 'vote' && !this.myVote;
    r.classList.toggle('can-vote', !!canVote);
  }

  openQuick(mode) {
    const panel = this.root.querySelector('.mt-quick-panel');
    if (!panel || !this.opts) return;
    panel.classList.remove('hidden');
    if (mode === 'phrases') {
      const raw = (i18n.data[i18n.lang] && i18n.data[i18n.lang].chat && i18n.data[i18n.lang].chat.phrases)
        || (i18n.data.tr && i18n.data.tr.chat && i18n.data.tr.chat.phrases) || [];
      const phrases = Array.isArray(raw) && raw.length ? raw : ['...'];
      panel.innerHTML = `<div class="mt-qp-title">${esc(i18n.t('chat.quickTitle') || 'Quick')}</div>` +
        phrases.slice(0, 10).map((t) => `<button type="button" class="mt-qp-item" data-text="${esc(t)}">${esc(t)}</button>`).join('') +
        `<button type="button" class="mt-qp-close">✕</button>`;
      panel.querySelectorAll('[data-text]').forEach((b) => b.addEventListener('click', () => {
        panel.classList.add('hidden');
        if (this.opts.onChat) this.opts.onChat(b.dataset.text);
      }));
    } else {
      const alive = (this.opts.players || []).filter((p) => p.alive && !p.me);
      panel.innerHTML = `<div class="mt-qp-title">${esc(i18n.t('chat.suspectBtn') || 'Suspect')}</div>` +
        alive.map((p) => `<button type="button" class="mt-qp-item" data-name="${esc(p.name)}">${esc(p.name)}</button>`).join('') +
        `<button type="button" class="mt-qp-close">✕</button>`;
      panel.querySelectorAll('[data-name]').forEach((b) => b.addEventListener('click', () => {
        panel.classList.add('hidden');
        const msg = i18n.t('chat.suspectOf', { name: b.dataset.name }) || (b.dataset.name + ' şüpheli');
        if (this.opts.onChat) this.opts.onChat(msg);
      }));
    }
    const c = panel.querySelector('.mt-qp-close');
    if (c) c.addEventListener('click', () => panel.classList.add('hidden'));
  }

  vote(id) {
    if (!this.opts || !this.opts.canVote || this.phase !== 'vote' || this.myVote) return;
    this.myVote = id;
    this.root.classList.remove('can-vote');
    this.root.querySelector('.mt-note').textContent = i18n.t('meeting.youVoted');
    const b = this.root.querySelector(`.mt-player[data-id="${id}"]`);
    if (b) b.classList.add('chosen'); else this.root.querySelector('.mt-skip').classList.add('chosen');
    this.opts.onVote(id);
  }

  markVoted(id) {
    const b = this.root && this.root.querySelector(`.mt-player[data-id="${id}"]`);
    if (b) b.classList.add('has-voted');
  }

  addChat(flag, name, text, opt = {}) {
    if (!this.root) return;
    const list = this.root.querySelector('.mt-chat-list');
    const d = document.createElement('div');
    d.className = 'mt-msg' + (opt.ghost ? ' ghost' : '') + (opt.mine ? ' mine' : '');
    d.innerHTML = `<img alt="" src="${getFlagThumb(flag, 30, 20)}"><div><b>${opt.ghost ? '👻 ' : ''}${esc(name)}</b><span>${esc(text)}</span></div>`;
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
  }

  showResults(votes, skips) {
    const r = this.root;
    this.setPhase('results', 0);
    r.querySelectorAll('.mt-player').forEach((b) => {
      const v = votes[b.dataset.id] || [];
      b.querySelector('.mt-votes').innerHTML = v.map((f, k) => `<img style="--k:${k}" alt="" src="${getFlagThumb(f, 24, 16)}">`).join('');
    });
    r.querySelector('.mt-skipvotes').innerHTML = skips.length
      ? `<span>${esc(i18n.t('meeting.skipped'))}:</span>` + skips.map((f, k) => `<img style="--k:${k}" alt="" src="${getFlagThumb(f, 24, 16)}">`).join('')
      : '';
  }

  showEject(line1, line2, flag) {
    const r = this.root;
    r.querySelector('.mt-panel').classList.add('hidden');
    const e = r.querySelector('.mt-eject');
    e.classList.remove('hidden');
    const img = e.querySelector('img');
    img.style.display = flag ? '' : 'none';
    if (flag) img.src = getFlagThumb(flag, 120, 80);
    e.querySelector('.mt-eject-1').textContent = line1;
    e.querySelector('.mt-eject-2').textContent = line2 || '';
    e.classList.remove('anim'); void e.offsetWidth; e.classList.add('anim');
  }

  close() {
    if (this.chatInput) this.chatInput.blur();
    this.opts = null;
    this.phase = null;
    if (!this.root || this.root.classList.contains('hidden')) return;
    // Solarak kapanır
    this.root.classList.add('closing');
    clearTimeout(this.closeT);
    this.closeT = setTimeout(() => { if (!this.opts) this.root.classList.add('hidden'); this.root.classList.remove('closing'); }, 380);
  }
}

// ---------------- Sabotaj seçim menüsü (Katil) ----------------
export class SabotageMenu {
  constructor() { this.root = null; this.isOpen = false; }

  open(types, onPick) {
    if (!this.root) {
      const r = this.root = document.createElement('div');
      r.className = 'sabmenu hidden';
      document.body.appendChild(r);
      r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    }
    const icons = { lights: '⚡', reactor: '☢', o2: '💨' };
    this.root.innerHTML = `<div class="sab-panel"><h2>${esc(i18n.t('sabotage.title'))}</h2>
      ${types.map((t, i) => `<button class="btn sab-opt" type="button" data-t="${t}"><span class="sab-ico">${icons[t]}</span>${esc(i18n.t('sabotage.' + t))}<kbd>${i + 1}</kbd></button>`).join('')}
      <button class="btn sab-close" type="button">${esc(i18n.t('sabotage.close'))}</button></div>`;
    this.root.querySelectorAll('.sab-opt').forEach((b) => b.addEventListener('click', () => { this.close(); onPick(b.dataset.t); }));
    this.root.querySelector('.sab-close').addEventListener('click', () => this.close());
    this.onPick = onPick;
    this.types = types;
    this.root.classList.remove('hidden');
    const panel = this.root.querySelector('.sab-panel');
    panel.classList.remove('pop'); void panel.offsetWidth; panel.classList.add('pop');
    this.isOpen = true;
  }

  pickIndex(i) { if (this.isOpen && this.types[i]) { const t = this.types[i]; this.close(); this.onPick(t); } }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; }
}

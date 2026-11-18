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
import { icon } from './Icons.js';
import { WORLD, ROOMS, CORRIDORS } from '../map/BunkerMap.js';

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
          <div class="mt-steps"><i data-s="discuss"></i><i data-s="vote"></i><i data-s="results"></i></div>
          <div class="mt-timer"><svg class="mt-ring" viewBox="0 0 44 44"><circle class="mt-ring-bg" cx="22" cy="22" r="19"/><circle class="mt-ring-fg" cx="22" cy="22" r="19" pathLength="100"/></svg><b class="mt-time"></b><span class="mt-phase"></span></div>
        </div>
        <div class="mt-bar"><i></i></div>
        <div class="mt-where">${icon('users')}<span></span></div>
        <div class="mt-map-wrap"><canvas class="mt-map" width="360" height="200"></canvas><span class="mt-map-legend"></span></div>
        <div class="mt-body">
          <div class="mt-grid-wrap">
            <div class="mt-grid"></div>
            <div class="mt-quick-panel hidden"></div>
          </div>
          <div class="mt-chat"><div class="mt-chat-title"></div><div class="mt-chat-list"></div>
          <div class="mt-quick">
            <button type="button" class="mt-qbtn" data-q="phrases">${icon('chat')}</button>
            <button type="button" class="mt-qbtn" data-q="suspect">${icon('eye')}</button>
          </div>
          <div class="mt-chat-row"><input class="mt-chat-input" autocomplete="off" spellcheck="false" enterkeyhint="send"><button class="mt-chat-send" type="button">${icon('send')}</button></div></div>
        </div>
        <div class="mt-foot">
          <button class="btn mt-skip" type="button">${icon('close')}<span></span><em class="mt-skipn"></em></button>
          <div class="mt-skipvotes"></div>
          <div class="mt-progress"><div class="mt-count"></div><div class="mt-pbar"><i></i></div></div>
          <div class="mt-note"></div>
        </div>
      </div>
      <div class="mt-eject hidden"><img alt=""><div class="mt-eject-1"></div><div class="mt-eject-2"></div></div>
      <div class="mt-splash hidden"><img alt=""><div class="mt-splash-text"></div></div>`;
    document.body.appendChild(r);
    r.querySelector('.mt-skip').addEventListener('click', (e) => { e.stopPropagation(); this.pick('skip'); });
    // Kartlar: 1. dokunuş seçer (onay balonu açılır), ✓ oyu verir, ✕ / boş yere dokunmak vazgeçer
    r.querySelector('.mt-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.mt-player');
      if (e.target.closest('.mt-yes')) { e.stopPropagation(); if (this.pending) this.vote(this.pending); return; }
      if (e.target.closest('.mt-no')) { e.stopPropagation(); this.setPending(null); return; }
      if (card && !card.classList.contains('dead')) { e.stopPropagation(); this.pick(card.dataset.id); }
    });
    r.querySelector('.mt-panel').addEventListener('click', () => this.setPending(null));
    // Klavye: 0 = GEÇ (iki kez basınca onay), Esc = seçimi bırak
    window.addEventListener('keydown', (e) => {
      if (!this.root || this.root.classList.contains('hidden') || this.phase !== 'vote') return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); this.pick('skip'); }
    });
    r.querySelector('.mt-skip').title = '0';
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
    this.pending = null;
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
    r.querySelector('.mt-skip span').textContent = i18n.t('meeting.skip');
    r.querySelector('.mt-skip').classList.remove('chosen', 'pending');
    r.querySelector('.mt-skipn').textContent = '';
    r.querySelector('.mt-where span').textContent = i18n.t('meeting.gathered');
    r.querySelectorAll('.mt-steps i').forEach((x) => { x.textContent = i18n.t(x.dataset.s === 'vote' ? 'meeting.vote' : x.dataset.s === 'results' ? 'meeting.results' : 'meeting.discuss'); });
    this.lastPhase = null; this.votedN = 0;
    this.aliveN = opts.players.filter((p) => p.alive).length;
    r.querySelector('.mt-skipvotes').innerHTML = '';
    r.querySelector('.mt-note').textContent = opts.canVote ? '' : i18n.t('meeting.ghostNoVote');
    r.classList.toggle('spectator', !opts.canVote);
    const grid = r.querySelector('.mt-grid');
    // Canlılar önce, ölüler sona (soluk ve küçük); sıra içinde orijinal düzen korunur
    const list = [...opts.players.filter((p) => p.alive), ...opts.players.filter((p) => !p.alive)];
    grid.innerHTML = list.map((p, i) => `
      <div role="button" tabindex="${p.alive ? 0 : -1}" style="--i:${i}" class="mt-player${p.alive ? '' : ' dead'}${p.me ? ' me' : ''}" data-id="${p.id}" aria-disabled="${!p.alive}">
        <span class="mt-ball" style="background-image:url(${getFlagThumb(p.flag, 60, 40)})">${p.alive ? '' : `<b class="mt-dead">${icon('ghost')}</b>`}</span>
        <span class="mt-info">
          <span class="mt-name">${esc(p.name)}</span>
          <span class="mt-tags">${p.me ? `<span class="mt-tag you">${esc(i18n.t('ui.you'))}</span>` : ''}${p.alive ? '' : `<span class="mt-tag rip">${esc(i18n.t('meeting.deadTag'))}</span>`}<span class="mt-voted">${icon('check')}${esc(i18n.t('meeting.voted'))}</span></span>
          <span class="mt-votes"></span>
          <span class="mt-confirm"><i class="mt-yes" role="button">${icon('check')}${esc(i18n.t('meeting.confirm'))}</i><i class="mt-no" role="button" aria-label="${esc(i18n.t('meeting.cancel'))}">${icon('close')}</i></span>
        </span>
        <span class="mt-num"></span>
        <span class="mt-stamp"></span>
      </div>`).join('');
    grid.querySelectorAll('.mt-player').forEach((b) => b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (this.pending === b.dataset.id) this.vote(b.dataset.id); else this.pick(b.dataset.id); }
      else if (e.key === 'Escape') this.setPending(null);
    }));
    this.setPhase('discuss', 0);
    this.renderCount();
    this.drawBodyMap(opts.bodyPos || null);
  }

  // Tartışma paneline küçük harita + ceset kırmızı nokta
  drawBodyMap(bodyPos) {
    const cv = this.root && this.root.querySelector('.mt-map');
    const leg = this.root && this.root.querySelector('.mt-map-legend');
    const wrap = this.root && this.root.querySelector('.mt-map-wrap');
    if (!cv || !wrap) return;
    // Kısa ekran / landscape telefonda harita paneli boğuyor → gizle
    if (window.innerHeight < 520 || (window.innerWidth < 760 && window.innerHeight < 600)) {
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    const w = cv.width, h = cv.height;
    const s = Math.min(w / WORLD.w, h / WORLD.h);
    const ox = (w - WORLD.w * s) / 2, oy = (h - WORLD.h * s) / 2;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(8,10,14,.9)'; c.fillRect(0, 0, w, h);
    const rect = (r, fill) => { c.fillStyle = fill; c.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); };
    [...Object.values(ROOMS), ...CORRIDORS].forEach((r) => { c.fillStyle = '#6a7380'; c.fillRect(ox + r.x * s - 1, oy + r.y * s - 1, r.w * s + 2, r.h * s + 2); });
    CORRIDORS.forEach((r) => rect(r, '#3a3f47'));
    const cols = { entrance: '#2f5a2a', hall: '#4b5260', reactor: '#5a3a33', security: '#2f3b52', control: '#2b3444', o2: '#2c5157', comms: '#28324a', generator: '#454a50', cafeteria: '#3e5a57', medbay: '#5e6c6a', lab: '#58686f', electrical: '#55542f', dorm: '#5a4430', storage: '#554634' };
    Object.entries(ROOMS).forEach(([id, r]) => rect(r, cols[id] || '#444'));
    if (bodyPos) {
      const bx = ox + bodyPos.x * s, by = oy + bodyPos.y * s;
      c.beginPath(); c.arc(bx, by, 7, 0, Math.PI * 2); c.fillStyle = '#ff2a2a'; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(bx, by, 11, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,40,40,.55)'; c.lineWidth = 2; c.stroke();
      if (leg) { leg.textContent = '● ' + i18n.t('meeting.bodyOnMap'); leg.classList.remove('hidden'); }
    } else if (leg) { leg.textContent = ''; leg.classList.add('hidden'); }
  }

  // "5 canlı · 2 oy verdi"
  renderCount() {
    const el = this.root && this.root.querySelector('.mt-count');
    if (el) el.innerHTML = `${icon('check')} <b>${this.votedN || 0}</b>/${this.aliveN || 0} ${esc(i18n.t('meeting.votedN'))}`;
    const bar = this.root && this.root.querySelector('.mt-pbar i');
    if (bar) bar.style.transform = `scaleX(${this.aliveN ? Math.min(1, (this.votedN || 0) / this.aliveN) : 0})`;
  }

  setPhase(phase, secs) {
    if (!this.root) return;
    const r = this.root;
    const sec = secs > 0 ? Math.ceil(secs) : 0;
    const phaseChanged = phase !== this.phase || phase !== this.lastPhase;
    // Sadece saniye/evre değişince DOM yaz (sürekli reflow mobilde kasıyordu)
    if (!phaseChanged && sec === this._lastSec) {
      if (phase !== 'results' && this.total > 0) {
        const frac = Math.max(0, Math.min(1, (secs || 0) / this.total));
        if (Math.abs(frac - (this._lastFrac || 0)) > 0.02) {
          this._lastFrac = frac;
          r.querySelector('.mt-bar i').style.transform = `scaleX(${frac})`;
          r.querySelector('.mt-ring-fg').style.strokeDashoffset = String(100 - frac * 100);
        }
      }
      return;
    }
    this._lastSec = sec;
    this.phase = phase;
    r.dataset.phase = phase;
    if (phaseChanged) {
      this.lastPhase = phase;
      this.total = Math.max(1, secs || 1);
      r.querySelector('.mt-phase').textContent = i18n.t(phase === 'vote' ? 'meeting.vote' : phase === 'results' ? 'meeting.results' : 'meeting.discuss');
      const order = ['discuss', 'vote', 'results'], at = order.indexOf(phase);
      r.querySelectorAll('.mt-steps i').forEach((x) => { const k = order.indexOf(x.dataset.s); x.classList.toggle('on', k === at); x.classList.toggle('done', k < at); });
      if (this.opts && this.opts.canVote && !this.myVote) {
        r.querySelector('.mt-note').textContent = phase === 'vote' ? i18n.t('meeting.pickHint') : phase === 'discuss' ? i18n.t('meeting.discussHint') : '';
      }
    } else {
      this.total = Math.max(this.total || 1, secs || 0);
    }
    r.querySelector('.mt-time').textContent = sec > 0 ? i18n.t('meeting.timeLeft', { s: sec }) : '';
    const frac = phase === 'results' ? 0 : Math.max(0, Math.min(1, (secs || 0) / this.total));
    this._lastFrac = frac;
    r.querySelector('.mt-bar i').style.transform = `scaleX(${frac})`;
    r.querySelector('.mt-ring-fg').style.strokeDashoffset = String(100 - frac * 100);
    r.classList.toggle('urgent', sec > 0 && sec <= 5 && phase !== 'results');
    const canVote = this.opts && this.opts.canVote && phase === 'vote' && !this.myVote;
    r.classList.toggle('can-vote', !!canVote);
    if (!canVote && this.pending) this.setPending(null);
  }

  // Kurucu oylamada çıktı: oylama baştan (herkes yeniden oy verir)
  resetVotes() {
    if (!this.root) return;
    this.myVote = null; this.votedN = 0; this.setPending(null);
    this.root.querySelectorAll('.mt-player').forEach((b) => b.classList.remove('has-voted', 'chosen'));
    this.root.querySelector('.mt-skip').classList.remove('chosen');
    this.renderCount();
    this.lastPhase = null;                 // süre çubuğu yeni oylamaya göre dolsun (bir sonraki tikte)
  }

  // Seçim (onay bekliyor): yanlış dokunuşla oy gitmesin diye iki adımlı
  pick(id) {
    if (!this.opts || !this.opts.canVote || this.phase !== 'vote' || this.myVote) return;
    if (this.pending === id) { this.vote(id); return; }   // aynı karta / GEÇ'e ikinci dokunuş = onay
    this.setPending(id);
  }

  setPending(id) {
    if (!this.root) return;
    this.pending = id;
    this.root.querySelectorAll('.mt-player.pending').forEach((b) => b.classList.remove('pending'));
    const skip = this.root.querySelector('.mt-skip');
    skip.classList.toggle('pending', id === 'skip');
    skip.querySelector('span').textContent = i18n.t(id === 'skip' ? 'meeting.skipConfirm' : 'meeting.skip');
    if (id && id !== 'skip') { const b = this.root.querySelector(`.mt-player[data-id="${id}"]`); if (b) b.classList.add('pending'); }
  }

  openQuick(mode) {
    const panel = this.root.querySelector('.mt-quick-panel');
    if (!panel || !this.opts) return;
    panel.classList.remove('hidden');
    if (mode === 'phrases') {
      const raw = (i18n.data[i18n.lang] && i18n.data[i18n.lang].chat && i18n.data[i18n.lang].chat.phrases)
        || (i18n.data.tr && i18n.data.tr.chat && i18n.data.tr.chat.phrases) || [];
      const phrases = Array.isArray(raw) && raw.length ? raw : ['...'];
      panel.innerHTML = `<div class="mt-qp-title">${esc(i18n.tf('chat.quickTitle', 'Quick'))}</div>` +
        phrases.slice(0, 10).map((t) => `<button type="button" class="mt-qp-item" data-text="${esc(t)}">${esc(t)}</button>`).join('') +
        `<button type="button" class="mt-qp-close">✕</button>`;
      panel.querySelectorAll('[data-text]').forEach((b) => b.addEventListener('click', () => {
        panel.classList.add('hidden');
        if (this.opts.onChat) this.opts.onChat(b.dataset.text);
      }));
    } else {
      const alive = (this.opts.players || []).filter((p) => p.alive && !p.me);
      panel.innerHTML = `<div class="mt-qp-title">${esc(i18n.tf('chat.suspectBtn', 'Suspect'))}</div>` +
        alive.map((p) => `<button type="button" class="mt-qp-item" data-name="${esc(p.name)}">${esc(p.name)}</button>`).join('') +
        `<button type="button" class="mt-qp-close">✕</button>`;
      panel.querySelectorAll('[data-name]').forEach((b) => b.addEventListener('click', () => {
        panel.classList.add('hidden');
        const msg = i18n.tf('chat.suspectOf', b.dataset.name + ' şüpheli', { name: b.dataset.name });
        if (this.opts.onChat) this.opts.onChat(msg);
      }));
    }
    const c = panel.querySelector('.mt-qp-close');
    if (c) c.addEventListener('click', () => panel.classList.add('hidden'));
  }

  vote(id) {
    if (!this.opts || !this.opts.canVote || this.phase !== 'vote' || this.myVote) return;
    this.setPending(null);
    this.myVote = id;
    this.root.classList.remove('can-vote');
    this.root.querySelector('.mt-note').textContent = i18n.t('meeting.youVoted');
    const b = this.root.querySelector(`.mt-player[data-id="${id}"]`);
    if (b) b.classList.add('chosen'); else this.root.querySelector('.mt-skip').classList.add('chosen');
    this.opts.onVote(id);
  }

  markVoted(id) {
    const b = this.root && this.root.querySelector(`.mt-player[data-id="${id}"]`);
    if (b && !b.classList.contains('has-voted')) { b.classList.add('has-voted'); this.votedN = (this.votedN || 0) + 1; this.renderCount(); }
  }

  addChat(flag, name, text, opt = {}) {
    if (!this.root) return;
    const list = this.root.querySelector('.mt-chat-list');
    const d = document.createElement('div');
    d.className = 'mt-msg' + (opt.ghost ? ' ghost' : '') + (opt.mine ? ' mine' : '');
    d.innerHTML = `<img alt="" src="${getFlagThumb(flag, 30, 20)}"><div><b>${opt.ghost ? icon('ghost') + ' ' : ''}${esc(name)}</b><span>${esc(text)}</span></div>`;
    list.appendChild(d);
    // Bellek: en fazla 40 mesaj tut (uzun toplantılarda DOM şişmesin)
    while (list.children.length > 40) list.removeChild(list.firstChild);
    list.scrollTop = list.scrollHeight;
  }

  showResults(votes, skips) {
    const r = this.root;
    this.setPhase('results', 0);
    const counts = Object.values(votes).map((x) => x.length);
    const max = counts.length ? Math.max(...counts) : 0;
    const leaders = counts.filter((n) => n === max).length;
    // Atılma kuralı GameExtras.finishVoting ile aynı: tek başına en çok oy + GEÇ'ten fazla
    const out = max > 0 && leaders === 1 && max > skips.length;
    const tie = max > 0 && !out;
    r.querySelectorAll('.mt-player').forEach((b) => {
      const v = votes[b.dataset.id] || [];
      b.querySelector('.mt-votes').innerHTML = v.map((f, k) => `<img style="--k:${k}" alt="" src="${getFlagThumb(f, 24, 16)}">`).join('');
      b.querySelector('.mt-num').textContent = v.length ? String(v.length) : '';
      const top = v.length > 0 && v.length === max;
      b.classList.toggle('top', top);
      b.classList.toggle('out', top && out);
      b.classList.toggle('tie', top && tie);
      b.classList.toggle('novotes', !v.length);
      b.querySelector('.mt-stamp').textContent = top ? i18n.t(out ? 'meeting.ejecting' : 'meeting.tieShort') : '';
    });
    r.querySelector('.mt-skipn').textContent = skips.length ? String(skips.length) : '';
    r.querySelector('.mt-skipvotes').innerHTML = skips.length
      ? `<span>${esc(i18n.t('meeting.skipped'))}:</span>` + skips.map((f, k) => `<img style="--k:${k}" alt="" src="${getFlagThumb(f, 24, 16)}">`).join('')
      : '';
    r.querySelector('.mt-note').textContent = '';
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
    const icons = { lights: icon('bolt'), reactor: icon('radiation'), o2: icon('gauge') };
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

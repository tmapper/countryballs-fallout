// ============================================================
// Chat.js - Lobi sohbeti (çevrimiçi oda) + ortak yardımcılar
// ============================================================
//   lobbyChat.show() / hide()     -> sol altta açılır-kapanır sohbet kutusu
//   Gelen mesaj: net 'chat' (ch: 'lobby'). Yazan oyuncunun üstünde balon da çıkar
//   (LobbyScene 'chat-bubble' olayını dinler).
//   T veya Enter tuşu: yazmaya başla (yazı alanı odaktayken oyun tuşları çalışmaz).
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { getFlagThumb } from '../systems/Flags.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const CHAT_MAX = 120;
let GAME = null;
export function setChatGame(g) { GAME = g; }

// Yazı alanı odaktayken basılı kalmış oyun tuşlarını bırak (karakter kendi kendine yürümesin)
export function releaseGameKeys() {
  const g = GAME;
  if (!g) return;
  g.scene.getScenes(true).forEach((s) => { if (s.input && s.input.keyboard) s.input.keyboard.resetKeys(); });
}

// Yazı alanı: tuşlar oyuna gitmesin, Enter gönderir, Esc kapatır
export function wireChatInput(input, onSend, onEsc) {
  input.maxLength = CHAT_MAX;
  input.addEventListener('focus', releaseGameKeys);
  const stop = (e) => e.stopPropagation();
  input.addEventListener('keyup', stop);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const v = input.value.trim();
      if (v) { onSend(v); input.value = ''; }
      else input.blur();
      e.preventDefault();
    } else if (e.key === 'Escape') { input.blur(); if (onEsc) onEsc(); }
  });
}

export function msgHtml(flag, name, text, extra = '') {
  return `<img alt="" src="${getFlagThumb(flag, 30, 20)}"><div><b>${esc(name)}${extra}</b><span>${esc(text)}</span></div>`;
}

class LobbyChat {
  constructor() { this.root = null; this.open = false; this.unread = 0; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'lchat hidden';
    r.innerHTML = `
      <button class="lc-toggle" type="button">💬<span class="lc-badge hidden"></span></button>
      <div class="lc-box">
        <div class="lc-list"></div>
        <div class="lc-row"><input class="lc-input" autocomplete="off" spellcheck="false" enterkeyhint="send"><button class="lc-send" type="button">➤</button></div>
      </div>`;
    document.body.appendChild(r);
    this.list = r.querySelector('.lc-list');
    this.input = r.querySelector('.lc-input');
    r.querySelector('.lc-toggle').addEventListener('click', () => this.setOpen(!this.open));
    r.querySelector('.lc-send').addEventListener('click', () => { const v = this.input.value.trim(); if (v) { this.send(v); this.input.value = ''; } this.input.focus(); });
    wireChatInput(this.input, (v) => this.send(v), () => {});
    net.on('chat', (m) => { if (m.ch === 'lobby') this.receive(m); });
    // T / Enter: yazmaya başla (lobi sahnesi Enter'ı başlatma için kullanıyorsa o önce çalışır)
    window.addEventListener('keydown', (e) => {
      if (!this.visible || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyT') { e.preventDefault(); this.setOpen(true); this.input.focus(); }
    });
    i18n.onChange(() => this.texts());
    this.texts();
  }

  texts() { if (this.input) this.input.placeholder = i18n.t('chat.placeholder'); }

  setOpen(on) {
    this.open = on;
    this.root.classList.toggle('open', on);
    if (on) { this.unread = 0; this.badge(); this.list.scrollTop = this.list.scrollHeight; }
    else this.input.blur();
  }

  badge() {
    const b = this.root.querySelector('.lc-badge');
    b.textContent = this.unread > 9 ? '9+' : String(this.unread);
    b.classList.toggle('hidden', !this.unread);
  }

  send(text) { net.chat(text, 'lobby'); }

  receive(m) {
    const d = document.createElement('div');
    d.className = 'mt-msg' + (m.from === net.id ? ' mine' : '');
    d.innerHTML = msgHtml(m.flag, m.name, m.text);
    this.list.appendChild(d);
    while (this.list.children.length > 60) this.list.firstChild.remove();
    this.list.scrollTop = this.list.scrollHeight;
    if (!this.open && m.from !== net.id) { this.unread++; this.badge(); }
    const g = GAME;
    if (g) g.events.emit('chat-bubble', { from: m.from, text: m.text });
  }

  show() {
    if (!this.root) this.build();
    this.visible = true;
    this.root.classList.remove('hidden');
    // Büyük ekranda açık başlasın, telefonda kapalı (oyunu kapatmasın)
    this.setOpen(window.innerWidth > 900 && window.innerHeight > 560);
  }

  hide() {
    this.visible = false;
    if (!this.root) return;
    this.root.classList.add('hidden');
    this.input.blur();
    this.list.innerHTML = '';
    this.unread = 0; this.badge();
  }
}

export const lobbyChat = new LobbyChat();

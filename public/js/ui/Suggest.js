// ============================================================
// Suggest.js - Öneri kutusu + kendi önerilerin + admin cevap / çözüldü
// ============================================================
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

class Suggest {
  constructor() {
    this.root = null;
    this.isOpen = false;
    this.tab = 'new';       // new | mine | admin
    this.list = [];
    this.selected = null;
    this.isAdmin = false;
  }

  ensure() { if (!this.root) this.build(); }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'suggest hidden';
    r.innerHTML = `
      <div class="sg-card">
        <div class="sg-head">
          <h2 data-t="suggest.title">ÖNERİ KUTUSU</h2>
          <button class="sg-x" type="button">✕</button>
        </div>
        <div class="sg-tabs">
          <button type="button" data-tab="new" class="on"></button>
          <button type="button" data-tab="mine"></button>
          <button type="button" data-tab="admin" class="sg-admin-tab hidden"></button>
        </div>
        <div class="sg-body"></div>
        <div class="sg-msg"></div>
      </div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.sg-x').addEventListener('click', () => this.close());
    r.querySelectorAll('.sg-tabs button').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      this.selected = null;
      this.render();
      if (this.tab === 'mine' || this.tab === 'admin') this.fetchList();
    }));
    r.addEventListener('keydown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    net.on('suggestOk', () => {
      this.msg(i18n.tf('suggest.thanks', 'Teşekkürler, önerin kaydedildi!'));
      this.fetchList();
    });
    net.on('suggestList', (m) => {
      this.list = m.list || [];
      this.isAdmin = !!m.admin;
      if (this.selected) {
        this.selected = this.list.find((x) => x.id === this.selected.id) || null;
        if (!this.selected && this.tab !== 'new') this.tab = this.isAdmin && this.tab === 'admin' ? 'admin' : 'mine';
      }
      this.render();
    });
    net.on('suggestUpdated', () => this.fetchList());
    i18n.onChange(() => this.isOpen && this.render());
  }

  fetchList() {
    net.connect();
    net.send({ t: 'suggestList', all: this.tab === 'admin' ? 1 : 0 });
  }

  msg(text, bad) {
    const e = this.root && this.root.querySelector('.sg-msg');
    if (!e) return;
    e.textContent = text;
    e.classList.toggle('bad', !!bad);
    clearTimeout(this._t);
    this._t = setTimeout(() => { e.textContent = ''; }, 4000);
  }

  open() {
    this.ensure();
    this.tab = 'new';
    this.selected = null;
    this.root.classList.remove('hidden');
    this.isOpen = true;
    this.render();
    this.fetchList();
  }

  close() {
    if (this.root) this.root.classList.add('hidden');
    this.isOpen = false;
  }

  render() {
    const r = this.root;
    if (!r) return;
    r.querySelector('h2').textContent = i18n.tf('suggest.title', 'ÖNERİ KUTUSU');
    const tabs = {
      new: i18n.tf('suggest.tabNew', 'Yeni'),
      mine: i18n.tf('suggest.tabMine', 'Önerilerim'),
      admin: i18n.tf('suggest.tabAdmin', 'Yönet')
    };
    r.querySelectorAll('.sg-tabs button').forEach((b) => {
      b.textContent = tabs[b.dataset.tab] || '';
      b.classList.toggle('on', b.dataset.tab === this.tab);
      if (b.dataset.tab === 'admin') b.classList.toggle('hidden', !this.isAdmin);
    });
    const body = r.querySelector('.sg-body');
    if (this.tab === 'new') this.renderNew(body);
    else if (this.selected) this.renderThread(body);
    else this.renderList(body);
  }

  renderNew(body) {
    body.innerHTML = `
      <p class="sg-hint">${esc(i18n.tf('suggest.hint', 'Oyuna dair fikir, hata bildirimi veya isteğini yaz.'))}</p>
      <p class="sg-warn">${esc(i18n.tf('suggest.warn', 'Gereksiz mesajlar ban sebebidir!'))}</p>
      <textarea class="sg-txt" maxlength="280" rows="5" placeholder="${esc(i18n.tf('suggest.placeholder', 'Önerini yaz...'))}"></textarea>
      <div class="sg-foot">
        <span class="sg-count">0/280</span>
        <button class="sg-send mm-tbtn primary" type="button">${esc(i18n.tf('suggest.send', 'GÖNDER'))}</button>
      </div>`;
    const ta = body.querySelector('.sg-txt');
    ta.addEventListener('input', () => { body.querySelector('.sg-count').textContent = `${ta.value.length}/280`; });
    body.querySelector('.sg-send').addEventListener('click', () => {
      const text = (ta.value || '').trim();
      if (text.length < 3) { this.msg(i18n.tf('suggest.short', 'En az 3 karakter yaz'), true); return; }
      if (!net.account) { this.msg(i18n.tf('shop.needLogin', 'Giriş gerekli'), true); return; }
      net.connect();
      net.send({ t: 'suggest', text });
      ta.value = '';
      body.querySelector('.sg-count').textContent = '0/280';
      this.tab = 'mine';
      setTimeout(() => this.fetchList(), 400);
    });
    setTimeout(() => ta.focus(), 40);
  }

  renderList(body) {
    const items = this.tab === 'admin'
      ? this.list
      : this.list.filter((x) => x.mine);
    if (!items.length) {
      body.innerHTML = `<p class="sg-empty">${esc(i18n.tf('suggest.empty', 'Henüz öneri yok'))}</p>`;
      return;
    }
    body.innerHTML = `<div class="sg-list">${items.map((s) => {
      const st = s.status === 'resolved'
        ? `<span class="sg-st done">${esc(i18n.tf('suggest.resolved', 'Çözüldü'))}</span>`
        : (s.replies && s.replies.length
          ? `<span class="sg-st reply">${esc(i18n.tf('suggest.hasReply', 'Cevap var'))}</span>`
          : `<span class="sg-st wait">${esc(i18n.tf('suggest.waiting', 'Bekliyor'))}</span>`);
      const preview = esc(String(s.text || '').slice(0, 90));
      const when = new Date(s.at || 0).toLocaleString();
      const who = this.tab === 'admin' ? esc(s.name || '?') + ' · ' : '';
      return `<button type="button" class="sg-item" data-id="${esc(s.id)}">
        <div class="sg-item-top">${st}<span class="sg-when">${who}${when}</span></div>
        <div class="sg-item-text">${preview}</div>
      </button>`;
    }).join('')}</div>`;
    body.querySelectorAll('.sg-item').forEach((b) => b.addEventListener('click', () => {
      this.selected = this.list.find((x) => x.id === b.dataset.id) || null;
      this.render();
    }));
  }

  renderThread(body) {
    const s = this.selected;
    if (!s) return;
    const replies = s.replies || [];
    body.innerHTML = `
      <button type="button" class="sg-back">‹ ${esc(i18n.tf('menu.back', 'Geri'))}</button>
      <div class="sg-thread">
        <div class="sg-bubble me">
          <div class="sg-bubble-h">${esc(s.name || '')} · ${new Date(s.at || 0).toLocaleString()}</div>
          <div>${esc(s.text || '')}</div>
        </div>
        ${replies.map((rp) => `
          <div class="sg-bubble ${rp.admin ? 'admin' : 'me'}">
            <div class="sg-bubble-h">${esc(rp.by || (rp.admin ? 'Admin' : ''))} · ${new Date(rp.at || 0).toLocaleString()}</div>
            <div>${esc(rp.text || '')}</div>
          </div>`).join('')}
      </div>
      ${s.status === 'resolved'
        ? `<p class="sg-resolved-note">✓ ${esc(i18n.tf('suggest.resolved', 'Çözüldü'))}</p>`
        : `
        <textarea class="sg-txt sg-reply-txt" maxlength="280" rows="3" placeholder="${esc(i18n.tf('suggest.replyPh', 'Mesaj yaz...'))}"></textarea>
        <div class="sg-foot">
          <button type="button" class="sg-send mm-tbtn primary sg-reply-btn">${esc(i18n.tf('suggest.reply', 'Gönder'))}</button>
          ${this.isAdmin ? `<button type="button" class="sg-resolve mm-tbtn">✓ ${esc(i18n.tf('suggest.markResolved', 'Çözüldü'))}</button>` : ''}
        </div>`}`;
    body.querySelector('.sg-back').addEventListener('click', () => { this.selected = null; this.render(); });
    const replyBtn = body.querySelector('.sg-reply-btn');
    if (replyBtn) replyBtn.addEventListener('click', () => {
      const ta = body.querySelector('.sg-reply-txt');
      const text = (ta.value || '').trim();
      if (text.length < 1) return;
      net.send({ t: 'suggestReply', id: s.id, text });
      ta.value = '';
      this.msg(i18n.tf('suggest.sent', 'Gönderildi'));
      setTimeout(() => this.fetchList(), 300);
    });
    const resBtn = body.querySelector('.sg-resolve');
    if (resBtn) resBtn.addEventListener('click', () => {
      net.send({ t: 'suggestResolve', id: s.id });
      this.msg(i18n.tf('suggest.resolved', 'Çözüldü'));
      setTimeout(() => this.fetchList(), 300);
    });
  }
}

export const suggest = new Suggest();

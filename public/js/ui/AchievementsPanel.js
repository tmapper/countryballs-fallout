// AchievementsPanel.js - Gizli başarımlar (kilitli: siyah ?)
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { ACHIEVEMENTS, ACH_BY_ID } from '../systems/Achievements.js';
import { icon, COIN_IMG, coinHtml } from './Icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

class AchievementsPanel {
  constructor() { this.root = null; this.isOpen = false; }

  ensure() {
    if (this.root) return;
    const r = this.root = document.createElement('div');
    r.className = 'ach-panel hidden';
    r.innerHTML = `<div class="ach-card">
      <div class="ach-head"><h2 data-t="ach.title">BAŞARIMLAR</h2>
        <span class="ach-prog"></span>
        <button class="ach-x" type="button">✕</button></div>
      <div class="ach-body" data-scroll></div>
      <div class="ach-msg"></div>
    </div>`;
    document.body.appendChild(r);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    r.querySelector('.ach-x').addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') this.close(); });
    net.on('account', () => this.isOpen && this.render());
    net.on('achUnlock', (m) => {
      if (!this.isOpen) return;
      this.msg((i18n.t('ach.unlock') || 'Açıldı') + ': ' + (i18n.t('ach.' + m.id) || m.id) + ` (+${m.reward || 0})`);
      this.render();
    });
    i18n.onChange(() => this.isOpen && this.render());
  }

  msg(t) {
    const e = this.root.querySelector('.ach-msg');
    e.textContent = t;
    clearTimeout(this._t);
    this._t = setTimeout(() => { e.textContent = ''; }, 4000);
  }

  open() {
    this.ensure();
    this.root.classList.remove('hidden');
    this.isOpen = true;
    this.render();
  }

  close() {
    if (this.root) this.root.classList.add('hidden');
    this.isOpen = false;
  }

  render() {
    const unlocked = new Set((net.account && net.account.achievements) || []);
    const body = this.root.querySelector('.ach-body');
    this.root.querySelector('h2').textContent = i18n.t('ach.title') || 'BAŞARIMLAR';
    this.root.querySelector('.ach-prog').textContent = `${unlocked.size}/${ACHIEVEMENTS.length}`;
    body.innerHTML = ACHIEVEMENTS.map((a) => {
      const on = unlocked.has(a.id);
      if (!on) {
        return `<div class="ach-item locked"><div class="ach-ico">?</div>
          <div class="ach-info"><b>${esc(i18n.t('ach.hidden') || '???')}</b>
          <small>${esc(i18n.t('ach.hiddenHint') || 'Gizli başarım')}</small></div>
          <span class="ach-rew">${coinHtml(a.reward)}</span></div>`;
      }
      return `<div class="ach-item on"><div class="ach-ico">★</div>
        <div class="ach-info"><b>${esc(i18n.t('ach.' + a.id) || a.id)}</b>
        <small>${esc(i18n.t('ach.desc_' + a.id) || '')}</small></div>
        <span class="ach-rew">+${a.reward} ${COIN_IMG}</span></div>`;
    }).join('');
  }
}

export const achievementsPanel = new AchievementsPanel();

// QuestsPanel.js - Günlük / haftalık görevler (ana menü sağ panel)
import { i18n } from '../systems/I18n.js';
import { net } from '../systems/Net.js';
import { DAILY_POOL, WEEKLY_POOL } from '../systems/Quests.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const byId = Object.fromEntries([...DAILY_POOL, ...WEEKLY_POOL].map((q) => [q.id, q]));

class QuestsPanel {
  constructor() { this.root = null; }

  ensure() {
    if (this.root) return;
    const r = this.root = document.createElement('div');
    r.className = 'quests-side hidden';
    r.innerHTML = `
      <div class="qs-card">
        <div class="qs-head"><b data-t="quest.title">GÖREVLER</b></div>
        <div class="qs-sec"><span data-t="quest.daily">Günlük</span></div>
        <div class="qs-daily"></div>
        <div class="qs-sec"><span data-t="quest.weekly">Haftalık</span></div>
        <div class="qs-weekly"></div>
        <div class="qs-flag"><span data-t="quest.weekFlag">Haftanın bayrağı</span><div class="qs-flag-row"></div></div>
      </div>`;
    document.body.appendChild(r);
    net.on('account', () => this.render());
    net.on('quests', () => this.render());
    i18n.onChange(() => this.render());
  }

  show() { this.ensure(); this.root.classList.remove('hidden'); this.render(); net.send({ t: 'questsGet' }); }
  hide() { if (this.root) this.root.classList.add('hidden'); }

  render() {
    if (!this.root || this.root.classList.contains('hidden')) return;
    const acc = net.account;
    const q = (acc && acc.quests) || { daily: [], weekly: [] };
    const fill = (el, list) => {
      el.innerHTML = (list || []).map((row) => {
        const def = byId[row.id] || { goal: row.goal || 1, reward: row.reward || 0 };
        const prog = Math.min(def.goal, row.progress || 0);
        const done = !!row.claimed || prog >= def.goal;
        const pct = Math.min(100, (prog / def.goal) * 100);
        return `<div class="qs-item${done ? ' done' : ''}">
          <div class="qs-name">${esc(i18n.t('quest.' + row.id) || row.id)}</div>
          <div class="qs-bar"><i style="width:${pct}%"></i></div>
          <div class="qs-meta"><span>${prog}/${def.goal}</span><span><img class="coin-ico" alt="" src="assets/menu/coin.png" onerror="this.outerHTML='●'"> ${def.reward}</span>
          ${done && !row.claimed ? `<button type="button" data-claim="${esc(row.id)}" class="qs-claim">${esc(i18n.t('quest.claim') || 'AL')}</button>` : (row.claimed ? '✓' : '')}
          </div></div>`;
      }).join('') || `<div class="qs-empty">${esc(i18n.t('quest.login') || 'Giriş yap')}</div>`;
      el.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => net.send({ t: 'questClaim', id: b.dataset.claim })));
    };
    fill(this.root.querySelector('.qs-daily'), q.daily);
    fill(this.root.querySelector('.qs-weekly'), q.weekly);

    // Haftanın bayrağı
    const wf = (acc && acc.weekFlag) || q.weekFlag;
    const row = this.root.querySelector('.qs-flag-row');
    if (wf && wf.code) {
      row.innerHTML = `<img alt="" src="assets/flags/${wf.code}.webp" onerror="this.style.display='none'"><b>${esc(i18n.t('countries.' + wf.code) || wf.code)}</b>
        <small>${wf.owned ? (i18n.t('quest.owned') || 'Senin') : (i18n.t('quest.tryFlag') || 'Bu hafta dene')}</small>`;
    } else {
      row.innerHTML = `<small>${esc(i18n.t('quest.login') || 'Giriş yap')}</small>`;
    }
  }
}

export const questsPanel = new QuestsPanel();

// ============================================================
// ResultScreen.js - Maç sonu ekranı (kim kazandı, kim hangi roldeydi)
// ============================================================
// show(result, { onReplay, onLobby })
//   result = { winner: 'crew'|'impostor', me: { role, alive }, players: [{ flag, role, alive, me }] }
import { i18n } from '../systems/I18n.js';
import { getFlagThumb } from '../systems/Flags.js';
import { ROLE_COLORS } from '../systems/Roles.js';
import { teamOf } from '../systems/Combat.js';
import { net } from '../systems/Net.js';
import { titleName, xpPercent } from '../systems/Levels.js';
import { icon, COIN_IMG, coinHtml } from './Icons.js';

export class ResultScreen {
  constructor() { this.root = null; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'result hidden';
    r.innerHTML = `
      <div class="result-panel">
        <div class="result-kicker"></div>
        <h1 class="result-title"></h1>
        <div class="result-reward hidden"></div>
        <div class="result-list"></div>
        <div class="result-actions">
          <button class="btn btn-start replay" type="button"></button>
          <button class="btn to-lobby" type="button"></button>
        </div>
      </div>`;
    document.body.appendChild(r);
    r.querySelector('.replay').addEventListener('click', () => this.handlers.onReplay());
    r.querySelector(".to-lobby").addEventListener('click', () => this.handlers.onLobby());
    net.on('matchReward', () => this.renderReward());   // ödül, sonuç ekranı açıkken gelebilir
  }

  // Çevrimiçi maç ödülü: +XP, seviye atladıysa vurgu, XP çubuğu. Sunucu hesaplar (hile olmasın diye).
  renderReward() {
    if (!this.root || this.root.classList.contains('hidden')) return;
    const box = this.root.querySelector('.result-reward');
    const rw = net.lastReward;
    if (!this.handlers || !this.handlers.online || !rw) { box.classList.add('hidden'); return; }
    const a = rw.account, g = rw.gain;
    const line2 = g.levelUp
      ? `<div class="rr-lvl up">${i18n.t('result.levelUp', { a: g.oldLevel, b: a.level })}</div>`
      : `<div class="rr-lvl">${i18n.t('levels.level', { n: a.level })} · ${titleName(a.title)}</div>`;
    box.innerHTML = `<div class="rr-xp">+${g.xp} XP${g.coins ? ` · <span class="rr-coin">+${g.coins} ${COIN_IMG}</span>` : ''}${g.passXp ? ` · <span class="rr-coin">+${g.passXp} ${icon('ticket')} ${i18n.t('pass.passXp')}</span>` : ''}</div>${line2}<div class="rr-bar"><i></i></div>`;
    box.classList.remove('hidden');
    const bar = box.querySelector('.rr-bar i');
    setTimeout(() => { bar.style.width = xpPercent(a) + '%'; }, 80);
  }

  show(result, handlers) {
    if (!this.root) this.build();
    this.handlers = handlers;
    const r = this.root;
    const won = teamOf(result.me.role) === result.winner;
    r.dataset.winner = result.winner;
    r.querySelector('.result-kicker').textContent = won ? i18n.t('result.youWin') : i18n.t('result.youLose');
    r.querySelector('.result-kicker').classList.toggle('lose', !won);
    r.querySelector('.result-title').textContent = i18n.t(result.winner === 'crew' ? 'result.crewWin' : 'result.impostorWin');
    r.querySelector('.result-list').innerHTML = result.players.map((p) => `
      <div class="res-row${p.alive ? '' : ' dead'}">
        <img alt="" src="${getFlagThumb(p.flag, 36, 24)}">
        <span class="res-name">${p.name || i18n.t('countries.' + p.flag)}${p.me ? ` <b>(${i18n.t('ui.you')})</b>` : ''}</span>
        <span class="res-role" style="color:${ROLE_COLORS[p.role]}">${i18n.t('roles.' + p.role)}</span>
        <span class="res-state">${p.alive ? i18n.t('result.alive') : i18n.t('result.dead')}</span>
      </div>`).join('');
    r.querySelector('.replay').textContent = i18n.t('result.playAgain');
    r.querySelector('.replay').classList.toggle('hidden', !!handlers.online);
    r.querySelector(".to-lobby").textContent = i18n.t('result.lobby');
    r.classList.remove('hidden');
    this.renderReward();
    // Sunucu 4 sn içinde ödül göndermediyse (maç çok kısa / tek gerçek oyuncu) nedenini söyle
    if (handlers.online && !net.lastReward) {
      const box = r.querySelector('.result-reward');
      box.classList.add('hidden');
      clearTimeout(this.noRewT);
      this.noRewT = setTimeout(() => { if (!net.lastReward && !r.classList.contains('hidden')) { box.innerHTML = `<div class="rr-lvl">${i18n.t('result.noReward')}</div>`; box.classList.remove('hidden'); } }, 4000);
    }
    // Oyunda dokunulan parmak hemen bir butona basmasın
    r.classList.add('guard');
    setTimeout(() => r.classList.remove('guard'), 600);
  }

  hide() {
    if (this.root) this.root.classList.add('hidden');
  }
}

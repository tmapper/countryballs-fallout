// ============================================================
// GameSettings.js - Oyun içi Ayarlar paneli (⚙ butonu ya da Esc)
// ============================================================
// Müzik / efekt sesi, sessiz, dil, grafik kalitesi, tam ekran, lobiye dön.
// + Özel Teşekkürler sayfası
import { exitGame } from '../systems/ExitGame.js';
import { i18n } from '../systems/I18n.js';
import { getVolumes, setMusicVolume, setSfxVolume, isMuted, toggleMute, sfx } from '../systems/Sound.js';
import { getQuality, setQuality } from '../systems/Resolution.js';
import { releaseGameKeys } from './Chat.js';
import { setDevice, isMobile } from '../systems/Device.js';
import { perfHud } from '../systems/PerfHud.js';
import { getPerf, setPerf } from '../systems/Perf.js';
import { keyBindPanel, buttonEditor } from './Controls.js';
import { net } from '../systems/Net.js';

class GameSettings {
  constructor() { this.root = null; this.isOpen = false; this.creditsRoot = null; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'gset hidden';
    r.innerHTML = `<div class="gs-card">
      <div class="gs-head"><h2 data-t="ui.settings"></h2><button class="gs-x" type="button">✕</button></div>
      <label class="gs-row"><span data-t="ui.musicVol"></span><input class="gs-music" type="range" min="0" max="100"><b class="gs-mv"></b></label>
      <label class="gs-row"><span data-t="ui.sfxVol"></span><input class="gs-sfx" type="range" min="0" max="100"><b class="gs-sv"></b></label>
      <div class="gs-row"><span data-t="ui.mute"></span><button class="gs-tog gs-mute" type="button"></button></div>
      <div class="gs-row"><span data-t="ui.language"></span><div class="gs-seg gs-lang"><button type="button" data-v="tr">Türkçe</button><button type="button" data-v="en">English</button><button type="button" data-v="ru">Русский</button></div></div>
      <div class="gs-row"><span data-t="ui.quality"></span><div class="gs-seg gs-q"><button type="button" data-v="high" data-t="ui.qHigh"></button><button type="button" data-v="med" data-t="ui.qMed"></button><button type="button" data-v="low" data-t="ui.qLow"></button></div></div>
      <div class="gs-row"><span data-t="ui.perf"></span><div class="gs-seg gs-perf"><button type="button" data-v="high" data-t="ui.perfHigh"></button><button type="button" data-v="balanced" data-t="ui.perfBal"></button><button type="button" data-v="saver" data-t="ui.perfSaver"></button></div></div>
      <div class="gs-row gs-perfnote"><small data-t="ui.perfNote"></small></div>
      <div class="gs-row"><span data-t="ui.showFps"></span><button class="gs-tog gs-fps" type="button"></button></div>
      <div class="gs-row"><span data-t="ui.device"></span><div class="gs-seg gs-dev"><button type="button" data-v="mobile">Mobil</button><button type="button" data-v="pc">PC</button></div></div>
      <div class="gs-row"><span data-t="controls.title"></span><div class="gs-seg gs-ctl"><button type="button" class="gs-keys" data-t="controls.keysBtn"></button><button type="button" class="gs-layout" data-t="controls.layoutBtn"></button></div></div>
      <div class="gs-row gs-redeemrow"><span data-t="menu.redeem"></span><div class="gs-redeem"><input class="gs-code" type="text" autocomplete="off" spellcheck="false" enterkeyhint="done"><button type="button" class="gs-tog gs-code-go" data-t="menu.redeemGo"></button></div></div>
      <div class="gs-row gs-codemsg hidden"><small></small></div>
      <div class="gs-row gs-fsrow"><span data-t="ui.fullscreen"></span><button class="gs-tog gs-fs" type="button"></button></div>
      <div class="gs-row"><span data-t="ui.specialThanks"></span><button class="gs-tog gs-thanks" type="button">★</button></div>
      <div class="gs-foot"><button class="gs-btn gs-resume" type="button" data-t="ui.resume"></button><button class="gs-btn danger gs-leave" type="button" data-t="ui.backToLobby"></button><button class="gs-btn danger gs-exit" type="button" data-t="ui.exit"></button></div>
    </div>`;
    document.body.appendChild(r);
    const q = (s) => r.querySelector(s);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    q('.gs-x').addEventListener('click', () => this.close());
    q('.gs-resume').addEventListener('click', () => this.close());
    q('.gs-exit').addEventListener('click', () => exitGame());
    q('.gs-leave').addEventListener('click', () => { this.close(); if (this.onLeave) this.onLeave(); });
    q('.gs-music').addEventListener('input', (e) => { setMusicVolume(e.target.value / 100); this.render(); });
    q('.gs-sfx').addEventListener('input', (e) => { setSfxVolume(e.target.value / 100); this.render(); });
    q('.gs-sfx').addEventListener('change', () => sfx('ui_click'));
    q('.gs-mute').addEventListener('click', () => { toggleMute(); this.render(); });
    q('.gs-fps').addEventListener('click', () => { perfHud.setEnabled(!perfHud.enabled); this.render(); });
    r.querySelectorAll('.gs-lang button').forEach((b) => b.addEventListener('click', () => { i18n.setLanguage(b.dataset.v); this.render(); }));
    r.querySelectorAll('.gs-q button').forEach((b) => b.addEventListener('click', () => { setQuality(b.dataset.v); this.render(); }));
    r.querySelectorAll('.gs-perf button').forEach((b) => b.addEventListener('click', () => { setPerf(b.dataset.v); this.render(); }));
    r.querySelectorAll('.gs-dev button').forEach((b) => b.addEventListener('click', () => { setDevice(b.dataset.v); this.render(); this.msgDev = true; }));
    q('.gs-fs').addEventListener('click', () => {
      const d = document;
      if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
      else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
      setTimeout(() => this.render(), 300);
    });
    q('.gs-thanks').addEventListener('click', () => this.openCredits());
    q('.gs-keys').addEventListener('click', () => keyBindPanel.open());
    q('.gs-layout').addEventListener('click', () => { this.close(); buttonEditor.open(); });
    // Jeton kodu (eskiden sadece ana menünün ayrı ayarlar penceresindeydi; artık her yerde aynı pencere)
    const msg = (t) => { const m = q('.gs-codemsg'); m.classList.toggle('hidden', !t); m.querySelector('small').textContent = t || ''; };
    const redeem = () => {
      const code = q('.gs-code').value.trim();
      if (!code) { msg(i18n.tf('menu.redeemEmpty', 'Kod gir')); return; }
      if (!net.account) { msg(i18n.tf('shop.needLogin', 'Giriş yapmalısın')); return; }
      msg('...');
      if (net.status !== 'online') {
        net.connect();
        const once = () => { if (net.status === 'online') { net.off('status', once); net.redeem(code); } };
        net.on('status', once); setTimeout(() => net.off('status', once), 8000); return;
      }
      net.redeem(code);
    };
    q('.gs-code-go').addEventListener('click', redeem);
    q('.gs-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); redeem(); } });
    net.on('redeem', (m) => {
      if (!this.isOpen) return;
      if (m.ok) { msg((i18n.tf('menu.redeemOk', 'Kod kabul edildi!')) + ' +' + (Number(m.coins) || 0)); q('.gs-code').value = ''; }
      else msg(m.err === 'used' ? i18n.t('menu.redeemUsed') : m.err === 'login' ? i18n.t('shop.needLogin') : i18n.t('menu.redeemFail'));
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.key !== 'Escape') return;
      e.stopPropagation();
      if (keyBindPanel.isOpen) { keyBindPanel.close(); return; }          // önce üstteki tuş atama penceresi kapansın
      this.close();
    }, true);
    i18n.onChange(() => this.isOpen && this.render());
  }

  openCredits() {
    if (!this.creditsRoot) {
      const c = this.creditsRoot = document.createElement('div');
      c.className = 'credits-panel hidden';
      c.innerHTML = `<div class="credits-card">
        <div class="credits-head"><h2 data-t="ui.specialThanks"></h2><button class="credits-x" type="button">✕</button></div>
        <div class="credits-scroll"><div class="credits-text"></div></div>
      </div>`;
      document.body.appendChild(c);
      c.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === c) this.closeCredits(); });
      c.querySelector('.credits-x').addEventListener('click', () => this.closeCredits());
      window.addEventListener('keydown', (e) => { if (!c.classList.contains('hidden') && e.key === 'Escape') { e.stopPropagation(); this.closeCredits(); } }, true);
    }
    const text = (i18n.tf('ui.credits', '')).replace(/\\n/g, '\n');
    this.creditsRoot.querySelector('.credits-text').textContent = text;
    this.creditsRoot.querySelector('h2').textContent = i18n.tf('ui.specialThanks', 'Özel Teşekkürler');
    this.creditsRoot.classList.remove('hidden');
    const tx = this.creditsRoot.querySelector('.credits-text');
    tx.style.animation = 'none';
    void tx.offsetWidth;
    tx.style.animation = '';
  }

  closeCredits() {
    if (this.creditsRoot) this.creditsRoot.classList.add('hidden');
  }

  render() {
    const r = this.root, q = (s) => r.querySelector(s);
    r.querySelectorAll('[data-t]').forEach((n) => { n.textContent = i18n.t(n.dataset.t); });
    const v = getVolumes();
    q('.gs-music').value = Math.round(v.music * 100); q('.gs-mv').textContent = Math.round(v.music * 100) + '%';
    q('.gs-sfx').value = Math.round(v.sfx * 100); q('.gs-sv').textContent = Math.round(v.sfx * 100) + '%';
    const m = isMuted();
    q('.gs-mute').textContent = i18n.t(m ? 'ui.on' : 'ui.off'); q('.gs-mute').classList.toggle('on', m);
    r.querySelectorAll('.gs-lang button').forEach((b) => b.classList.toggle('on', b.dataset.v === i18n.lang));
    r.querySelectorAll('.gs-q button').forEach((b) => b.classList.toggle('on', b.dataset.v === getQuality()));
    r.querySelectorAll('.gs-perf button').forEach((b) => b.classList.toggle('on', b.dataset.v === getPerf()));
    q('.gs-fps').textContent = i18n.t(perfHud.enabled ? 'ui.on' : 'ui.off'); q('.gs-fps').classList.toggle('on', perfHud.enabled);
    r.querySelectorAll('.gs-dev button').forEach((b) => b.classList.toggle('on', b.dataset.v === (isMobile() ? 'mobile' : 'pc')));
    q('.gs-dev [data-v="mobile"]').textContent = i18n.lang === 'en' ? 'Mobile' : 'Mobil';
    const fs = !!document.fullscreenElement;
    q('.gs-fsrow').classList.toggle('hidden', !document.fullscreenEnabled);
    q('.gs-fs').textContent = i18n.t(fs ? 'ui.on' : 'ui.off'); q('.gs-fs').classList.toggle('on', fs);
  }

  open({ onLeave } = {}) {
    if (!this.root) this.build();
    this.onLeave = onLeave;
    this.root.querySelector('.gs-leave').classList.toggle('hidden', !onLeave);
    releaseGameKeys();
    this.root.classList.remove('hidden');
    this.isOpen = true;
    this.render();
  }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; this.closeCredits(); }
}

export const gameSettings = new GameSettings();

// ============================================================
// GameSettings.js - Oyun içi Ayarlar paneli (⚙ butonu ya da Esc)
// ============================================================
// Müzik / efekt sesi, sessiz, dil, grafik kalitesi, tam ekran, lobiye dön.
import { i18n } from '../systems/I18n.js';
import { getVolumes, setMusicVolume, setSfxVolume, isMuted, toggleMute, sfx } from '../systems/Sound.js';
import { getQuality, setQuality } from '../systems/Resolution.js';
import { releaseGameKeys } from './Chat.js';

class GameSettings {
  constructor() { this.root = null; this.isOpen = false; }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'gset hidden';
    r.innerHTML = `<div class="gs-card">
      <div class="gs-head"><h2 data-t="ui.settings"></h2><button class="gs-x" type="button">✕</button></div>
      <label class="gs-row"><span data-t="ui.musicVol"></span><input class="gs-music" type="range" min="0" max="100"><b class="gs-mv"></b></label>
      <label class="gs-row"><span data-t="ui.sfxVol"></span><input class="gs-sfx" type="range" min="0" max="100"><b class="gs-sv"></b></label>
      <div class="gs-row"><span data-t="ui.mute"></span><button class="gs-tog gs-mute" type="button"></button></div>
      <div class="gs-row"><span data-t="ui.language"></span><div class="gs-seg gs-lang"><button type="button" data-v="tr">Türkçe</button><button type="button" data-v="en">English</button></div></div>
      <div class="gs-row"><span data-t="ui.quality"></span><div class="gs-seg gs-q"><button type="button" data-v="high" data-t="ui.qHigh"></button><button type="button" data-v="low" data-t="ui.qLow"></button></div></div>
      <div class="gs-row gs-fsrow"><span data-t="ui.fullscreen"></span><button class="gs-tog gs-fs" type="button"></button></div>
      <div class="gs-foot"><button class="gs-btn gs-resume" type="button" data-t="ui.resume"></button><button class="gs-btn danger gs-leave" type="button" data-t="ui.backToLobby"></button></div>
    </div>`;
    document.body.appendChild(r);
    const q = (s) => r.querySelector(s);
    r.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === r) this.close(); });
    q('.gs-x').addEventListener('click', () => this.close());
    q('.gs-resume').addEventListener('click', () => this.close());
    q('.gs-leave').addEventListener('click', () => { this.close(); if (this.onLeave) this.onLeave(); });
    q('.gs-music').addEventListener('input', (e) => { setMusicVolume(e.target.value / 100); this.render(); });
    q('.gs-sfx').addEventListener('input', (e) => { setSfxVolume(e.target.value / 100); this.render(); });
    q('.gs-sfx').addEventListener('change', () => sfx('ui_click'));
    q('.gs-mute').addEventListener('click', () => { toggleMute(); this.render(); });
    r.querySelectorAll('.gs-lang button').forEach((b) => b.addEventListener('click', () => { i18n.setLanguage(b.dataset.v); this.render(); }));
    r.querySelectorAll('.gs-q button').forEach((b) => b.addEventListener('click', () => { setQuality(b.dataset.v); this.render(); }));
    q('.gs-fs').addEventListener('click', () => {
      const d = document;
      if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
      else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
      setTimeout(() => this.render(), 300);
    });
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true);
    i18n.onChange(() => this.isOpen && this.render());
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
    const fs = !!document.fullscreenElement;
    q('.gs-fsrow').classList.toggle('hidden', !document.fullscreenEnabled);
    q('.gs-fs').textContent = i18n.t(fs ? 'ui.on' : 'ui.off'); q('.gs-fs').classList.toggle('on', fs);
  }

  open({ onLeave } = {}) {
    if (!this.root) this.build();
    this.onLeave = onLeave;
    releaseGameKeys();
    this.root.classList.remove('hidden');
    this.isOpen = true;
    this.render();
  }

  close() { if (this.root) this.root.classList.add('hidden'); this.isOpen = false; }
}

export const gameSettings = new GameSettings();

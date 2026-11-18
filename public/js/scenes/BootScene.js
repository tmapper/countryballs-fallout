// ============================================================
// BootScene.js - Açılış sahnesi: dil dosyaları + karakter kareleri, sonra lobi
// ============================================================
import { i18n } from '../systems/I18n.js';
import { loadJSON } from '../systems/Assets.js';
import { loadCharacters } from '../systems/CharacterAtlas.js';
import { loadRoleMeta } from '../ui/RoleReveal.js';
import { loadKillMeta } from '../ui/KillCutscene.js';
import { showMainMenu } from '../systems/GameFlow.js';
import { loadPropImages } from '../map/PropImages.js';
import { loadFlagImages } from '../systems/Flags.js';
import { RES } from '../systems/Resolution.js';
import { preloadSfx } from '../systems/Sound.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    // Özel yükleme ekranı index.html'de (#cfs-loader): burada sadece ilerlemesi yazılır
    const L = window.cfsLoader || { set() {}, done() {}, error() {} };
    const step = (p, key) => L.set(p, i18n.t(key));
    const track = (pr, p, key) => pr.then((v) => { step(p, key); return v; });
    // Sesleri arka planda decode et (ilk tıklamada gecikme olmasın)
    try { preloadSfx(); } catch (e) { /* yoksay */ }
    Promise.all([loadJSON('locales/tr.json'), loadJSON('locales/en.json'), loadJSON('locales/ru.json')])
      .then(([tr, en, ru]) => {
        i18n.init({ tr, en, ru });
        const ver = document.querySelector('#cfs-loader .ld-ver');                 // sürüm tek yerden (dil dosyası)
        if (ver) ver.textContent = 'BUNKER-07 · ' + i18n.t('menu.version');
        step(15, 'loader.chars');
        // Tüm varlıklar girişte yüklensin — oyunda kasma/donma olmasın
        return Promise.all([
          track(loadCharacters(), 45, 'loader.cinematics'),
          track(loadRoleMeta(), 55, 'loader.roles'),
          track(loadKillMeta(), 65, 'loader.kills'),
          track(loadPropImages().catch(() => {}), 80, 'loader.props'),
          track(loadFlagImages().catch(() => {}), 92, 'loader.flags')
        ]);
      })
      .then(() => {
        step(100, 'loader.ready');
        L.done();
        showMainMenu();
      })
      .catch((err) => {
        console.error(err);
        L.error((i18n.tf('ui.loadError', 'Error')) + ': ' + err.message);
      });
  }
}

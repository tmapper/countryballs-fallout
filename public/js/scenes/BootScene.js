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

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    // Özel yükleme ekranı index.html'de (#cfs-loader): burada sadece ilerlemesi yazılır
    const L = window.cfsLoader || { set() {}, done() {}, error() {} };
    const step = (p, key) => L.set(p, i18n.t(key));
    const track = (pr, p, key) => pr.then((v) => { step(p, key); return v; });
    Promise.all([loadJSON('locales/tr.json'), loadJSON('locales/en.json')])
      .then(([tr, en]) => {
        i18n.init({ tr, en });
        step(20, 'loader.chars');
        // Kritik olanları bekle; prop/flag arka planda (menü hemen açılsın)
        return Promise.all([track(loadCharacters(), 70, 'loader.cinematics'), track(loadRoleMeta(), 80, 'loader.roles'), track(loadKillMeta(), 90, 'loader.kills')]);
      })
      .then(() => {
        step(100, 'loader.ready');
        L.done();
        showMainMenu();
        // Arka plan yükleme — menü açıldıktan sonra
        loadPropImages().catch(() => {});
        loadFlagImages().catch(() => {});
      })
      .catch((err) => {
        console.error(err);
        L.error((i18n.t('ui.loadError') || 'Error') + ': ' + err.message);
      });
  }
}

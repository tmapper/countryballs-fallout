// ============================================================
// BootScene.js - Açılış sahnesi: dil dosyaları + karakter kareleri, sonra lobi
// ============================================================
import { i18n, I18n } from '../systems/I18n.js';
import { loadJSON } from '../systems/Assets.js';
import { loadCharacters } from '../systems/CharacterAtlas.js';
import { loadRoleMeta } from '../ui/RoleReveal.js';
import { loadKillMeta } from '../ui/KillCutscene.js';
import { showMainMenu } from '../systems/GameFlow.js';
import { loadPropImages } from '../map/PropImages.js';
import { loadFlagImages } from '../systems/Flags.js';
import { RES } from '../systems/Resolution.js';
import { preloadSfx } from '../systems/Sound.js';
import { isMemSave } from '../systems/MemSaver.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    // Özel yükleme ekranı index.html'de (#cfs-loader): burada sadece ilerlemesi yazılır
    const L = window.cfsLoader || { set() {}, done() {}, error() {} };
    const step = (p, key) => L.set(p, i18n.t(key));
    const track = (pr, p, key) => pr.then((v) => { step(p, key); return v; });
    // Sesleri arka planda decode et (ilk tıklamada gecikme olmasın)
    try { preloadSfx(); } catch (e) { /* yoksay */ }
    // Türkçe + İngilizce (yedek) + seçili dil açılışta; diğer diller seçilince yüklenir
    const want = I18n.wanted();
    const extra = want !== 'tr' && want !== 'en' ? [want] : [];
    Promise.all([loadJSON('locales/tr.json'), loadJSON('locales/en.json'), ...extra.map((l) => loadJSON(`locales/${l}.json`).catch(() => null))])
      .then(([tr, en, x]) => {
        const data = { tr, en };
        if (extra.length && x) data[extra[0]] = x;
        i18n.init(data, (l) => loadJSON(`locales/${l}.json`));
        const ver = document.querySelector('#cfs-loader .ld-ver');                 // sürüm tek yerden (dil dosyası)
        if (ver) ver.textContent = 'BUNKER-07 · ' + i18n.t('menu.version');
        step(15, 'loader.chars');
        // Belleği küçült: menüde sadece menünün dosyaları; lobi/maç dosyaları lobiye girerken (GameAssets.js)
        if (isMemSave()) return track(loadFlagImages().catch(() => {}), 92, 'loader.flags');
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

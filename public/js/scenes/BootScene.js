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
    const { width, height } = this.scale;
    const msg = this.add.text(width / 2, height / 2, 'Yükleniyor... / Loading...', {
      fontFamily: 'Arial', fontSize: Math.round(24 * RES.k) + 'px', color: '#ffffff', align: 'center'
    }).setOrigin(0.5);

    Promise.all([loadJSON('locales/tr.json'), loadJSON('locales/en.json')])
      .then(([tr, en]) => {
        i18n.init({ tr, en });
        msg.setText(i18n.t('ui.loading'));
        return Promise.all([loadCharacters(), loadRoleMeta(), loadKillMeta(), loadPropImages(), loadFlagImages()]);
      })
      .then(() => {
        msg.setVisible(false);
        showMainMenu();
      })
      .catch((err) => {
        console.error(err);
        msg.setText((i18n.t('ui.loadError') || 'Error') + '\n' + err.message).setColor('#ff6666');
      });
  }
}

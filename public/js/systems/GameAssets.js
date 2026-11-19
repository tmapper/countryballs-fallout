// ============================================================
// GameAssets.js - Lobi + maç dosyaları (karakter kareleri, eşya resimleri, rol/öldürme bilgileri)
// ============================================================
// Normalde açılışta yüklenir. "Belleği küçült" açıkken menüde YÜKLENMEZ: oyuncu lobiye/odaya
// girerken yüklenir (kısa bir "Yükleniyor" yazısı), menüye dönünce bellekten atılır.
import { loadCharacters, unloadCharacters, charactersLoaded } from './CharacterAtlas.js';
import { loadPropImages, unloadPropImages } from '../map/PropImages.js';
import { loadRoleMeta } from '../ui/RoleReveal.js';
import { loadKillMeta } from '../ui/KillCutscene.js';
import { i18n } from './I18n.js';

let loading = null;
export const gameAssetsReady = () => charactersLoaded();

export function loadGameAssets() {
  if (gameAssetsReady()) return Promise.resolve();
  if (loading) return loading;
  loading = Promise.all([
    loadCharacters(),
    loadRoleMeta().catch(() => {}),
    loadKillMeta().catch(() => {}),
    loadPropImages().catch(() => {})
  ]).finally(() => { loading = null; });
  return loading;
}

export function unloadGameAssets() {
  if (loading) return;
  unloadCharacters();
  unloadPropImages();
}

// Dosyalar hazır değilse kısa bir yükleme yazısı göster, hazır olunca fn'i çalıştır
export function withGameAssets(fn) {
  if (gameAssetsReady()) { fn(); return; }
  const d = document.createElement('div');
  d.className = 'ga-loading';
  d.innerHTML = `<div class="ga-spin"></div><span>${i18n.tf('loader.chars', 'Loading...')}</span>`;
  document.body.appendChild(d);
  loadGameAssets().then(fn, (e) => { console.error(e); fn(); }).finally(() => d.remove());
}

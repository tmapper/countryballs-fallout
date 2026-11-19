// ============================================================
// PropImages.js - Eşya görselleri (şeffaf PNG) yükleyici
// ============================================================
// assets/props/*.png dosyaları (tools/keyprops.py yeşil perdeden üretir).
// MapPainter eşyaları çizerken buradan alır; dosya yüklenemezse eski kodla
// çizim devreye girer (oyun yine açılır).
import { assetUrl } from '../systems/Assets.js';
export const PROP_NAMES = ['agac', 'kaya', 'kum', 'varil', 'oksijen', 'masa', 'reaktor', 'sandik', 'raf', 'otomat',
  'monitor', 'dolap', 'jenerator', 'revir', 'ranza', 'salter_paneli', 'kablo_panosu', 'sigorta_kutusu', 'vana_paneli', 'tunel'];

export const PROP_IMG = {};

// Belleği küçült: menüdeyken eşya resimlerini bırak (lobiye girerken yeniden yüklenir)
export function unloadPropImages() { Object.keys(PROP_IMG).forEach((k) => { PROP_IMG[k].src = ''; delete PROP_IMG[k]; }); }

export function loadPropImages() {
  return Promise.all(PROP_NAMES.map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { PROP_IMG[n] = im; res(); };
    im.onerror = () => {
      // webp yoksa png dene (yeni ağaç vb.)
      const im2 = new Image();
      im2.onload = () => { PROP_IMG[n] = im2; res(); };
      im2.onerror = () => res();
      im2.src = assetUrl('assets/props/' + n + '.png');
    };
    im.src = assetUrl('assets/props/' + n + '.webp');
  })));
}

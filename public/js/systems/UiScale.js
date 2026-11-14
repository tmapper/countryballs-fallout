// ============================================================
// UiScale.js - Arayüz boyutu (APK / EXE / tarayıcıda farklı görünen ölçek sorunları için)
// ============================================================
// Ayarlar'da: Otomatik / Küçük / Normal / Büyük / Çok büyük.
// - Menüler ve pencereler (FitScreen.js) bu ölçekle başlar, ekrana sığmazsa yine küçülür.
// - Oyun içi butonlar ve yazılar (UIScene) bu ölçekle büyür/küçülür.
// OTOMATİK: Android APK'da telefonun "yazı boyutu" ayarı uygulama içindeki tüm yazıları büyütür
// (tarayıcıda olmaz) ve pencereler taşar. Otomatik mod bunu ölçer ve arayüzü o kadar küçültür.
const KEY = 'cfs.uiScale';
export const UI_SCALES = ['auto', '0.85', '1', '1.15', '1.3'];
let pref = 'auto';
try { const v = localStorage.getItem(KEY); if (UI_SCALES.includes(v)) pref = v; } catch (e) { /* yoksay */ }
const subs = [];

// Yazılar sistem tarafından büyütülmüş mü? 100px yazının gerçek yüksekliğini ölç.
let textZoom = 1;
function measureTextZoom() {
  try {
    const d = document.createElement('span');
    d.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;font:100px/1 Arial,sans-serif;white-space:nowrap;-webkit-text-size-adjust:100%;text-size-adjust:100%';
    d.textContent = 'MMMMMMMMMM';
    document.body.appendChild(d);
    const w = d.getBoundingClientRect().width;
    d.remove();
    // Arial'de 'M' genişliği ~0.833em -> 10 harf ~833 px. %12den az fark: büyütme yok say.
    const r = w / 833;
    textZoom = r > 1.12 && r < 2.5 ? r : 1;   // 1.12: geniş yazı tipleri (Noto, Roboto) yanlışlıkla büyütülmüş sayılmasın
  } catch (e) { textZoom = 1; }
}
if (document.body) measureTextZoom(); else document.addEventListener('DOMContentLoaded', measureTextZoom);

export const getUiPref = () => pref;
export function getUiScale() {
  if (pref === 'auto') return Math.max(0.6, Math.min(1, 1 / textZoom));
  return Number(pref) || 1;
}
export function setUiPref(v) {
  if (!UI_SCALES.includes(v)) return;
  pref = v;
  try { localStorage.setItem(KEY, v); } catch (e) { /* yoksay */ }
  subs.forEach((fn) => { try { fn(); } catch (e) { /* yoksay */ } });
  window.dispatchEvent(new Event('resize'));
}
export function onUiScale(fn) { subs.push(fn); }
export const UI_SCALE_LABEL = { tr: { auto: 'Otomatik', '0.85': 'Küçük', 1: 'Normal', '1.15': 'Büyük', '1.3': 'Çok büyük' }, en: { auto: 'Auto', '0.85': 'Small', 1: 'Normal', '1.15': 'Large', '1.3': 'Extra large' } };

// ============================================================
// Resolution.js - 1080p iç çözünürlük
// ============================================================
// Oyun ekranın GERÇEK piksel çözünürlüğünde çizilir (yüksek DPI ekranlar dahil),
// ama en az 1080p (1920) en fazla 2K (2560) uzun kenar: hem net hem kasmaz.
//   PC 1920x1080 (dpr 1)     -> 1920x1080
//   Laptop 1536x864 (dpr 1.25) -> 1920x1080
//   PC 2560x1440 / 4K        -> 2560 uzun kenar
//   Telefon 844x390 (dpr 3)  -> 2532x1170'i 2560 ile sınırlar
// RES.cssW / RES.cssH : ekranın CSS boyutu (arayüz yerleşimi bununla yapılır)
// RES.k               : CSS pikseli başına çizilen piksel

import { isMobileHw, detectTier } from './Device.js';
import { isTyping, onTypingEnd } from './Typing.js';
export const MIN_LONG_SIDE = 1920;
export const MAX_LONG_SIDE = 1920;   // 1080p: net ve akıcı (2K çok kasıyordu)
export const MAX_K = 3;

export const RES = { k: 1, cssW: 800, cssH: 600 };
// Grafik kalitesi: 'high' = 1080p, 'med' = 900p, 'low' = 720p (zayıf cihazlar). Ana menü ve oyun içi Ayarlar'dan.
// Oyuncu seçmediyse ("Otomatik") cihazın gücüne göre seçilir (Device.js detectTier).
// Her kalitenin bir FPS sınırı vardır (cihaz türüne göre):
//   Telefon/tablet : Yüksek 120 · Orta 60  · Düşük 30
//   Bilgisayar     : Yüksek 240 · Orta 120 · Düşük 60
const Q_KEY = 'cfs.quality';
export const FPS_CAPS = { mobile: { high: 120, med: 60, low: 30 }, pc: { high: 240, med: 120, low: 60 } };
export const fpsCap = (q) => FPS_CAPS[isMobileHw() ? 'mobile' : 'pc'][q || getQuality()] || 60;
let saved = null;
try { const q = localStorage.getItem(Q_KEY); if (q === 'high' || q === 'med' || q === 'low') saved = q; } catch (e) { /* yoksay */ }
let quality = saved || 'high';
let tierDone = !!saved;
export const getQuality = () => {
  // Otomatik: güç ölçümü (WebGL bilgisi) ilk sorulduğunda bir kez yapılır
  if (!tierDone) { tierDone = true; quality = detectTier(); }
  return quality;
};
export const getQualityPref = () => saved || 'auto';
const qListeners = new Set();
export const onQualityChange = (fn) => { qListeners.add(fn); return () => qListeners.delete(fn); };
// persist = false: sadece bu oturum (otomatik düşürme oyuncunun kayıtlı seçimini ezmesin)
// q = 'auto': kayıtlı seçimi sil, cihaza göre seç
export function setQuality(q, persist = true) {
  if (q === 'auto') {
    saved = null; tierDone = true; quality = detectTier();
    try { localStorage.removeItem(Q_KEY); } catch (e) { /* yoksay */ }
  } else {
    quality = q === 'low' || q === 'med' ? q : 'high';
    if (persist) { saved = quality; try { localStorage.setItem(Q_KEY, quality); } catch (e) { /* yoksay */ } }
  }
  qListeners.forEach((fn) => { try { fn(quality); } catch (e) { /* yoksay */ } });
  window.dispatchEvent(new Event('resize'));
}

// Oyunun gerçekten kapladığı alan (#game). Telefonda adres çubuğu açılıp kapanınca
// window.innerHeight ile ekrandaki alan farklı olabiliyor; görüntü çarpılmasın diye kutunun kendisini ölçeriz.
function viewSize() {
  const el = document.getElementById('game');
  const r = el ? el.getBoundingClientRect() : null;
  const vv = window.visualViewport;
  const w = r && r.width > 0 ? r.width : (vv ? vv.width : window.innerWidth);
  const h = r && r.height > 0 ? r.height : (vv ? vv.height : window.innerHeight);
  return { w, h };
}

export function measure() {
  const v = viewSize();
  RES.cssW = Math.max(1, Math.round(v.w));
  RES.cssH = Math.max(1, Math.round(v.h));
  const long = Math.max(RES.cssW, RES.cssH);
  const phys = long * Math.min(3, window.devicePixelRatio || 1);
  // Telefon/tablette 1080p yeter (pil ve ısınma)
  const mobile = isMobileHw();
  let target = Math.max(MIN_LONG_SIDE, Math.min(mobile ? MIN_LONG_SIDE : MAX_LONG_SIDE, phys));
  if (getQuality() === 'low') target = 1280;
  else if (quality === 'med') target = Math.min(target, 1600);
  RES.k = Math.min(MAX_K, target / long);
  return RES;
}

export function gameSize() {
  return { width: Math.round(RES.cssW * RES.k), height: Math.round(RES.cssH * RES.k) };
}

// Pencere boyutu / telefon yönü değişince oyunu yeniden boyutlandır
export function attachResolution(game) {
  let lastW = 0, lastH = 0, lastK = 0, raf = 0;
  const apply = () => {
    raf = 0;
    const prevW = RES.cssW, prevH = RES.cssH, prevK = RES.k;
    measure();
    // Klavye açıkken (yazı yazılıyor) ekran sadece kısaldıysa oyunu yeniden boyutlandırma:
    // eskiden tuval ufalıyor, ekran kararıyordu. Klavye kapanınca onTypingEnd ile düzeltilir.
    if (isTyping() && lastW && Math.abs(RES.cssW - lastW) < 2 && RES.cssH < lastH) {
      RES.cssW = prevW; RES.cssH = prevH; RES.k = prevK;
      return;
    }
    if (RES.cssW === lastW && RES.cssH === lastH && RES.k === lastK) return;
    lastW = RES.cssW; lastH = RES.cssH; lastK = RES.k;
    const { width, height } = gameSize();
    game.scale.setZoom(1 / RES.k);
    game.scale.resize(width, height);
    // Tuval tam olarak kutunun boyutunda (tarayıcı esnetip çarpıtmasın)
    const c = game.canvas;
    if (c) { c.style.width = RES.cssW + 'px'; c.style.height = RES.cssH + 'px'; }
  };
  let ready = false;
  game.events.once('ready', () => { ready = true; });
  const later = () => { if (ready && !raf) raf = requestAnimationFrame(apply); };
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', () => { later(); setTimeout(apply, 300); setTimeout(apply, 800); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', later);
  document.addEventListener('fullscreenchange', () => { later(); setTimeout(apply, 300); });
  onTypingEnd(() => { if (ready) apply(); });
  const el = document.getElementById('game');
  // Phaser hazır olmadan boyutlandırma yapma
  game.events.once('ready', () => { if (el && typeof ResizeObserver === 'function') new ResizeObserver(later).observe(el); apply(); });
}

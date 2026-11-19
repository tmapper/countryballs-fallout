// ============================================================
// Perf.js - Performans modu (Ayarlar > Performans): Yüksek / Dengeli / Pil tasarrufu
// ============================================================
// Grafik kalitesinden (çözünürlük) ayrıdır: oyunun İŞLEMCİ yükünü ayarlar.
//   botSkip   : botlar kaç karede bir "düşünür" (görüş, karar, yol). Yürümeleri her karede akıcı kalır.
//   visTtl    : botun "kimi görüyorum" listesi kaç saniye geçerli (görüş ışını hesabı pahalı)
//   fogSkip   : sis kaç karede bir yeniden çizilir (0: her kare, 1: iki karede bir, 2: üç karede bir)
//   sight/cull: diğer topların görünürlüğü ve ekran dışı eşyaların gizlenmesi (saniye aralık)
//   skinSlice : karakter yürüme karelerini arka planda hazırlamaya kare başına ayrılan süre (ms)
// FPS sınırı burada değil, GRAFİK kalitesine bağlı (Resolution.js FPS_CAPS):
//   Telefon/tablet: Yüksek 120 · Orta 60 · Düşük 30 — Bilgisayar: Yüksek 240 · Orta 120 · Düşük 60
import { isMobileHw } from './Device.js';
import { fpsCap, onQualityChange } from './Resolution.js';

const KEY = 'cfs.perf';
export const PERF_LEVELS = {
  high:     { botSkip: 2, visTtl: 0.12, fogSkip: 0, sight: 0.08, cull: 0.16, skinSlice: 6 },
  balanced: { botSkip: 3, visTtl: 0.25, fogSkip: 1, sight: 0.12, cull: 0.24, skinSlice: 4 },
  // Pil tasarrufu: işlemci yükü azalır
  saver:    { botSkip: 4, visTtl: 0.4,  fogSkip: 2, sight: 0.18, cull: 0.32, skinSlice: 3 }
};

let level = null;
try { const v = localStorage.getItem(KEY); if (PERF_LEVELS[v]) level = v; } catch (e) { /* yoksay */ }
if (!level) level = isMobileHw() ? 'balanced' : 'high';     // telefon varsayılanı: Dengeli

let game = null;
export const getPerf = () => level;
export const perf = () => PERF_LEVELS[level];

// Kare hızı sınırını oyun döngüsüne uygula (Phaser TimeStep; döngü yeniden başlatılınca geçerli olur).
// Ekran yenileme hızından yüksek sınır (ör. 60 Hz ekranda 240) zaten ekranın hızında çalışır.
let applied = -1;
function applyFps() {
  const loop = game && game.loop;
  if (!loop) return;
  const n = fpsCap();
  if (n === applied) return;
  applied = n;
  loop.fpsLimit = n; loop.hasFpsLimit = n > 0; loop._limitRate = n > 0 ? 1000 / n : 0;
  if (loop.running) { loop.sleep(); loop.wake(); }
}
export const currentFpsCap = () => fpsCap();

export function attachPerf(phaserGame) {
  game = phaserGame;
  applyFps();
  if (game.events) game.events.once('ready', () => { applied = -1; applyFps(); });
}
onQualityChange(() => applyFps());

export function setPerf(v, persist = true) {
  if (!PERF_LEVELS[v]) return;
  level = v;
  if (persist) try { localStorage.setItem(KEY, v); } catch (e) { /* yoksay */ }
  applyFps();
}

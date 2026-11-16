// ============================================================
// Perf.js - Performans modu (Ayarlar > Performans): Yüksek / Dengeli / Pil tasarrufu
// ============================================================
// Grafik kalitesinden (çözünürlük) ayrıdır: oyunun İŞLEMCİ yükünü ayarlar.
//   botSkip   : botlar kaç karede bir "düşünür" (görüş, karar, yol). Yürümeleri her karede akıcı kalır.
//   visTtl    : botun "kimi görüyorum" listesi kaç saniye geçerli (görüş ışını hesabı pahalı)
//   fogSkip   : sis kaç karede bir yeniden çizilir (0: her kare, 1: iki karede bir, 2: üç karede bir)
//   sight/cull: diğer topların görünürlüğü ve ekran dışı eşyaların gizlenmesi (saniye aralık)
//   skinSlice : karakter yürüme karelerini arka planda hazırlamaya kare başına ayrılan süre (ms)
//   fpsLimit  : 0 = sınırsız (hiçbir modda FPS sınırı yok; ekran ne kadar verirse)
import { isMobile } from './Device.js';

const KEY = 'cfs.perf';
export const PERF_LEVELS = {
  high:     { botSkip: 2, visTtl: 0.12, fogSkip: 0, sight: 0.08, cull: 0.16, skinSlice: 6, fpsLimit: 0 },
  balanced: { botSkip: 3, visTtl: 0.25, fogSkip: 1, sight: 0.12, cull: 0.24, skinSlice: 4, fpsLimit: 0 },
  saver:    { botSkip: 4, visTtl: 0.4,  fogSkip: 2, sight: 0.18, cull: 0.32, skinSlice: 3, fpsLimit: 0 }
};

let level = null;
try { const v = localStorage.getItem(KEY); if (PERF_LEVELS[v]) level = v; } catch (e) { /* yoksay */ }
if (!level) level = isMobile() ? 'balanced' : 'high';     // telefon varsayılanı: Dengeli

let game = null;
export const getPerf = () => level;
export const perf = () => PERF_LEVELS[level];

// Kare hızı sınırını oyun döngüsüne uygula (Phaser TimeStep; döngü yeniden başlatılınca geçerli olur)
function applyFps() {
  const loop = game && game.loop;
  if (!loop) return;
  const n = PERF_LEVELS[level].fpsLimit;
  loop.fpsLimit = n; loop.hasFpsLimit = n > 0; loop._limitRate = n > 0 ? 1000 / n : 0;
  if (loop.running) { loop.sleep(); loop.wake(); }
}

export function attachPerf(phaserGame) { game = phaserGame; applyFps(); }

export function setPerf(v) {
  if (!PERF_LEVELS[v]) return;
  level = v;
  try { localStorage.setItem(KEY, v); } catch (e) { /* yoksay */ }
  applyFps();
}

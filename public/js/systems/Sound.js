// ============================================================
// Sound.js - Ses efektleri ve müzik
// ============================================================
// Dosyalar: public/assets/sounds/<ad>.mp3 (tek HTML sürümünde gömülü gelir).
//   sfx('kill')                 -> tek seferlik efekt
//   playMusic('music_game')     -> döngülü müzik (eskisi yumuşakça kısılır)
//   startLoop('geiger_loop') / stopLoop('geiger_loop') -> döngülü efekt
//   toggleMute()                -> M tuşu: tüm sesleri aç/kapat (tercih hatırlanır)
// Tarayıcılar ilk tıklama/tuşa kadar ses çalmaya izin vermez; müzik izin gelince başlar.
import { assetUrl } from './Assets.js';

// Ses seviyeleri (oyun içi Ayarlar'dan değişir, hatırlanır). 0..1
const VOL_KEY = 'cfs.vol';
let musicK = 1, sfxK = 1;
try { const v = JSON.parse(localStorage.getItem(VOL_KEY) || '{}'); if (typeof v.m === 'number') musicK = v.m; if (typeof v.s === 'number') sfxK = v.s; } catch (e) { /* yoksay */ }
const BASE_MUSIC = 0.35, BASE_SFX = 0.8;
let MUSIC_VOL = BASE_MUSIC * musicK;
let SFX_VOL = BASE_SFX * sfxK;
const saveVol = () => { try { localStorage.setItem(VOL_KEY, JSON.stringify({ m: musicK, s: sfxK })); } catch (e) { /* yoksay */ } };
export const getVolumes = () => ({ music: musicK, sfx: sfxK });
export function setMusicVolume(k) {
  musicK = Math.max(0, Math.min(1, k)); MUSIC_VOL = BASE_MUSIC * musicK; saveVol();
  if (music) music.volume = MUSIC_VOL;
}
export function setSfxVolume(k) {
  sfxK = Math.max(0, Math.min(1, k)); SFX_VOL = BASE_SFX * sfxK; saveVol();
  Object.entries(loops).forEach(([n, a]) => { a.volume = vol(n, SFX_VOL); });
}
// Bazı seslerin kendi ses seviyesi (1 = normal)
const LEVEL = {
  step: 0.22, ui_click: 0.5, geiger_loop: 0.55, alarm_loop: 0.16, oxygen_alert: 0.3, valve_turn: 0.7,
  wire_connect: 0.8, lever: 0.8, dust_wipe: 0.7, door_seal: 0.5, power_down: 0.45, power_up: 0.5
};
const MUTE_KEY = 'cfs.muted';

let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* yoksay */ }

let music = null;
let musicName = null;
const loops = {};

const url = (name) => assetUrl(`assets/sounds/${name}.mp3`);
const vol = (name, base, k = 1) => Math.max(0, Math.min(1, base * (LEVEL[name] ?? 1) * k));
const tryPlay = (a) => { const p = a.play(); if (p && p.catch) p.catch(() => {}); };

// Ses yumuşak geçişi. setTimeout ile (requestAnimationFrame değil): sekme arka plandayken de biter.
// Eskiden sekme gizlenince geçiş hiç bitmiyor, eski müzik/alarm kapanmadan çalmaya devam ediyor,
// uzun oynayınca sesler üst üste binip "cinlenme" yapıyordu.
function fade(a, to, ms, then) {
  clearInterval(a._fadeT);
  const from = a.volume;
  const t0 = performance.now();
  a._fadeT = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(a._fadeT); a._fadeT = 0; if (then) then(); }
  }, 30);
}

// Tamamen kapat ve belleği bırak
function kill(a) {
  try { clearInterval(a._fadeT); a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* yoksay */ }
  live.delete(a);
}
const live = new Set();          // çalan tüm müzik/döngü sesleri (yetim kalan var mı diye kontrol)

// Her ses için küçük bir havuz: her çalışta yeni Audio oluşturmak (özellikle adım sesi) kasma yapıyordu
const pools = {};
export function sfx(name, k = 1, pitch = 1) {
  if (muted) return null;
  const pool = pools[name] || (pools[name] = []);
  // pitch değişince aynı elemanı paylaşmak bozulabilir; pitch≈1 için havuz, değilse yeni
  let a = null;
  if (Math.abs(pitch - 1) < 0.001) {
    a = pool.find((x) => x.paused || x.ended);
    if (!a) {
      if (pool.length >= 6) a = pool[0];
      else { a = new Audio(url(name)); a.preload = 'auto'; pool.push(a); }
    }
  } else {
    a = new Audio(url(name));
    a.preload = 'auto';
  }
  try { a.playbackRate = Math.max(0.5, Math.min(2, pitch)); } catch (e) {}
  a.currentTime = 0;
  a.volume = vol(name, SFX_VOL, k);
  tryPlay(a);
  return a;
}

export function playMusic(name) {
  if (musicName === name && music) {
    if (music.paused && !muted) tryPlay(music);
    return;
  }
  stopMusic();
  const a = new Audio(url(name));
  live.add(a);
  a.loop = true;
  a.volume = 0;
  music = a;
  musicName = name;
  if (!muted) tryPlay(a);
  fade(a, MUSIC_VOL, 900);
}

export function stopMusic(ms = 600) {
  const a = music;
  music = null;
  musicName = null;
  if (a) fade(a, 0, ms, () => kill(a));
}

export function startLoop(name, k = 1) {
  if (loops[name]) return;
  const a = new Audio(url(name));
  live.add(a);
  a.loop = true;
  a.volume = vol(name, SFX_VOL, k);
  loops[name] = a;
  if (!muted) tryPlay(a);
}

export function stopLoop(name, ms = 250) {
  const a = loops[name];
  if (!a) return;
  delete loops[name];
  fade(a, 0, ms, () => kill(a));
}

export function stopAllLoops() {
  Object.keys(loops).forEach((n) => stopLoop(n));
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* yoksay */ }
  const all = [music, ...Object.values(loops)].filter(Boolean);
  all.forEach((a) => (muted ? a.pause() : tryPlay(a)));
  return muted;
}

// İlk tıklama/tuş: tarayıcı sese izin verir, bekleyen müziği başlat
const unlock = () => {
  if (muted) return;
  if (music && music.paused) tryPlay(music);
  Object.values(loops).forEach((a) => { if (a.paused) tryPlay(a); });
};
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('keydown', unlock, true);

// Butonlara tıklama sesi
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('button')) sfx('ui_click');
}, true);

// M tuşu: sesi aç/kapat (yazı alanındayken değil)
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyM' || e.repeat) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  toggleMute();
});

// Bekçi: 2 sn'de bir, şu an çalması gerekmeyen (yetim) müzik/döngü seslerini kapat
setInterval(() => {
  const keep = new Set([music, ...Object.values(loops)]);
  live.forEach((a) => { if (!keep.has(a) && !a._fadeT) kill(a); });
}, 2000);
// Sekme gizlenince döngü sesleri sustur, geri gelince devam et
document.addEventListener('visibilitychange', () => {
  const all = [music, ...Object.values(loops)].filter(Boolean);
  if (document.hidden) all.forEach((a) => a.pause());
  else if (!muted) all.forEach((a) => tryPlay(a));
});

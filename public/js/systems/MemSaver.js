// ============================================================
// MemSaver.js - "Belleği küçült" modu
// ============================================================
// Az bellekli cihazlar (ör. 4 GB tablet + aynı anda yayın) için: oyun sadece O AN açık olan
// bölümün dosyalarını bellekte tutar, diğerlerini atar.
//   Menü  : karakter kareleri, eşya resimleri, harita/lobi dokuları, oyuncu dokuları YÜKLENMEZ
//   Lobi  : oyun dosyaları açılırken yüklenir; menü arka planı boşaltılır
//   Maç   : lobi dokuları atılır; rol animasyonu bitince rol videosu ve çizim alanı silinir
//   Kasa  : 3D kasa sadece inceleme açıkken yüklenir, kapanınca model + 3D çizim alanı silinir
// Her zaman (mod kapalıyken de): sadece oynanan haritanın dokuları tutulur.
//
// Varsayılan: telefon/tabletlerde bellek 4 GB veya azsa AÇIK (Ayarlar'dan değiştirilebilir).
import { isMobileHw } from './Device.js';

const KEY = 'cfs.memsave';
let saved = null;                       // null = otomatik
try { const v = localStorage.getItem(KEY); if (v === '1' || v === '0') saved = v === '1'; } catch (e) { /* yoksay */ }

const autoOn = () => isMobileHw() && (Number(navigator.deviceMemory) || 4) <= 4;
export const isMemSave = () => (saved === null ? autoOn() : saved);

const listeners = new Set();
export const onMemSave = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function setMemSave(v) {
  saved = !!v;
  try { localStorage.setItem(KEY, saved ? '1' : '0'); } catch (e) { /* yoksay */ }
  listeners.forEach((fn) => { try { fn(saved); } catch (e) { /* yoksay */ } });
  if (saved) enterPhase(phase, 50);     // açılınca hemen temizle
}

// ---------- Bölümler ----------
// Her temizleyici, hangi bölümlerde GEREKLİ olduğunu söyler; başka bir bölüme geçilince çalışır.
let phase = 'boot';
const hooks = [];
export const getPhase = () => phase;
export function whenLeaving(name, keepIn, fn) {
  const i = hooks.findIndex((h) => h.name === name);
  const h = { name, keep: new Set(keepIn), fn };
  if (i >= 0) hooks[i] = h; else hooks.push(h);
}

let timer = 0;
// Sahne değişimleri Phaser'da bir sonraki karede işlendiği için temizlik biraz sonra yapılır
export function enterPhase(p, delay = 700) {
  phase = p;
  clearTimeout(timer);
  if (!isMemSave()) return;
  timer = setTimeout(() => {
    if (phase !== p) return;
    hooks.forEach((h) => { if (!h.keep.has(p)) { try { h.fn(p); } catch (e) { /* yoksay */ } } });
  }, delay);
}

// WebGL çizim alanını tamamen bırak (GPU belleği geri verilir)
export function dropGL(gl, canvas) {
  try { const ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) { /* yoksay */ }
  if (canvas) { canvas.width = 1; canvas.height = 1; }
}

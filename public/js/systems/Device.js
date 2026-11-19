// ============================================================
// Device.js - Cihaz türü + kontrol modu
// ============================================================
// İki ayrı şey var:
//   1) DONANIM (isMobileHw): telefon/tablet mi, bilgisayar mı? FPS sınırları, çözünürlük ve otomatik
//      grafik kalitesi buna göre seçilir. Oyun kendisi algılar.
//   2) KONTROL MODU (isMobile): ekranın mobil düzeni mi (joystick yardımı, tam ekran butonu, büyük menü)
//      PC düzeni mi? Varsayılan "Otomatik": ekrana dokunulunca MOBİL, klavyede oyun tuşuna
//      (WASD/oklar/Boşluk/E/Q...) basılınca ya da fare oynatılınca PC olur.
// Hangi modda olursa olsun İKİ KONTROL DE HEP ÇALIŞIR: dokunmatik ekranlı bilgisayarda parmakla
// joystick, telefona klavye takınca WASD kullanılabilir.
// Ayarlar > Cihaz'dan Otomatik / Mobil / PC seçilebilir (Mobil/PC seçilirse mod sabit kalır).
const KEY = 'cfs.device';

// ---------- 1) donanım ----------
function detectHwMobile() {
  try {
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Tablet/i.test(ua)) return true;
    // iPadOS kendini Mac olarak tanıtır: dokunmatik Mac = iPad
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
    if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
    const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
    // Ana işaretçi parmak ve hiç fare yok = telefon/tablet
    return mm('(pointer: coarse)') && !mm('(any-pointer: fine)');
  } catch (e) { return false; }
}
const HW_MOBILE = detectHwMobile();
export const isMobileHw = () => HW_MOBILE;

// Cihaz gücü: 'high' | 'med' | 'low' (otomatik grafik kalitesi için)
let tierCache = null;
export function detectTier() {
  if (tierCache) return tierCache;
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } else gpu = 'nowebgl';
  } catch (e) { /* yoksay */ }
  const mem = Number(navigator.deviceMemory) || 0;          // GB (Chrome/Android); bilinmiyorsa 0
  const cores = Number(navigator.hardwareConcurrency) || 0;
  const weakGpu = /nowebgl|SwiftShader|llvmpipe|Software|Microsoft Basic|Mali-(4\d\d|T[678]\d\d|G31|G51|G52|G57)|Adreno \(TM\) ([34]\d\d|50\d|51\d|52\d)|PowerVR (SGX|Rogue GE|Rogue G6)|GMA|HD Graphics( [2-5]\d\d)?$|Intel\(R\) HD Graphics( [2-5]\d\d)?\b/i.test(gpu);
  const strongGpu = /RTX|GTX (9[6-8]0|10[5-8]0|16\d0)|Radeon (RX|Pro)|Apple (M\d|GPU)|Arc\b|Adreno \(TM\) (6[4-9]\d|7\d\d|8\d\d)|Mali-G(7[6-9]|71[0-9]|72\d)|Immortalis|Xclipse/i.test(gpu);
  let t;
  if (HW_MOBILE) {
    if (weakGpu || (mem && mem <= 3) || (cores && cores <= 4)) t = 'low';
    else if (strongGpu && (!mem || mem >= 6)) t = 'high';
    else t = 'med';
  } else {
    if (/nowebgl|SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(gpu) || (mem && mem <= 2) || (cores && cores <= 2)) t = 'low';
    else if (weakGpu || (mem && mem <= 4) || (cores && cores <= 4)) t = 'med';
    else t = 'high';
  }
  tierCache = t;
  return t;
}

// ---------- 2) kontrol modu ----------
let pref = 'auto';                     // 'auto' | 'mobile' | 'pc'
try { const v = localStorage.getItem(KEY); if (v === 'mobile' || v === 'pc' || v === 'auto') pref = v; } catch (e) { /* yoksay */ }
let mode = pref === 'auto' ? (HW_MOBILE ? 'mobile' : 'pc') : pref;
const listeners = new Set();

export const getDevice = () => pref;                       // kayıtlı tercih (eski kod için)
export const getDevicePref = () => pref;
export const isMobile = () => mode === 'mobile';           // şu anki ekran düzeni
export const onInputMode = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function setMode(m) {
  if (m === mode) return;
  mode = m;
  applyDeviceClass();
  listeners.forEach((fn) => { try { fn(mode); } catch (e) { /* yoksay */ } });
}

export function setDevice(v) {
  pref = v === 'mobile' || v === 'pc' ? v : 'auto';
  try { localStorage.setItem(KEY, pref); } catch (e) { /* yoksay */ }
  setMode(pref === 'auto' ? (lastInput || (HW_MOBILE ? 'mobile' : 'pc')) : pref);
  applyDeviceClass();
  window.dispatchEvent(new Event('resize'));
}

export function applyDeviceClass() {
  if (!document.body) return;
  document.body.classList.toggle('dev-mobile', isMobile());
  document.body.classList.toggle('dev-pc', !isMobile());
}

// Otomatik mod: son kullanılan girdiye göre düzen değişir
let lastInput = null, lastTouch = 0, mouseAcc = 0, mouseLast = null;
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ', 'KeyR', 'KeyF', 'KeyG', 'Enter', 'Escape', 'Tab']);
function editable(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
function sawInput(kind) {
  lastInput = kind;
  if (pref === 'auto') setMode(kind);
}
if (typeof window !== 'undefined') {
  const touch = () => { lastTouch = performance.now(); mouseAcc = 0; mouseLast = null; sawInput('mobile'); };
  window.addEventListener('touchstart', touch, { capture: true, passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') touch();
    else if (e.pointerType === 'mouse' && performance.now() - lastTouch > 800) sawInput('pc');
  }, { capture: true, passive: true });
  window.addEventListener('keydown', (e) => {
    // Sohbet/isim yazarken (telefon klavyesi dahil) mod değişmez
    if (editable(e.target) || e.isComposing || e.keyCode === 229) return;
    if (GAME_KEYS.has(e.code)) sawInput('pc');
  }, { capture: true });
  // Fare ile belirgin hareket (dokunmatikten sonra tarayıcının taklit ettiği fare olaylarını yoksay)
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || performance.now() - lastTouch < 800 || mode === 'pc') return;
    if (mouseLast) mouseAcc += Math.abs(e.clientX - mouseLast[0]) + Math.abs(e.clientY - mouseLast[1]);
    mouseLast = [e.clientX, e.clientY];
    if (mouseAcc > 160) { mouseAcc = 0; sawInput('pc'); }
  }, { passive: true });
}

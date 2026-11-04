// ============================================================
// Device.js - Oyuncunun seçtiği cihaz: 'mobile' | 'pc'
// ============================================================
// İlk açılışta sorulur (ui/StartPrompts.js), Ayarlar'dan değiştirilebilir. Seçilmediyse dokunmatik
// ekrana bakılır. Mobil: joystick, büyük butonlar, düşük grafik ile başlar. PC: klavye/fare.
const KEY = 'cfs.device';
let dev = null;
try { const v = localStorage.getItem(KEY); if (v === 'mobile' || v === 'pc') dev = v; } catch (e) { /* yoksay */ }

export const getDevice = () => dev;
export const isMobile = () => (dev ? dev === 'mobile' : (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
export function setDevice(v) {
  dev = v === 'mobile' ? 'mobile' : 'pc';
  try { localStorage.setItem(KEY, dev); } catch (e) { /* yoksay */ }
  applyDeviceClass();
  window.dispatchEvent(new Event('resize'));
}
export function applyDeviceClass() {
  document.body.classList.toggle('dev-mobile', isMobile());
  document.body.classList.toggle('dev-pc', !isMobile());
}

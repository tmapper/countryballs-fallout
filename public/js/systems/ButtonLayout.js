// ============================================================
// ButtonLayout.js - MOBİL BUTON YERLERİ (Ayarlar > Buton yerleri)
// ============================================================
// Oyuncu aksiyon butonlarını sürükleyip istediği yere koyar. Konumlar ekranın oranı olarak saklanır
// (0..1), böylece telefon dönünce / ekran boyu değişince de doğru yerde kalır. Boyut çarpanı da ayarlanır.
const KEY = 'cfs.btnpos';
export const BUTTON_IDS = ['action', 'tunnel', 'use', 'report', 'sabotage'];
let data = { pos: {}, scale: 1 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') data = { pos: s.pos || {}, scale: Number(s.scale) || 1 }; } catch (e) { /* yoksay */ }

export const getButtonPos = (id) => data.pos[id] || null;          // { x: 0..1, y: 0..1 } ya da null (varsayılan yer)
export const getButtonScale = () => Math.max(0.7, Math.min(1.5, data.scale || 1));
export function saveLayout(pos, scale) {
  data = { pos: { ...pos }, scale: Math.max(0.7, Math.min(1.5, scale || 1)) };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* yoksay */ }
}
export function resetLayout() { saveLayout({}, 1); }

// Varsayılan yerler (UIScene ile aynı hesap; düzenleyici bunları gösterir). W,H: CSS piksel, R: büyük buton yarıçapı
export function defaultPositions(W, H, R) {
  const a = { x: W - 24 - R, y: H - 24 - R, r: R };
  const t = { x: a.x - R - 18 - R * 0.78, y: H - 24 - R * 0.78, r: R * 0.78 };
  return {
    action: a, tunnel: t,
    use: { x: t.x - t.r - 16 - R * 0.78, y: t.y, r: R * 0.78 },
    report: { x: a.x, y: a.y - a.r - 16 - R * 0.86, r: R * 0.86 },
    sabotage: { x: t.x, y: t.y - t.r - 16 - R * 0.78, r: R * 0.78 }
  };
}

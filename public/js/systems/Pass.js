// ============================================================
// Pass.js - Sığınak Bileti (sezon) ayarları ve ödül tablosu (Phaser'dan bağımsız)
// ============================================================
// UYARI: sunucudaki (server/index.js) SEZON / passReward / CRATE_ODDS / HFLAGS ile AYNI olmalı.
// Sunucu her şeyi doğrular; burası sadece ekranda göstermek içindir.
export const PASS = { LEVELS: 30, BAR_XP: 20, MAX_XP: 600, DAYS: 30 };
export const CRATE_TIERS = ['common', 'rare', 'grand'];
export const CRATE_ICON = { common: '📦', rare: '🎁', grand: '👑' };
export const CRATE_ODDS = { common: { rare: 70, epic: 25, legendary: 5 }, rare: { rare: 45, epic: 42, legendary: 13 }, grand: { epic: 70, legendary: 30 } };
export const RARITY_COLOR = { common: '#9fb3c8', rare: '#4aa3ff', epic: '#b66bff', legendary: '#ffb12b' };
export const RARITY_ORDER = ['legendary', 'epic', 'rare'];

// Bar numarası (1..30) -> ödül: { coins } ya da { crate: 'common'|'rare'|'grand' }
export function passReward(L) {
  if (L % 3 === 0) return { crate: (L === 15 || L === 30) ? 'grand' : (L === 9 || L === 18 || L === 24) ? 'rare' : 'common' };
  return { coins: 50 + 10 * Math.floor(L / 3) };
}

// Hesaptan özet: ulaşılan bar sayısı, alınabilir ödül sayısı, açılmamış kasa sayısı
export function passStatus(acc) {
  const p = (acc && acc.pass) || { xp: 0, claimed: [], season: 1, daysLeft: PASS.DAYS };
  const reached = Math.min(PASS.LEVELS, Math.floor(p.xp / PASS.BAR_XP));
  let claimable = 0;
  for (let L = 1; L <= reached; L++) if (!p.claimed.includes(L)) claimable++;
  const crates = acc && acc.crates ? CRATE_TIERS.reduce((n, t) => n + (acc.crates[t] || 0), 0) : 0;
  return { ...p, reached, claimable, crates };
}

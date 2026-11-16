// ============================================================
// Roles.js - Rol dağıtımı ve rol şansları
// ============================================================
// Her maçta 1 Katil + 1 Şerif vardır, kalanlar Masum.
// Roller karıştırılıp dağıtıldığı için her oyuncunun şansı:
//   Katil = 1/N, Şerif = 1/N, Masum = (N-2)/N
//   4 oyuncu -> Katil %25, Şerif %25, Masum %50
// İleride 2 Katil vb. istenirse sadece buildRoleList() değişir.

export const ROLES = ['impostor', 'sheriff', 'crewmate'];
export const ROLE_COLORS = { impostor: '#e5484d', sheriff: '#3e8bff', crewmate: '#46c46a' };
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 15;          // tek kişilik lobi (sen + en fazla 14 bot)
export const ONLINE_MAX = 25;           // çevrimiçi oda
// Rol sayıları oyuncu sayısına göre (sunucudaki impCount / sheriffCount ile aynı):
//   Katil : 1-7 kişi 1 · 8-12 kişi 2 · 13-19 kişi 3 · 20-25 kişi 4
//   Şerif : 1-9 kişi 1 · 10-17 kişi 2 · 18-25 kişi 3
export const impCount = (n) => (n >= 20 ? 4 : n >= 13 ? 3 : n >= 8 ? 2 : 1);
export const sheriffCount = (n) => (n >= 18 ? 3 : n >= 10 ? 2 : 1);

export function buildRoleList(n) {
  const k = impCount(n), sh = sheriffCount(n);
  return [...Array(k).fill('impostor'), ...Array(sh).fill('sheriff'), ...Array(Math.max(0, n - k - sh)).fill('crewmate')];
}

// Bir oyuncunun her rolü alma olasılığı (0..1)
export function roleChances(n) {
  const list = buildRoleList(n);
  const out = {};
  ROLES.forEach((r) => { out[r] = list.filter((x) => x === r).length / n; });
  return out;
}

// Rolleri dağıtır. Dönen dizinin 0. elemanı = benim rolüm.
// forced: 'random' ya da bir rol adı (rol testi için benim rolümü sabitler)
export function assignRoles(n, forced = 'random') {
  const roles = buildRoleList(n);
  // Anti-streak (solo): son roller localStorage'da, katil tekrarını azalt
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem('cfs.roleHist') || '[]'); } catch (e) { hist = []; }
  if (!Array.isArray(hist)) hist = [];
  const recentImp = hist.slice(-5).filter((x) => x === 'impostor').length;
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    if (forced !== 'random' && roles.includes(forced)) {
      const i = roles.indexOf(forced);
      [roles[0], roles[i]] = [roles[i], roles[0]];
    }
    // Ben (index 0) son 3 maçta 2+ katil olduysa yeniden dene
    if (roles[0] === 'impostor' && recentImp >= 2 && forced === 'random') continue;
    break;
  }
  try {
    hist.push(roles[0]);
    localStorage.setItem('cfs.roleHist', JSON.stringify(hist.slice(-12)));
  } catch (e) { /* yoksay */ }
  return roles;
}

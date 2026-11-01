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
export const MAX_PLAYERS = 10;

export function buildRoleList(n) {
  return ['impostor', 'sheriff', ...Array(Math.max(0, n - 2)).fill('crewmate')];
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
  for (let i = roles.length - 1; i > 0; i--) { // Fisher-Yates karıştırma
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  if (forced !== 'random' && roles.includes(forced)) {
    const i = roles.indexOf(forced);
    [roles[0], roles[i]] = [roles[i], roles[0]];
  }
  return roles;
}

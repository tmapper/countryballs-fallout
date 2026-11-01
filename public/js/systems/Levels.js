// ============================================================
// Levels.js - Seviye/unvan gösterimi (istemci tarafı)
// ============================================================
// Seviye ve XP'yi SUNUCU hesaplar (server/index.js -> publicAcc). Burada sadece gösterim yardımcıları var.
//   net.account = { level, xp, xpInto, xpNeed, title (0..5), stats: {...} }
import { i18n } from './I18n.js';

export const TITLE_LEVELS = [1, 5, 10, 20, 35, 50];   // sunucudaki TITLE_AT ile aynı olmalı
export const MAX_LEVEL = 100;

export const titleName = (idx) => i18n.t('levels.title.' + idx);
export const xpPercent = (a) => (a && a.level >= MAX_LEVEL ? 100 : a ? Math.min(100, Math.round((a.xpInto / Math.max(1, a.xpNeed)) * 100)) : 0);
export const winRate = (st) => (st && st.played ? Math.round((st.wins / st.played) * 100) : null);
// Bir sonraki unvan: { idx, level } ya da null
export const nextTitle = (a) => {
  const i = TITLE_LEVELS.findIndex((l) => l > a.level);
  return i < 0 ? null : { idx: i, level: TITLE_LEVELS[i] };
};

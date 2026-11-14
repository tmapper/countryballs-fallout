// ============================================================
// Achievements.js - Gizli başarımlar (kilidi açılınca isim + ödül)
// ============================================================
// Sunucu u.achievements[] tutar; ödül jetonu sunucuda verilir.
export const ACHIEVEMENTS = [
  { id: 'first_win', reward: 30 },
  { id: 'first_kill', reward: 25 },
  { id: 'first_task', reward: 20 },
  { id: 'win_crew', reward: 25 },
  { id: 'win_imp', reward: 30 },
  { id: 'win_sheriff', reward: 35 },
  { id: 'triple_kill', reward: 50 },
  { id: 'perfect_tasks', reward: 40 },
  { id: 'survive_end', reward: 30 },
  { id: 'report_first', reward: 20 },
  { id: 'vote_correct', reward: 25 },
  { id: 'no_kill_win_imp', reward: 45 },
  { id: 'sheriff_ace', reward: 50 },
  { id: 'ghost_tasks', reward: 30 },
  { id: 'play_10', reward: 35 },
  { id: 'play_50', reward: 50 },
  { id: 'win_5', reward: 40 },
  { id: 'win_25', reward: 50 },
  { id: 'collect_3_hist', reward: 30 },
  { id: 'collect_8_hist', reward: 50 },
  { id: 'open_crate', reward: 20 },
  { id: 'buy_hat', reward: 20 },
  { id: 'market_sell', reward: 25 },
  { id: 'market_buy', reward: 25 },
  { id: 'pass_10', reward: 30 },
  { id: 'pass_30', reward: 50 },
  { id: 'daily_3', reward: 30 },
  { id: 'streak_3', reward: 40 },
  { id: 'mystic_own', reward: 50 },
  { id: 'all_hats_free', reward: 25 },
  { id: 'friend_invite', reward: 20 },
  { id: 'solo_win', reward: 25 },
  { id: 'meeting_skip', reward: 20 },
  { id: 'tunnel_escape', reward: 30 },
  { id: 'last_crew', reward: 45 },
  { id: 'double_sheriff_kill', reward: 50 },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

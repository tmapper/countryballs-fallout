// ============================================================
// Quests.js - Günlük / haftalık görev tanımları
// ============================================================
export const DAILY_POOL = [
  { id: 'd_play_2', goal: 2, reward: 40, key: 'play' },
  { id: 'd_play_3', goal: 3, reward: 50, key: 'play' },
  { id: 'd_win_1', goal: 1, reward: 45, key: 'win' },
  { id: 'd_tasks_8', goal: 8, reward: 40, key: 'tasks' },
  { id: 'd_kill_2', goal: 2, reward: 45, key: 'kills' },
  { id: 'd_report_1', goal: 1, reward: 30, key: 'reports' },
  { id: 'd_crate_1', goal: 1, reward: 35, key: 'crates' },
];

export const WEEKLY_POOL = [
  { id: 'w_play_10', goal: 10, reward: 120, key: 'play' },
  { id: 'w_win_5', goal: 5, reward: 150, key: 'win' },
  { id: 'w_tasks_30', goal: 30, reward: 100, key: 'tasks' },
  { id: 'w_kills_8', goal: 8, reward: 130, key: 'kills' },
  { id: 'w_crates_3', goal: 3, reward: 100, key: 'crates' },
  { id: 'w_hist_1', goal: 1, reward: 80, key: 'hist' },
];

// Basit deterministik seçim (sunucu da aynı seed mantığını kullanır)
export function pickDaily(dayIndex, n = 3) {
  const out = [];
  let x = (dayIndex * 1103515245 + 12345) >>> 0;
  const pool = [...DAILY_POOL];
  while (out.length < n && pool.length) {
    x = (x * 1103515245 + 12345) >>> 0;
    const i = x % pool.length;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function pickWeekly(weekIndex, n = 3) {
  const out = [];
  let x = (weekIndex * 1664525 + 1013904223) >>> 0;
  const pool = [...WEEKLY_POOL];
  while (out.length < n && pool.length) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const i = x % pool.length;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

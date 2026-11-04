// ============================================================
// Tasks.js - Görev istasyonları ve görev dağıtımı (Phaser'dan bağımsız veri)
// ============================================================
// Her masum/şerif oyuncuya TASKS_PER_PLAYER görev verilir (rastgele, farklı istasyonlar).
// Katil görev almaz. Tüm masumların görevleri biterse MASUMLAR kazanır.
// Yeni istasyon eklemek: STATIONS listesine bir satır (oda + odaya göre x,y + görev türü).
// x,y = oyuncunun DURACAĞI nokta (ayak noktası). Eşya/duvar içine koyma: test edilir.
import { ROOMS, onMapChange } from '../map/BunkerMap.js';

export const TASKS_PER_PLAYER = 5;
export const TASK_RANGE = 110;     // dünya pikseli: istasyona bu kadar yakın olunca kullanılabilir

// Görev türü -> işaretçide görünen resim (assets/props/<ad>.png), yoksa emoji
export const TASK_ICON = {
  wires:    { img: 'kablo_panosu',   emoji: '🔌' },
  levers:   { img: 'salter_paneli',  emoji: '🎚' },
  valve:    { img: 'vana_paneli',    emoji: '🛞' },
  geiger:   { img: 'sigorta_kutusu', emoji: '☢' },
  filter:   { img: null,             emoji: '💨' },
  keypad:   { img: null,             emoji: '🔢' },
  simon:    { img: 'monitor',        emoji: '💡' },
  swipe:    { img: null,             emoji: '💳' },
  align:    { img: 'reaktor',        emoji: '🎯' },
  download: { img: 'monitor',        emoji: '⬇' },
  upload:   { img: 'monitor',        emoji: '⬆' },
  fuel:     { img: 'oksijen',        emoji: '⛽' },
  order:    { img: null,             emoji: '🔘' },
  pipes:    { img: null,             emoji: '🔧' },
  waste:    { img: 'varil',          emoji: '🛢' },
  freq:     { img: 'monitor',        emoji: '📡' },
  scan:     { img: null,             emoji: '🖐' }
};

// Odaya göre göreli konum (dx, dy saklanır: harita değişince yeniden hesaplanır)
const at = (room, dx, dy) => ({ room, dx, dy, x: ROOMS[room].x + dx, y: ROOMS[room].y + dy });

// İki aşamalı görevlerin ikinci adımı (veri indir -> İletişim'e yükle)
export const UPLOAD_STATION = { id: 'upload_comms', type: 'upload', ...at('comms', 250, 450) };

export const STATIONS = [
  { id: 'wires_electrical',  type: 'wires',  ...at('electrical', 640, 150) },
  { id: 'wires_generator',   type: 'wires',  ...at('generator', 420, 300) },
  { id: 'wires_comms',       type: 'wires',  ...at('comms', 250, 300) },
  { id: 'levers_electrical', type: 'levers', ...at('electrical', 330, 150) },
  { id: 'levers_control',    type: 'levers', ...at('control', 130, 200) },
  { id: 'valve_o2',          type: 'valve',  ...at('o2', 760, 560) },
  { id: 'valve_reactor',     type: 'valve',  ...at('reactor', 200, 200) },
  { id: 'geiger_reactor',    type: 'geiger', ...at('reactor', 760, 680) },
  { id: 'geiger_security',   type: 'geiger', ...at('security', 350, 200) },
  { id: 'geiger_lab',        type: 'geiger', ...at('lab', 210, 300) },
  { id: 'filter_o2',         type: 'filter', ...at('o2', 160, 640) },
  { id: 'filter_cafeteria',  type: 'filter', ...at('cafeteria', 430, 120) },
  { id: 'filter_medbay',     type: 'filter', ...at('medbay', 300, 160) },
  { id: 'keypad_security',   type: 'keypad', ...at('security', 600, 200) },
  { id: 'keypad_storage',    type: 'keypad', ...at('storage', 480, 180) },
  { id: 'keypad_dorm',       type: 'keypad', ...at('dorm', 120, 300) },
  { id: 'simon_control',     type: 'simon',  ...at('control', 400, 450) },
  { id: 'simon_lab',         type: 'simon',  ...at('lab', 300, 420) },
  { id: 'swipe_hall',        type: 'swipe',  ...at('hall', 1000, 450) },
  { id: 'swipe_cafeteria',   type: 'swipe',  ...at('cafeteria', 430, 470) },
  { id: 'align_reactor',     type: 'align',  ...at('reactor', 850, 300) },
  { id: 'align_generator',   type: 'align',  ...at('generator', 500, 600) },
  { id: 'download_lab',      type: 'download', ...at('lab', 420, 650) },
  { id: 'download_medbay',   type: 'download', ...at('medbay', 450, 600) },
  { id: 'download_storage',  type: 'download', ...at('storage', 480, 880) },
  // ---- Yeni görevler (6 tür, 14 istasyon). Konumlar BunkerMap.canStand ile doğrulandı. ----
  { id: 'fuel_generator',    type: 'fuel',   ...at('generator', 680, 310) },
  { id: 'fuel_storage',      type: 'fuel',   ...at('storage', 180, 490) },
  { id: 'order_control',     type: 'order',  ...at('control', 680, 230) },
  { id: 'order_hall',        type: 'order',  ...at('hall', 220, 290) },
  { id: 'pipes_o2',          type: 'pipes',  ...at('o2', 300, 330) },
  { id: 'pipes_electrical',  type: 'pipes',  ...at('electrical', 280, 450) },
  { id: 'pipes_cafeteria',   type: 'pipes',  ...at('cafeteria', 120, 370) },
  { id: 'waste_storage',     type: 'waste',  ...at('storage', 740, 270) },
  { id: 'waste_medbay',      type: 'waste',  ...at('medbay', 140, 370) },
  { id: 'freq_comms',        type: 'freq',   ...at('comms', 480, 210) },
  { id: 'freq_security',     type: 'freq',   ...at('security', 100, 350) },
  { id: 'scan_medbay',       type: 'scan',   ...at('medbay', 680, 250) },
  { id: 'scan_lab',          type: 'scan',   ...at('lab', 100, 470) },
  { id: 'scan_dorm',         type: 'scan',   ...at('dorm', 360, 510) }
];

// En fazla 1 iki-aşamalı görev, aynı türden en fazla 2 görev
export function pickTasks(n = TASKS_PER_PLAYER, { flat = false } = {}) {
  const pool = STATIONS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [], perType = {};
  for (const s of pool) {
    if (out.length >= n) break;
    if ((perType[s.type] || 0) >= (s.type === 'download' ? 1 : 2)) continue;
    perType[s.type] = (perType[s.type] || 0) + 1;
    const t = { id: s.id, type: s.type, room: s.room, x: s.x, y: s.y, done: false };
    if (s.type === 'download' && !flat) t.next = { ...UPLOAD_STATION };
    out.push(t);
  }
  return out;
}

// Yapılmamış görevlerden, menzildeki en yakın olanı
export function nearestTask(tasks, x, y) {
  let best = null, bestD = TASK_RANGE;
  tasks.forEach((t) => {
    if (t.done) return;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= bestD) { best = t; bestD = d; }
  });
  return best;
}

// Harita değişince (kurucu başka harita seçti) bütün istasyonları yeni oda konumlarına taşı
onMapChange(() => {
  [...STATIONS, UPLOAD_STATION].forEach((st) => { const r = ROOMS[st.room]; if (r) { st.x = r.x + st.dx; st.y = r.y + st.dy; } });
});

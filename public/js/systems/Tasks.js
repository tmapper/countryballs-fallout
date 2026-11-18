// ============================================================
// Tasks.js - Görev istasyonları ve görev dağıtımı (Phaser'dan bağımsız veri)
// ============================================================
// Her masum/şerif oyuncuya TASKS_PER_PLAYER görev verilir (rastgele, farklı istasyonlar).
// Katil görev almaz. Tüm masumların görevleri biterse MASUMLAR kazanır.
// Yeni istasyon eklemek: STATIONS listesine bir satır (oda + odaya göre x,y + görev türü).
// x,y = oyuncunun DURACAĞI nokta (ayak noktası). Her istasyon kendisiyle ilgili bir eşyanın önünde/yanındadır
// (kablo -> elektrik panosu, yakıt -> jeneratör tankı, tarama -> tarayıcı...). İki haritada da canStand ile doğrulandı.
import { ROOMS, MAP, onMapChange } from '../map/BunkerMap.js';

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
  scan:     { img: null,             emoji: '🖐' },
  coffee:   { img: null,             emoji: '☕' },
  medicine: { img: null,             emoji: '💊' },
  crank:    { img: null,             emoji: '⚙' },
  plants:   { img: null,             emoji: '🪴' },
  beds:     { img: null,             emoji: '🛏' },
  thermometer: { img: null,          emoji: '🌡' },
  battery:  { img: null,             emoji: '🔋' }
};

// Odaya göre göreli konum (dx, dy saklanır: harita değişince yeniden hesaplanır)
const at = (room, dx, dy) => ({ room, dx, dy, x: ROOMS[room].x + dx, y: ROOMS[room].y + dy });

// İki aşamalı görevlerin ikinci adımı (veri indir -> İletişim'e yükle)
export const UPLOAD_STATION = { id: 'upload_comms', type: 'upload', ...at('comms', 290, 568) };  // iletişim konsolunun önü

export const STATIONS = [
  { id: 'wires_electrical',  type: 'wires',  ...at('electrical', 710, 130) },
  { id: 'wires_generator',   type: 'wires',  ...at('generator', 270, 375) },
  { id: 'wires_comms',       type: 'wires',  ...at('comms', 505, 190) },
  { id: 'levers_electrical', type: 'levers', ...at('electrical', 150, 130) },
  { id: 'levers_control',    type: 'levers', ...at('control', 280, 390) },
  { id: 'valve_o2',          type: 'valve',  ...at('o2', 760, 580) },
  { id: 'valve_reactor',     type: 'valve',  ...at('reactor', 146, 345), alt: { ring: [560, 200] } },
  { id: 'geiger_reactor',    type: 'geiger', ...at('reactor', 900, 496) },
  { id: 'geiger_security',   type: 'geiger', ...at('security', 560, 510) },
  { id: 'geiger_lab',        type: 'geiger', ...at('lab', 452, 240) },
  { id: 'filter_o2',         type: 'filter', ...at('o2', 160, 678) },
  { id: 'filter_cafeteria',  type: 'filter', ...at('cafeteria', 650, 130) },
  { id: 'filter_medbay',     type: 'filter', ...at('medbay', 660, 120) },
  { id: 'keypad_security',   type: 'keypad', ...at('security', 350, 374) },
  { id: 'keypad_storage',    type: 'keypad', ...at('storage', 740, 420) },
  { id: 'keypad_dorm',       type: 'keypad', ...at('dorm', 355, 618) },
  { id: 'simon_control',     type: 'simon',  ...at('control', 520, 390) },
  { id: 'simon_lab',         type: 'simon',  ...at('lab', 130, 634) },
  { id: 'swipe_hall',        type: 'swipe',  ...at('hall', 1060, 170) },
  { id: 'swipe_cafeteria',   type: 'swipe',  ...at('cafeteria', 130, 90) },
  { id: 'align_reactor',     type: 'align',  ...at('reactor', 700, 450) },
  { id: 'align_generator',   type: 'align',  ...at('generator', 270, 545) },
  { id: 'download_lab',      type: 'download', ...at('lab', 130, 274) },
  { id: 'download_medbay',   type: 'download', ...at('medbay', 230, 145) },
  { id: 'download_storage',  type: 'download', ...at('storage', 230, 415) },
  // ---- Yeni görevler (6 tür, 14 istasyon). Konumlar BunkerMap.canStand ile doğrulandı. ----
  { id: 'fuel_generator',    type: 'fuel',   ...at('generator', 680, 260) },
  { id: 'fuel_storage',      type: 'fuel',   ...at('storage', 470, 745), alt: { ring: [410, 690] } },
  { id: 'order_control',     type: 'order',  ...at('control', 196, 138) },
  { id: 'order_hall',        type: 'order',  ...at('hall', 960, 748) },
  { id: 'pipes_o2',          type: 'pipes',  ...at('o2', 450, 290) },
  { id: 'pipes_electrical',  type: 'pipes',  ...at('electrical', 690, 600) },
  { id: 'pipes_cafeteria',   type: 'pipes',  ...at('cafeteria', 510, 70) },
  { id: 'waste_storage',     type: 'waste',  ...at('storage', 770, 834), alt: { ring: [110, 230] } },
  { id: 'waste_medbay',      type: 'waste',  ...at('medbay', 700, 458) },
  { id: 'freq_comms',        type: 'freq',   ...at('comms', 378, 400) },
  { id: 'freq_security',     type: 'freq',   ...at('security', 176, 144) },
  { id: 'scan_medbay',       type: 'scan',   ...at('medbay', 110, 260) },
  { id: 'scan_lab',          type: 'scan',   ...at('lab', 565, 538) },
  { id: 'scan_dorm',         type: 'scan',   ...at('dorm', 320, 450) },
  // ---- v0.9.22: 5 yeni tür (ilgili objenin yanında) ----
  { id: 'coffee_cafeteria',  type: 'coffee',   ...at('cafeteria', 800, 138) },   // içecek makinesi
  { id: 'medicine_medbay',   type: 'medicine', ...at('medbay', 140, 458), alt: { ring: [820, 651] } },  // hasta yatağı
  { id: 'crank_generator',   type: 'crank',    ...at('generator', 125, 290) },   // jeneratör
  { id: 'plants_o2',         type: 'plants',   ...at('o2', 138, 540) },          // saksı
  { id: 'plants_hall',       type: 'plants',   ...at('hall', 146, 720) },        // saksı
  { id: 'beds_dorm',         type: 'beds',     ...at('dorm', 530, 180) },         // ranza
  // ---- v0.9.30: termometre + batarya ----
  { id: 'thermo_lab',        type: 'thermometer', ...at('lab', 400, 200) },
  { id: 'thermo_reactor',    type: 'thermometer', ...at('reactor', 320, 280) },
  { id: 'battery_electrical', type: 'battery',  ...at('electrical', 200, 300) },
  { id: 'battery_generator', type: 'battery',   ...at('generator', 400, 400) }
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
// alt: { haritaId: [dx, dy] } -> o haritada bağlı olduğu eşya başka odayla çakıştığı için çizilmiyorsa farklı yer
function placeStations(mapId) {
  [...STATIONS, UPLOAD_STATION].forEach((st) => {
    const r = ROOMS[st.room]; if (!r) return;
    const [dx, dy] = (st.alt && st.alt[mapId]) || [st.dx, st.dy];
    st.x = r.x + dx; st.y = r.y + dy;
  });
}
onMapChange(placeStations);
placeStations(MAP.id);   // açılıştaki harita için de (alt konumlar)

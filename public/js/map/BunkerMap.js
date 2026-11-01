// ============================================================
// BunkerMap.js - Nükleer sığınak haritasının VERİSİ (Phaser'dan bağımsız)
// ============================================================
// Harita = dikdörtgenler listesi. Yürünebilir alan, odaların ve koridorların
// birleşimidir; dışarıda kalan her yer DUVAR (toprak) sayılır. Çizim, çarpışma,
// görüş alanı ve SUNUCU doğrulaması bu tek veriyi kullanır.
//
//  Reaktör ─ Güvenlik ─ Kontrol ─ O2 ─ İletişim
//    │          │           │       │       │
//  Jeneratör ─ Yemekhane ─ Ana Salon ─ Revir ─ Laboratuvar
//    │          │           │       │
//  Elektrik ─ Yatakhane ─ SIĞINAK GİRİŞİ ─ Depo
// (Reaktör↔Elektrik, Güvenlik↔Yatakhane... gibi uzak odalar Katil tünelleriyle bağlı)

import { buildProps } from './MapProps.js';
import { MAX_PLAYERS_LIMIT } from '../shared/constants.js';

export const WORLD = { w: 6450, h: 4100 };
export const WALL_LIP = 26;            // duvarın çizilen kalınlığı (görsel)
export const WALL_FACE = 96;           // odaların üst kenarındaki duvarın ön yüzü (3/4 görünüm)
export const WALL_THICK = 46;          // yan/alt duvarların üstten görünen kalınlığı

export const ROOMS = {
  entrance:   { x: 2650, y: 3150, w: 1200, h: 700,  floor: 'grass' },
  hall:       { x: 2650, y: 1450, w: 1200, h: 850,  floor: 'hall' },
  reactor:    { x: 300,  y: 300,  w: 1000, h: 850,  floor: 'reactor' },
  security:   { x: 1550, y: 300,  w: 700,  h: 600,  floor: 'security' },
  control:    { x: 2850, y: 300,  w: 800,  h: 650,  floor: 'control' },
  o2:         { x: 4250, y: 300,  w: 900,  h: 850,  floor: 'o2' },
  comms:      { x: 5450, y: 300,  w: 650,  h: 600,  floor: 'comms' },
  generator:  { x: 300,  y: 1500, w: 800,  h: 750,  floor: 'generator' },
  cafeteria:  { x: 1450, y: 1500, w: 850,  h: 750,  floor: 'cafeteria' },
  medbay:     { x: 4250, y: 1500, w: 850,  h: 700,  floor: 'medbay' },
  lab:        { x: 5450, y: 1400, w: 700,  h: 800,  floor: 'lab' },
  electrical: { x: 300,  y: 2650, w: 950,  h: 800,  floor: 'electrical' },
  dorm:       { x: 1550, y: 2650, w: 650,  h: 750,  floor: 'dorm' },
  storage:    { x: 4250, y: 2650, w: 950,  h: 1000, floor: 'storage' }
};

// Koridorlar: DÜZ dikdörtgen, tam iki odaya biraz girer (botlar bu bağlantılardan yol bulur)
export const CORRIDORS = [
  { id: 'c1',  x: 1290, y: 500,  w: 270, h: 180 }, // reaktör  <-> güvenlik
  { id: 'c2',  x: 2240, y: 520,  w: 620, h: 180 }, // güvenlik <-> kontrol
  { id: 'c3',  x: 3640, y: 520,  w: 620, h: 180 }, // kontrol  <-> o2
  { id: 'c4',  x: 5140, y: 560,  w: 320, h: 180 }, // o2       <-> iletişim
  { id: 'c5',  x: 600,  y: 1140, w: 180, h: 370 }, // reaktör  <-> jeneratör
  { id: 'c6',  x: 1800, y: 890,  w: 180, h: 620 }, // güvenlik <-> yemekhane
  { id: 'c7',  x: 3160, y: 940,  w: 180, h: 520 }, // kontrol  <-> ana salon
  { id: 'c8',  x: 4600, y: 1140, w: 180, h: 370 }, // o2       <-> revir
  { id: 'c9',  x: 5700, y: 890,  w: 180, h: 520 }, // iletişim <-> laboratuvar
  { id: 'c10', x: 1090, y: 1800, w: 370, h: 180 }, // jeneratör <-> yemekhane
  { id: 'c11', x: 2290, y: 1850, w: 370, h: 180 }, // yemekhane <-> ana salon
  { id: 'c12', x: 3840, y: 1780, w: 420, h: 180 }, // ana salon <-> revir
  { id: 'c13', x: 5090, y: 1700, w: 370, h: 180 }, // revir    <-> laboratuvar
  { id: 'c14', x: 600,  y: 2240, w: 180, h: 420 }, // jeneratör <-> elektrik
  { id: 'c15', x: 1800, y: 2240, w: 180, h: 420 }, // yemekhane <-> yatakhane
  { id: 'c16', x: 4600, y: 2190, w: 180, h: 470 }, // revir    <-> depo
  { id: 'c17', x: 1240, y: 2900, w: 320, h: 180 }, // elektrik <-> yatakhane
  { id: 'c18', x: 2190, y: 3200, w: 470, h: 180 }, // yatakhane <-> giriş
  { id: 'c19', x: 3160, y: 2290, w: 180, h: 870 }, // ana salon <-> giriş (BUNKER KAPISI burada biter)
  { id: 'c20', x: 3840, y: 3400, w: 420, h: 180 }  // giriş    <-> depo
];

// Sınır tünelleri (sadece Katil görür ve kullanır): çiftler birbirine bağlı
export const TUNNELS = [
  { id: 't1',  x: 540,  y: 1090, links: ['t2'] },   // reaktör
  { id: 't2',  x: 430,  y: 3370, links: ['t1'] },   // elektrik
  { id: 't3',  x: 1710, y: 845,  links: ['t4'] },   // güvenlik
  { id: 't4',  x: 2110, y: 3330, links: ['t3'] },   // yatakhane
  { id: 't5',  x: 3460, y: 885,  links: ['t6'] },   // kontrol
  { id: 't6',  x: 3760, y: 2230, links: ['t5'] },   // ana salon
  { id: 't7',  x: 5122, y: 1080, links: ['t8'] },   // o2
  { id: 't8',  x: 6110, y: 2150, links: ['t7'] },   // laboratuvar
  { id: 't9',  x: 6010, y: 830,  links: ['t10'] },  // iletişim
  { id: 't10', x: 5110, y: 3580, links: ['t9'] },   // depo
  { id: 't11', x: 860,  y: 2195, links: ['t12'] },  // jeneratör
  { id: 't12', x: 1540, y: 2180, links: ['t11'] }   // yemekhane
];

export const BUNKER_DOOR_X = 3250;                                      // sığınak kapısının ortası (c19 koridoru)
export const EMERGENCY_BUTTON = { x: 3250, y: 1875 };                   // masanın ortası
export const START_POINT = { x: 3290, y: 3260, radius: 210 };           // kapı + BAŞLAT direği çevresi
export const LOBBY_CENTER = { x: 3250, y: 3600 };                       // lobide oyuncuların toplandığı yer

// Bomba düştükten sonra (maç başladığında) dışarısı KAPANIR: giriş alanına bir daha girilmez.
// GameScene sealed = true yapar, LobbyScene false (lobi bomba öncesidir).
export const world = { sealed: false };
const inEntrance = (x, y) => { const e = ROOMS.entrance; return x >= e.x - 4 && x < e.x + e.w + 4 && y >= e.y - 10; };

export const WALKABLE = [...Object.values(ROOMS), ...CORRIDORS];

// Eşyalar (hem çizilir hem çarpışma)
export const PROPS = buildProps(ROOMS);
const SOLIDS = PROPS.filter((p) => p.solid);

// ---------------- Yürünebilirlik ----------------
export function inWalkable(x, y) {
  for (const r of WALKABLE) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
  }
  return false;
}

// Karakterin "ayak izi": ayak noktasının etrafında küçük bir kutu.
// Üst gövde duvarın/eşyanın üstüne taşabilir (kuşbakışı görünüm).
const FOOT_HALF_W = 26, FOOT_DEPTH = 22;

function hitsSolid(x, y) {
  const x0 = x - FOOT_HALF_W, x1 = x + FOOT_HALF_W, y0 = y - FOOT_DEPTH, y1 = y;
  for (const p of SOLIDS) {
    if (p.shape === 'circle') {
      // Kutunun daireye en yakın noktası daire içindeyse çarpışma var
      const nx = Math.max(x0, Math.min(p.x, x1)), ny = Math.max(y0, Math.min(p.y, y1));
      if ((nx - p.x) ** 2 + (ny - p.y) ** 2 < p.r * p.r) return true;
    } else if (x1 > p.x && x0 < p.x + p.w && y1 > p.y && y0 < p.y + p.h) {
      return true;
    }
  }
  return false;
}

export function canStand(x, y) {
  if (world.sealed && (inEntrance(x - FOOT_HALF_W, y) || inEntrance(x + FOOT_HALF_W, y))) return false;
  return inWalkable(x - FOOT_HALF_W, y) && inWalkable(x + FOOT_HALF_W, y) &&
         inWalkable(x - FOOT_HALF_W, y - FOOT_DEPTH) && inWalkable(x + FOOT_HALF_W, y - FOOT_DEPTH) &&
         !hitsSolid(x, y);
}

// LOBİDE oyuncular sadece giriş (çimenlik) alanında dolaşabilir.
export function canStandLobby(x, y) {
  const e = ROOMS.entrance;
  const inside = (px, py) => px >= e.x && px < e.x + e.w && py >= e.y + 20 && py < e.y + e.h;
  return inside(x - FOOT_HALF_W, y) && inside(x + FOOT_HALF_W, y) &&
         inside(x - FOOT_HALF_W, y - FOOT_DEPTH) && inside(x + FOOT_HALF_W, y - FOOT_DEPTH) &&
         !hitsSolid(x, y);
}

// Hangi odadayız? (koridor ise 'corridor', duvar içindeyse null)
export function getRoomAt(x, y) {
  for (const [id, r] of Object.entries(ROOMS)) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return id;
  }
  return inWalkable(x, y) ? 'corridor' : null;
}

export function inStartZone(x, y) {
  return (x - START_POINT.x) ** 2 + (y - START_POINT.y) ** 2 <= START_POINT.radius ** 2;
}

// ---------------- Doğma noktaları ----------------
// Lobide: giriş alanında yan yana dizilir. Oyunda: ana masanın ETRAFINDA bir halka.
export function lobbySpawn(i) {
  const cols = 5, dx = 120, dy = 110;
  const col = i % cols, row = Math.floor(i / cols);
  return { x: LOBBY_CENTER.x + (col - (cols - 1) / 2) * dx, y: LOBBY_CENTER.y + row * dy };
}
export function gameSpawn(i, n) {
  const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
  const R = 255;
  return { x: Math.round(EMERGENCY_BUTTON.x + Math.cos(a) * R), y: Math.round(EMERGENCY_BUTTON.y + Math.sin(a) * R) };
}

// ---------------- Görüş ızgarası ----------------
// Işın atma için: her hücre 0 = boş, 1 = duvar. (Eşyalar ışığı engellemez; sadece duvarlar.)
export function buildGrid(cell = 16, sealed = false) {
  const cols = Math.ceil(WORLD.w / cell), rows = Math.ceil(WORLD.h / cell);
  const data = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
      data[j * cols + i] = inWalkable(cx, cy) && !(sealed && inEntrance(cx, cy)) ? 0 : 1;
    }
  }
  return { cell, cols, rows, data };
}

export function isWall(grid, x, y) {
  const i = Math.floor(x / grid.cell), j = Math.floor(y / grid.cell);
  if (i < 0 || j < 0 || i >= grid.cols || j >= grid.rows) return true;
  return grid.data[j * grid.cols + i] === 1;
}

export { MAX_PLAYERS_LIMIT };

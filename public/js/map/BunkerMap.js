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

export const WALL_LIP = 26;            // duvarın çizilen kalınlığı (görsel)
export const WALL_FACE = 96;           // odaların üst kenarındaki duvarın ön yüzü (3/4 görünüm)
export const WALL_THICK = 46;          // yan/alt duvarların üstten görünen kalınlığı

// YENİ HARİTA (8.5): çapraz bir halka. Solda pembe MERKEZ küme (ana salon + yemekhane + elektrik + jeneratör),
// sağ üstte büyük oda (O2 + kontrol + iletişim), sağda güvenlik -> laboratuvar, sağ altta büyük kare
// (depo + reaktör), altta revir, sol altta yatakhane. Merkezden büyük odaya ORTADAN kestirme geçiş var.
// Oda boyutları eskisiyle aynı: görev istasyonları ve eşyalar odaya göre göreli konumlu olduğu için bozulmaz.
//
//                 kontrol
//        iletişim ─ O2 ──────┐
//            │ (orta geçiş)  güvenlik
//  yemekhane ─ ANA SALON       │
//  elektrik ─ jeneratör     laboratuvar
//      │                       │
//   yatakhane            depo ═ reaktör
//      └──── revir ───────────┘
//              │ (bunker kapısı)
//            GİRİŞ (bomba sonrası kapalı)
// ---------------- HARİTALAR ----------------
// Her harita: dünya boyu, odalar, koridorlar, katil tünelleri, kapı/masa noktaları.
// Oda ID'leri ve BOYUTLARI iki haritada aynıdır: görev istasyonları ve eşyalar odaya göre göreli
// olduğu için harita değişince kendiliğinden yeni yerlerine taşınır (useMap).
// Yeni harita eklemek: MAPS'e bir giriş ekle + locales'e maps.<id> adı.
const CW = 180;
const MAPS = {
  // KAVŞAK (yeni, varsayılan): çapraz halka, ortadan kestirme geçiş
  ring: {
    world: { w: 7200, h: 8200 },
    rooms: {
  control:    { x: 4560, y: 1640, w: 800,  h: 650,  floor: 'control' },
  o2:         { x: 4050, y: 2240, w: 900,  h: 850,  floor: 'o2' },
  comms:      { x: 3480, y: 2350, w: 650,  h: 600,  floor: 'comms' },
  security:   { x: 6150, y: 2850, w: 700,  h: 600,  floor: 'security' },
  lab:        { x: 6100, y: 3820, w: 700,  h: 800,  floor: 'lab' },
  storage:    { x: 5000, y: 4900, w: 950,  h: 1000, floor: 'storage' },
  reactor:    { x: 5450, y: 5450, w: 1000, h: 850,  floor: 'reactor' },
  medbay:     { x: 3550, y: 6000, w: 850,  h: 700,  floor: 'medbay' },
  dorm:       { x: 2250, y: 5300, w: 650,  h: 750,  floor: 'dorm' },
  electrical: { x: 2150, y: 4250, w: 950,  h: 800,  floor: 'electrical' },
  hall:       { x: 2650, y: 3450, w: 1200, h: 850,  floor: 'hall' },
  cafeteria:  { x: 1900, y: 3300, w: 850,  h: 750,  floor: 'cafeteria' },
  generator:  { x: 3050, y: 4250, w: 800,  h: 750,  floor: 'generator' },
  entrance:   { x: 3400, y: 7300, w: 1200, h: 700,  floor: 'hall' }
},
    corridors: [
  // halka: büyük oda (O2) -> güvenlik
  { id: 'r1',  x: 4900, y: 2700, w: 750, h: CW },
  { id: 'r2',  x: 5560, y: 2700, w: CW,  h: 340 },
  { id: 'r3',  x: 5560, y: 2860, w: 700, h: CW },
  // güvenlik -> laboratuvar
  { id: 'r4',  x: 6420, y: 3400, w: CW,  h: 520 },
  // laboratuvar -> depo
  { id: 'r5',  x: 6300, y: 4560, w: CW,  h: 450 },
  { id: 'r6',  x: 5850, y: 4830, w: 630, h: CW },
  // depo -> revir
  { id: 'r7',  x: 4600, y: 5600, w: 500, h: CW },
  { id: 'r8',  x: 4600, y: 5600, w: CW,  h: 620 },
  { id: 'r9',  x: 4300, y: 6040, w: 480, h: CW },
  // revir -> yatakhane
  { id: 'r10', x: 2890, y: 6150, w: 760, h: CW },
  { id: 'r11', x: 2890, y: 5950, w: CW,  h: 380 },
  // yatakhane -> elektrik (merkez küme)
  { id: 'r12', x: 2500, y: 4950, w: CW,  h: 450 },
  // ORTADAKİ GEÇİŞ: ana salon -> büyük oda (O2)
  { id: 'r13', x: 3600, y: 3200, w: CW,  h: 340 },
  { id: 'r14', x: 3600, y: 3200, w: 680, h: CW },
  { id: 'r15', x: 4100, y: 3000, w: CW,  h: 380 },
  // revir -> giriş (BUNKER KAPISI burada biter)
  { id: 'r16', x: 3880, y: 6600, w: CW,  h: 800 }
],
    tunnels: [
  { id: 't1',  x: 5260, y: 1790, links: ['t2'] },   // kontrol
  { id: 't2',  x: 2343, y: 5900, links: ['t1'] },   // yatakhane
  { id: 't3',  x: 2014, y: 3801, links: ['t4'] },   // yemekhane
  { id: 't4',  x: 6224, y: 6169, links: ['t3'] },   // reaktör
  { id: 't5',  x: 6761, y: 3007, links: ['t6'] },   // güvenlik
  { id: 't6',  x: 3666, y: 6421, links: ['t5'] },   // revir
  { id: 't7',  x: 3568, y: 2822, links: ['t8'] },   // iletişim
  { id: 't8',  x: 6502, y: 4548, links: ['t7'] }    // laboratuvar
],
    doorX: 3970, button: { x: 3250, y: 3875 }, start: { x: 4000, y: 7560, radius: 210 }, lobby: { x: 4000, y: 7750 }
  },
  // KLASİK SIĞINAK (eski harita): 3 sıra oda ızgarası
  classic: {
    world: { w: 6450, h: 4100 },
    rooms: {
  entrance:   { x: 2650, y: 3150, w: 1200, h: 700,  floor: 'hall' },
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
},
    corridors: [
  { id: 'k1',  x: 1290, y: 500,  w: 270, h: 180 }, // reaktör  <-> güvenlik
  { id: 'k2',  x: 2240, y: 520,  w: 620, h: 180 }, // güvenlik <-> kontrol
  { id: 'k3',  x: 3640, y: 520,  w: 620, h: 180 }, // kontrol  <-> o2
  { id: 'k4',  x: 5140, y: 560,  w: 320, h: 180 }, // o2       <-> iletişim
  { id: 'k5',  x: 600,  y: 1140, w: 180, h: 370 }, // reaktör  <-> jeneratör
  { id: 'k6',  x: 1800, y: 890,  w: 180, h: 620 }, // güvenlik <-> yemekhane
  { id: 'k7',  x: 3160, y: 940,  w: 180, h: 520 }, // kontrol  <-> ana salon
  { id: 'k8',  x: 4600, y: 1140, w: 180, h: 370 }, // o2       <-> revir
  { id: 'k9',  x: 5700, y: 890,  w: 180, h: 520 }, // iletişim <-> laboratuvar
  { id: 'k10', x: 1090, y: 1800, w: 370, h: 180 }, // jeneratör <-> yemekhane
  { id: 'k11', x: 2290, y: 1850, w: 370, h: 180 }, // yemekhane <-> ana salon
  { id: 'k12', x: 3840, y: 1780, w: 420, h: 180 }, // ana salon <-> revir
  { id: 'k13', x: 5090, y: 1700, w: 370, h: 180 }, // revir    <-> laboratuvar
  { id: 'k14', x: 600,  y: 2240, w: 180, h: 420 }, // jeneratör <-> elektrik
  { id: 'k15', x: 1800, y: 2240, w: 180, h: 420 }, // yemekhane <-> yatakhane
  { id: 'k16', x: 4600, y: 2190, w: 180, h: 470 }, // revir    <-> depo
  { id: 'k17', x: 1240, y: 2900, w: 320, h: 180 }, // elektrik <-> yatakhane
  { id: 'k18', x: 2190, y: 3200, w: 470, h: 180 }, // yatakhane <-> giriş
  { id: 'k19', x: 3160, y: 2290, w: 180, h: 870 }, // ana salon <-> giriş (BUNKER KAPISI burada biter)
  { id: 'k20', x: 3840, y: 3400, w: 420, h: 180 }  // giriş    <-> depo
],
    tunnels: [
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
],
    doorX: 3250, button: { x: 3250, y: 1875 }, start: { x: 3290, y: 3260, radius: 210 }, lobby: { x: 3250, y: 3600 }
  },
  // DERİN KUYU (3. harita): 3 katlı sığınak — üstte teknik, ortada yaşam, altta lojistik + giriş
  // Oda boyutları classic/ring ile AYNI (eşya/görev göreli koordinatları bozulmasın)
  shaft: {
    world: { w: 6200, h: 5000 },
    rooms: {
  reactor:    { x: 200,  y: 200,  w: 1000, h: 850,  floor: 'reactor' },
  generator:  { x: 1500, y: 250,  w: 800,  h: 750,  floor: 'generator' },
  electrical: { x: 2600, y: 200,  w: 950,  h: 800,  floor: 'electrical' },
  cafeteria:  { x: 200,  y: 1400, w: 850,  h: 750,  floor: 'cafeteria' },
  hall:       { x: 1400, y: 1350, w: 1200, h: 850,  floor: 'hall' },
  security:   { x: 2900, y: 1450, w: 700,  h: 600,  floor: 'security' },
  control:    { x: 3900, y: 1400, w: 800,  h: 650,  floor: 'control' },
  o2:         { x: 5000, y: 1300, w: 900,  h: 850,  floor: 'o2' },
  dorm:       { x: 250,  y: 2600, w: 650,  h: 750,  floor: 'dorm' },
  medbay:     { x: 1300, y: 2550, w: 850,  h: 700,  floor: 'medbay' },
  storage:    { x: 2500, y: 2500, w: 950,  h: 1000, floor: 'storage' },
  lab:        { x: 3800, y: 2550, w: 700,  h: 800,  floor: 'lab' },
  comms:      { x: 4900, y: 2600, w: 650,  h: 600,  floor: 'comms' },
  entrance:   { x: 1400, y: 4000, w: 1200, h: 700,  floor: 'hall' }
},
    corridors: [
  // üst -> orta
  { id: 's1',  x: 550,  y: 1040, w: 180, h: 380 }, // reaktör -> yemekhane
  { id: 's2',  x: 1800, y: 990,  w: 180, h: 380 }, // jeneratör -> ana salon
  { id: 's3',  x: 3000, y: 990,  w: 180, h: 480 }, // elektrik -> güvenlik
  // orta yatay
  { id: 's4',  x: 1040, y: 1680, w: 380, h: 180 }, // yemekhane -> ana salon
  { id: 's5',  x: 2580, y: 1650, w: 340, h: 180 }, // ana salon -> güvenlik
  { id: 's6',  x: 3580, y: 1600, w: 340, h: 180 }, // güvenlik -> kontrol
  { id: 's7',  x: 4680, y: 1600, w: 340, h: 180 }, // kontrol -> o2
  // orta -> alt
  { id: 's8',  x: 480,  y: 2140, w: 180, h: 480 }, // yemekhane -> yatakhane
  { id: 's9',  x: 1600, y: 2190, w: 180, h: 380 }, // ana salon -> revir
  { id: 's10', x: 3100, y: 2040, w: 180, h: 480 }, // güvenlik -> depo
  { id: 's11', x: 4150, y: 2040, w: 180, h: 530 }, // kontrol -> laboratuvar
  { id: 's12', x: 5200, y: 2140, w: 180, h: 480 }, // o2 -> iletişim
  // alt yatay
  { id: 's13', x: 890,  y: 2900, w: 430, h: 180 }, // yatakhane -> revir
  { id: 's14', x: 2140, y: 2900, w: 380, h: 180 }, // revir -> depo
  { id: 's15', x: 3430, y: 2900, w: 390, h: 180 }, // depo -> laboratuvar
  { id: 's16', x: 4480, y: 2900, w: 440, h: 180 }, // laboratuvar -> iletişim
  // giriş (bunker kapısı bu koridorda)
  { id: 's17', x: 1850, y: 3240, w: 180, h: 780 }  // revir -> giriş
],
    tunnels: [
  { id: 't1',  x: 700,  y: 625,  links: ['t2'] },   // reaktör
  { id: 't2',  x: 575,  y: 2975, links: ['t1'] },   // yatakhane
  { id: 't3',  x: 1900, y: 625,  links: ['t4'] },   // jeneratör
  { id: 't4',  x: 2975, y: 3000, links: ['t3'] },   // depo
  { id: 't5',  x: 3075, y: 600,  links: ['t6'] },   // elektrik
  { id: 't6',  x: 4150, y: 2950, links: ['t5'] },   // laboratuvar
  { id: 't7',  x: 625,  y: 1775, links: ['t8'] },   // yemekhane
  { id: 't8',  x: 5450, y: 1725, links: ['t7'] },   // o2
  { id: 't9',  x: 3250, y: 1750, links: ['t10'] },  // güvenlik
  { id: 't10', x: 2000, y: 4350, links: ['t9'] },   // giriş
  { id: 't11', x: 4300, y: 1725, links: ['t12'] },  // kontrol
  { id: 't12', x: 1725, y: 2900, links: ['t11'] }   // revir
],
    doorX: 1940, button: { x: 2000, y: 1775 }, start: { x: 2000, y: 4300, radius: 210 }, lobby: { x: 2000, y: 4450 }
  }

};
export const MAP_IDS = Object.keys(MAPS);
export const DEFAULT_MAP = 'ring';

// Aktif haritanın verisi. NESNELER YERİNDE değiştirilir (import edenler hep güncel veriyi görür).
export const MAP = { id: null, doorX: 0 };
export const WORLD = { w: 0, h: 0 };
export const ROOMS = {};
export const CORRIDORS = [];
export const TUNNELS = [];
export const EMERGENCY_BUTTON = { x: 0, y: 0 };
export const START_POINT = { x: 0, y: 0, radius: 210 };
export const LOBBY_CENTER = { x: 0, y: 0 };
export const WALKABLE = [];
export const PROPS = [];
const SOLIDS = [];
const hooks = [];
// Harita değişince haber al (görev istasyonları, sabotaj noktaları yeniden hesaplanır)
export const onMapChange = (fn) => hooks.push(fn);

export function useMap(id) {
  const m = MAPS[id] || MAPS[DEFAULT_MAP];
  const mid = MAPS[id] ? id : DEFAULT_MAP;
  if (MAP.id === mid) return;
  MAP.id = mid; MAP.doorX = m.doorX;
  Object.assign(WORLD, m.world);
  Object.keys(ROOMS).forEach((k) => delete ROOMS[k]);
  Object.entries(m.rooms).forEach(([k, r]) => { ROOMS[k] = { ...r }; });
  CORRIDORS.length = 0; m.corridors.forEach((c) => CORRIDORS.push({ ...c }));
  TUNNELS.length = 0; m.tunnels.forEach((t) => TUNNELS.push({ ...t, links: [...t.links] }));
  Object.assign(EMERGENCY_BUTTON, m.button); Object.assign(START_POINT, m.start); Object.assign(LOBBY_CENTER, m.lobby);
  WALKABLE.length = 0; WALKABLE.push(...Object.values(ROOMS), ...CORRIDORS);
  PROPS.length = 0; PROPS.push(...dropClashes(buildProps(ROOMS).filter(insideOwnRoomOnly)));
  SOLIDS.length = 0; SOLIDS.push(...PROPS.filter((p) => p.solid));
  indexSolids();
  hooks.forEach((fn) => fn(mid));
}

// Eşyalar odaya göre göreli konumlu; bazı haritalarda odalar iç içe geçer (Kavşak'ta depo-reaktör, iletişim-O2...).
// Merkezi BAŞKA bir odanın içine düşen eşya o haritada çizilmez ve çarpışmaz (forklift reaktörün ortasında durmasın).
function insideOwnRoomOnly(p) {
  if (p.pts) return true;
  const circ = p.shape === 'circle' || (p.r && !p.w);
  const cx = circ ? p.x : p.x + (p.w || 0) / 2, cy = circ ? p.y : p.y + (p.h || 0) / 2;
  return !Object.entries(ROOMS).some(([id, r]) => id !== p.room && cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h);
}

// İki farklı odanın katı eşyaları üst üste biniyorsa (odalar birleşik haritada) küçük olanı çizme
function dropClashes(list) {
  const box = (p) => { const c = p.shape === 'circle' || (p.r && !p.w); return c ? [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r] : [p.x, p.y, p.x + (p.w || 0), p.y + (p.h || 0)]; };
  const area = (b) => (b[2] - b[0]) * (b[3] - b[1]);
  const drop = new Set();
  list.forEach((a, i) => list.forEach((b, j) => {
    if (j <= i || !a.solid || !b.solid || a.room === b.room || a.pts || b.pts) return;
    const A = box(a), B = box(b);
    if (A[0] < B[2] && A[2] > B[0] && A[1] < B[3] && A[3] > B[1]) drop.add(area(A) < area(B) ? a : b);
  }));
  return list.filter((p) => !drop.has(p));
}

// Bomba düştükten sonra (maç başladığında) dışarısı KAPANIR: giriş alanına bir daha girilmez.
// GameScene sealed = true yapar, LobbyScene false (lobi bomba öncesidir).
export const world = { sealed: false };
const inEntrance = (x, y) => { const e = ROOMS.entrance; return x >= e.x - 4 && x < e.x + e.w + 4 && y >= e.y - 10 && y < e.y + e.h + 10; };


// Eşyalar (hem çizilir hem çarpışma)

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

// PERFORMANS: eskiden her canStand çağrısı TÜM eşyaları tek tek tarıyordu. Bot yol bulma saniyede on binlerce
// canStand çağırdığı için bu donmaların ana nedeniydi. Eşyalar artık 200 px'lik kovalara dağıtılır;
// sadece ayak izinin değdiği kovalardaki eşyalar denenir.
const BUCKET = 200;
let buckets = new Map();
const bkey = (i, j) => i * 100003 + j;
function indexSolids() {
  buckets = new Map();
  for (const p of SOLIDS) {
    const bx0 = p.shape === 'circle' ? p.x - p.r : p.x, bx1 = p.shape === 'circle' ? p.x + p.r : p.x + p.w;
    const by0 = p.shape === 'circle' ? p.y - p.r : p.y, by1 = p.shape === 'circle' ? p.y + p.r : p.y + p.h;
    for (let i = Math.floor(bx0 / BUCKET); i <= Math.floor(bx1 / BUCKET); i++) {
      for (let j = Math.floor(by0 / BUCKET); j <= Math.floor(by1 / BUCKET); j++) {
        const k = bkey(i, j);
        let a = buckets.get(k);
        if (!a) buckets.set(k, a = []);
        a.push(p);
      }
    }
  }
}

function hitsSolid(x, y) {
  const x0 = x - FOOT_HALF_W, x1 = x + FOOT_HALF_W, y0 = y - FOOT_DEPTH, y1 = y;
  const i0 = Math.floor(x0 / BUCKET), i1 = Math.floor(x1 / BUCKET), j0 = Math.floor(y0 / BUCKET), j1 = Math.floor(y1 / BUCKET);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const list = buckets.get(bkey(i, j));
      if (list && hitsList(list, x0, x1, y0, y1)) return true;
    }
  }
  return false;
}

function hitsList(list, x0, x1, y0, y1) {
  for (const p of list) {
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
  // 12 kişiye kadar tek halka; daha kalabalıkta iç halka 12, dış halka geri kalanı
  const inner = n <= 12 ? n : 12;
  const outer = i >= inner;
  const k = outer ? n - inner : inner, j = outer ? i - inner : i;
  const a = -Math.PI / 2 + (j / Math.max(1, k)) * Math.PI * 2 + (outer ? Math.PI / k : 0);
  for (const R of outer ? [390, 340, 300] : [255]) {
    const p = { x: Math.round(EMERGENCY_BUTTON.x + Math.cos(a) * R), y: Math.round(EMERGENCY_BUTTON.y + Math.sin(a) * R) };
    if (!outer || canStand(p.x, p.y)) return p;
  }
  return { x: Math.round(EMERGENCY_BUTTON.x + Math.cos(a) * 255), y: Math.round(EMERGENCY_BUTTON.y + Math.sin(a) * 255) };
}

// TOPLANTI: herkes ana masanın (EMERGENCY_BUTTON / roundtable) etrafına ışınlanır.
// gameSpawn ile aynı halka mantığı; Kavşak ve Klasik haritalarda masa hall odasında.
export function meetingSpawn(i, n) {
  return gameSpawn(i, n);
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

useMap(DEFAULT_MAP);

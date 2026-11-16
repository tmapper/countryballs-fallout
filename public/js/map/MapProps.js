// ============================================================
// MapProps.js - Odaların içindeki eşyalar (reaktör çekirdeği, tanklar, yataklar...)
// ============================================================
// TEK VERİ KAYNAĞI: Aynı liste hem çizilir (MapPainter) hem çarpışma olarak
// kullanılır (BunkerMap). Böylece "görünen şeyin içinden geçme" olmaz.
// Koordinatlar ODANIN SOL ÜST köşesine göredir (buildProps dünyaya çevirir).
//
// Şekiller:  rect  -> x,y,w,h (sol üst köşe)      circle -> x,y (merkez), r
// solid: true  = oyuncu içinden geçemez.   solid: false = sadece süs (zemin çizimi)
// Not: Kapı (koridor) ağızlarının önüne katı eşya koyma; tools ile test edilir.

export function buildProps(R) {
  const P = [];
  const add = (room, o) => {
    const q = { room, solid: true, ...o };
    if (o.pts) q.pts = o.pts.map(([px, py]) => [R[room].x + px, R[room].y + py]);   // nokta listelerini de dünyaya çevir
    q.x = R[room].x + (o.x || 0); q.y = R[room].y + (o.y || 0);
    P.push(q);
  };
  const decor = (room, o) => add(room, { solid: false, ...o });

  // ---------------- SIĞINAK GİRİŞİ (çimenlik, yüzey) 1200x700 ----------------
  decor('entrance', { type: 'path', x: 510, y: 0, w: 180, h: 700 });        // taş yol
  [[90, 380], [1120, 110], [90, 630], [1110, 630]].forEach(([x, y]) => add('entrance', { type: 'tree', shape: 'circle', x, y, r: 34 }));
  add('entrance', { type: 'sandbag', shape: 'rect', x: 380, y: 110, w: 90, h: 40 });
  add('entrance', { type: 'sandbag', shape: 'rect', x: 830, y: 170, w: 90, h: 40 });
  add('entrance', { type: 'startpost', shape: 'rect', x: 735, y: 96, w: 36, h: 36 });   // BAŞLAT düğmesi direği
  add('entrance', { type: 'bench', shape: 'rect', x: 230, y: 615, w: 170, h: 40 });
  add('entrance', { type: 'bench', shape: 'rect', x: 800, y: 615, w: 170, h: 40 });
  add('entrance', { type: 'rock', shape: 'circle', x: 330, y: 230, r: 26, solid: false });
  add('entrance', { type: 'rock', shape: 'circle', x: 900, y: 270, r: 22, solid: false });
  [[250, 350], [640, 190], [980, 480], [420, 470], [770, 420], [200, 520], [1060, 250]].forEach(([x, y], i) =>
    add('entrance', { type: i % 3 === 2 ? 'rock' : 'bush', shape: 'circle', x, y, r: i % 3 === 2 ? 16 : 24, solid: false }));
  add('entrance', { type: 'barrel', shape: 'circle', x: 1000, y: 540, r: 22 });
  add('entrance', { type: 'barrel', shape: 'circle', x: 1050, y: 562, r: 22 });

  // ---------------- ANA SALON 1200x850 ----------------
  decor('hall', { type: 'trefoil', x: 600, y: 425, r: 330 });
  decor('hall', { type: 'stools', x: 600, y: 425, r: 190 });
  add('hall', { type: 'roundtable', shape: 'circle', x: 600, y: 425, r: 140 });
  [[300, 210], [844, 210], [300, 590], [844, 590]].forEach(([x, y]) => add('hall', { type: 'pillar', shape: 'rect', x, y, w: 56, h: 56 }));
  add('hall', { type: 'shelf', shape: 'rect', x: 120, y: 770, w: 230, h: 60 });
  add('hall', { type: 'shelf', shape: 'rect', x: 850, y: 770, w: 220, h: 60 });
  add('hall', { type: 'vending', shape: 'rect', x: 1110, y: 110, w: 60, h: 80 });
  add('hall', { type: 'vending', shape: 'rect', x: 1110, y: 650, w: 60, h: 80 });
  add('hall', { type: 'plant', shape: 'circle', x: 70, y: 110, r: 26 });
  add('hall', { type: 'plant', shape: 'circle', x: 70, y: 700, r: 26 });
  decor('hall', { type: 'board', x: 140, y: 6, w: 300, h: 20 });
  decor('hall', { type: 'board', x: 760, y: 6, w: 300, h: 20 });

  // ---------------- REAKTÖR 1000x850 ----------------
  decor('reactor', { type: 'hazardring', x: 500, y: 430, r: 270 });
  decor('reactor', { type: 'pipe', pts: [[500, 430], [500, 0]] });
  decor('reactor', { type: 'pipe', pts: [[500, 430], [0, 430]] });
  decor('reactor', { type: 'pipe', pts: [[500, 430], [1000, 430]] });
  add('reactor', { type: 'core', shape: 'circle', x: 500, y: 430, r: 150 });
  [[80, 80], [860, 80], [80, 700], [860, 700]].forEach(([x, y]) => add('reactor', { type: 'pillar', shape: 'rect', x, y, w: 60, h: 60 }));
  add('reactor', { type: 'console', shape: 'rect', x: 520, y: 760, w: 260, h: 56 });
  add('reactor', { type: 'console', shape: 'rect', x: 40, y: 250, w: 56, h: 150 });
  add('reactor', { type: 'barrel', shape: 'circle', x: 900, y: 540, r: 22 });
  add('reactor', { type: 'barrel', shape: 'circle', x: 900, y: 592, r: 22 });
  add('reactor', { type: 'barrel', shape: 'circle', x: 852, y: 566, r: 22 });
  decor('reactor', { type: 'stripes', x: 260, y: 800, w: 220, h: 20 });

  // ---------------- GÜVENLİK 700x600 ----------------
  add('security', { type: 'monitorbank', shape: 'rect', x: 60, y: 24, w: 580, h: 70 });
  add('security', { type: 'desk', shape: 'rect', x: 180, y: 260, w: 340, h: 64 });
  add('security', { type: 'rack', shape: 'rect', x: 610, y: 440, w: 70, h: 100 });
  add('security', { type: 'rack', shape: 'rect', x: 20, y: 440, w: 70, h: 100 });
  decor('security', { type: 'cable', pts: [[350, 94], [350, 260]] });
  decor('security', { type: 'rug', x: 230, y: 380, w: 240, h: 80 });

  // ---------------- KONTROL ODASI 800x650 ----------------
  add('control', { type: 'monitorbank', shape: 'rect', x: 60, y: 24, w: 680, h: 64 });
  add('control', { type: 'console', shape: 'rect', x: 200, y: 230, w: 160, h: 110 });
  add('control', { type: 'console', shape: 'rect', x: 440, y: 230, w: 160, h: 110 });
  add('control', { type: 'locker', shape: 'rect', x: 700, y: 470, w: 70, h: 130 });
  add('control', { type: 'locker', shape: 'rect', x: 30, y: 470, w: 70, h: 130 });
  decor('control', { type: 'stripes', x: 120, y: 600, w: 180, h: 22 });
  decor('control', { type: 'stripes', x: 500, y: 600, w: 180, h: 22 });

  // ---------------- O2 ODASI 900x850 ----------------
  decor('o2', { type: 'pipe', pts: [[0, 330], [250, 330], [450, 330], [900, 330]] });
  decor('o2', { type: 'pipe', pts: [[250, 240], [250, 330]] });
  decor('o2', { type: 'pipe', pts: [[450, 240], [450, 330]] });
  decor('o2', { type: 'pipe', pts: [[650, 240], [650, 330]] });
  [[250, 160], [450, 160], [650, 160]].forEach(([x, y]) => add('o2', { type: 'tank', shape: 'circle', x, y, r: 80 }));
  add('o2', { type: 'filter', shape: 'rect', x: 60, y: 700, w: 200, h: 90 });
  add('o2', { type: 'filter', shape: 'rect', x: 640, y: 700, w: 200, h: 90 });
  add('o2', { type: 'valve', shape: 'circle', x: 840, y: 560, r: 30 });
  add('o2', { type: 'plant', shape: 'circle', x: 60, y: 520, r: 28 });
  decor('o2', { type: 'vent', x: 380, y: 560, w: 140, h: 90 });

  // ---------------- İLETİŞİM 650x600 ----------------
  add('comms', { type: 'monitorbank', shape: 'rect', x: 40, y: 24, w: 380, h: 64 });
  add('comms', { type: 'rack', shape: 'rect', x: 470, y: 20, w: 70, h: 120 });
  add('comms', { type: 'rack', shape: 'rect', x: 555, y: 20, w: 70, h: 120 });
  add('comms', { type: 'dish', shape: 'circle', x: 500, y: 380, r: 72 });
  add('comms', { type: 'console', shape: 'rect', x: 40, y: 520, w: 200, h: 56 });
  decor('comms', { type: 'cable', pts: [[505, 140], [505, 300]] });
  decor('comms', { type: 'cable', pts: [[230, 88], [230, 200], [430, 200], [430, 380]] });

  // ---------------- JENERATÖR 800x750 ----------------
  [120, 290, 460].forEach((y) => add('generator', { type: 'generator', shape: 'rect', x: 30, y, w: 190, h: 130 }));
  add('generator', { type: 'tank', shape: 'circle', x: 680, y: 150, r: 60 });
  add('generator', { type: 'barrel', shape: 'circle', x: 650, y: 610, r: 24 });
  add('generator', { type: 'barrel', shape: 'circle', x: 702, y: 610, r: 24 });
  add('generator', { type: 'barrel', shape: 'circle', x: 676, y: 658, r: 24 });
  decor('generator', { type: 'oil', x: 430, y: 560, r: 80 });
  decor('generator', { type: 'cable', pts: [[220, 185], [300, 185], [300, 525], [220, 525]] });
  decor('generator', { type: 'cable', pts: [[220, 355], [300, 355]] });

  // ---------------- YEMEKHANE 850x750 ----------------
  add('cafeteria', { type: 'longtable', shape: 'rect', x: 110, y: 170, w: 240, h: 90 });
  add('cafeteria', { type: 'longtable', shape: 'rect', x: 570, y: 170, w: 240, h: 90 });   // kapı ağızlarından uzak (iki haritada da)
  add('cafeteria', { type: 'longtable', shape: 'rect', x: 110, y: 560, w: 240, h: 90 });
  add('cafeteria', { type: 'longtable', shape: 'rect', x: 570, y: 560, w: 240, h: 90 });
  add('cafeteria', { type: 'vending', shape: 'rect', x: 20, y: 30, w: 60, h: 80 });
  add('cafeteria', { type: 'vending', shape: 'rect', x: 770, y: 30, w: 60, h: 80 });
  add('cafeteria', { type: 'counter', shape: 'rect', x: 560, y: 20, w: 180, h: 60 });
  decor('cafeteria', { type: 'rug', x: 300, y: 330, w: 250, h: 120 });

  // ---------------- REVİR 850x700 ----------------
  add('medbay', { type: 'scanner', shape: 'rect', x: 40, y: 40, w: 140, h: 170 });
  add('medbay', { type: 'cabinet', shape: 'rect', x: 600, y: 20, w: 120, h: 50 });
  [[620, 480], [620, 590], [60, 480], [60, 590]].forEach(([x, y]) => add('medbay', { type: 'bed', shape: 'rect', x, y, w: 160, h: 82 }));
  add('medbay', { type: 'plant', shape: 'circle', x: 790, y: 60, r: 24 });
  decor('medbay', { type: 'cross', x: 425, y: 330, r: 70 });

  // ---------------- LABORATUVAR 700x800 ----------------
  add('lab', { type: 'desk', shape: 'rect', x: 20, y: 160, w: 220, h: 64 });   // üst kapı ağzını kapatmasın (iki harita)
  add('lab', { type: 'desk', shape: 'rect', x: 20, y: 520, w: 220, h: 64 });
  add('lab', { type: 'vat', shape: 'circle', x: 560, y: 220, r: 58 });
  add('lab', { type: 'vat', shape: 'circle', x: 560, y: 400, r: 58 });
  add('lab', { type: 'scanner', shape: 'rect', x: 500, y: 560, w: 130, h: 150 });
  add('lab', { type: 'cabinet', shape: 'rect', x: 20, y: 720, w: 160, h: 50 });
  decor('lab', { type: 'stripes', x: 440, y: 120, w: 240, h: 18 });
  decor('lab', { type: 'vent', x: 220, y: 330, w: 120, h: 80 });

  // ---------------- ELEKTRİK 950x800 ----------------
  add('electrical', { type: 'panel', shape: 'rect', x: 40, y: 20, w: 220, h: 60 });
  add('electrical', { type: 'panel', shape: 'rect', x: 520, y: 20, w: 380, h: 60 });
  add('electrical', { type: 'transformer', shape: 'rect', x: 70, y: 300, w: 130, h: 120 });
  add('electrical', { type: 'transformer', shape: 'rect', x: 70, y: 450, w: 130, h: 120 });
  add('electrical', { type: 'transformer', shape: 'rect', x: 740, y: 520, w: 130, h: 120 });
  add('electrical', { type: 'bench', shape: 'rect', x: 380, y: 680, w: 220, h: 70 });
  decor('electrical', { type: 'cable', pts: [[260, 50], [260, 220], [800, 220], [800, 520]] });
  decor('electrical', { type: 'cable', pts: [[135, 300], [135, 230], [420, 230]] });
  decor('electrical', { type: 'puddle', x: 520, y: 420, r: 60 });

  // ---------------- YATAKHANE 650x750 ----------------
  add('dorm', { type: 'bunk', shape: 'rect', x: 20, y: 40, w: 200, h: 90 });
  add('dorm', { type: 'bunk', shape: 'rect', x: 430, y: 40, w: 200, h: 90 });
  add('dorm', { type: 'bunk', shape: 'rect', x: 430, y: 200, w: 200, h: 90 });
  add('dorm', { type: 'table', shape: 'rect', x: 230, y: 330, w: 180, h: 70 });
  add('dorm', { type: 'locker', shape: 'rect', x: 20, y: 640, w: 200, h: 60 });
  add('dorm', { type: 'locker', shape: 'rect', x: 280, y: 640, w: 150, h: 60 });
  decor('dorm', { type: 'rug', x: 220, y: 470, w: 210, h: 100 });

  // ---------------- DEPO 950x1000 ----------------
  [[40, 40], [112, 40], [40, 112], [790, 40], [790, 112], [718, 40]].forEach(([x, y]) => add('storage', { type: 'crate', shape: 'rect', x, y, w: 68, h: 68 }));
  add('storage', { type: 'shelf', shape: 'rect', x: 280, y: 280, w: 100, h: 230 });
  add('storage', { type: 'shelf', shape: 'rect', x: 560, y: 280, w: 100, h: 230 });
  add('storage', { type: 'crate', shape: 'rect', x: 790, y: 360, w: 80, h: 80 });
  add('storage', { type: 'crate', shape: 'rect', x: 790, y: 450, w: 80, h: 80 });
  [[720, 860], [770, 880], [820, 860]].forEach(([x, y]) => add('storage', { type: 'barrel', shape: 'circle', x, y, r: 24 }));
  add('storage', { type: 'crate', shape: 'rect', x: 220, y: 640, w: 140, h: 70 });
  add('storage', { type: 'forklift', shape: 'rect', x: 520, y: 650, w: 120, h: 150 });
  decor('storage', { type: 'stripes', x: 280, y: 560, w: 380, h: 20 });

  return P;
}

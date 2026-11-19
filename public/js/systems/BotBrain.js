// ============================================================
// BotBrain.js - Test botları için basit yapay zeka (çok oyunculu gelene kadar)
// ============================================================
// Bot ya bulunduğu odada rastgele bir yere yürür, ya da koridorlardan geçerek
// başka bir odaya gider. Yol: oda -> kapı -> koridor ortası -> kapı -> hedef oda.
// Odalar ve koridorlar dikdörtgen olduğu için bu ara noktalar arası düz çizgi
// her zaman yürünebilir alanda kalır.
import { ROOMS, CORRIDORS, getRoomAt, canStand, world, WORLD, MAP } from '../map/BunkerMap.js';

const DOOR_INSET = 70;   // kapı noktası oda kenarından ne kadar içeride
const MARGIN = 60;       // odada rastgele nokta seçerken kenar payı

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Oda grafiği: hangi koridor hangi iki odayı bağlıyor (harita verisinden otomatik)
const LINKS = [];
CORRIDORS.forEach((c) => {
  const rooms = Object.keys(ROOMS).filter((id) => overlaps(c, ROOMS[id]));
  if (rooms.length === 2) LINKS.push({ c, a: rooms[0], b: rooms[1] });
});

function doorPoint(c, room) {
  const r = ROOMS[room];
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  if (c.w < c.h) return { x: cx, y: clamp(cy, r.y + DOOR_INSET, r.y + r.h - DOOR_INSET) }; // dikey koridor
  return { x: clamp(cx, r.x + DOOR_INSET, r.x + r.w - DOOR_INSET), y: cy };              // yatay koridor
}

// Genişlik öncelikli arama: from odasından to odasına ara noktalar
function findPath(from, to) {
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    LINKS.forEach((l) => {
      const next = l.a === cur ? l.b : l.b === cur ? l.a : null;
      if (next && !(next in prev)) { prev[next] = { room: cur, link: l }; queue.push(next); }
    });
  }
  if (!(to in prev)) return [];
  const pts = [];
  for (let r = to; prev[r]; r = prev[r].room) {
    const { room, link } = prev[r];
    const c = link.c;
    pts.unshift(doorPoint(c, room), { x: c.x + c.w / 2, y: c.y + c.h / 2 }, doorPoint(c, r));
  }
  return pts;
}

// ---------------- Yol bulma (A*) ----------------
// Harita 30 px'lik hücrelere bölünür; karakterin ayak izi sığan hücreler yürünebilir (duvarlar VE eşyalar hesaba
// katılır). Botlar masa/dolap/varil gibi eşyalara çarpmaz, etrafından dolanır.
//
// PERFORMANS (botlar donuyordu):
//  - Açık liste artık ikili yığın (eskiden her adımda tüm liste taranıyordu: O(n²)).
//  - Çalışma dizileri her çağrıda yeniden üretilmiyor (3 x 65k elemanlık dizi + fill) bir kez ayrılır, sürüm damgasıyla sıfırlanır.
//  - Yol kısaltma sınırlı bakışla yapılır (eskiden her nokta çifti için tüm hat taranıyordu).
//  - tryNavPath: bir karede en fazla ~3 ms yol bulma. Bütçe biterse bot kısa bekler, sonraki karede dener;
//    böylece toplantı sonrası / sabotajda tüm botlar AYNI karede yol hesaplayıp oyunu dondurmaz.
const CELL = 30;
let GW = 0, GH = 0;
let nav = null, navKey = null;
let gScore = null, came = null, mark = null, stamp = 0;
// Komşu hücreler arası geçiş gerçekten yürünebilir mi? (iki hücre merkezi yürünebilir olsa da aradaki ince
// duvar/eşya köşesi geçişi kapatabiliyordu: botlar böyle bir "geçide" yol çizip sonsuza kadar takılıyordu)
// 0 = bilinmiyor, 1 = açık, 2 = kapalı. Tembel hesaplanır (ilk kullanıldığında).
let edges = null;
const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function edgeOk(cx, cy, k) {
  const i = (cy * GW + cx) * 8 + k;
  if (edges[i]) return edges[i] === 1;
  const [dx, dy] = DIRS[k];
  const ax = cx * CELL + CELL / 2, ay = cy * CELL + CELL / 2;
  let ok = true;
  for (const t of [0.25, 0.5, 0.75]) if (!canStand(ax + dx * CELL * t, ay + dy * CELL * t)) { ok = false; break; }
  edges[i] = ok ? 1 : 2;
  return ok;
}
function navGrid() {
  const key = MAP.id + ':' + world.sealed;               // harita ya da kapı durumu değişince yeniden kur
  if (nav && navKey === key) return nav;
  GW = Math.ceil(WORLD.w / CELL); GH = Math.ceil(WORLD.h / CELL);
  nav = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) nav[gy * GW + gx] = canStand(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;
  edges = new Uint8Array(GW * GH * 8);
  if (!gScore || gScore.length !== GW * GH) {
    gScore = new Float32Array(GW * GH); came = new Int32Array(GW * GH); mark = new Uint32Array(GW * GH); stamp = 0;
  }
  navKey = key;
  return nav;
}
// Maç başında bir kez çağır: ızgara ilk bot hareketinde değil, yükleme sırasında kurulsun
export function warmNav() {
  const g = navGrid();
  // Geçiş kontrollerini de şimdi (yükleme sırasında) hesapla: maç içinde ilk yol aramaları 10-20 ms sürüp kare atlatmasın
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    if (!g[cy * GW + cx]) continue;
    for (let k = 0; k < 8; k++) {
      const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
      if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && g[ny * GW + nx]) edgeOk(cx, cy, k);
    }
  }
}

const cellOf = (x, y) => [clamp(Math.floor(x / CELL), 0, GW - 1), clamp(Math.floor(y / CELL), 0, GH - 1)];
const center = (gx, gy) => ({ x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 });
// En yakın yürünebilir hücre (hedef bir eşyanın içindeyse)
function nearestFree(g, gx, gy) {
  if (g[gy * GW + gx]) return [gx, gy];
  for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = gx + dx, y = gy + dy;
    if (x >= 0 && y >= 0 && x < GW && y < GH && g[y * GW + x]) return [x, y];
  }
  return null;
}
// Düz çizgide yürünebilir mi (yol kısaltma için)
function clearLine(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!canStand(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
  return true;
}

// İkili yığın (en küçük f en üstte). Küçük ve bağımsız; her aramada yeniden kullanılır.
const heapI = [], heapF = [];
function heapPush(i, f) {
  let k = heapI.length; heapI.push(i); heapF.push(f);
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (heapF[p] <= f) break;
    heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p;
  }
  heapI[k] = i; heapF[k] = f;
}
function heapPop() {
  const top = heapI[0], li = heapI.pop(), lf = heapF.pop(), n = heapI.length;
  if (n) {
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= n) break;
      if (c + 1 < n && heapF[c + 1] < heapF[c]) c++;
      if (heapF[c] >= lf) break;
      heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c;
    }
    heapI[k] = li; heapF[k] = lf;
  }
  return top;
}

const LOOKAHEAD = 14;   // yol kısaltırken en fazla bu kadar hücre ileriye bakılır

export function navPath(from, to) {
  const g = navGrid();
  const s = nearestFree(g, ...cellOf(from.x, from.y)), e = nearestFree(g, ...cellOf(to.x, to.y));
  if (!s || !e) return [to];
  const S = s[1] * GW + s[0], E = e[1] * GW + e[0];
  if (++stamp >= 0xfffffff0) { mark.fill(0); stamp = 1; }
  heapI.length = 0; heapF.length = 0;
  const ex = e[0], ey = e[1];
  const h = (i) => Math.hypot((i % GW) - ex, ((i / GW) | 0) - ey);
  mark[S] = stamp; gScore[S] = 0; came[S] = -1;
  heapPush(S, h(S));
  const closedStamp = stamp;     // kapalı küme: gScore'u negatif işaretlemek yerine ayrı sürüm kullan
  let guard = 0, found = S === E;
  const closed = navClosed(closedStamp);
  while (heapI.length && guard++ < 80000 && !found) {
    const cur = heapPop();
    if (closed[cur] === closedStamp) continue;
    closed[cur] = closedStamp;
    if (cur === E) { found = true; break; }
    const cx = cur % GW, cy = (cur / GW) | 0, base = gScore[cur];
    for (let k = 0; k < 8; k++) {
      const dx = DIRS[k][0], dy = DIRS[k][1];
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const ni = ny * GW + nx;
      if (!g[ni] || closed[ni] === closedStamp) continue;
      if (dx && dy && (!g[cy * GW + nx] || !g[ny * GW + cx])) continue;    // köşe kesme yok
      if (!edgeOk(cx, cy, k)) continue;                                      // aradaki geçiş kapalı
      const ng = base + (dx && dy ? 1.414 : 1);
      if (mark[ni] !== stamp || ng < gScore[ni]) { mark[ni] = stamp; gScore[ni] = ng; came[ni] = cur; heapPush(ni, ng + h(ni)); }
    }
  }
  if (!found) return [to];
  const cells = [];
  for (let i = E; i !== -1; i = came[i]) { cells.push(center(i % GW, (i / GW) | 0)); if (i === S) break; }
  cells.reverse();
  cells.push(canStand(to.x, to.y) ? to : cells[cells.length - 1]);
  // Yolu kısalt: sınırlı bakışla görünen en uzak noktaya düz git
  const out = []; let a = from, i = 0;
  while (i < cells.length) {
    let j = Math.min(cells.length - 1, i + LOOKAHEAD);
    while (j > i && !clearLine(a, cells[j])) j--;
    out.push(cells[j]); a = cells[j]; i = j + 1;
  }
  return out;
}
// Kapalı küme için ayrı sürüm dizisi (mark ile aynı boyutta, tembel üretilir)
let closedArr = null;
function navClosed() {
  if (!closedArr || closedArr.length !== GW * GH) closedArr = new Uint32Array(GW * GH);
  return closedArr;
}

// Kare başına yol bulma bütçesi. GameScene her bot düşünme turunda navFrameStart() çağırır.
const NAV_BUDGET_MS = 3;
let navSpent = 0;
export function navFrameStart() { navSpent = 0; }
// Bütçe bittiyse null döner (çağıran kısa bekleyip tekrar dener)
export function tryNavPath(from, to) {
  if (navSpent >= NAV_BUDGET_MS) return null;
  const t0 = performance.now();
  const p = navPath(from, to);
  navSpent += performance.now() - t0;
  return p;
}

function randomPointIn(room) {
  const r = ROOMS[room];
  for (let i = 0; i < 20; i++) {
    const p = { x: r.x + MARGIN + Math.random() * (r.w - MARGIN * 2), y: r.y + MARGIN + 30 + Math.random() * (r.h - MARGIN * 2 - 30) };
    if (canStand(p.x, p.y)) return p;
  }
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export class BotBrain {
  constructor(ball) {
    this.ball = ball;
    this.path = [];
    this.wait = 0.5 + Math.random() * 2;
    this.stuck = 0;
    this.dir = { x: 0, y: 0 };
    this.suspect = null; // öldürürken gördüğü oyuncu (bot Şerif bunu vurmaya çalışır)
    this.fails = 0;
  }

  // Belirli bir noktaya git (sabotaj tamiri gibi). Oda grafiğinden yol bulur.
  goTo(x, y) {
    this.goal = { x, y };
    const p = tryNavPath({ x: this.ball.x, y: this.ball.y }, { x, y });
    if (!p) { this.path = []; this.wait = 0.04 + Math.random() * 0.08; this.deferred = true; return; }   // bu karenin bütçesi bitti
    this.deferred = false; this.wait = 0;
    this.path = p;
  }

  // Toplantıdan sonra: planı unut, kısa bekle
  reset() { this.path = []; this.goal = null; this.doing = null; this.finishing = null; this.wait = 0.5 + Math.random() * 1.5; this.stuck = 0; }

  plan() {
    if (this.goal) { this.goTo(this.goal.x, this.goal.y); return; }
    // Görev listesi varsa çoğunlukla sıradaki göreve yürü (Katil bot da sahte görev yapar)
    const todo = (this.ball.botTasks || []).filter((t) => !t.done);
    // Katil bot da masum gibi sık görev gezer (0.82); belli olmasın
    const taskBias = this.ball.role === 'impostor' ? 0.82 : 0.7;
    if (todo.length && Math.random() < taskBias) {
      const t = todo[Math.floor(Math.random() * todo.length)];
      this.doing = t;
      this.goTo(t.x, t.y);
      return;
    }
    const here = getRoomAt(this.ball.x, this.ball.y - 8);
    const room = ROOMS[here] ? here : 'hall';
    const ids = Object.keys(ROOMS).filter((id) => id !== room && !(world.sealed && id === 'entrance'));
    const target = Math.random() < 0.55 ? room : ids[Math.floor(Math.random() * ids.length)];
    const p = tryNavPath({ x: this.ball.x, y: this.ball.y }, randomPointIn(target));
    if (!p) { this.path = []; this.wait = 0.04 + Math.random() * 0.08; this.deferred = true; return; }
    this.deferred = false;
    this.path = p;
  }

  // Her karede çağrılır; yön vektörü döndürür.
  // chase: hedefe yaklaşır ama yapışmaz / sağ-sol sallanmaz (yumuşak, insan gibi).
  update(dt, chase = null) {
    this.dir.x = 0; this.dir.y = 0; this.dir.t = null;
    if (this.noChase > 0) { this.noChase -= dt; chase = null; }
    if (chase && this.chaseStuck > 0.7) {
      this.chaseStuck = 0; this.noChase = 1.2 + Math.random() * 0.8; this.doing = null;
      // Direkt vektör yerine yol bul — engelde titreme olmasın
      this.goTo(chase.x + (Math.random() - 0.5) * 40, chase.y + (Math.random() - 0.5) * 40);
      chase = null;
    }
    this.chasing = !!chase;
    if (chase) {
      this.path = [];
      // Kısa tereddüt (oyuncu gibi)
      if (this.chasePause > 0) {
        this.chasePause -= dt;
        return this.dir;
      }
      const dx = chase.x - this.ball.x, dy = chase.y - this.ball.y;
      const d = Math.hypot(dx, dy) || 1;
      // Tercih mesafesi: yapışma / sağ-sol dönme olmasın
      const prefer = this.chasePrefer || 100;
      let tx = 0, ty = 0;
      if (d > prefer + 30) {
        // Uzaktan: orta hız, sprint yok
        const sp = d > 420 ? 0.82 : (d > 220 ? 0.68 : 0.55);
        tx = (dx / d) * sp; ty = (dy / d) * sp;
      } else if (d < prefer * 0.55) {
        // Çok yakın: dur veya hafif geri (sallanma yok)
        tx = 0; ty = 0;
      } else {
        // İdeal bant: neredeyse dur, hafif ayarla
        tx = (dx / d) * 0.18; ty = (dy / d) * 0.18;
      }
      // Yön yumuşatma — ani 180° dönüşleri kes
      this._sx = (this._sx == null ? tx : this._sx * 0.72 + tx * 0.28);
      this._sy = (this._sy == null ? ty : this._sy * 0.72 + ty * 0.28);
      // Çok küçük vektörleri sıfırla (titreme / flip)
      if (Math.abs(this._sx) < 0.04 && Math.abs(this._sy) < 0.04) { this._sx = 0; this._sy = 0; }
      this.dir.x = this._sx; this.dir.y = this._sy;
      // Ara sıra kısa durak (gerçek oyuncu gibi)
      if (Math.random() < dt * 0.15) this.chasePause = 0.15 + Math.random() * 0.35;
      return this.dir;
    }
    this._sx = null; this._sy = null; this.chasePause = 0;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0 && this.finishing) { const t = this.finishing; this.finishing = null; if (this.ball.onBotTask) this.ball.onBotTask(t); }
      return this.dir;
    }
    if (!this.path.length) {
      this.plan();
      if (!this.path.length) { if (!this.deferred) this.wait = 1; return this.dir; }
    }
    const t = this.path[0];
    const dx = t.x - this.ball.x, dy = t.y - this.ball.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      this.path.shift();
      if (!this.path.length && this.goal) {                                         // hedefe vardı
        this.goal = null; this.fails = 0;
        if (this.doing) { this.finishing = this.doing; this.doing = null; this.wait = 2.5 + Math.random() * 5; this._wx = null; this._wy = null; }
        return this.dir;
      }
      if (!this.path.length) { this.wait = 0.8 + Math.random() * 3.5; this.fails = 0; this._wx = null; this._wy = null; }
      return this.dir;
    }
    // Normal yürüyüş: biraz yavaş + yumuşak (sağa-sola titreme azalır)
    const speed = this.ball.role === 'impostor' ? 0.72 : 0.75;
    let tx = (dx / d) * speed, ty = (dy / d) * speed;
    this._wx = (this._wx == null ? tx : this._wx * 0.55 + tx * 0.45);
    this._wy = (this._wy == null ? ty : this._wy * 0.55 + ty * 0.45);
    this.dir.x = this._wx; this.dir.y = this._wy;
    this.dir.t = t;
    return this.dir;
  }

  // GameScene hareket sonucunu bildirir; takılırsa yeni plan yapar
  report(moved, dt) {
    this.chaseStuck = this.chasing && !moved ? (this.chaseStuck || 0) + dt : 0;
    // İlerleme ölçümü: "kıpırdıyor ama 2 sn'de 25 px bile ilerlemiyor" da takılmadır (köşede titreme)
    const b = this.ball;
    if (!this.prog || this.wait > 0 || !this.path.length) this.prog = { x: b.x, y: b.y, t: 0 };
    else {
      this.prog.t += dt;
      if (Math.hypot(b.x - this.prog.x, b.y - this.prog.y) > 25) this.prog = { x: b.x, y: b.y, t: 0 };
      else if (this.prog.t > 2) { this.prog = { x: b.x, y: b.y, t: 0 }; moved = false; this.stuck = 1; }
    }
    if (this.wait > 0 || moved) { this.stuck = 0; return; }
    this.stuck += dt;
    if (this.stuck > 0.6) {
      this.stuck = 0; this.wait = 0.15;
      // Aynı yere 3 kez takıldıysa vazgeç (hedefli ya da rastgele yürüyüş fark etmez; eskiden rastgele yürüyüşte
      // sayaç hiç artmıyordu ve bot aynı köşeye sonsuza kadar yol çiziyordu) ve yakındaki açık bir noktaya kaç
      if (++this.fails >= 3) {
        this.goal = null; this.doing = null; this.fails = 0;
        this.path = [];
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 110;
          const p = { x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r };
          if (canStand(p.x, p.y) && clearLine(b, p)) { this.path = [p]; break; }
        }
        return;
      }
      // Başka bir topa ya da köşeye takıldı: yolu baştan hesapla (hedef aynı kalır)
      const last = this.path[this.path.length - 1];
      const np = last ? tryNavPath({ x: b.x, y: b.y }, last) : [];
      if (np) this.path = np;                       // bütçe yoksa eski yol kalır, bir sonraki takılmada tekrar denenir
    }
  }
}

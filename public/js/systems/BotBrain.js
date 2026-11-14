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
// katılır). Botlar artık masa/dolap/varil gibi eşyalara çarpmaz, etrafından dolanır.
const CELL = 30;
let GW = 0, GH = 0;
let nav = null, navKey = null;
function navGrid() {
  const key = MAP.id + ':' + world.sealed;               // harita ya da kapı durumu değişince yeniden kur
  if (nav && navKey === key) return nav;
  GW = Math.ceil(WORLD.w / CELL); GH = Math.ceil(WORLD.h / CELL);
  nav = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) nav[gy * GW + gx] = canStand(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;
  navKey = key;
  return nav;
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
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 6);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!canStand(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
  return true;
}
export function navPath(from, to) {
  const g = navGrid();
  const s = nearestFree(g, ...cellOf(from.x, from.y)), e = nearestFree(g, ...cellOf(to.x, to.y));
  if (!s || !e) return [to];
  const S = s[1] * GW + s[0], E = e[1] * GW + e[0];
  const gs = new Float32Array(GW * GH).fill(Infinity), came = new Int32Array(GW * GH).fill(-1), closed = new Uint8Array(GW * GH);
  const open = [S]; gs[S] = 0;
  const h = (i) => { const x = i % GW, y = (i / GW) | 0; return Math.hypot(x - e[0], y - e[1]); };
  const f = new Float32Array(GW * GH).fill(Infinity); f[S] = h(S);
  let guard = 0;
  while (open.length && guard++ < 80000) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === E) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % GW, cy = (cur / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const ni = ny * GW + nx;
      if (!g[ni] || closed[ni]) continue;
      if (dx && dy && (!g[cy * GW + nx] || !g[ny * GW + cx])) continue;    // köşe kesme yok
      const ng = gs[cur] + (dx && dy ? 1.414 : 1);
      if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; f[ni] = ng + h(ni); open.push(ni); }
    }
  }
  if (came[E] < 0 && S !== E) return [to];
  const cells = [];
  for (let i = E; i !== -1; i = came[i]) { cells.unshift(center(i % GW, (i / GW) | 0)); if (i === S) break; }
  cells.push(canStand(to.x, to.y) ? to : cells[cells.length - 1]);
  // Yolu kısalt: görünen en uzak noktaya düz git
  const out = []; let a = from, i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(a, cells[j])) j--;
    out.push(cells[j]); a = cells[j]; i = j + 1;
  }
  return out;
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
    this.wait = 0;
    this.goal = { x, y };
    this.path = navPath({ x: this.ball.x, y: this.ball.y }, { x, y });
  }

  // Toplantıdan sonra: planı unut, kısa bekle
  reset() { this.path = []; this.goal = null; this.doing = null; this.finishing = null; this.wait = 0.5 + Math.random() * 1.5; this.stuck = 0; }

  plan() {
    if (this.goal) { this.goTo(this.goal.x, this.goal.y); return; }
    // Görev listesi varsa çoğunlukla sıradaki göreve yürü (Katil bot da sahte görev yapar)
    const todo = (this.ball.botTasks || []).filter((t) => !t.done);
    if (todo.length && Math.random() < 0.7) {
      const t = todo[Math.floor(Math.random() * todo.length)];
      this.doing = t;
      this.goTo(t.x, t.y);
      return;
    }
    const here = getRoomAt(this.ball.x, this.ball.y - 8);
    const room = ROOMS[here] ? here : 'hall';
    const ids = Object.keys(ROOMS).filter((id) => id !== room && !(world.sealed && id === 'entrance'));
    const target = Math.random() < 0.55 ? room : ids[Math.floor(Math.random() * ids.length)];
    this.path = navPath({ x: this.ball.x, y: this.ball.y }, randomPointIn(target));
  }

  // Her karede çağrılır; yön vektörü döndürür.
  // chase: görünen bir hedef verilirse (Katil avı / Şerif şüpheliyi kovalar) doğrudan ona yürür.
  update(dt, chase = null) {
    this.dir.x = 0; this.dir.y = 0;
    if (chase) {
      this.path = []; this.wait = 0;
      const dx = chase.x - this.ball.x, dy = chase.y - this.ball.y;
      const d = Math.hypot(dx, dy);
      // Max 1.0 yön uzunluğu → oyuncu ile aynı üst hız (speedMul lobiden)
      if (d > 40) { this.dir.x = (dx / d) * 1.0; this.dir.y = (dy / d) * 1.0; }
      return this.dir;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0 && this.finishing) { const t = this.finishing; this.finishing = null; if (this.ball.onBotTask) this.ball.onBotTask(t); }
      return this.dir;
    }
    if (!this.path.length) {
      this.plan();
      if (!this.path.length) { this.wait = 1; return this.dir; }
    }
    const t = this.path[0];
    const dx = t.x - this.ball.x, dy = t.y - this.ball.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      this.path.shift();
      if (!this.path.length && this.goal) {                                         // hedefe vardı
        this.goal = null; this.fails = 0;
        if (this.doing) { this.finishing = this.doing; this.doing = null; this.wait = 3 + Math.random() * 4; }  // görevi "yapıyor"
        return this.dir;
      }
      if (!this.path.length) this.wait = 1 + Math.random() * 3;
      return this.dir;
    }
    // Normal gezinme: oyuncudan biraz yavaş, asla üstüne çıkmaz
    const speed = 0.85;
    this.dir.x = (dx / d) * speed; this.dir.y = (dy / d) * speed;
    return this.dir;
  }

  // GameScene hareket sonucunu bildirir; takılırsa yeni plan yapar
  report(moved, dt) {
    if (this.wait > 0 || moved) { this.stuck = 0; return; }
    this.stuck += dt;
    if (this.stuck > 0.6) {
      this.stuck = 0; this.wait = 0.15;
      // Başka bir topa ya da köşeye takıldı: yolu baştan hesapla (hedef aynı kalır)
      const last = this.path[this.path.length - 1];
      this.path = last ? navPath({ x: this.ball.x, y: this.ball.y }, last) : [];
      // Aynı hedefe 3 kez takıldıysa vazgeç (sonsuz döngü olmasın)
      if (this.goal && ++this.fails >= 3) { this.goal = null; this.doing = null; this.fails = 0; }
    }
  }
}

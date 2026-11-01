// ============================================================
// BotBrain.js - Test botları için basit yapay zeka (çok oyunculu gelene kadar)
// ============================================================
// Bot ya bulunduğu odada rastgele bir yere yürür, ya da koridorlardan geçerek
// başka bir odaya gider. Yol: oda -> kapı -> koridor ortası -> kapı -> hedef oda.
// Odalar ve koridorlar dikdörtgen olduğu için bu ara noktalar arası düz çizgi
// her zaman yürünebilir alanda kalır.
import { ROOMS, CORRIDORS, getRoomAt, canStand, world } from '../map/BunkerMap.js';

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
    const bx = this.ball.x, by = this.ball.y;
    let here = getRoomAt(bx, by - 8);
    const there = getRoomAt(x, y - 8);
    this.wait = 0;
    this.goal = { x, y };
    let pre = [];
    // Koridordaysa: önce koridorun bağladığı en yakın odanın kapısına çık
    if (!ROOMS[here]) {
      const l = LINKS.find((k) => bx >= k.c.x - 4 && bx <= k.c.x + k.c.w + 4 && by >= k.c.y - 4 && by <= k.c.y + k.c.h + 4);
      if (l) {
        const da = doorPoint(l.c, l.a), db = doorPoint(l.c, l.b);
        const useA = Math.hypot(da.x - bx, da.y - by) <= Math.hypot(db.x - bx, db.y - by);
        here = useA ? l.a : l.b;
        pre = [{ x: l.c.x + l.c.w / 2, y: l.c.y + l.c.h / 2 }, useA ? da : db];
      }
    }
    if (ROOMS[here] && ROOMS[there] && here !== there) this.path = [...pre, ...findPath(here, there), { x, y }];
    else this.path = [...pre, { x, y }];
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
    const room = ROOMS[here] ? here : null;
    if (!room) { this.path = []; return; }
    if (Math.random() < 0.55) {
      this.path = [randomPointIn(room)];
    } else {
      const ids = Object.keys(ROOMS).filter((id) => id !== room && !(world.sealed && id === 'entrance'));
      const target = ids[Math.floor(Math.random() * ids.length)];
      // Önce bulunduğu odanın içinde kapı hizasına gelsin diye yol aynen kullanılır
      this.path = [...findPath(room, target), randomPointIn(target)];
    }
  }

  // Her karede çağrılır; yön vektörü döndürür.
  // chase: görünen bir hedef verilirse (Katil avı / Şerif şüpheliyi kovalar) doğrudan ona yürür.
  update(dt, chase = null) {
    this.dir.x = 0; this.dir.y = 0;
    if (chase) {
      this.path = []; this.wait = 0;
      const dx = chase.x - this.ball.x, dy = chase.y - this.ball.y;
      const d = Math.hypot(dx, dy);
      if (d > 40) { this.dir.x = (dx / d) * 0.9; this.dir.y = (dy / d) * 0.9; }
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
    const speed = 0.75;
    this.dir.x = (dx / d) * speed; this.dir.y = (dy / d) * speed;
    return this.dir;
  }

  // GameScene hareket sonucunu bildirir; takılırsa yeni plan yapar
  report(moved, dt) {
    if (this.wait > 0 || moved) { this.stuck = 0; return; }
    this.stuck += dt;
    if (this.stuck > 0.8) {
      this.stuck = 0; this.path = []; this.wait = 0.3;
      // Aynı hedefe 3 kez takıldıysa vazgeç (sonsuz döngü olmasın)
      if (this.goal && ++this.fails >= 3) { this.goal = null; this.doing = null; this.fails = 0; }
    }
  }
}

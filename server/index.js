// ============================================================
// server/index.js - Oyunun SUNUCUSU (dosya sunar + çok oyunculu lobiler)
// ============================================================
// Hiçbir ek paket gerekmez (npm install şart değil): Node.js'in kendi http modülü ve
// küçük bir WebSocket uygulaması (aşağıda) kullanılır.
//
// Çalıştırma:  node server/index.js      (PORT ortam değişkeni ile port değişir, varsayılan 3000)
// Oyun:        http://localhost:3000      WebSocket: ws://localhost:3000/ws
//
// LOBİLER
//   Her lobi: { code, name, hostId, public, max, players: Map(id -> {id, name, flag}), state, bots }
//   - list   : açık lobiler; ÖNE ÇIKANLAR = en kalabalık, oyunda olmayan ilk 3 lobi
//   - create : yeni lobi kur (kuran kişi host olur)
//   - join   : kodla katıl          - leave : ayrıl
//   - Host çıkarsa en eski oyuncu host olur. Oyun sırasında ayrılan oyuncu herkese bildirilir.
// OYUN İÇİ
//   Sunucu oyun kurallarını bilmez: host'un oyunu yönetir (roller, öldürme, toplantı, oylama,
//   sabotaj). Sunucu sadece mesajları odadakilere iletir:
//   - relay {to?: 'host'|id, d}   -> d mesajı odaya (gönderen hariç) ya da tek kişiye gider.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_ROOMS = 200;
const MAX_PLAYERS = 10;
const MIN_MATCH_SECS = Number(process.env.MIN_MATCH_SECS) || 40;     // bundan kısa maçlar istatistiğe yazılmaz (hile/test engeli)
const MAX_TASKS_PER_MATCH = 5; // Tasks.js -> TASKS_PER_PLAYER ile aynı olmalı (oyuncu başına görev sayısı)
const MIN_HUMANS = 2;          // istatistik için maçta en az 2 gerçek (hesaplı) oyuncu olmalı; botlarla tek başına XP kasılamaz
const ADMIN_KEY = process.env.ADMIN_KEY || '';   // /api/backup?key=... ile hesapları indirmek için (boşsa kapalı)

// ---------------- HESAPLAR ----------------
// Basit hesap sistemi: isim + şifre. Şifreler scrypt ile tuzlanıp saklanır (düz metin asla yok).
// Kayıtlar data/accounts.json dosyasında. Her hesapta maç istatistikleri (stats) tutulur; seviye bunlardan hesaplanır.
// Oturum: girişte rastgele bir anahtar (token) verilir, istemci saklar, sonraki açılışta onunla girer.
// NOT: Ücretsiz sunucularda (Render free) disk kalıcı değildir; yeniden başlatınca hesaplar silinebilir.
//      Kalıcı olsun istenirse DATA_DIR ortam değişkeniyle kalıcı bir diske yönlendir (README).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ACC_FILE = path.join(DATA_DIR, 'accounts.json');
let accounts = { users: {}, tokens: {} };
try { accounts = JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')); } catch (e) { /* ilk çalıştırma */ }
let saveT = null;
function saveAccounts() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ACC_FILE + '.tmp', JSON.stringify(accounts)); fs.renameSync(ACC_FILE + '.tmp', ACC_FILE); }
    catch (e) { console.error('Hesaplar kaydedilemedi', e.message); }
  }, 300);
}
const NAME_RE = /^[A-Za-z0-9_ÇĞİÖŞÜçğıöşü]{3,16}$/;
const hashPass = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString('hex');
// ---------------- İSTATİSTİK + SEVİYE ----------------
// Seviye, istatistiklerden HESAPLANIR (ayrıca saklanmaz): formül değişirse herkesin seviyesi de doğru güncellenir.
//   XP = oynanan maç x 20 + kazanılan maç x 30 + yapılan görev x 4 + öldürme x 8
//   Seviye n -> n+1 için gereken XP = 80 + 20n   (toplam: (n-1)*(10n+80)); en yüksek seviye 100.
const XP = { played: 20, win: 30, task: 4, kill: 8 };
const MAX_LEVEL = 100;
const TITLE_AT = [1, 5, 10, 20, 35, 50];          // unvan eşikleri (istemcide levels.title.0..5)
const emptyStats = () => ({ played: 0, wins: 0, losses: 0, winsCrew: 0, winsImpostor: 0, asImpostor: 0, asSheriff: 0, asCrew: 0, tasks: 0, kills: 0, streak: 0, bestStreak: 0, left: 0 });
const xpAt = (n) => (n - 1) * (10 * n + 80);        // n. seviyeye ulaşmak için toplam XP
function calcXp(st) { return st.played * XP.played + st.wins * XP.win + st.tasks * XP.task + st.kills * XP.kill; }
function levelOf(xp) { let n = 1; while (n < MAX_LEVEL && xp >= xpAt(n + 1)) n++; return n; }
// Eksik alanları (eski hesaplar) doldurur; AYNI nesneyi döndürür, böylece st.played++ gibi değişiklikler hesaba işler
function ensureStats(u) { if (!u.stats) u.stats = emptyStats(); else for (const k of Object.keys(emptyStats())) if (typeof u.stats[k] !== 'number') u.stats[k] = 0; return u.stats; }
function publicAcc(u) {
  const st = ensureStats(u), xp = calcXp(st), level = levelOf(xp);
  const base = xpAt(level), next = level >= MAX_LEVEL ? base : xpAt(level + 1);
  let title = 0; TITLE_AT.forEach((l, i) => { if (level >= l) title = i; });
  return { name: u.name, created: u.created, xp, level, xpInto: xp - base, xpNeed: Math.max(1, next - base), title, stats: { ...st } };
}
function newToken(key) {
  const tok = crypto.randomBytes(24).toString('hex');
  accounts.tokens[tok] = { key, at: Date.now() };
  saveAccounts();
  return tok;
}
const tries = new Map();   // basit kaba kuvvet koruması: IP başına dakikada en fazla 10 deneme
function tooMany(c) {
  const k = c.ip, now = Date.now(), t = tries.get(k) || [];
  const recent = t.filter((x) => now - x < 60000); recent.push(now); tries.set(k, recent);
  return recent.length > 10;
}

// ---------------- Statik dosyalar ----------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  if (url === '/api/backup' && ADMIN_KEY && (req.url.split('key=')[1] || '').split('&')[0] === encodeURIComponent(ADMIN_KEY)) {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Content-Disposition': 'attachment; filename=accounts.json' });
    res.end(JSON.stringify(accounts)); return;
  }
  if (url === '/api/rooms') { res.writeHead(200, { 'Content-Type': MIME['.json'], 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(listRooms())); return; }
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
});

// ---------------- Küçük WebSocket uygulaması (RFC 6455) ----------------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients = new Set();
const rooms = new Map();   // code -> room
let nextId = 1;

server.on('upgrade', (req, socket) => {
  if (!(req.url || '').startsWith('/ws')) { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const client = { id: 'p' + (nextId++), socket, buf: Buffer.alloc(0), room: null, alive: true, name: '', flag: 'TR', account: null,
    ip: String(req.headers['x-forwarded-for'] || socket.remoteAddress || '').split(',')[0].trim() };
  clients.add(client);
  socket.on('data', (chunk) => onData(client, chunk));
  socket.on('close', () => onClose(client));
  socket.on('error', () => socket.destroy());
  send(client, { t: 'hello', id: client.id });
});

function onData(c, chunk) {
  c.buf = Buffer.concat([c.buf, chunk]);
  while (c.buf.length >= 2) {
    const b0 = c.buf[0], b1 = c.buf[1];
    const op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
    if (len > 1 << 20) { c.socket.destroy(); return; }          // 1 MB üstü mesaj kabul edilmez
    const need = off + (masked ? 4 : 0) + len;
    if (c.buf.length < need) return;
    let payload = c.buf.subarray(off + (masked ? 4 : 0), need);
    if (masked) {
      const mask = c.buf.subarray(off, off + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    c.buf = c.buf.subarray(need);
    if (op === 0x8) { c.socket.end(); return; }                 // kapat
    if (op === 0x9) { frame(c, 0xA, payload); continue; }       // ping -> pong
    if (op === 0xA) { c.alive = true; continue; }               // pong
    if (op === 0x1) {
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      c.alive = true;
      try { handle(c, msg); } catch (e) { console.error('Mesaj hatası', e); }
    }
  }
}

function frame(c, op, payload) {
  if (c.socket.destroyed) return;
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  c.socket.write(Buffer.concat([head, payload]));
}
const send = (c, obj) => frame(c, 0x1, Buffer.from(JSON.stringify(obj)));

// Kopmuş bağlantıları temizle
setInterval(() => {
  clients.forEach((c) => {
    if (!c.alive) { c.socket.destroy(); return; }
    c.alive = false;
    frame(c, 0x9, Buffer.alloc(0));
  });
}, 20000);

// ---------------- Lobiler ----------------

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do { code = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(code));
  return code;
}

const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);

function roomInfo(r) {
  return {
    code: r.code, name: r.name, public: r.public, max: r.max, state: r.state, hostId: r.hostId, bots: r.bots,
    players: [...r.players.values()].map((p) => ({ id: p.id, name: p.name, flag: p.flag }))
  };
}

function listRooms() {
  const all = [...rooms.values()].filter((r) => r.public)
    .map((r) => ({ code: r.code, name: r.name, count: r.players.size, max: r.max, state: r.state, hostName: (r.players.get(r.hostId) || {}).name || '', created: r.created }));
  all.sort((a, b) => (a.state === 'lobby' ? 0 : 1) - (b.state === 'lobby' ? 0 : 1) || b.count - a.count || b.created - a.created);
  const featured = all.filter((r) => r.state === 'lobby' && r.count < r.max).slice(0, 3).map((r) => r.code);
  return { rooms: all.slice(0, 60), featured, online: clients.size };
}

function broadcast(r, obj, exceptId) {
  r.players.forEach((p) => { if (p.id !== exceptId) send(p.client, obj); });
}
const roomUpdate = (r) => broadcast(r, { t: 'room', room: roomInfo(r) });

function leaveRoom(c) {
  const r = c.room && rooms.get(c.room);
  c.room = null;
  if (!r) return;
  if (r.state === 'game' && r.match && r.match.roster[c.id]) r.match.roster[c.id].left = true;   // maç sürerken ayrılan = yenilgi sayılır
  r.players.delete(c.id);
  if (!r.players.size) { rooms.delete(r.code); return; }
  if (r.hostId === c.id) {
    r.hostId = r.players.keys().next().value;               // en eski oyuncu host olur
    if (r.state === 'game') { r.state = 'lobby'; broadcast(r, { t: 'hostLeft' }); }
  } else if (r.state === 'game') {
    broadcast(r, { t: 'playerLeft', id: c.id });
  }
  roomUpdate(r);
}

function handle(c, m) {
  switch (m.t) {
    case 'profile':
      if (!c.account) c.name = clean(m.name, 16) || 'Misafir';
      c.flag = clean(m.flag, 4) || 'TR';
      break;
    case 'register': {
      if (tooMany(c)) { send(c, { t: 'authError', code: 'tooMany' }); return; }
      const name = String(m.name || '').trim(), pass = String(m.pass || '');
      if (!NAME_RE.test(name)) { send(c, { t: 'authError', code: 'badName' }); return; }
      if (pass.length < 4 || pass.length > 64) { send(c, { t: 'authError', code: 'badPass' }); return; }
      const key = name.toLocaleLowerCase('tr');
      if (accounts.users[key]) { send(c, { t: 'authError', code: 'nameTaken' }); return; }
      const salt = crypto.randomBytes(16).toString('hex');
      accounts.users[key] = { name, salt, hash: hashPass(pass, salt), stats: emptyStats(), created: Date.now() };
      saveAccounts();
      c.account = key; c.name = name;
      send(c, { t: 'account', account: publicAcc(accounts.users[key]), token: newToken(key) });
      break;
    }
    case 'login': {
      if (tooMany(c)) { send(c, { t: 'authError', code: 'tooMany' }); return; }
      const key = String(m.name || '').trim().toLocaleLowerCase('tr');
      const u = accounts.users[key];
      if (!u || !crypto.timingSafeEqual(Buffer.from(hashPass(m.pass || '', u.salt), 'hex'), Buffer.from(u.hash, 'hex'))) { send(c, { t: 'authError', code: 'wrong' }); return; }
      c.account = key; c.name = u.name;
      send(c, { t: 'account', account: publicAcc(u), token: newToken(key) });
      break;
    }
    case 'auth': {
      const tk = accounts.tokens[String(m.token || '')];
      const u = tk && accounts.users[tk.key];
      if (!u) { send(c, { t: 'authError', code: 'expired', silent: true }); return; }
      c.account = tk.key; c.name = u.name;
      send(c, { t: 'account', account: publicAcc(u) });
      break;
    }
    case 'logout': {
      if (m.token) { delete accounts.tokens[String(m.token)]; saveAccounts(); }
      c.account = null; c.name = 'Misafir';
      send(c, { t: 'account', account: null });
      break;
    }
    case 'list':
      send(c, { t: 'list', ...listRooms() });
      break;
    case 'create': {
      if (rooms.size >= MAX_ROOMS) { send(c, { t: 'error', code: 'full' }); return; }
      leaveRoom(c);
      const code = makeCode();
      const r = {
        code, name: clean(m.name, 28) || `${c.name} lobisi`, public: m.public !== false,
        max: Math.max(4, Math.min(MAX_PLAYERS, Number(m.max) || 10)), hostId: c.id, state: 'lobby',
        bots: false, players: new Map(), created: Date.now()
      };
      rooms.set(code, r);
      r.players.set(c.id, { id: c.id, name: c.name, flag: c.flag, client: c });
      c.room = code;
      send(c, { t: 'joined', you: c.id, room: roomInfo(r) });
      break;
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r) { send(c, { t: 'error', code: 'notFound' }); return; }
      if (r.players.size >= r.max) { send(c, { t: 'error', code: 'roomFull' }); return; }
      if (r.state !== 'lobby') { send(c, { t: 'error', code: 'inGame' }); return; }
      leaveRoom(c);
      // Aynı bayrak varsa boşta bir bayrağı seçmesi için istemciye bırakılır
      r.players.set(c.id, { id: c.id, name: c.name, flag: c.flag, client: c });
      c.room = r.code;
      send(c, { t: 'joined', you: c.id, room: roomInfo(r) });
      roomUpdate(r);
      break;
    }
    case 'leave':
      leaveRoom(c);
      send(c, { t: 'left' });
      break;
    case 'setFlag': {
      const want = clean(m.flag, 4);
      const r0 = rooms.get(c.room);
      // Odada başkasının bayrağı seçilemez
      if (r0 && [...r0.players.values()].some((p) => p.id !== c.id && p.flag === want)) { send(c, { t: 'error', code: 'flagTaken' }); return; }
      c.flag = want || c.flag;
      const r = rooms.get(c.room);
      if (r && r.players.get(c.id)) { r.players.get(c.id).flag = c.flag; roomUpdate(r); }
      break;
    }
    case 'roomSettings': {                       // sadece host: botlar, isim, açık/özel
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id) return;
      if (typeof m.bots === 'boolean') r.bots = m.bots;
      if (typeof m.public === 'boolean') r.public = m.public;
      if (m.name) r.name = clean(m.name, 28);
      roomUpdate(r);
      break;
    }
    case 'start': {                              // sadece host: oyunu başlat, kurulum herkese gider
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id || r.state !== 'lobby') return;
      r.state = 'game';
      // Maç kaydı: kim hangi rolde (host'un gönderdiği kurulumdan) ve hangi hesap. Sonuç gelince istatistik buna göre yazılır.
      r.match = { startAt: Date.now(), done: false, roster: {} };
      const setupPlayers = (m.setup && Array.isArray(m.setup.players)) ? m.setup.players : [];
      setupPlayers.forEach((sp) => {
        const pl = r.players.get(sp && sp.id);
        if (!pl || !pl.client.account) return;
        const role = ['impostor', 'sheriff', 'crewmate'].includes(sp.role) ? sp.role : 'crewmate';
        r.match.roster[sp.id] = { key: pl.client.account, role, left: false };
      });
      broadcast(r, { t: 'start', setup: m.setup });
      roomUpdate(r);
      break;
    }
    case 'end': {                                // sadece host: maç bitti, lobiye dönüldü
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id) return;
      r.state = 'lobby';
      roomUpdate(r);
      break;
    }
    case 'matchResult': {                        // sadece host: maç bitti, kazanan + oyuncu başına görev/öldürme
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id || r.state !== 'game' || !r.match || r.match.done) return;
      const mt = r.match;
      const winner = m.winner === 'impostor' ? 'impostor' : m.winner === 'crew' ? 'crew' : null;
      if (!winner) return;
      mt.done = true;
      const entries = Object.entries(mt.roster);
      const distinct = new Set(entries.map(([, e]) => e.key));
      if ((Date.now() - mt.startAt) / 1000 < MIN_MATCH_SECS || distinct.size < MIN_HUMANS) return;
      const per = new Map((Array.isArray(m.stats) ? m.stats : []).map((x) => [x && x.id, x || {}]));
      const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
      entries.forEach(([pid, e]) => {
        const u = accounts.users[e.key];
        if (!u) return;
        const st = ensureStats(u), before = publicAcc(u);
        const got = per.get(pid) || {};
        const won = !e.left && (e.role === 'impostor' ? 'impostor' : 'crew') === winner;
        const tasks = e.role === 'impostor' ? 0 : num(got.tasks, MAX_TASKS_PER_MATCH), kills = e.role === 'impostor' ? num(got.kills, 10) : 0;
        st.played++; st.tasks += tasks; st.kills += kills;
        if (e.role === 'impostor') st.asImpostor++; else if (e.role === 'sheriff') st.asSheriff++; else st.asCrew++;
        if (e.left) st.left++;
        if (won) { st.wins++; if (winner === 'impostor') st.winsImpostor++; else st.winsCrew++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); }
        else { st.losses++; st.streak = 0; }
        const after = publicAcc(u);
        const pl = r.players.get(pid);
        if (pl && pl.client.account === e.key) {
          send(pl.client, { t: 'matchReward', account: after, gain: { xp: after.xp - before.xp, won, tasks, kills, levelUp: after.level > before.level, oldLevel: before.level } });
        }
      });
      saveAccounts();
      break;
    }
    case 'relay': {
      const r = rooms.get(c.room);
      if (!r) return;
      const msg = { t: 'relay', from: c.id, d: m.d };
      if (m.to === 'host') { const h = r.players.get(r.hostId); if (h && h.id !== c.id) send(h.client, msg); }
      else if (m.to) { const p = r.players.get(m.to); if (p) send(p.client, msg); }
      else broadcast(r, msg, c.id);
      break;
    }
    case 'ping':
      send(c, { t: 'pong', at: m.at });
      break;
  }
}

function onClose(c) {
  if (!clients.has(c)) return;
  clients.delete(c);
  leaveRoom(c);
}

server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor -> http://localhost:${PORT}  (WebSocket: /ws)`);
});

module.exports = { server };

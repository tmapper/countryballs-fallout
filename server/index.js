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
const MAX_PLAYERS = 25;
const impCount = (n) => (n >= 20 ? 4 : n >= 13 ? 3 : n >= 8 ? 2 : 1);     // istemcideki Roles.impCount ile aynı
const sheriffCount = (n) => (n >= 18 ? 3 : n >= 10 ? 2 : 1);              // istemcideki Roles.sheriffCount ile aynı
const MIN_MATCH_SECS = Number(process.env.MIN_MATCH_SECS) || 40;     // bundan kısa maçlar istatistiğe yazılmaz (hile/test engeli)
const MAX_TASKS_PER_MATCH = 5; // Tasks.js -> TASKS_PER_PLAYER ile aynı olmalı (oyuncu başına görev sayısı)
const MIN_HUMANS = 2;          // en az 2 farklı hesaplı oyuncu: tek başına botlu odada sahte sonuçla jeton/XP kasılamasın
const ADMIN_KEY = process.env.ADMIN_KEY || '';
// Tek kullanımlık jeton kodları: REDEEM_CODES="kod1:1000,kod2:500" (küçük harf). Kaynak kodda durursa herkes görür.
const REDEEM_CODES = Object.fromEntries(String(process.env.REDEEM_CODES || '').split(',').map((x) => x.trim().toLowerCase().split(':'))
  .filter(([k, v]) => k && Number(v) > 0).map(([k, v]) => [k.replace(/\s+/g, ''), Math.min(100000, Math.floor(Number(v)))]));   // /api/backup?key=... ile hesapları indirmek için (boşsa kapalı)

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
// Bulut kaydı (önerilen, ücretsiz): Upstash Redis. Render ücretsiz planda disk silindiği için
// veriler buraya da yazılır. Ortam değişkenleri: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (README).
//
// Anahtar düzeni (ayrı key'ler — hepsi accounts altında değildi):
//   cfs:accounts     → { users, tokens }          (hesaplar + oturum token'ları)
//   cfs:suggestions  → [ { name, account, text, at }, ... ]
//   cfs:market       → [ { id, seller, ... }, ... ]
//   cfs:mod          → { modCode, modLog }
//   cfs:admins       → HASH (ayrı, loadAdmins)
// Eski tek-blob (cfs:accounts içinde her şey) otomatik göç edilir.
const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KV_ACCOUNTS = process.env.KV_KEY || 'cfs:accounts';
const KV_SUGGESTIONS = process.env.KV_SUGGESTIONS || 'cfs:suggestions';
const KV_MARKET = process.env.KV_MARKET || 'cfs:market';
const KV_MOD = process.env.KV_MOD || 'cfs:mod';
async function kv(cmd) {
  const res = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function ensureAccountsShape() {
  if (!accounts.users) accounts.users = {};
  if (!accounts.tokens) accounts.tokens = {};
  if (!Array.isArray(accounts.suggestions)) accounts.suggestions = [];
  if (!Array.isArray(accounts.market)) accounts.market = [];
  if (!Array.isArray(accounts.modLog)) accounts.modLog = [];
}
async function loadCloud() {
  if (!KV_URL || !KV_TOKEN) { console.log('Hesaplar: yerel dosya (' + ACC_FILE + ')'); return; }
  for (let i = 0; i < 5; i++) {
    try {
      // 1) Hesaplar (users + tokens). Eski blob da burada olabilir.
      const rawAcc = await kv(['GET', KV_ACCOUNTS]);
      if (rawAcc) {
        const parsed = JSON.parse(rawAcc);
        accounts.users = parsed.users || {};
        accounts.tokens = parsed.tokens || {};
        // Eski tek-blob göçü: suggestions / market / mod hâlâ accounts içindeyse al
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length) accounts.suggestions = parsed.suggestions;
        if (Array.isArray(parsed.market) && parsed.market.length) accounts.market = parsed.market;
        if (parsed.modCode) accounts.modCode = parsed.modCode;
        if (Array.isArray(parsed.modLog) && parsed.modLog.length) accounts.modLog = parsed.modLog;
      }
      // 2) Ayrı key'ler (varsa bunlar öncelikli)
      try {
        const s = await kv(['GET', KV_SUGGESTIONS]);
        if (s) accounts.suggestions = JSON.parse(s);
      } catch (e) { /* yoksa eski blob'dan kalan kullanılır */ }
      try {
        const m = await kv(['GET', KV_MARKET]);
        if (m) accounts.market = JSON.parse(m);
      } catch (e) { /* */ }
      try {
        const mod = await kv(['GET', KV_MOD]);
        if (mod) {
          const o = JSON.parse(mod);
          if (o.modCode) accounts.modCode = o.modCode;
          if (Array.isArray(o.modLog)) accounts.modLog = o.modLog;
        }
      } catch (e) { /* */ }
      ensureAccountsShape();
      console.log('Hesaplar: bulut (Upstash) -', Object.keys(accounts.users || {}).length, 'hesap,',
        (accounts.suggestions || []).length, 'öneri,', (accounts.market || []).length, 'pazar ilanı');
      // Eski blob'dan göç yaptıysak yeni key'lere bir kez yaz
      if (rawAcc) {
        const parsed = JSON.parse(rawAcc);
        if (parsed.suggestions || parsed.market || parsed.modCode || parsed.modLog) {
          await saveCloud(); // ayrı key'lere ayır
        }
      }
      return;
    } catch (e) { console.error('Bulut okunamadı, tekrar deneniyor', e.message); await new Promise((r) => setTimeout(r, 1500)); }
  }
  console.error('UYARI: bulut kaydı okunamadı, yerel dosya kullanılıyor');
}
let cloudBusy = false, cloudAgain = false;
async function saveCloud() {
  if (!KV_URL || !KV_TOKEN) return;
  if (cloudBusy) { cloudAgain = true; return; }
  cloudBusy = true;
  try {
    ensureAccountsShape();
    // Hesaplar: sadece users + tokens (şişkin olmasın)
    await kv(['SET', KV_ACCOUNTS, JSON.stringify({ users: accounts.users, tokens: accounts.tokens })]);
    await kv(['SET', KV_SUGGESTIONS, JSON.stringify(accounts.suggestions || [])]);
    await kv(['SET', KV_MARKET, JSON.stringify(accounts.market || [])]);
    await kv(['SET', KV_MOD, JSON.stringify({ modCode: accounts.modCode || '', modLog: accounts.modLog || [] })]);
  } catch (e) { console.error('Bulut kaydı başarısız', e.message); cloudAgain = true; }
  cloudBusy = false;
  if (cloudAgain) { cloudAgain = false; setTimeout(saveCloud, 1000); }
}
let saveT = null;
function saveAccounts() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    saveT = null;
    try {
      ensureAccountsShape();
      fs.mkdirSync(DATA_DIR, { recursive: true });
      // Yerel dosyada hâlâ tek JSON (geliştirme kolaylığı); bulutta ayrı key
      fs.writeFileSync(ACC_FILE + '.tmp', JSON.stringify(accounts));
      fs.renameSync(ACC_FILE + '.tmp', ACC_FILE);
    } catch (e) { console.error('Hesaplar kaydedilemedi', e.message); }
    saveCloud();
  }, 300);
}
// Sunucu kapanırken (Render yeniden başlatma) bekleyen kaydı bitir
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, async () => {
  if (saveT) {
    clearTimeout(saveT); saveT = null;
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ACC_FILE, JSON.stringify(accounts)); } catch (e) { /* yoksay */ }
  }
  try {
    await Promise.race([
      (async () => {
        ensureAccountsShape();
        await kv(['SET', KV_ACCOUNTS, JSON.stringify({ users: accounts.users, tokens: accounts.tokens })]);
        await kv(['SET', KV_SUGGESTIONS, JSON.stringify(accounts.suggestions || [])]);
        await kv(['SET', KV_MARKET, JSON.stringify(accounts.market || [])]);
        await kv(['SET', KV_MOD, JSON.stringify({ modCode: accounts.modCode || '', modLog: accounts.modLog || [] })]);
      })(),
      new Promise((r) => setTimeout(r, 4000))
    ]);
  } catch (e) { /* yoksay */ }
  process.exit(0);
}));
// ---------------- JETON (oyun içi para, gerçek para DEĞİL) ----------------
// Maçlardan kazanılır, şapka almak için harcanır. Bakiye ve alınan şapkalar SUNUCUDA tutulur (hile ile artırılamaz).
// Fiyatlar istemcideki systems/Looks.js HAT_PRICE ile aynı olmalı.
const HAT_PRICE = {"none":0,"cap_red":0,"cap_blue":0,"beanie":0,"fedora":100,"party":100,"chef":100,"beret":100,"bowler":100,"army":100,"hardhat":100,"cowboy":250,"fez":250,"santa":250,"grad":250,"headphones":250,"flowers":250,"ushanka":250,"cat":250,"bunny":250,"tophat":500,"viking":500,"witch":500,"pirate":500,"propeller":500,"sombrero":500,"antenna":500,"gasmask":500,"crown":1000,"halo":1000,"bandana":250,"ninja":500,"helmet":500,"mushroom":500,"afro":500,"turban":500,"plague":750,"astronaut":750};
const START_COINS = 200;                                  // yeni hesaba hoş geldin jetonu
const COIN = { played: 10, win: 25, task: 2, kill: 5 };
function ensureWallet(u) { if (typeof u.coins !== 'number') u.coins = START_COINS; if (!Array.isArray(u.hats)) u.hats = []; return u; }
const ownsHat = (u, h) => HAT_PRICE[h] === 0 || (u && Array.isArray(u.hats) && u.hats.includes(h));

// ---------------- SIĞINAK BİLETİ (sezon) + TARİHİ BAYRAKLAR ----------------
// 30 günlük sezon; her 20 XP = 1 bar (en fazla 30 bar). Her barın ödülü ya jeton ya kasadır.
// Kasadan tarihi bayrak çıkar (sıradan 25 bayrak dışındakiler). Her şey SUNUCUDA tutulur ve doğrulanır.
// UYARI: ödül tablosu, kasa şansları ve bayrak nadirlikleri istemcideki systems/Pass.js ile aynı olmalı.
const SEASON_DAYS = 30, PASS_LEVELS = 30, PASS_BAR_XP = 20, DAY_MS = 86400000;
const SEASON_EPOCH = Date.UTC(2026, 10, 11);                   // 1. sezonun başlangıcı (UTC); sonrası otomatik yeni sezon
const PASS_XP = { played: 8, win: 6, task: 1, kill: 2, daily: 10 };   // bilet XP'si: maç + kazanma + görev + öldürme + günün ilk maçı
const HFLAGS = { OTT: 'mystic', BRE: 'legendary', ROM: 'legendary', MAM: 'legendary', AND: 'legendary', GOK: 'legendary', HRE: 'epic', BYZ: 'epic', SOV: 'epic', JPE: 'epic', FRK: 'epic', RUE: 'epic', VEN: 'epic', PRU: 'epic', AQY: 'epic', QRN: 'epic', BGK: 'rare', ESE: 'rare', GEN: 'rare', HAZ: 'rare', MON: 'epic', PER: 'epic', ABB: 'legendary', SEL: 'legendary' };
const DUPE_COINS = { rare: 120, epic: 400, legendary: 1000, mystic: 2500 };   // rare 150'ken Sığınak Kasası (250) çift çıkınca ortalama 255 jeton geri veriyordu: sonsuz jeton      // aynı bayrak tekrar çıkarsa jetona çevrilir
const CRATE_ODDS = { common: { rare: 70, epic: 25, legendary: 5 }, rare: { rare: 45, epic: 42, legendary: 13 }, grand: { epic: 70, legendary: 30 } };
const CRATE_TIERS = Object.keys(CRATE_ODDS);
const CRATE_PRICE = { common: 250, rare: 500, grand: 1000 };  // jetonla kasa satın alma
function seasonInfo(t = Date.now()) {
  const n = Math.max(0, Math.floor((t - SEASON_EPOCH) / (SEASON_DAYS * DAY_MS)));
  const end = SEASON_EPOCH + (n + 1) * SEASON_DAYS * DAY_MS;
  return { id: n + 1, daysLeft: Math.max(1, Math.ceil((end - t) / DAY_MS)) };
}
function passReward(L) {
  if (L === 30) return { flag: 'OTT' };  // 30. seviye: Osmanlı (mistik, kasadan çıkmaz)
  if (L % 3 === 0) return { crate: (L === 15) ? 'grand' : (L === 9 || L === 18 || L === 24) ? 'rare' : 'common' };
  return { coins: 50 + 10 * Math.floor(L / 3) };
}
function ensureMeta(u) {
  if (!Array.isArray(u.flags)) u.flags = [];
  if (!u.crates || typeof u.crates !== 'object') u.crates = {};
  CRATE_TIERS.forEach((k) => { if (typeof u.crates[k] !== 'number') u.crates[k] = 0; });
  const sid = seasonInfo().id;
  if (!u.pass || u.pass.s !== sid) u.pass = { s: sid, xp: 0, claimed: [], d: 0 };
  if (!Array.isArray(u.achievements)) u.achievements = [];
  if (!Array.isArray(u.roleHist)) u.roleHist = [];   // son roller (anti-streak)
  ensureQuests(u);
  return u;
}

// ---- Günlük / haftalık görevler ----
const DAILY_POOL = [
  { id: 'd_play_2', goal: 2, reward: 40, key: 'play' },
  { id: 'd_play_3', goal: 3, reward: 50, key: 'play' },
  { id: 'd_win_1', goal: 1, reward: 45, key: 'win' },
  { id: 'd_tasks_8', goal: 8, reward: 40, key: 'tasks' },
  { id: 'd_kill_2', goal: 2, reward: 45, key: 'kills' },
  { id: 'd_report_1', goal: 1, reward: 30, key: 'reports' },
  { id: 'd_crate_1', goal: 1, reward: 35, key: 'crates' },
];
const WEEKLY_POOL = [
  { id: 'w_play_10', goal: 10, reward: 120, key: 'play' },
  { id: 'w_win_5', goal: 5, reward: 150, key: 'win' },
  { id: 'w_tasks_30', goal: 30, reward: 100, key: 'tasks' },
  { id: 'w_kills_8', goal: 8, reward: 130, key: 'kills' },
  { id: 'w_crates_3', goal: 3, reward: 100, key: 'crates' },
  { id: 'w_hist_1', goal: 1, reward: 80, key: 'hist' },
];
const ACH_REWARDS = {
  first_win:30, first_kill:25, first_task:20, win_crew:25, win_imp:30, win_sheriff:35,
  triple_kill:50, perfect_tasks:40, survive_end:30, report_first:20, vote_correct:25,
  no_kill_win_imp:45, sheriff_ace:50, ghost_tasks:30, play_10:35, play_50:50, win_5:40, win_25:50,
  collect_3_hist:30, collect_8_hist:50, open_crate:20, buy_hat:20, market_sell:25, market_buy:25,
  pass_10:30, pass_30:50, daily_3:30, streak_3:40, mystic_own:50, all_hats_free:25,
  friend_invite:20, solo_win:25, meeting_skip:20, tunnel_escape:30, last_crew:45, double_sheriff_kill:50
};
function dayIndex(t = Date.now()) { return Math.floor(t / 86400000); }
function weekIndex(t = Date.now()) { return Math.floor(t / (7 * 86400000)); }
function pickPool(pool, seed, n) {
  const out = []; let x = seed >>> 0; const p = pool.slice();
  while (out.length < n && p.length) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; const i = x % p.length; out.push({ ...p.splice(i, 1)[0], progress: 0, claimed: false }); }
  return out;
}
function weekFlagCode(t = Date.now()) {
  const hist = Object.keys(HFLAGS).filter((f) => HFLAGS[f] !== 'mystic');
  if (!hist.length) return 'BRE';
  return hist[weekIndex(t) % hist.length];
}
function ensureQuests(u) {
  const di = dayIndex(), wi = weekIndex();
  if (!u.quests) u.quests = {};
  if (u.quests.day !== di) {
    u.quests.day = di;
    u.quests.daily = pickPool(DAILY_POOL, di * 9973 + 13, 3);
  }
  if (u.quests.week !== wi) {
    u.quests.week = wi;
    u.quests.weekly = pickPool(WEEKLY_POOL, wi * 7919 + 7, 3);
  }
  u.quests.weekFlag = weekFlagCode();
  return u.quests;
}
function bumpQuest(u, key, n = 1) {
  ensureMeta(u);
  const q = u.quests;
  let changed = false;
  for (const list of [q.daily, q.weekly]) {
    for (const row of list) {
      const def = DAILY_POOL.concat(WEEKLY_POOL).find((x) => x.id === row.id);
      if (!def || def.key !== key || row.claimed) continue;
      row.progress = Math.min(def.goal, (row.progress || 0) + n);
      changed = true;
    }
  }
  return changed;
}
function unlockAch(u, id) {
  if (!ACH_REWARDS[id]) return null;
  ensureMeta(u);
  if (u.achievements.includes(id)) return null;
  u.achievements.push(id);
  const reward = ACH_REWARDS[id];
  u.coins = (u.coins || 0) + reward;
  return { id, reward };
}

const addPassXp = (u, n) => { const p = ensureMeta(u).pass; p.xp = Math.min(PASS_LEVELS * PASS_BAR_XP, p.xp + Math.max(0, n)); };
const ownsFlag = (u, f) => !HFLAGS[f] || (u && Array.isArray(u.flags) && u.flags.includes(f));
function grantReward(u, rw) {
  if (rw.coins) u.coins += rw.coins;
  if (rw.crate) u.crates[rw.crate] = (u.crates[rw.crate] || 0) + 1;
  if (rw.flag && HFLAGS[rw.flag] && !u.flags.includes(rw.flag)) u.flags.push(rw.flag);
}
function rollCrate(tier) {
  const odds = CRATE_ODDS[tier];
  let x = crypto.randomInt(100), rarity = Object.keys(odds)[0];
  for (const [rr, w] of Object.entries(odds)) { if (x < w) { rarity = rr; break; } x -= w; }
  // mystic bayraklar (OTT) kasadan ASLA çıkmaz
  const pool = Object.keys(HFLAGS).filter((f) => HFLAGS[f] === rarity && HFLAGS[f] !== 'mystic');
  if (!pool.length) { // yedek: epic/legendary
    const fallback = Object.keys(HFLAGS).filter((f) => HFLAGS[f] === 'epic' || HFLAGS[f] === 'legendary');
    return { rarity: 'epic', flag: fallback[crypto.randomInt(fallback.length)] };
  }
  return { rarity, flag: pool[crypto.randomInt(pool.length)] };
}
// ---------------- ADMİN ----------------
// Admin listesi Upstash'te "cfs:admins" adlı HASH'te tutulur: alan = hesap adı (küçük harf), değer = 1 (admin) / 0.
// Sunucu bunu dakikada bir okur ve hesaplara u.admin = 0/1 olarak yansıtır (yeniden başlatmaya gerek yok).
// Upstash yoksa ADMINS=ad1,ad2 ortam değişkeni kullanılır.
const ADMIN_HASH = process.env.ADMIN_HASH || 'cfs:admins';
const ENV_ADMINS = (process.env.ADMINS || '').split(',').map((x) => x.trim().toLocaleLowerCase('tr')).filter(Boolean);
let adminSet = new Set(ENV_ADMINS);
// Admin: Upstash hash (cfs:admins) VEYA hesap nesnesindeki u.admin === 1
// (sadece hesaba admin yazıldıysa da komutlar çalışsın)
const isAdmin = (c) => {
  if (!c || !c.account) return false;
  if (adminSet.has(c.account)) return true;
  const u = accounts.users[c.account];
  return !!(u && (u.admin === 1 || u.admin === true || u.admin === '1'));
};
async function loadAdmins() {
  const set = new Set(ENV_ADMINS);
  if (KV_URL && KV_TOKEN) {
    try {
      const arr = await kv(['HGETALL', ADMIN_HASH]) || [];
      for (let i = 0; i + 1 < arr.length; i += 2) if (String(arr[i + 1]).trim() === '1') set.add(String(arr[i]).trim().toLocaleLowerCase('tr'));
    } catch (e) { console.error('Admin listesi okunamadı:', e.message); return; }   // hata olursa eski liste kalsın
  }
  // Hesaplarda elle admin=1 yazılmış olanları da sete ekle (tek yönlü senkron)
  Object.entries(accounts.users || {}).forEach(([k, u]) => {
    if (u && (u.admin === 1 || u.admin === true || u.admin === '1')) set.add(k);
  });
  adminSet = set;
  let changed = false;
  Object.entries(accounts.users).forEach(([k, u]) => {
    const v = set.has(k) ? 1 : 0;
    if (u.admin !== v) { u.admin = v; changed = true; clients.forEach((c) => { if (c.account === k) send(c, { t: 'account', account: publicAcc(u) }); }); }
  });
  if (changed) saveAccounts();
}
// ---------------- MODERATÖRLÜK ----------------
// Bir hesap 20 kez odaya girip çıkınca (lobi/maç) menünün sol üstünde "ŞİFRE GİR" butonu açılır.
// Oraya 15 karakterlik MODERATÖR KODU girilirse hesap moderatör olur (u.mod = 1).
// Moderatör: oyuncuyu odadan atar (kick), çok oyunculudan men eder (ban / unban), hesabı siler.
// Adminler ve diğer moderatörler moderatörden korunur (moderatörü sadece admin yönetir).
// KOD: MOD_CODE ortam değişkeni (tam 15 karakter) ya da ilk çalıştırmada üretilip hesap kaydına
//      (accounts.modCode) yazılan rastgele kod. Sunucu açılışta konsola yazar; admin sohbette /modcode ile görür.
const MOD_UNLOCK = 20, MOD_CODE_LEN = 15;
const MOD_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ENV_MOD_CODE = String(process.env.MOD_CODE || '').trim().toUpperCase();
function modCode() {
  if (ENV_MOD_CODE.length === MOD_CODE_LEN) return ENV_MOD_CODE;
  if (typeof accounts.modCode !== 'string' || accounts.modCode.length !== MOD_CODE_LEN) {
    accounts.modCode = Array.from({ length: MOD_CODE_LEN }, () => MOD_ALPHA[crypto.randomInt(MOD_ALPHA.length)]).join('');
    saveAccounts();
  }
  return accounts.modCode;
}
const isModUser = (u) => !!(u && (u.mod === 1 || u.mod === true));
const isMod = (c) => isAdmin(c) || isModUser(c && c.account && accounts.users[c.account]);
const modTries = new Map();          // hesap -> son denemeler (10 dakikada en fazla 5 yanlış)
function modLog(c, action, target) {
  if (!Array.isArray(accounts.modLog)) accounts.modLog = [];
  accounts.modLog.push({ by: c.account, action, target, at: Date.now() });
  if (accounts.modLog.length > 300) accounts.modLog = accounts.modLog.slice(-200);
}
function modRow(key, u, cl) {
  const r = cl && cl.room ? rooms.get(cl.room) : null;
  return { key: key || null, id: cl ? cl.id : null, name: u ? u.name : (cl ? cl.name || 'Misafir' : '?'), guest: !u, online: !!cl,
    room: r ? r.code : null, inGame: !!(r && r.state === 'game'), banned: !!(u && (Number(u.danger) || 0) >= 3),
    mod: isModUser(u), admin: !!(key && (adminSet.has(key) || (u && u.admin === 1))) };
}
function modListFor(c, q) {
  const rows = [], seen = new Set();
  clients.forEach((cl) => {
    if (cl === c) return;
    const key = cl.account, u = key ? accounts.users[key] : null;
    if (key) { if (seen.has(key)) return; seen.add(key); }
    rows.push(modRow(key, u, cl));
  });
  const f = fold(q);
  if (f) {
    Object.entries(accounts.users).forEach(([k, u]) => {
      if (seen.has(k) || k === c.account || rows.length > 80) return;
      if (fold(k).includes(f) || fold(u.name).includes(f)) { seen.add(k); rows.push(modRow(k, u, null)); }
    });
  }
  const list = f ? rows.filter((x) => fold(x.name).includes(f) || fold(x.key || '').includes(f)) : rows;
  list.sort((a, b) => (b.online - a.online) || String(a.name).localeCompare(String(b.name), 'tr'));
  return list.slice(0, 60);
}
// Hesabın ya da tek bir misafir bağlantısının bulunduğu odadan atılması
function modKickClients(targets) {
  targets.forEach((cl) => {
    const r = cl.room && rooms.get(cl.room);
    if (!r) return;
    (r.banned || (r.banned = new Set())).add(cl.account || cl.id);
    send(cl, { t: 'kicked' });
    leaveRoom(cl);
  });
}
function modAction(c, m) {
  const action = String(m.action || '');
  const key = m.key ? String(m.key).toLocaleLowerCase('tr') : null;
  const u = key ? accounts.users[key] : null;
  const targets = key ? [...clients].filter((cl) => cl.account === key) : [...clients].filter((cl) => cl.id === m.id && !cl.account);
  if (key && !u) return { err: 'noUser' };
  if (!key && !targets.length) return { err: 'noUser' };
  if (key && key === c.account) return { err: 'self' };
  if (key && (adminSet.has(key) || u.admin === 1)) return { err: 'protected' };
  if (isModUser(u) && !isAdmin(c)) return { err: 'protected' };
  const name = u ? u.name : (targets[0].name || 'Misafir');
  switch (action) {
    case 'kick':
      if (!targets.some((cl) => cl.room)) return { err: 'notInRoom' };
      modKickClients(targets); break;
    case 'ban':
      if (!u) return { err: 'guest' };
      u.danger = 3; saveAccounts();
      modKickClients(targets);
      targets.forEach((cl) => send(cl, { t: 'account', account: publicAcc(u), banned: true }));
      break;
    case 'unban':
      if (!u) return { err: 'guest' };
      u.danger = 0; saveAccounts(); pushAccount(key); break;
    case 'delete': {
      if (!u) return { err: 'guest' };
      modKickClients(targets);
      delete accounts.users[key];
      Object.keys(accounts.tokens).forEach((t) => { if (accounts.tokens[t].key === key) delete accounts.tokens[t]; });
      Object.values(accounts.users).forEach((v) => {
        if (Array.isArray(v.friends)) v.friends = v.friends.filter((x) => x !== key);
        if (Array.isArray(v.freq)) v.freq = v.freq.filter((x) => x !== key);
      });
      if (Array.isArray(accounts.market)) accounts.market = accounts.market.filter((x) => x.seller !== key);
      boardCache.at = 0;
      targets.forEach((cl) => { cl.account = null; cl.name = 'Misafir'; send(cl, { t: 'account', account: null, deleted: true }); });
      saveAccounts(); break;
    }
    default: return { err: 'bad' };
  }
  modLog(c, action, key || name);
  return { ok: true, name };
}
// ---------------- ARKADAŞLAR + SIRALAMA ----------------
// u.friends: arkadaş hesap anahtarları, u.freq: gelen istekler. Haftalık XP: u.wxp + u.wk (yılın haftası).
const weekId = (t = Date.now()) => Math.floor((t / 86400000 + 3) / 7);   // Pazartesi başlar
function addWeekXp(u, xp) { const w = weekId(); if (u.wk !== w) { u.wk = w; u.wxp = 0; } u.wxp += Math.max(0, xp); }
const weekXp = (u) => (u.wk === weekId() ? u.wxp || 0 : 0);
function ensureSocial(u) { if (!Array.isArray(u.friends)) u.friends = []; if (!Array.isArray(u.freq)) u.freq = []; return u; }
const keyOf = (name) => String(name || '').trim().toLocaleLowerCase('tr');
function onlineClient(key) { for (const c of clients) if (c.account === key) return c; return null; }
function friendView(key) {
  const u = accounts.users[key]; if (!u) return null;
  const c = onlineClient(key);
  const r = c && c.room ? rooms.get(c.room) : null;
  return { name: u.name, level: publicAcc(u).level, online: !!c, room: r && r.state === 'lobby' && r.players.size < r.max ? r.code : null, inGame: !!(r && r.state === 'game') };
}
function sendSocial(c) {
  const u = c.account && accounts.users[c.account]; if (!u) return;
  ensureSocial(u);
  send(c, { t: 'social', friends: u.friends.map(friendView).filter(Boolean), requests: u.freq.map((k) => accounts.users[k] && accounts.users[k].name).filter(Boolean) });
}
let boardCache = { at: 0, all: [], week: [] };
function boards() {
  if (Date.now() - boardCache.at < 30000) return boardCache;            // 30 sn önbellek (sunucu yükü)
  const list = Object.entries(accounts.users).map(([k, u]) => { const a = publicAcc(u); return { k, name: u.name, level: a.level, title: a.title, xp: a.xp, wxp: weekXp(u), wins: a.stats.wins }; });
  boardCache = {
    at: Date.now(),
    all: list.filter((x) => x.xp > 0).sort((a, b) => b.xp - a.xp),
    week: list.filter((x) => x.wxp > 0).sort((a, b) => b.wxp - a.wxp)
  };
  return boardCache;
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
  ensureWallet(u);
  ensureMeta(u);
  const si = seasonInfo();
  const q = ensureQuests(u);
  const wf = q.weekFlag;
  const danger = Math.max(0, Math.min(3, Number(u.danger) || 0));
  return { name: u.name, created: u.created, xp, level, xpInto: xp - base, xpNeed: Math.max(1, next - base), title, stats: { ...st }, coins: u.coins, hats: [...u.hats],
    flags: [...u.flags], crates: { ...u.crates }, admin: u.admin ? 1 : 0, danger,
    mod: isModUser(u) ? 1 : 0, rooms: Math.min(MOD_UNLOCK, u.rooms || 0), modUnlock: (u.rooms || 0) >= MOD_UNLOCK || isModUser(u) || !!u.admin ? 1 : 0,
    pass: { season: si.id, daysLeft: si.daysLeft, xp: u.pass.xp, claimed: [...u.pass.claimed] },
    achievements: [...u.achievements],
    quests: { daily: q.daily.map((x) => ({ ...x })), weekly: q.weekly.map((x) => ({ ...x })), weekFlag: { code: wf, owned: !!(u.flags && u.flags.includes(wf)) } }
  };
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
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
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
  serveStatic(req, res, file);
});

// PERFORMANS: eskiden hiç önbellek başlığı yoktu; tarayıcı her açılışta ~25 MB'ı (videolar, resimler, sesler) baştan
// indiriyordu, animasyonlar bu yüzden geç geliyordu. Artık:
//   - Büyük medya dosyaları (png/webp/mp4/mp3...) 1 gün önbellekte kalır (içerik değişirse dosya adı/?v= değişmeli)
//   - js/css/html/json her seferinde ETag ile sorulur (değişmediyse 304, içerik inmez)
//   - Metin dosyaları gzip ile sıkıştırılır (phaser.min.js ~1.1 MB -> ~340 KB)
//   - Range desteği: iPhone/Safari video ve sesi ancak böyle oynatır, seek ve hızlı başlama da buna bağlı
const zlib = require('zlib');
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);
const LONG_CACHE = new Set(['.png', '.jpg', '.webp', '.mp4', '.mp3', '.ico']);
const gzCache = new Map();   // dosya -> { mtime, buf } (küçük sayıda statik dosya; bellekte tutmak güvenli)

function serveStatic(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'ETag': etag,
      'Last-Modified': st.mtime.toUTCString(),
      'Cache-Control': LONG_CACHE.has(ext) ? 'public, max-age=86400' : 'no-cache',
      'Accept-Ranges': 'bytes'
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }

    // Range (video/ses): 206 Partial Content
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? parseInt(range[1], 10) : Math.max(0, st.size - parseInt(range[2], 10));
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      end = Math.min(end, st.size - 1);
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); res.end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    // Metin dosyaları: gzip
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const hit = gzCache.get(file);
      const send = (buf) => {
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Content-Length': buf.length });
        res.end(req.method === 'HEAD' ? undefined : buf);
      };
      if (hit && hit.mtime === st.mtimeMs) { send(hit.buf); return; }
      fs.readFile(file, (e, raw) => {
        if (e) { res.writeHead(500); res.end(); return; }
        zlib.gzip(raw, { level: 6 }, (e2, buf) => {
          if (e2) { res.writeHead(500); res.end(); return; }
          if (gzCache.size < 200) gzCache.set(file, { mtime: st.mtimeMs, buf });
          send(buf);
        });
      });
      return;
    }

    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

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
      // SUNUCU KORUMASI: çok büyük mesaj ya da saniyede 80'den fazla mesaj yok sayılır (spam / hile)
      if (payload.length > 16384) continue;
      const now = Date.now();
      if (now - (c.rateAt || 0) >= 1000) { c.rateAt = now; c.rateN = 0; }
      if (++c.rateN > 80) continue;
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

// Konum toplu gönderimi: her odada biriken konumları 100 ms'de bir tek mesajla yolla
setInterval(() => {
  rooms.forEach((r) => {
    if (!r.pos || !r.pos.size) return;
    const all = [...r.pos.values()];
    r.pos.clear();
    broadcast(r, { t: 'relay', from: '*', d: { k: 'pp', a: all } });
  });
}, 100);

// ---------------- Kurucu ayarları ----------------
// imps / sheriffs: 0 = otomatik (oyuncu sayısına göre). Sınırlar burada (hile ile uç değer girilemez).
const MAP_IDS = ['ring', 'classic'];
const defaultCfg = () => ({ map: 'ring', speed: 1, discuss: 15, vote: 25, killCd: 15, imps: 0, sheriffs: 0 });   // istemcide RoomConfig.DEFAULT_CFG
const clampNum = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
function sanitizeCfg(old, m) {
  const c = { ...old };
  if (MAP_IDS.includes(m.map)) c.map = m.map;
  if (m.speed !== undefined) c.speed = Math.round(clampNum(m.speed, 0.5, 2, 1) * 4) / 4;          // 0.5x .. 2x
  if (m.discuss !== undefined) c.discuss = Math.round(clampNum(m.discuss, 0, 180, 15) / 5) * 5;   // 0..180 sn
  if (m.vote !== undefined) c.vote = Math.round(clampNum(m.vote, 10, 120, 25) / 5) * 5;
  if (m.killCd !== undefined) c.killCd = Math.round(clampNum(m.killCd, 10, 90, 15) / 5) * 5;
  if (m.imps !== undefined) c.imps = Math.round(clampNum(m.imps, 0, 5, 0));
  if (m.sheriffs !== undefined) c.sheriffs = Math.round(clampNum(m.sheriffs, 0, 5, 0));
  return c;
}

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
    code: r.code, name: r.name, public: r.public, max: r.max, state: r.state, hostId: r.hostId, bots: r.bots, cfg: r.cfg || defaultCfg(),
    players: [...r.players.values()].map((p) => ({ id: p.id, name: p.name, flag: p.flag, hat: p.client.hat || 'none', ready: !!p.ready }))
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
  const buf = Buffer.from(JSON.stringify(obj));   // bir kez çevir, herkese aynısını yolla
  r.players.forEach((p) => { if (p.id !== exceptId) frame(p.client, 0x1, buf); });
}
const roomUpdate = (r) => broadcast(r, { t: 'room', room: roomInfo(r) });

function leaveRoom(c) {
  const r = c.room && rooms.get(c.room);
  c.room = null;
  if (!r) return;
  // Moderatör kilidi için sayaç: hesabın odaya girip çıkma sayısı (20'de "şifre gir" açılır)
  const cu = c.account && accounts.users[c.account];
  if (cu && (cu.rooms || 0) < MOD_UNLOCK) { cu.rooms = (cu.rooms || 0) + 1; saveAccounts(); if (cu.rooms === MOD_UNLOCK) setTimeout(() => pushAccount(c.account), 50); }
  if (r.state === 'game' && r.match && r.match.roster[c.id]) r.match.roster[c.id].left = true;   // maç sürerken ayrılan = yenilgi sayılır
  r.players.delete(c.id);
  if (!r.players.size) { rooms.delete(r.code); return; }
  if (r.state === 'game' && r.dead) r.dead.add(c.id);     // maçtan çıkan oyuncu artık "yaşayan" sayılmaz
  if (r.hostId === c.id) {
    r.hostId = r.players.keys().next().value;               // en eski oyuncu host olur
    if (r.state === 'game') {
      // MAÇ DEVAM EDER: yeni host oyunu yönetmeyi devralır (roller, botlar, toplantı). Eskiden herkes lobiye atılıyordu.
      broadcast(r, { t: 'playerLeft', id: c.id });
      roomUpdate(r);                                        // önce yeni hostId herkese gitsin
      const nh = r.players.get(r.hostId);
      if (nh) send(nh.client, { t: 'hostMigrate', roles: r.roles || {}, left: c.id });
      return;
    }
  } else if (r.state === 'game') {
    broadcast(r, { t: 'playerLeft', id: c.id });
  }
  roomUpdate(r);
}

// İstenen bayrak tarihi bir bayraksa sahibi olunmalı (admin hariç); değilse sıradan bayrağa dönülür
function applyFlag(c) {
  const u = c.account && accounts.users[c.account];
  // Admin: hash'te varsa 1; hesapta zaten 1 ise koru (Upstash'te elle yazılmış olabilir)
  if (u) {
    if (adminSet.has(c.account)) u.admin = 1;
    else if (u.admin === 1 || u.admin === true || u.admin === '1') u.admin = 1;
    else u.admin = 0;
  }
  const want = c.wantFlag || c.flag || 'TR';
  c.flag = (!HFLAGS[want] || isAdmin(c) || ownsFlag(u, want)) ? want : 'TR';
}

// ---------------- ADMİN KOMUTLARI (sohbete / ile yazılır; sadece admin) ----------------
let LOC_NAMES = {};
try { fs.readdirSync(path.join(PUBLIC, 'locales')).filter((f) => f.endsWith('.json')).forEach((f) => { LOC_NAMES[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'locales', f), 'utf8')).countries || {}; }); } catch (e) { /* isimler yoksa sadece kodla çalışır */ }
const fold = (x) => String(x || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// "finland", "turkey", "Finlandiya", "FI" -> 'FI'
function flagFromSpec(spec) {
  const sp = fold(spec); if (!sp) return null;
  const codes = [...new Set([...Object.keys(LOC_NAMES.tr || {}), ...Object.keys(LOC_NAMES.en || {}), ...Object.keys(LOC_NAMES.ru || {})])];
  let hit = codes.find((k) => fold(k) === sp);
  if (!hit) hit = codes.find((k) => fold((LOC_NAMES.tr || {})[k]) === sp || fold((LOC_NAMES.en || {})[k]) === sp);
  if (!hit && sp.length >= 3) hit = codes.find((k) => fold((LOC_NAMES.tr || {})[k]).startsWith(sp) || fold((LOC_NAMES.en || {})[k]).startsWith(sp));
  return hit || null;
}
const ROLE_TR = { impostor: 'KATİL', sheriff: 'ŞERİF', crewmate: 'MASUM' };
function matchPlayer(all, spec) {
  const code = flagFromSpec(spec), f = fold(spec);
  return all.find((p) => (code && String(p.flag).toUpperCase() === code) || fold(p.name) === f) || null;
}
// /imposter vb. ile ayarlanan roller: rastgele dağıtımdan SONRA uygulanır; sayılar korunsun diye rolü eski sahibiyle takas eder
function applyForcedRoles(r, all) {
  const out = [], forced = new Set();
  (r.force || []).forEach((e) => {
    const t = matchPlayer(all, e.spec);
    if (!t) { out.push('⚠ Bulunamadı: ' + e.spec); return; }
    if (t.role !== e.role) {
      const other = all.find((q) => q !== t && !forced.has(q) && q.role === e.role);
      if (other) other.role = t.role;
      t.role = e.role;
    }
    forced.add(t);
    out.push('✔ ' + (t.name || t.flag) + ' → ' + ROLE_TR[e.role]);
  });
  if (!all.some((q) => q.role === 'impostor')) {                      // en az bir katil kalsın
    const pick = all.find((q) => !forced.has(q) && q.role !== 'impostor');
    if (pick) { pick.role = 'impostor'; out.push('ℹ Katil kalmadığı için rastgele biri katil yapıldı'); }
  }
  const by = new Set((r.force || []).map((e) => e.by));
  r.force = [];
  by.forEach((id) => { const pl = r.players.get(id); if (pl) out.forEach((t) => sysMsg(pl.client, t)); });
}
const sysMsg = (c, text) => send(c, { t: 'chat', from: 'sys', name: 'SİSTEM', flag: '', text, ch: 'lobby', sys: true });
function pushAccount(key) { const u = accounts.users[key]; if (u) clients.forEach((c) => { if (c.account === key) send(c, { t: 'account', account: publicAcc(u) }); }); }
// hedef: "ben" | hesap adı | odadaki oyuncunun bayrağı/adı
function findAccount(c, r, spec) {
  const sp = String(spec || '').trim();
  if (!sp) return null;
  if (['me', 'ben'].includes(sp.toLowerCase())) return c.account && accounts.users[c.account] ? c.account : null;
  const key = sp.toLocaleLowerCase('tr');
  if (accounts.users[key]) return key;
  if (r) { const code = flagFromSpec(sp); for (const pl of r.players.values()) if (pl.client.account && ((code && String(pl.flag).toUpperCase() === code) || fold(pl.name) === fold(sp))) return pl.client.account; }
  return null;
}
const HELP = [
  'ROL (lobide, sonraki maç): /imposter <hedef>  /sheriff <hedef>  /crew <hedef>  /roles  /clearroles',
  'HESAP: /coins <hedef> <±n>  /xp <hedef> <n> (bilet XP)  /crate <hedef> <common|rare|grand> [n]  /flag <hedef> <bayrak|all>  /hat <hedef> <şapka|all>',
  'UYARI: /warn <hedef> [0-3]  /unwarn <hedef>   (3 = çok oyunculu ban, sadece tek kişilik)',
  'ODA: /kick <hedef>  /say <metin>  /who  /season  /admins  /reloadadmins',
  'MODERATÖR: /modcode (kodu gösterir)  /mods  /unmod <hedef>',
  'Hedef: ben, hesap adı, bayrak (finland, turkey, FI) ya da oyuncu adı. Admin listesi Upstash cfs:admins hash\'inden gelir.'
];
function adminCommand(c, r, text) {
  const tok = text.slice(1).trim().split(/\s+/);
  const cmd = (tok.shift() || '').toLocaleLowerCase('tr');
  const say = (t) => sysMsg(c, t);
  const num = (v) => Math.max(-100000, Math.min(100000, Math.floor(Number(v) || 0)));
  const roleCmd = { imposter: 'impostor', impostor: 'impostor', katil: 'impostor', sheriff: 'sheriff', sherriff: 'sheriff', serif: 'sheriff', şerif: 'sheriff', crew: 'crewmate', crewmate: 'crewmate', masum: 'crewmate' }[cmd];
  if (roleCmd) {
    if (r.state !== 'lobby') { say('Roller sadece lobide, maç başlamadan ayarlanır.'); return; }
    const spec = tok.join(' ');
    if (!spec) { say('Kullanım: /' + cmd + ' <bayrak veya oyuncu>  (ör. /' + cmd + ' finland)'); return; }
    r.force = (r.force || []).filter((e) => fold(e.spec) !== fold(spec));
    r.force.push({ spec, role: roleCmd, by: c.id });
    say('✔ Sonraki maç: ' + spec + ' → ' + ROLE_TR[roleCmd]);
    return;
  }
  switch (cmd) {
    case 'help': case 'yardim': case 'yardım': case '?': HELP.forEach(say); break;
    case 'roles': say((r.force || []).length ? (r.force || []).map((e) => e.spec + ' → ' + ROLE_TR[e.role]).join(', ') : 'Ayarlı rol yok.'); break;
    case 'clearroles': r.force = []; say('✔ Rol ayarları silindi.'); break;
    case 'coins': case 'jeton': {
      if (!isMod(c)) { say('Bu komut için moderatör veya admin yetkisi gerekli.'); break; }
      const k = findAccount(c, r, tok[0]); const n = num(tok[1]);
      if (!k || !n) { say('Kullanım: /coins <hedef> <±sayı>'); break; }
      const u = accounts.users[k]; ensureWallet(u); u.coins = Math.max(0, u.coins + n); saveAccounts(); pushAccount(k);
      say('✔ ' + u.name + ': ' + (n > 0 ? '+' : '') + n + ' 🪙 (yeni bakiye ' + u.coins + ')'); break;
    }
    case 'warn': case 'uyari': case 'uyarı': {
      const k = findAccount(c, r, tok[0]);
      if (!k) { say('Kullanım: /warn <hedef> [0-3]  (boş = +1)'); break; }
      const u = accounts.users[k];
      let d = Number(u.danger) || 0;
      if (tok[1] !== undefined && tok[1] !== '') d = Math.max(0, Math.min(3, Math.floor(Number(tok[1]) || 0)));
      else d = Math.min(3, d + 1);
      u.danger = d;
      saveAccounts(); pushAccount(k);
      say('✔ ' + u.name + ' danger=' + d + (d >= 3 ? ' (çok oyunculu BAN)' : ''));
      // Online ise anında uyar
      clients.forEach((cl) => {
        if (cl.account === k) {
          if (d >= 3) send(cl, { t: 'account', account: publicAcc(u), banned: true });
          else if (d >= 1) send(cl, { t: 'account', account: publicAcc(u), warn: { danger: d, msg: 'Uyarı Aldınız!' } });
          else send(cl, { t: 'account', account: publicAcc(u) });
        }
      });
      break;
    }
    case 'unwarn': case 'uyarikaldır': case 'uyarikaldır': {
      const k = findAccount(c, r, tok[0]);
      if (!k) { say('Kullanım: /unwarn <hedef>'); break; }
      const u = accounts.users[k];
      u.danger = 0;
      saveAccounts(); pushAccount(k);
      say('✔ ' + u.name + ' uyarıları temizlendi (danger=0)');
      clients.forEach((cl) => { if (cl.account === k) send(cl, { t: 'account', account: publicAcc(u) }); });
      break;
    }
    case 'xp': {
      if (!isMod(c)) { say('Bu komut için moderatör veya admin yetkisi gerekli.'); break; }
      const k = findAccount(c, r, tok[0]); const n = num(tok[1]);
      if (!k || !n) { say('Kullanım: /xp <hedef> <sayı>  (Sığınak Bileti XP)'); break; }
      const u = accounts.users[k]; ensureMeta(u); addPassXp(u, n); saveAccounts(); pushAccount(k);
      say('✔ ' + u.name + ': bilet XP ' + u.pass.xp + '/' + (PASS_LEVELS * PASS_BAR_XP)); break;
    }
    case 'crate': case 'kasa': {
      if (!isMod(c)) { say('Bu komut için moderatör veya admin yetkisi gerekli.'); break; }
      const k = findAccount(c, r, tok[0]); const tier = String(tok[1] || '').toLowerCase(); const n = Math.max(1, Math.min(50, num(tok[2]) || 1));
      if (!k || !CRATE_ODDS[tier]) { say('Kullanım: /crate <hedef> <common|rare|grand> [adet]'); break; }
      const u = accounts.users[k]; ensureMeta(u); u.crates[tier] += n; saveAccounts(); pushAccount(k);
      say('✔ ' + u.name + ': +' + n + ' ' + tier + ' kasa'); break;
    }
    case 'flag': case 'bayrak': {
      if (!isMod(c)) { say('Bu komut için moderatör veya admin yetkisi gerekli.'); break; }
      const k = findAccount(c, r, tok[0]); const what = tok.slice(1).join(' ');
      if (!k || !what) { say('Kullanım: /flag <hedef> <bayrak|all>'); break; }
      const u = accounts.users[k]; ensureMeta(u);
      const list = fold(what) === 'all' ? Object.keys(HFLAGS) : [flagFromSpec(what)].filter((f) => f && HFLAGS[f]);
      if (!list.length) { say('Bu bir tarihi bayrak değil. Tarihi bayraklar: ' + Object.keys(HFLAGS).join(', ')); break; }
      list.forEach((f) => { if (!u.flags.includes(f)) u.flags.push(f); });
      saveAccounts(); pushAccount(k); say('✔ ' + u.name + ': ' + list.join(', ') + ' verildi'); break;
    }
    case 'kick': case 'at': {
      const k = tok.join(' ');
      const code = flagFromSpec(k);
      const pl = [...r.players.values()].find((p) => p.id !== c.id && ((code && String(p.flag).toUpperCase() === code) || fold(p.name) === fold(k)));
      if (!pl) { say('Odada bulunamadı: ' + k); break; }
      (r.banned || (r.banned = new Set())).add(pl.client.account || pl.id);
      send(pl.client, { t: 'kicked' }); leaveRoom(pl.client); say('✔ Atıldı: ' + pl.name); break;
    }
    case 'say': case 'duyuru': {
      const t = tok.join(' '); if (!t) { say('Kullanım: /say <metin>'); break; }
      broadcast(r, { t: 'chat', from: 'sys', name: '📢 YÖNETİM', flag: '', text: t.slice(0, 120), ch: 'lobby', sys: true }); break;
    }
    case 'who': {
      r.players.forEach((p) => {
        const role = r.match && r.match.roster && r.match.roster[p.id] ? ' · ' + (ROLE_TR[r.match.roster[p.id].role] || '') : '';
        say(p.id + ' · ' + p.name + ' · ' + p.flag + (p.client.account ? ' · @' + p.client.account : ' · misafir') + role);
      }); break;
    }
    case 'season': { const si = seasonInfo(); say('Sezon ' + si.id + ' · ' + si.daysLeft + ' gün kaldı'); break; }
    case 'hat': case 'sapka': case 'şapka': {
      if (!isMod(c)) { say('Bu komut için moderatör veya admin yetkisi gerekli.'); break; }
      const k = findAccount(c, r, tok[0]); const what = String(tok[1] || '').toLowerCase();
      if (!k || !what) { say('Kullanım: /hat <hedef> <şapka_id|all>  (ör. /hat ben top_hat)'); break; }
      const u = accounts.users[k]; ensureMeta(u);
      if (!u.hats) u.hats = [];
      if (what === 'all') {
        // Tüm bilinen şapkaları ver (Looks.js HAT_IDS ile aynı olmalı; sunucuda sabit liste)
        const ALL_HATS = ['tophat','cowboy','crown','beanie','cap_red','cap_blue','fedora','party','chef','viking','army','hardhat','fez','beret','santa','witch','pirate','grad','headphones','flowers','halo','propeller','bowler','sombrero','ushanka','bunny','cat','antenna','gasmask','bandana','ninja','helmet','mushroom','afro','turban','plague','astronaut'];
        ALL_HATS.forEach((h) => { if (!u.hats.includes(h)) u.hats.push(h); });
        saveAccounts(); pushAccount(k); say('✔ ' + u.name + ': tüm şapkalar verildi'); break;
      }
      if (!u.hats.includes(what)) u.hats.push(what);
      saveAccounts(); pushAccount(k); say('✔ ' + u.name + ': şapka ' + what + ' verildi'); break;
    }
    case 'modcode': case 'modkod':
      if (!isAdmin(c)) { say('Bu komut sadece admin için.'); break; }
      say('Moderatör kodu: ' + modCode() + (ENV_MOD_CODE.length === MOD_CODE_LEN ? ' (MOD_CODE ortam değişkeninden)' : '')); break;
    case 'mods': case 'moderatorler': say('Moderatörler: ' + (Object.entries(accounts.users).filter(([, u]) => isModUser(u)).map(([, u]) => u.name).join(', ') || '(yok)')); break;
    case 'unmod': {
      if (!isMod(c)) { say('Bu komut için moderatör veya admin yetkisi gerekli.'); break; }
      const k = findAccount(c, r, tok.join(' '));
      if (!k) { say('Kullanım: /unmod <hedef>'); break; }
      accounts.users[k].mod = 0; saveAccounts(); pushAccount(k); say('✔ ' + accounts.users[k].name + ' artık moderatör değil'); break;
    }
    case 'admins': case 'adminler': {
      say('Adminler: ' + ([...adminSet].join(', ') || '(yok)')); break;
    }
    case 'reloadadmins': case 'adminyenile': {
      loadAdmins().then(() => say('✔ Admin listesi yenilendi (' + adminSet.size + ' kişi)')).catch((e) => say('Hata: ' + e.message));
      break;
    }
    default: say('Bilinmeyen komut: /' + cmd + '  (/help)');
  }
}

function handle(c, m) {
  switch (m.t) {
    case 'profile':
      if (!c.account) c.name = clean(m.name, 16) || 'Misafir';
      c.wantFlag = clean(m.flag, 4) || 'TR';
      applyFlag(c);
      if (m.hat !== undefined) c.hat = ownsHat(c.account && accounts.users[c.account], String(m.hat)) ? String(m.hat) : 'none';
      break;
    case 'social': { sendSocial(c); break; }
    case 'friendAdd': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'socialError', code: 'needLogin' }); return; }
      const k = keyOf(m.name), v = accounts.users[k];
      if (!v) { send(c, { t: 'socialError', code: 'noUser' }); return; }
      if (k === c.account) { send(c, { t: 'socialError', code: 'self' }); return; }
      ensureSocial(u); ensureSocial(v);
      if (u.friends.includes(k)) { send(c, { t: 'socialError', code: 'already' }); return; }
      if (u.freq.includes(k)) {                                  // o da beni eklemişti: direkt arkadaş
        u.freq = u.freq.filter((x) => x !== k); u.friends.push(k); if (!v.friends.includes(c.account)) v.friends.push(c.account);
      } else if (!v.freq.includes(c.account)) {
        if (v.freq.length >= 50) { send(c, { t: 'socialError', code: 'full' }); return; }
        v.freq.push(c.account);
      }
      saveAccounts();
      send(c, { t: 'socialOk', code: u.friends.includes(k) ? 'added' : 'sent' });
      sendSocial(c);
      const vc = onlineClient(k); if (vc) sendSocial(vc);
      break;
    }
    case 'friendAnswer': {                                       // gelen isteği kabul / reddet
      const u = c.account && accounts.users[c.account]; if (!u) return;
      const k = keyOf(m.name), v = accounts.users[k];
      ensureSocial(u);
      u.freq = u.freq.filter((x) => x !== k);
      if (m.accept && v) { ensureSocial(v); if (!u.friends.includes(k)) u.friends.push(k); if (!v.friends.includes(c.account)) v.friends.push(c.account); }
      saveAccounts(); sendSocial(c);
      const vc = onlineClient(k); if (vc) sendSocial(vc);
      break;
    }
    case 'friendRemove': {
      const u = c.account && accounts.users[c.account]; if (!u) return;
      const k = keyOf(m.name), v = accounts.users[k];
      ensureSocial(u); u.friends = u.friends.filter((x) => x !== k);
      if (v) { ensureSocial(v); v.friends = v.friends.filter((x) => x !== c.account); }
      saveAccounts(); sendSocial(c);
      break;
    }
    case 'invite': {                                             // odadayken arkadaşı davet et
      const u = c.account && accounts.users[c.account]; const r = rooms.get(c.room);
      if (!u || !r) return;
      const k = keyOf(m.name); ensureSocial(u);
      if (!u.friends.includes(k)) return;
      const now = Date.now(); if (now - (c.lastInvite || 0) < 2000) return; c.lastInvite = now;
      const vc = onlineClient(k);
      if (!vc) { send(c, { t: 'socialError', code: 'offline' }); return; }
      send(vc, { t: 'invite', from: u.name, code: r.code, room: r.name });
      send(c, { t: 'socialOk', code: 'invited' });
      break;
    }
    case 'board': {
      const b = boards(), week = m.period === 'week', arr = week ? b.week : b.all;
      const row = (x, i) => ({ rank: i + 1, name: x.name, level: x.level, title: x.title, value: week ? x.wxp : x.xp, wins: x.wins });
      const meIdx = c.account ? arr.findIndex((x) => x.k === c.account) : -1;
      send(c, { t: 'board', period: week ? 'week' : 'all', top: arr.slice(0, 25).map(row), me: meIdx >= 0 ? row(arr[meIdx], meIdx) : null, total: arr.length });
      break;
    }
    case 'suggests': case 'oneriler': case 'öneriler': {
      const say = (t) => sysMsg(c, t);
      if (!isAdmin(c)) { say('Yetki yok'); break; }
      const list = accounts.suggestions || [];
      say('Öneri sayısı: ' + list.length);
      list.slice(-15).forEach((s) => say((s.name || '?') + ': ' + String(s.text || '').slice(0, 120)));
      break;
    }
    case 'suggest': {
      const u = c.account && accounts.users[c.account];
      const text = String(m.text || '').trim().slice(0, 280);
      if (!text || text.length < 3) return;
      if (!accounts.suggestions) accounts.suggestions = [];
      accounts.suggestions.push({ name: u ? u.name : 'anon', account: c.account || null, text, at: Date.now() });
      if (accounts.suggestions.length > 500) accounts.suggestions = accounts.suggestions.slice(-400);
      saveAccounts();
      send(c, { t: 'suggestOk' });
      break;
    }
    // ---- OYUNCULAR ARASI PAZAR ----
    // listing: { id, seller, sellerName, type:'flag'|'hat', item, price, at }
    case 'marketList': {
      if (!accounts.market) accounts.market = [];
      send(c, { t: 'market', list: accounts.market.slice(-100).map((x) => ({ ...x, mine: x.seller === c.account })) });
      break;
    }
    case 'marketSell': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      ensureMeta(u); ensureWallet(u);
      const type = m.kind === 'hat' ? 'hat' : 'flag';
      const item = String(m.item || '');
      const price = Math.floor(Number(m.price) || 0);
      if (price < 50 || price > 50000) { send(c, { t: 'shopError', code: 'badPrice' }); return; }
      if (!accounts.market) accounts.market = [];
      // Pazar doluysa yeni ilan alınmaz (eskiden en eski ilanlar silinip satıcının eşyası kayboluyordu)
      if (accounts.market.length >= 200) { send(c, { t: 'shopError', code: 'marketFull' }); return; }
      if (accounts.market.filter((x) => x.seller === c.account).length >= 10) { send(c, { t: 'shopError', code: 'tooManyListings' }); return; }
      if (type === 'flag') {
        if (!HFLAGS[item] || !u.flags.includes(item)) { send(c, { t: 'shopError', code: 'noItem' }); return; }
        // mystic satılamaz
        if (HFLAGS[item] === 'mystic') { send(c, { t: 'shopError', code: 'mysticLock' }); return; }
        u.flags = u.flags.filter((f) => f !== item);
        // Satılan bayrak takılıysa çıkar (artık sahibi değil)
        clients.forEach((cl) => { if (cl.account === c.account && (cl.flag === item || cl.wantFlag === item)) { cl.wantFlag = ''; cl.flag = ''; applyFlag(cl); const rr = rooms.get(cl.room); if (rr && rr.players.get(cl.id)) { rr.players.get(cl.id).flag = cl.flag; roomUpdate(rr); } } });
      } else {
        if (!u.hats.includes(item) || (HAT_PRICE[item] === 0)) { send(c, { t: 'shopError', code: 'noItem' }); return; }
        u.hats = u.hats.filter((h) => h !== item);
        clients.forEach((cl) => { if (cl.account === c.account && cl.hat === item) { cl.hat = 'none'; const rr = rooms.get(cl.room); if (rr) roomUpdate(rr); } });
      }
      if (!accounts.market) accounts.market = [];
      const id = crypto.randomBytes(6).toString('hex');
      accounts.market.push({ id, seller: c.account, sellerName: u.name, type, item, price, at: Date.now() });
      saveAccounts();
      const am = unlockAch(u, 'market_sell');
      send(c, { t: 'account', account: publicAcc(u), marketOk: 'listed' });
      if (am) send(c, { t: 'achUnlock', ...am });
      break;
    }
    case 'marketBuy': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      ensureMeta(u); ensureWallet(u);
      if (!accounts.market) accounts.market = [];
      const id = String(m.id || '');
      const idx = accounts.market.findIndex((x) => x.id === id);
      if (idx < 0) { send(c, { t: 'shopError', code: 'gone' }); return; }
      const listing = accounts.market[idx];
      if (listing.seller === c.account) { send(c, { t: 'shopError', code: 'own' }); return; }
      if (u.coins < listing.price) { send(c, { t: 'shopError', code: 'noCoins' }); return; }
      const seller = accounts.users[listing.seller];
      if (!seller) { accounts.market.splice(idx, 1); saveAccounts(); send(c, { t: 'shopError', code: 'gone' }); return; }
      u.coins -= listing.price;
      seller.coins = (seller.coins || 0) + listing.price;
      if (listing.type === 'flag') {
        if (!u.flags.includes(listing.item)) u.flags.push(listing.item);
      } else {
        if (!u.hats.includes(listing.item)) u.hats.push(listing.item);
      }
      accounts.market.splice(idx, 1);
      saveAccounts();
      const ab = unlockAch(u, 'market_buy');
      send(c, { t: 'account', account: publicAcc(u), marketOk: 'bought' });
      if (ab) send(c, { t: 'achUnlock', ...ab });
      // satıcıya haber (online ise)
      const sc = onlineClient(listing.seller);
      if (sc) send(sc, { t: 'account', account: publicAcc(seller), marketOk: 'sold' });
      break;
    }
    case 'marketCancel': {
      const u = c.account && accounts.users[c.account];
      if (!u) return;
      if (!accounts.market) accounts.market = [];
      const id = String(m.id || '');
      const idx = accounts.market.findIndex((x) => x.id === id && x.seller === c.account);
      if (idx < 0) return;
      const listing = accounts.market[idx];
      if (listing.type === 'flag' && !u.flags.includes(listing.item)) u.flags.push(listing.item);
      else if (listing.type === 'hat' && !u.hats.includes(listing.item)) u.hats.push(listing.item);
      accounts.market.splice(idx, 1);
      saveAccounts();
      send(c, { t: 'account', account: publicAcc(u), marketOk: 'cancelled' });
      break;
    }
    case 'redeem': {
      try {
        const u = c.account && accounts.users[c.account];
        if (!u) { send(c, { t: 'redeem', ok: false, err: 'login' }); break; }
        ensureWallet(u);
        if (!u.redeems || typeof u.redeems !== 'object') u.redeems = {};
        const code = String(m.code || '').trim().toLowerCase().replace(/\s+/g, '');
        // Tek kullanımlık jeton kodları (tatil / test)
        const CODES = REDEEM_CODES;   // kodlar artık kaynak kodda değil: REDEEM_CODES ortam değişkeni
        if (CODES[code]) {
          if (u.redeems[code]) { send(c, { t: 'redeem', ok: false, err: 'used' }); break; }
          u.redeems[code] = Date.now();
          const amount = CODES[code];
          u.coins = (typeof u.coins === 'number' ? u.coins : 0) + amount;
          try { ensureMeta(u); } catch (e) { console.error('redeem meta', e); }
          saveAccounts();
          let acc = null;
          try { acc = publicAcc(u); } catch (e) { console.error('redeem publicAcc', e); acc = { name: u.name, coins: u.coins }; }
          send(c, { t: 'redeem', ok: true, coins: amount, account: acc });
          if (acc) send(c, { t: 'account', account: acc });
          break;
        }
        send(c, { t: 'redeem', ok: false, err: 'invalid' });
      } catch (e) {
        console.error('redeem error', e);
        send(c, { t: 'redeem', ok: false, err: 'error' });
      }
      break;
    }
    case 'rename': {
      const u = c.account && accounts.users[c.account];
      if (!u) return;
      const name = String(m.name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      const letters = (name.match(/[\p{L}\p{N}]/gu) || []).length;                    // en az 3 harf/rakam ("---" olmaz)
      const low = (s) => String(s).toLocaleLowerCase('tr').normalize('NFC');           // Türkçe İ/ı doğru küçülsün
      const RESERVED = ['admin', 'administrator', 'moderator', 'moderatör', 'mod', 'sistem', 'system', 'server', 'sunucu', 'anthropic', 'yetkili'];
      if (name.length < 3 || letters < 3 || !/^[\w\u00C0-\u024F\u0400-\u04FF \-]+$/i.test(name)) {
        send(c, { t: 'rename', ok: 0, err: 'bad' }); return;
      }
      if (RESERVED.some((w) => low(name).replace(/[\s\-_]/g, '').startsWith(w))) { send(c, { t: 'rename', ok: 0, err: 'taken' }); return; }
      // Benzersiz: başka hesabın görünen adı YA DA giriş adı ile aynı olamaz
      const key = Object.keys(accounts.users).find((k) => k !== c.account && (low(k) === low(name) || (accounts.users[k].name && low(accounts.users[k].name) === low(name))));
      if (key) { send(c, { t: 'rename', ok: 0, err: 'taken' }); return; }
      u.name = name;
      saveAccounts();
      // Odadaki görünen ad da hemen değişsin
      clients.forEach((cl) => {
        if (cl.account !== c.account) return;
        const rr = rooms.get(cl.room), pl = rr && rr.players.get(cl.id);
        if (pl) { pl.name = name; roomUpdate(rr); }
      });
      send(c, { t: 'account', account: publicAcc(u) });
      send(c, { t: 'rename', ok: 1 });
      break;
    }
    case 'questsGet': {
      const u = c.account && accounts.users[c.account];
      if (!u) return;
      ensureMeta(u);
      send(c, { t: 'account', account: publicAcc(u) });
      break;
    }
    case 'questClaim': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      ensureMeta(u); ensureWallet(u);
      const id = String(m.id || '');
      const allQ = [...u.quests.daily, ...u.quests.weekly];
      const row = allQ.find((x) => x.id === id);
      const def = DAILY_POOL.concat(WEEKLY_POOL).find((x) => x.id === id);
      if (!row || !def || row.claimed) return;
      if ((row.progress || 0) < def.goal) return;
      row.claimed = true;
      u.coins += def.reward;
      const unlocked = [];
      const dailyDone = u.quests.daily.filter((x) => x.claimed).length;
      if (dailyDone >= 3) { const a = unlockAch(u, 'daily_3'); if (a) unlocked.push(a); }
      saveAccounts();
      send(c, { t: 'account', account: publicAcc(u), questClaimed: id, reward: def.reward });
      unlocked.forEach((a) => send(c, { t: 'achUnlock', ...a }));
      break;
    }
    case 'passClaim': case 'passClaimAll': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      ensureWallet(u); ensureMeta(u);
      const p = u.pass, got = [];
      const levels = m.t === 'passClaimAll' ? Array.from({ length: PASS_LEVELS }, (_, i) => i + 1) : [Math.floor(Number(m.level))];
      levels.forEach((L) => {
        if (!(L >= 1 && L <= PASS_LEVELS) || p.xp < L * PASS_BAR_XP || p.claimed.includes(L)) return;
        p.claimed.push(L);
        const rw = passReward(L); grantReward(u, rw); got.push({ level: L, ...rw });
      });
      if (got.length) saveAccounts();
      send(c, { t: 'account', account: publicAcc(u), claimed: got });
      break;
    }
    case 'buyCrate': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      ensureWallet(u); ensureMeta(u);
      const tier = String(m.tier || '');
      const price = CRATE_PRICE[tier];
      if (!price) { send(c, { t: 'shopError', code: 'badCrate' }); return; }
      const n = Math.max(1, Math.min(10, Math.floor(Number(m.n) || 1)));
      const cost = price * n;
      if (u.coins < cost) { send(c, { t: 'shopError', code: 'noCoins' }); return; }
      u.coins -= cost;
      u.crates[tier] = (u.crates[tier] || 0) + n;
      saveAccounts();
      send(c, { t: 'account', account: publicAcc(u), boughtCrate: { tier, n, cost } });
      break;
    }
    case 'crateOpen': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      ensureWallet(u); ensureMeta(u);
      const tier = String(m.tier || '');
      if (!CRATE_ODDS[tier] || !(u.crates[tier] > 0)) { send(c, { t: 'shopError', code: 'noCrate' }); return; }
      u.crates[tier]--;
      const res = rollCrate(tier);
      let dupe = false, coins = 0;
      if (u.flags.includes(res.flag)) { dupe = true; coins = DUPE_COINS[res.rarity]; u.coins += coins; } else u.flags.push(res.flag);
      saveAccounts();
      bumpQuest(u, 'crates', 1);
      if (!dupe) bumpQuest(u, 'hist', 1);
      const a1 = unlockAch(u, 'open_crate');
      send(c, { t: 'account', account: publicAcc(u), crate: { tier, flag: res.flag, rarity: res.rarity, dupe, coins } });
      if (a1) send(c, { t: 'achUnlock', ...a1 });
      break;
    }
    case 'buyHat': {
      const u = c.account && accounts.users[c.account];
      const h = String(m.hat || '');
      if (!u) { send(c, { t: 'shopError', code: 'needLogin' }); return; }
      if (!(h in HAT_PRICE)) return;
      ensureWallet(u);
      if (ownsHat(u, h)) { send(c, { t: 'account', account: publicAcc(u) }); return; }
      if (u.coins < HAT_PRICE[h]) { send(c, { t: 'shopError', code: 'noCoins' }); return; }
      u.coins -= HAT_PRICE[h];
      u.hats.push(h);
      bumpQuest(u, 'play', 0);
      const ah = unlockAch(u, 'buy_hat');
      saveAccounts();
      send(c, { t: 'account', account: publicAcc(u), bought: h });
      break;
    }
    case 'setHat': {
      c.hat = ownsHat(c.account && accounts.users[c.account], String(m.hat)) ? String(m.hat) : 'none';
      const r = rooms.get(c.room);
      if (r) roomUpdate(r);
      break;
    }
    case 'register': {
      if (tooMany(c)) { send(c, { t: 'authError', code: 'tooMany' }); return; }
      const name = String(m.name || '').trim(), pass = String(m.pass || '');
      if (!NAME_RE.test(name)) { send(c, { t: 'authError', code: 'badName' }); return; }
      if (pass.length < 4 || pass.length > 64) { send(c, { t: 'authError', code: 'badPass' }); return; }
      const key = name.toLocaleLowerCase('tr');
      if (accounts.users[key]) { send(c, { t: 'authError', code: 'nameTaken' }); return; }
      const salt = crypto.randomBytes(16).toString('hex');
      accounts.users[key] = { name, salt, hash: hashPass(pass, salt), stats: emptyStats(), created: Date.now(), coins: START_COINS, hats: [], admin: 0 };
      saveAccounts();
      c.account = key; c.name = name; applyFlag(c);
      send(c, { t: 'account', account: publicAcc(accounts.users[key]), token: newToken(key) });
      break;
    }
    case 'login': {
      if (tooMany(c)) { send(c, { t: 'authError', code: 'tooMany' }); return; }
      const key = String(m.name || '').trim().toLocaleLowerCase('tr');
      const u = accounts.users[key];
      if (!u || !crypto.timingSafeEqual(Buffer.from(hashPass(m.pass || '', u.salt), 'hex'), Buffer.from(u.hash, 'hex'))) { send(c, { t: 'authError', code: 'wrong' }); return; }
      c.account = key; c.name = u.name; applyFlag(c);
      const dang = Math.max(0, Math.min(3, Number(u.danger) || 0));
      const payload = { t: 'account', account: publicAcc(u), token: newToken(key) };
      if (dang >= 1 && dang < 3) payload.warn = { danger: dang, msg: 'Uyarı Aldınız!' };
      if (dang >= 3) payload.banned = true;
      send(c, payload);
      break;
    }
    case 'auth': {
      const tk = accounts.tokens[String(m.token || '')];
      const u = tk && accounts.users[tk.key];
      if (!u) { send(c, { t: 'authError', code: 'expired', silent: true }); return; }
      c.account = tk.key; c.name = u.name; applyFlag(c);
      const dang = Math.max(0, Math.min(3, Number(u.danger) || 0));
      const payload = { t: 'account', account: publicAcc(u) };
      if (dang >= 1 && dang < 3) payload.warn = { danger: dang, msg: 'Uyarı Aldınız!' };
      if (dang >= 3) payload.banned = true;
      send(c, payload);
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
      if (!c.account) { send(c, { t: 'error', code: 'needLogin' }); return; }   // misafir başkasının adıyla giremesin
      {
        const bu = accounts.users[c.account];
        if (bu && (Number(bu.danger) || 0) >= 3) { send(c, { t: 'error', code: 'banned' }); return; }
      }
      if (rooms.size >= MAX_ROOMS) { send(c, { t: 'error', code: 'full' }); return; }
      leaveRoom(c);
      const code = makeCode();
      const r = {
        code, name: clean(m.name, 28) || `${c.name} lobisi`, public: m.public !== false,
        max: Math.max(4, Math.min(MAX_PLAYERS, Number(m.max) || MAX_PLAYERS)), hostId: c.id, state: 'lobby',
        bots: false, players: new Map(), created: Date.now(), cfg: defaultCfg()
      };
      rooms.set(code, r);
      r.players.set(c.id, { id: c.id, name: c.name, flag: c.flag, client: c, ready: false });
      c.room = code;
      send(c, { t: 'joined', you: c.id, room: roomInfo(r) });
      break;
    }
    case 'join': {
      if (!c.account) { send(c, { t: 'error', code: 'needLogin' }); return; }
      {
        const bu = accounts.users[c.account];
        if (bu && (Number(bu.danger) || 0) >= 3) { send(c, { t: 'error', code: 'banned' }); return; }
      }
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r) { send(c, { t: 'error', code: 'notFound' }); return; }
      if (r.players.size >= r.max) { send(c, { t: 'error', code: 'roomFull' }); return; }
      if (r.banned && r.banned.has(c.account || c.id)) { send(c, { t: 'error', code: 'kicked' }); return; }
      if (r.state !== 'lobby') { send(c, { t: 'error', code: 'inGame' }); return; }
      leaveRoom(c);
      // Aynı bayrak varsa boşta bir bayrağı seçmesi için istemciye bırakılır
      r.players.set(c.id, { id: c.id, name: c.name, flag: c.flag, client: c, ready: false });
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
      if (HFLAGS[want] && !isAdmin(c) && !ownsFlag(c.account && accounts.users[c.account], want)) { send(c, { t: 'error', code: 'flagLocked' }); return; }   // tarihi bayrak sadece sahibi
      const r0 = rooms.get(c.room);
      // Odada başkasının bayrağı seçilemez
      if (r0 && [...r0.players.values()].some((p) => p.id !== c.id && p.flag === want)) { send(c, { t: 'error', code: 'flagTaken' }); return; }
      c.wantFlag = want || c.flag;
      applyFlag(c);
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
      if (m.max !== undefined) r.max = Math.max(Math.max(4, r.players.size), Math.min(MAX_PLAYERS, Math.round(Number(m.max) || r.max)));
      if (m.cfg && typeof m.cfg === 'object') r.cfg = sanitizeCfg(r.cfg || defaultCfg(), m.cfg);
      roomUpdate(r);
      break;
    }
    case 'kick': {                               // sadece kurucu: oyuncuyu odadan at
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id || m.id === c.id) return;
      const p = r.players.get(m.id);
      if (!p) return;
      (r.banned || (r.banned = new Set())).add(p.client.account || p.id);   // aynı odaya geri giremez
      send(p.client, { t: 'kicked' });
      leaveRoom(p.client);
      break;
    }
    case 'giveHost': {                           // sadece kurucu (lobideyken): kuruculuğu devret
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id || r.state !== 'lobby' || !r.players.has(m.id)) return;
      r.hostId = m.id;
      roomUpdate(r);
      break;
    }
    case 'ready': {
      const r = rooms.get(c.room);
      if (!r || r.state !== 'lobby') return;
      const pl = r.players.get(c.id);
      if (!pl) return;
      pl.ready = !!m.on;
      roomUpdate(r);
      break;
    }
    case 'start': {                              // sadece host: oyunu başlat
      // HİLE KORUMASI: rolleri SUNUCU dağıtır (host kendini katil seçemez) ve herkese
      // sadece KENDİ rolü gider (tarayıcıdan katilin kim olduğu okunamaz). Host oyunu yönettiği
      // için tam listeyi alır (host yetkili model; tam koruma için kuralların sunucuda çalışması gerekir).
      const r = rooms.get(c.room);
      if (!r || r.hostId !== c.id || r.state !== 'lobby') return;
      // Herkes hazır olmalı (botlar hariç — sadece gerçek oyuncular)
      const notReady = [...r.players.values()].filter((p) => !p.ready);
      if (notReady.length) {
        send(c, { t: 'error', code: 'notReady', names: notReady.map((p) => p.name) });
        sysMsg(c, 'Herkes hazır değil: ' + notReady.map((p) => p.name).join(', '));
        return;
      }
      const sent = (m.setup && Array.isArray(m.setup.players)) ? m.setup.players : [];
      const humans = [...r.players.values()].map((p) => ({ id: p.id, name: p.name, flag: p.flag, hat: p.client.hat || 'none' }));
      const seen = new Set(humans.map((p) => p.id));
      const bots = [];
      sent.forEach((p) => {
        if (!p || !p.bot || !/^bot\d{1,2}$/.test(String(p.id)) || seen.has(p.id)) return;
        if (humans.length + bots.length >= r.max) return;
        seen.add(p.id);
        bots.push({ id: p.id, name: String(p.name || '').slice(0, 24), flag: String(p.flag || '').slice(0, 8), bot: true });
      });
      const all = [...humans, ...bots];
      if (all.length < 3) return;
      const cfg = r.cfg || defaultCfg();
      // Kurucu katil/şerif sayısı seçtiyse onu kullan (en az 1 katil, katiller oyuncuların yarısından az)
      const maxImp = Math.max(1, Math.ceil(all.length / 2) - 1);
      const nImp = cfg.imps ? Math.min(cfg.imps, maxImp) : impCount(all.length);
      const nSh = Math.max(0, Math.min(cfg.sheriffs ? cfg.sheriffs : sheriffCount(all.length), all.length - nImp - 1));
      // Anti-streak: son maçlarda sık katil olanlara daha düşük ağırlık
      const need = { impostor: nImp, sheriff: nSh, crewmate: all.length - nImp - nSh };
      const pool = all.map((p) => {
        const pl = r.players.get(p.id);
        const u = pl && pl.client.account ? accounts.users[pl.client.account] : null;
        const hist = (u && u.roleHist) || [];
        const recentImp = hist.slice(-5).filter((x) => x === 'impostor').length;
        const recentSh = hist.slice(-5).filter((x) => x === 'sheriff').length;
        return { p, wImp: Math.max(1, 8 - recentImp * 3), wSh: Math.max(1, 6 - recentSh * 2), wCrew: 4 + recentImp };
      });
      const pickWeighted = (arr, weightFn) => {
        const total = arr.reduce((s, x) => s + weightFn(x), 0);
        let r = crypto.randomInt(Math.max(1, total));
        for (const x of arr) { r -= weightFn(x); if (r < 0) return x; }
        return arr[arr.length - 1];
      };
      const remain = pool.slice();
      const assign = (role, n, wfn) => {
        for (let k = 0; k < n && remain.length; k++) {
          const x = pickWeighted(remain, wfn);
          x.p.role = role;
          remain.splice(remain.indexOf(x), 1);
        }
      };
      assign('impostor', need.impostor, (x) => x.wImp);
      assign('sheriff', need.sheriff, (x) => x.wSh);
      remain.forEach((x) => { x.p.role = 'crewmate'; });
      applyForcedRoles(r, all);
      r.state = 'game';
      r.roles = Object.fromEntries(all.map((p) => [p.id, p.role]));   // kurucu çıkarsa yeni kurucuya verilir
      r.dead = new Set();          // ölüler (host'un olaylarından): ölülerin sohbeti sadece ölülere gider
      r.killCount = {};            // HİLE KORUMASI: sunucunun saydığı öldürmeler (host'un 'kill' olayları)
      r.taskReq = {};              // HİLE KORUMASI: oyuncunun host'a yolladığı görev istekleri (en fazla bu kadar görev sayılır)
      // Maç kaydı: kim hangi rolde ve hangi hesap. Sonuç gelince istatistik buna göre yazılır.
      r.match = { startAt: Date.now(), done: false, roster: {} };
      all.forEach((sp) => {
        const pl = r.players.get(sp.id);
        if (!pl || !pl.client.account) return;
        r.match.roster[sp.id] = { key: pl.client.account, role: sp.role, left: false };
        const u = accounts.users[pl.client.account];
        if (u) {
          ensureMeta(u);
          u.roleHist = (u.roleHist || []).concat(sp.role).slice(-12);
        }
      });
      saveAccounts();
      r.players.forEach((pl) => {
        // Katiller birbirini bilir; şerifler de birbirini bilir
        const me = all.find((p) => p.id === pl.id) || {};
        const meImp = me.role === 'impostor';
        const meSh = me.role === 'sheriff';
        const view = all.map((p) => (
          pl.id === r.hostId || p.id === pl.id ||
          (meImp && p.role === 'impostor') ||
          (meSh && p.role === 'sheriff')
        ) ? p : { ...p, role: null });
        if (r.players.get(pl.id)) r.players.get(pl.id).ready = false;
        send(pl.client, { t: 'start', setup: { players: view, cfg } });
      });
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
      let winner = m.winner === 'impostor' ? 'impostor' : m.winner === 'crew' ? 'crew' : null;
      if (!winner) return;
      // HİLE KORUMASI (kısmi): sunucunun kendi tuttuğu rol + ölüm kaydıyla tutarsız kazanan bildirimi düzeltilir
      if (r.roles && r.dead) {
        const ids = Object.keys(r.roles), alive = ids.filter((id) => !r.dead.has(id));
        const imps = alive.filter((id) => r.roles[id] === 'impostor').length, others = alive.length - imps;
        if (winner === 'impostor' && imps === 0) winner = 'crew';                       // katil kalmamışken katil kazandı denemez
        else if (winner === 'crew' && imps > 0 && imps >= others) winner = 'impostor';  // katiller çoğunluktayken masum kazandı denemez
      }
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
        // Görev / öldürme: bildirilen sayı, sunucunun gördüğü sayıyı geçemez (host kendi görevlerini yerelde yaptığı için ona güvenilir)
        const seenTasks = pid === r.hostId ? MAX_TASKS_PER_MATCH : ((r.taskReq && r.taskReq[pid]) || 0);
        const tasks = e.role === 'impostor' ? 0 : Math.min(num(got.tasks, MAX_TASKS_PER_MATCH), seenTasks);
        const kills = e.role === 'impostor' ? Math.min(num(got.kills, 10), (r.killCount && r.killCount[pid]) || 0) : 0;
        st.played++; st.tasks += tasks; st.kills += kills;
        if (e.role === 'impostor') st.asImpostor++; else if (e.role === 'sheriff') st.asSheriff++; else st.asCrew++;
        if (e.left) st.left++;
        if (won) { st.wins++; if (winner === 'impostor') st.winsImpostor++; else st.winsCrew++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); }
        else { st.losses++; st.streak = 0; }
        ensureWallet(u);
        addWeekXp(u, calcXp(st) - before.xp);
        const coins = COIN.played + (won ? COIN.win : 0) + tasks * COIN.task + kills * COIN.kill;
        u.coins += coins;
        // Sığınak Bileti XP'si (günün ilk maçında bonus)
        const pp = ensureMeta(u).pass, today = Math.floor(Date.now() / DAY_MS), pBefore = pp.xp;
        let pxp = PASS_XP.played + (won ? PASS_XP.win : 0) + tasks * PASS_XP.task + kills * PASS_XP.kill;
        if (pp.d !== today) { pp.d = today; pxp += PASS_XP.daily; }
        addPassXp(u, pxp);
        // Görev ilerleme + başarımlar
        bumpQuest(u, 'play', 1);
        if (won) bumpQuest(u, 'win', 1);
        if (tasks) bumpQuest(u, 'tasks', tasks);
        if (kills) bumpQuest(u, 'kills', kills);
        const unlocked = [];
        const pushA = (id) => { const a = unlockAch(u, id); if (a) unlocked.push(a); };
        if (won && st.wins === 1) pushA('first_win');
        if (kills >= 1 && st.kills - kills === 0) pushA('first_kill');
        if (tasks >= 1 && st.tasks - tasks === 0) pushA('first_task');
        if (won && winner === 'crew' && e.role !== 'impostor') pushA('win_crew');
        if (won && e.role === 'impostor') pushA('win_imp');
        if (won && e.role === 'sheriff') pushA('win_sheriff');
        if (kills >= 3) pushA('triple_kill');
        if (won && e.role === 'impostor' && kills === 0) pushA('no_kill_win_imp');
        if (st.played >= 10) pushA('play_10');
        if (st.played >= 50) pushA('play_50');
        if (st.wins >= 5) pushA('win_5');
        if (st.wins >= 25) pushA('win_25');
        if (st.streak >= 3) pushA('streak_3');
        if (u.flags && u.flags.length >= 3) pushA('collect_3_hist');
        if (u.flags && u.flags.length >= 8) pushA('collect_8_hist');
        if (u.flags && u.flags.includes('OTT')) pushA('mystic_own');
        const after = publicAcc(u);
        const pl = r.players.get(pid);
        if (pl && pl.client.account === e.key) {
          send(pl.client, { t: 'matchReward', account: after, gain: { xp: after.xp - before.xp, coins, passXp: pp.xp - pBefore, won, tasks, kills, levelUp: after.level > before.level, oldLevel: before.level }, unlocked });
          unlocked.forEach((a) => send(pl.client, { t: 'achUnlock', ...a }));
        }
      });
      saveAccounts();
      break;
    }
    case 'relay': {
      const r = rooms.get(c.room);
      if (!r) return;
      // HİLE KORUMASI: oyun olaylarını (ev) ve bot konumlarını (bp) sadece host yollayabilir
      const k = m.d && m.d.k;
      if ((k === 'ev' || k === 'bp') && r.hostId !== c.id) return;
      if (k === 'pp') return;                                  // toplu konum mesajını sadece sunucu yollar (sahte konum engeli)
      // Ölüleri takip et (ölü sohbetini yaşayanlara göndermemek için)
      if (k === 'ev' && r.state === 'game' && Array.isArray(m.d.a)) {
        const a = m.d.a, dead = r.dead || (r.dead = new Set());
        if (m.d.n === 'kill') { dead.add(a[1]); const kc = r.killCount || (r.killCount = {}); kc[a[0]] = (kc[a[0]] || 0) + 1; }
        else if (m.d.n === 'shoot') dead.add(a[2] ? a[1] : a[0]);
        else if (m.d.n === 'endMeeting' && a[0] != null) dead.add(a[0]);
        else if (m.d.n === 'gunTake' && r.roles && r.roles[a[0]] && r.roles[a[0]] !== 'impostor') r.roles[a[0]] = 'sheriff';   // silahı alan yeni şerif (kurucu değişirse doğru rol gitsin)
      }
      if (k === 'req' && m.d.a === 'task' && r.state === 'game') { const tr = r.taskReq || (r.taskReq = {}); tr[c.id] = (tr[c.id] || 0) + 1; }
      // SUNUCU TASARRUFU: oyuncu konumları (p: oyunda, lp: lobide) tek tek herkese gitmez; odada biriktirilip
      // saniyede 10 kez TEK toplu mesajla gönderilir (25 kişide mesaj sayısı ~24 kat azalır).
      if ((k === 'p' || k === 'lp') && !m.to) {
        const d = m.d;
        // m: 0 duruyor, 1 yürüyor, 2 tünelin içinde (sadece Katil tünelde olabilir; başkası 2 yollarsa 0 sayılır)
        const me = r.players.get(c.id);
        const mv = d.m === 2 ? (me && me.role === 'impostor' && r.state === 'game' ? 2 : 0) : (d.m ? 1 : 0);
        const ts = Number.isInteger(d.ts) && d.ts >= 0 && d.ts < 1e7 ? d.ts : -1;     // gönderici zamanı (akıcı oynatma için)
        const row = [c.id, d.x | 0, d.y | 0, d.f ? 1 : 0, mv, k === 'lp' ? 1 : 0];
        if (ts >= 0) row.push(ts);
        (r.pos || (r.pos = new Map())).set(c.id, row);
        return;
      }
      // Emoji / hızlı sohbet: sadece numara (0-15), hız sınırı; ölünün emojisi sadece ölülere gider
      if (k === 'emo') {
        const e = m.d.e;
        if (r.state !== 'game' || !Number.isInteger(e) || e < 0 || e > 15) return;
        const now = Date.now();
        if (now - (c.lastEmo || 0) < 1200) return;
        c.lastEmo = now;
        const out = { t: 'relay', from: c.id, d: { k: 'emo', e } };
        if (r.dead && r.dead.has(c.id)) { r.players.forEach((p) => { if (p.id !== c.id && r.dead.has(p.id)) send(p.client, out); }); }
        else broadcast(r, out, c.id);
        return;
      }
      const msg = { t: 'relay', from: c.id, d: m.d };
      if (m.to === 'host') { const h = r.players.get(r.hostId); if (h && h.id !== c.id) send(h.client, msg); }
      else if (m.to) { const p = r.players.get(m.to); if (p) send(p.client, msg); }
      else broadcast(r, msg, c.id);
      break;
    }
    case 'chat': {
      // Sohbet: lobi ve toplantı. Uzunluk + hız sınırı sunucuda.
      const r = rooms.get(c.room);
      if (!r) return;
      const now = Date.now();
      if (now - (c.lastChat || 0) < 600) return;
      c.lastChat = now;
      const text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
      if (!text) return;
      // / ile başlayan mesajlar: admin veya moderatör ise komut, değilse yayma (görünmez kalsın) + uyarı
      if (text[0] === '/') {
        if (isMod(c)) { adminCommand(c, r, text); return; }
        sysMsg(c, 'Bu komut için moderatör veya admin yetkisi gerekli. Moderatör paneli kodu ile açıldıktan sonra /help yazabilirsin.');
        return;
      }
      const pl = r.players.get(c.id);
      const meDead = r.state === 'game' && !!(r.dead && r.dead.has(c.id));
      const ch = m.ch === 'meet' ? 'meet' : m.ch === 'ghost' ? 'ghost' : 'lobby';
      const out = { t: 'chat', from: c.id, name: pl ? pl.name : '?', flag: pl ? pl.flag : '', text, ch, dead: meDead || !!m.dead || ch === 'ghost' };
      if (r.state === 'game' && out.dead) {
        // Ölü / hayalet mesajı: SADECE ölülere (eskiden herkese gidiyor, yaşayan hileci okuyabiliyordu)
        r.players.forEach((p) => { if (r.dead && r.dead.has(p.id)) send(p.client, out); });
      } else broadcast(r, out);
      break;
    }
    // ---- MODERATÖR ----
    case 'modCode': {
      const u = c.account && accounts.users[c.account];
      if (!u) { send(c, { t: 'modErr', code: 'needLogin' }); return; }
      if (isMod(c)) { send(c, { t: 'modOk', account: publicAcc(u) }); return; }
      if ((u.rooms || 0) < MOD_UNLOCK) { send(c, { t: 'modErr', code: 'locked' }); return; }
      const now = Date.now(), list = (modTries.get(c.account) || []).filter((x) => now - x < 600000);
      if (list.length >= 5 || tooMany(c)) { send(c, { t: 'modErr', code: 'tooMany' }); return; }
      const got = String(m.code || '').trim().toUpperCase(), want = modCode();
      const gb = Buffer.from(got), wb = Buffer.from(want);
      const ok = got.length === MOD_CODE_LEN && gb.length === wb.length && crypto.timingSafeEqual(gb, wb);   // Türkçe harf: bayt sayısı farklı, eskiden hata verip cevapsız kalıyordu
      if (!ok) { list.push(now); modTries.set(c.account, list); send(c, { t: 'modErr', code: got.length === MOD_CODE_LEN ? 'wrong' : 'len', left: 5 - list.length }); return; }
      modTries.delete(c.account);
      u.mod = 1; modLog(c, 'becameMod', c.account); saveAccounts();
      send(c, { t: 'modOk', account: publicAcc(u) });
      break;
    }
    case 'modList': {
      if (!isMod(c)) { send(c, { t: 'modErr', code: 'noPerm' }); return; }
      send(c, { t: 'modList', list: modListFor(c, String(m.q || '').slice(0, 24)) });
      break;
    }
    case 'modAct': {
      if (!isMod(c)) { send(c, { t: 'modErr', code: 'noPerm' }); return; }
      const now = Date.now(); if (now - (c.lastModAct || 0) < 250) { send(c, { t: 'modErr', code: 'slow' }); return; } c.lastModAct = now;
      const res = modAction(c, m);
      if (res.err) send(c, { t: 'modErr', code: res.err });
      else send(c, { t: 'modDone', action: String(m.action), name: res.name });
      send(c, { t: 'modList', list: modListFor(c, String(m.q || '').slice(0, 24)) });
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

loadCloud().then(loadAdmins).then(() => { setInterval(loadAdmins, 60000); }).then(() => server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor -> http://localhost:${PORT}  (WebSocket: /ws)`);
  console.log('Moderatör kodu (15 karakter): ' + modCode() + (ENV_MOD_CODE.length === MOD_CODE_LEN ? '  [MOD_CODE]' : '  [kayıtta saklı; değiştirmek için MOD_CODE ortam değişkeni]'));
}));

module.exports = { server };

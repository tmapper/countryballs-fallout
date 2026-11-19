// Sığınak Bileti + admin komutları entegrasyon testi (gerçek sunucuyu başlatır). Çalıştır: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3400 + Math.floor(Math.random() * 400);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cfs-test-'));
let srv;

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const inbox = [];
  const waiters = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    inbox.push(m);
    waiters.slice().forEach((w) => { if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); } });
  };
  const api = {
    inbox,
    ready: new Promise((res) => { ws.onopen = res; }),
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 4000) => new Promise((res, rej) => {
      const hit = inbox.find(pred); if (hit) { inbox.splice(inbox.indexOf(hit), 1); return res(hit); }
      const w = { pred, res: (m) => { inbox.splice(inbox.indexOf(m), 1); res(m); } };
      waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); rej(new Error('zaman aşımı: ' + pred)); } }, ms);
    }),
    close: () => ws.close()
  };
  return api;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function signup(name) {
  const c = client(); await c.ready;
  c.send({ t: 'register', name, pass: 'test1234' });
  const m = await c.wait((x) => x.t === 'account' && x.account);
  c.acc = m.account; return c;
}

test.before(async () => {
  srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMINS: 'boss', MIN_MATCH_SECS: '1', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://localhost:${PORT}/health`); if (r.ok) return; } catch (e) { /* bekle */ } await sleep(150); }
  throw new Error('sunucu açılmadı');
});
test.after(() => { if (srv) srv.kill(); });

test('Sığınak Bileti: XP, ödül alma, kasa açma, tarihi bayrak', async () => {
  const boss = await signup('boss'), alice = await signup('alice');
  assert.equal(boss.acc.admin, 1);
  assert.equal(alice.acc.admin, 0);
  boss.send({ t: 'create', name: 'Test', max: 10 }); await boss.wait((m) => m.t === 'joined');

  // XP olmadan ödül alınamaz
  alice.send({ t: 'passClaim', level: 1 });
  assert.deepEqual((await alice.wait((m) => m.t === 'account' && m.claimed)).claimed, []);

  // admin 100 bilet XP verir -> 5 bar
  boss.send({ t: 'chat', text: '/xp alice 100', ch: 'lobby' });
  const up = await alice.wait((m) => m.t === 'account' && m.account.pass.xp === 100);
  assert.equal(up.account.pass.xp, 100);

  alice.send({ t: 'passClaim', level: 1 });                       // 50 jeton
  const c1 = await alice.wait((m) => m.t === 'account' && m.claimed);
  assert.equal(c1.claimed.length, 1);
  assert.equal(c1.account.coins, 250);
  alice.send({ t: 'passClaim', level: 1 });                       // ikinci kez alınamaz
  assert.deepEqual((await alice.wait((m) => m.t === 'account' && m.claimed)).claimed, []);
  alice.send({ t: 'passClaim', level: 6 });                       // 120 XP gerekir, 100 var
  assert.deepEqual((await alice.wait((m) => m.t === 'account' && m.claimed)).claimed, []);
  alice.send({ t: 'passClaimAll' });                              // 2,3(kasa),4,5
  const all = await alice.wait((m) => m.t === 'account' && m.claimed);
  assert.deepEqual(all.claimed.map((x) => x.level), [2, 3, 4, 5]);
  assert.equal(all.account.crates.common, 1);

  // kasa aç
  alice.send({ t: 'crateOpen', tier: 'common' });
  const cr = await alice.wait((m) => m.t === 'account' && m.crate);
  assert.ok(['rare', 'epic', 'legendary'].includes(cr.crate.rarity));
  assert.equal(cr.account.crates.common, 0);
  assert.ok(cr.account.flags.includes(cr.crate.flag));
  alice.send({ t: 'crateOpen', tier: 'common' });                 // kasa kalmadı
  assert.equal((await alice.wait((m) => m.t === 'shopError')).code, 'noCrate');

  boss.close(); alice.close();
});

test('Admin komutları: roller, bayrak verme, yetkisiz kullanıcı, maç sonu bilet XP', async () => {
  const mk = async (name, flag) => {
    const c = client(); await c.ready;
    c.send({ t: 'login', name, pass: 'test1234' });
    const r = await c.wait((m) => m.t === 'account' && m.account).catch(() => null);
    if (!r) { c.close(); const n = await signup(name); n.send({ t: 'setFlag', flag }); return n; }
    return c;
  };
  const boss = await mk('boss', 'DE'), alice = await mk('alice', 'TR'), bob = await signup('bobby');
  boss.send({ t: 'create', name: 'Test', max: 10 });
  const code = (await boss.wait((m) => m.t === 'joined')).room.code;
  boss.id = null;
  for (const c of [alice, bob]) { c.send({ t: 'join', code }); }
  const aj = await alice.wait((m) => m.t === 'joined'); alice.id = aj.you;
  const bj = await bob.wait((m) => m.t === 'joined'); bob.id = bj.you;
  alice.send({ t: 'setFlag', flag: 'TR' }); bob.send({ t: 'setFlag', flag: 'FI' }); boss.send({ t: 'setFlag', flag: 'DE' });
  await sleep(300);

  // kilitli tarihi bayrak seçilemez
  bob.send({ t: 'setFlag', flag: 'OTT' });
  assert.equal((await bob.wait((m) => m.t === 'error')).code, 'flagLocked');
  // yetkisiz kullanıcının komutu işe yaramaz (normal mesaj olur)
  alice.send({ t: 'chat', text: '/imposter turkey', ch: 'lobby' });
  await sleep(700);
  // admin: bayrak ver, sonra seçilebilir
  boss.send({ t: 'chat', text: '/flag bobby ottoman', ch: 'lobby' });
  assert.match((await boss.wait((m) => m.t === 'chat' && m.sys)).text, /OTT/);
  await bob.wait((m) => m.t === 'account' && m.account.flags.includes('OTT'));
  bob.send({ t: 'setFlag', flag: 'OTT' }); await sleep(300);
  bob.send({ t: 'setFlag', flag: 'FI' }); await sleep(300);

  // roller: finland -> katil, turkey -> şerif (bayrak adı İngilizce de olur)
  boss.send({ t: 'chat', text: '/imposter finland', ch: 'lobby' }); await boss.wait((m) => m.t === 'chat' && m.sys);
  await sleep(700);
  boss.send({ t: 'chat', text: '/sheriff turkey', ch: 'lobby' }); await boss.wait((m) => m.t === 'chat' && m.sys);
  for (const c of [boss, alice, bob]) c.send({ t: 'ready', on: true });   // herkes hazır olmalı
  await sleep(150);
  boss.send({ t: 'start', setup: { players: [] } });
  const view = (await boss.wait((m) => m.t === 'start')).setup.players;
  const role = (flag) => view.find((p) => p.flag === flag).role;
  assert.equal(role('FI'), 'impostor');
  assert.equal(role('TR'), 'sheriff');
  assert.equal(role('DE'), 'crewmate');

  // maç sonu: bilet XP (8 maç + 6 kazanma + 10 günün ilk maçı = 24; kaybeden 18)
  await sleep(1300);
  boss.send({ t: 'matchResult', winner: 'crew', stats: [] });
  const ra = await alice.wait((m) => m.t === 'matchReward');
  const rb = await bob.wait((m) => m.t === 'matchReward');
  assert.equal(ra.gain.passXp, 24);
  assert.equal(rb.gain.passXp, 18);
  boss.close(); alice.close(); bob.close();
});

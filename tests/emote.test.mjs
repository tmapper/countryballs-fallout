// Oyun içi emoji (emo) yönlendirme testi: hız sınırı + ölünün emojisi sadece ölülere. Çalıştır: npm test
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

test('Emoji: herkese gider, ölününki sadece ölülere, hız sınırı', async () => {
  const host = await signup('emohost'), alice = await signup('emoalice'), bob = await signup('emobob');
  host.send({ t: 'create', name: 'Emo', max: 10 });
  const code = (await host.wait((m) => m.t === 'joined')).room.code;
  for (const c of [alice, bob]) { c.send({ t: 'join', code }); await c.wait((m) => m.t === 'joined'); }
  for (const c of [host, alice, bob]) c.send({ t: 'ready', on: true });   // herkes hazır olmalı
  await sleep(150);
  host.send({ t: 'start', setup: { players: [] } });
  for (const c of [host, alice, bob]) await c.wait((m) => m.t === 'start');
  const ids = {};
  // canlı emojisi herkese (alice'in id'si relay "from" alanından)
  alice.send({ t: 'relay', d: { k: 'emo', e: 4 } });
  const m1 = await bob.wait((m) => m.t === 'relay' && m.d && m.d.k === 'emo' && m.d.e === 4);
  ids.alice = m1.from;
  // hız sınırı: hemen ikincisi düşer
  alice.send({ t: 'relay', d: { k: 'emo', e: 5 } });
  await sleep(300);
  assert.ok(!bob.inbox.some((m) => m.t === 'relay' && m.d && m.d.k === 'emo' && m.d.e === 5), 'hız sınırı');
  // geçersiz numara düşer
  await sleep(1300);
  alice.send({ t: 'relay', d: { k: 'emo', e: 99 } });
  await sleep(300);
  assert.ok(!bob.inbox.some((m) => m.t === 'relay' && m.d && m.d.k === 'emo' && m.d.e === 99), 'geçersiz');
  // host alice'i öldürür; alice'in emojisi canlı bob'a gitmez
  host.send({ t: 'relay', d: { k: 'ev', n: 'kill', a: ['bot1', ids.alice] } });
  await sleep(1300);
  alice.send({ t: 'relay', d: { k: 'emo', e: 2 } });
  await sleep(400);
  assert.ok(!bob.inbox.some((m) => m.t === 'relay' && m.d && m.d.k === 'emo' && m.d.e === 2), 'ölünün emojisi canlıya gitmemeli');
  for (const c of [host, alice, bob]) c.close();
});

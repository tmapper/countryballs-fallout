// Uzaktaki oyuncu akıcılığı (NetSmooth): titremeli ağda sabit hız, durunca doğru yerde durma, saat sıçraması
import test from 'node:test';
import assert from 'node:assert/strict';
import { NetSmoother } from '../public/js/systems/NetSmooth.js';

function play(latFn, path, ms = 12000) {
  let seed = 3; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const s = new NetSmoother(); const arr = []; let lastKey = '', idle = 0;
  for (let t = 0; t < ms; t += 100) {
    const p = path(t); const key = p.x + ',' + p.m; idle += 100;
    if (key !== lastKey || idle >= 1000) { lastKey = key; idle = 0; const prev = arr.length ? arr[arr.length - 1].at : 0; arr.push({ at: Math.max(prev + 1, t + latFn(R)), ts: t + 777, ...p }); }
  }
  const xs = []; let ai = 0;
  for (let now = 0; now < ms + 1500; now += 1000 / 60) {
    while (ai < arr.length && arr[ai].at <= now) { const a = arr[ai++]; s.push(a.at, a.ts, a.x, 0, a.m); }
    const p = s.sample(now, 1 / 60); xs.push(p ? p.x : null);
  }
  return xs;
}

test('titremeli ağda sabit hız', () => {
  const xs = play((R) => 10 + R() * 250, (t) => ({ x: t * 0.3, m: 1 }));
  const v = []; for (let i = 240; i < 700; i++) v.push((xs[i] - xs[i - 1]) * 60);
  const stalls = v.filter((x) => x < 120).length;
  assert.ok(stalls <= 3, 'durma sayısı: ' + stalls);
});

test('durup kalkınca doğru yerde durur', () => {
  const path = (t) => (t < 3000 ? { x: t * 0.3, m: 1 } : t < 7000 ? { x: 900, m: 0 } : { x: 900 + (t - 7000) * 0.3, m: 1 });
  const xs = play((R) => 20 + R() * 100, path, 9000);
  const atStop = xs[Math.round(5500 / (1000 / 60))];
  assert.ok(Math.abs(atStop - 900) < 1, 'durma yeri ' + atStop);
  assert.ok(xs[xs.length - 1] > 1450, 'tekrar yürüdü ' + xs[xs.length - 1]);
});

test('gönderici saati sıçrayınca donmaz', () => {
  const s = new NetSmoother(); let x = 0, now = 0, ts = 1000;
  for (let i = 0; i < 50; i++) { now += 100; ts += 100; x += 30; s.push(now, ts, x, 0, 1); s.sample(now, 0.1); }
  ts -= 50000;                                           // yeni kurucu: başka saat
  let last = null;
  for (let i = 0; i < 30; i++) { now += 100; ts += 100; x += 30; s.push(now, ts, x, 0, 1); for (let f = 0; f < 6; f++) last = s.sample(now + f * 16, 1 / 60); }
  assert.ok(last.x > x - 300, 'takıldı: ' + last.x + ' / ' + x);
});

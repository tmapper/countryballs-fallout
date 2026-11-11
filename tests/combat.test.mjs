// Çalıştır: npm test   (Node 20+; bağımlılık yok)
import test from 'node:test';
import assert from 'node:assert/strict';
import { canSee, checkWinner, nearestTunnel, pickTunnelDir, findTarget, TUNNEL_RANGE } from '../public/js/systems/Combat.js';

import { useMap, buildGrid, TUNNELS as MAP_TUNNELS } from '../public/js/map/BunkerMap.js';

useMap('ring');
const open = buildGrid();                       // gerçek harita ızgarası
const T0 = MAP_TUNNELS[0];                      // t1: açık bir odada, yürünebilir
const TUN = [
  { id: 'a', x: 0, y: 0, links: ['b'] },
  { id: 'b', x: 1000, y: 0, links: ['a'] },
  { id: 'c', x: 0, y: 900, links: [] },
  { id: 'd', x: 2000, y: 20, links: [] },
];

test('checkWinner: kurallar', () => {
  const mk = (...roles) => roles.map((role) => ({ role, alive: true }));
  assert.equal(checkWinner(mk('impostor', 'crew', 'crew')), null);
  assert.equal(checkWinner(mk('impostor', 'crew')), 'impostor');
  assert.equal(checkWinner(mk('crew', 'crew')), 'crew');
  const dead = mk('impostor', 'crew', 'crew'); dead[0].alive = false;
  assert.equal(checkWinner(dead), 'crew');
});

test('nearestTunnel: menzil', () => {
  assert.equal(nearestTunnel(TUN, 10, 10).id, 'a');
  assert.equal(nearestTunnel(TUN, TUNNEL_RANGE + 50, 0), null);
});

test('pickTunnelDir: yöne göre en yakın tünel', () => {
  assert.equal(pickTunnelDir(TUN, 'a', 1, 0).id, 'b');    // sağ: b (d daha uzakta)
  assert.equal(pickTunnelDir(TUN, 'a', 0, 1).id, 'c');    // aşağı
  assert.equal(pickTunnelDir(TUN, 'a', -1, 0), null);     // solda tünel yok
  assert.equal(pickTunnelDir(TUN, 'a', 0, 0), null);      // yön yok
  assert.equal(pickTunnelDir(TUN, 'zz', 1, 0), null);     // bilinmeyen tünel
});

test('tünelin içindeki oyuncu görülemez ve hedef alınamaz', () => {
  const killer = { x: T0.x, y: T0.y, role: 'impostor', alive: true };
  const victim = { x: T0.x + 30, y: T0.y, role: 'crew', alive: true };
  assert.equal(canSee(open, killer, victim), true);
  victim.inTunnel = 'a';
  assert.equal(canSee(open, killer, victim), false);
  assert.equal(findTarget(open, killer, [killer, victim], 150), null);
});

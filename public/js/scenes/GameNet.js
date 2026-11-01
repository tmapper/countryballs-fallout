// ============================================================
// GameNet.js - Çok oyunculu oyunun senkronu (GameScene'e eklenir)
// ============================================================
// Model: HOST YETKİLİ. Oyunu kuran kişinin bilgisayarı kuralları yönetir:
//   roller, öldürme/vurma kontrolü, toplantı ve oylama, sabotaj süreleri, görev toplamı,
//   botlar ve oyun sonu. Diğer oyuncular (client) isteklerini host'a gönderir ("req"),
//   host olayları herkese yayınlar ("ev"), herkes aynı fonksiyonu uygular.
// Herkes kendi topunun konumunu kendisi gönderir ("p"); host botların konumunu gönderir ("bp").
//
// Mesajlar (net.relay ile, sunucu sadece iletir):
//   { k:'p', x, y, f, m }                    -> konum (f: sola bakıyor, m: yürüyor)
//   { k:'bp', b: [[id, x, y, f, m], ...] }   -> host: bot konumları
//   { k:'req', a: 'kill'|'shoot'|'report'|'emergency'|'vote'|'task'|'fix'|'sab', ... } -> host'a
//   { k:'ev', n: olay, a: [...] }            -> host'tan herkese
import { net } from '../systems/Net.js';
import { KILL_RANGE, SHOOT_RANGE } from '../systems/Combat.js';
import { REPORT_RANGE } from './GameExtras.js';
import { FIX_RANGE } from '../systems/Sabotage.js';

const POS_RATE = 1 / 12;       // saniyede 12 konum
const SLACK = 90;               // ağ gecikmesi payı (menzil kontrolünde)

export function installNet(GameScene) {
  const P = GameScene.prototype;

  P.setupNet = function (mode) {
    this.netMode = mode || 'offline';            // 'offline' | 'host' | 'client'
    this.isHost = this.netMode === 'host';
    this.isClient = this.netMode === 'client';
    this.online = this.netMode !== 'offline';
    this.byId = new Map(this.balls.map((b) => [b.id, b]));
    this.posT = 0;
    if (!this.online) return;
    this.applyRoleTags();
    const onRelay = (m) => this.onRelay(m.from, m.d || {});
    const onLeft = (m) => this.onPlayerLeft(m.id);
    net.on('relay', onRelay);
    net.on('playerLeft', onLeft);
    this.events.once('shutdown', () => { net.off('relay', onRelay); net.off('playerLeft', onLeft); });
  };

  // Host: olayı herkese yayınla (uygulanırken tekrar yayınlama)
  P.emitEv = function (n, a) {
    if (this.isHost && !this.applyingNet) net.relay({ k: 'ev', n, a });
  };

  P.req = function (a, extra = {}) { net.relay({ k: 'req', a, ...extra }, 'host'); };

  P.ball = function (id) { return id == null ? null : this.byId.get(id) || null; };
  P.bodyOf = function (id) { const b = this.ball(id); return b ? this.bodies.find((c) => c.ball === b) || null : null; };

  // ---------- Her kare ----------
  P.netUpdate = function (dt) {
    if (!this.online) return;
    this.balls.forEach((b) => { if (b.net && !b.isMe) b.netStep(dt); });
    this.posT -= dt;
    if (this.posT > 0) return;
    this.posT = POS_RATE;
    const me = this.player;
    net.relay({ k: 'p', x: Math.round(me.x), y: Math.round(me.y), f: me.facing === 'left' ? 1 : 0, m: me.isMoving ? 1 : 0 });
    if (this.isHost) {
      const bots = this.balls.filter((b) => b.brain);
      if (bots.length) net.relay({ k: 'bp', b: bots.map((b) => [b.id, Math.round(b.x), Math.round(b.y), b.facing === 'left' ? 1 : 0, b.isMoving ? 1 : 0]) });
    }
  };

  // ---------- Gelen mesajlar ----------
  P.onRelay = function (from, d) {
    if (d.k === 'p') {
      const b = this.ball(from);
      if (b && !b.isMe) b.net = { x: d.x, y: d.y, f: d.f, m: d.m };
    } else if (d.k === 'bp' && this.isClient) {
      d.b.forEach(([id, x, y, f, m]) => { const b = this.ball(id); if (b) b.net = { x, y, f, m }; });
    } else if (d.k === 'req' && this.isHost) {
      this.onRequest(this.ball(from), d);
    } else if (d.k === 'ev' && this.isClient) {
      this.applyEv(d.n, d.a || []);
    }
  };

  // Host: bir oyuncunun isteğini kontrol et ve uygula
  P.onRequest = function (who, d) {
    if (!who || this.over) return;
    const near = (a, b, r) => a && b && Math.hypot(a.x - b.x, a.y - b.y) <= r + SLACK;
    switch (d.a) {
      case 'kill': {
        const t = this.ball(d.t);
        if (!this.meeting && who.alive && who.role === 'impostor' && who.cooldown <= 0 && t && t.alive && near(who, t, KILL_RANGE)) this.kill(who, t);
        break;
      }
      case 'shoot': {
        const t = this.ball(d.t);
        if (!this.meeting && who.alive && who.role === 'sheriff' && who.cooldown <= 0 && t && t.alive && near(who, t, SHOOT_RANGE)) this.shoot(who, t);
        break;
      }
      case 'report': {
        const body = this.bodyOf(d.b);
        if (who.alive && body && near(who, body, REPORT_RANGE)) this.callMeeting(who, body);
        break;
      }
      case 'emergency':
        if (who.alive && !this.sabotage && (who.emergencyLeft === undefined ? 1 : who.emergencyLeft) > 0) { who.emergencyLeft = 0; this.callMeeting(who, null); }
        break;
      case 'vote':
        this.castVote(who, d.id);
        break;
      case 'task':
        who.tasksDone = (who.tasksDone || 0) + 1;
        this.addTaskDone(1);
        break;
      case 'fix':
        if (this.sabotage && who.alive && who.role !== 'impostor' && near(who, this.sabotage.def.fix, FIX_RANGE)) this.fixSabotage();
        break;
      case 'sab':
        if (who.alive && who.role === 'impostor') this.startSabotage(d.type);
        break;
    }
  };

  // Client: host'un olayını uygula
  P.applyEv = function (n, a) {
    this.applyingNet = true;
    try {
      const B = (i) => this.ball(a[i]);
      switch (n) {
        case 'kill': if (B(0) && B(1)) this.kill(B(0), B(1)); break;
        case 'shoot': if (B(0) && B(1)) this.shoot(B(0), B(1)); break;
        case 'meeting': if (B(0)) this.callMeeting(B(0), a[1] != null ? this.bodyOf(a[1]) : null); break;
        case 'chat': if (B(0)) this.showChat(B(0), a[1], this.ball(a[2]), a[3]); break;
        case 'phase': this.setMeetingPhase(a[0]); break;
        case 'voted': if (B(0)) this.castVote(B(0), '?'); break;
        case 'results': this.showVoteResults(a[0], a[1], this.ball(a[2]), a[3]); break;
        case 'endMeeting': this.endMeeting(this.ball(a[0])); break;
        case 'sab': this.startSabotage(a[0]); break;
        case 'sabFix': this.fixSabotage(); break;
        case 'tasks': this.taskDone = a[0]; this.taskTotal = a[1]; this.publishTasks(); break;
        case 'over': this.finishGame(a[0]); break;
      }
    } finally {
      this.applyingNet = false;
    }
  };

  // Bir oyuncu bağlantıyı kesti: oyundan düşer (ceset bırakmaz)
  P.onPlayerLeft = function (id) {
    const b = this.ball(id);
    if (!b || b.isMe) return;
    b.left = true;
    if (b.alive) this.die(b, { noBody: true });
    b.setVisible(false);
    this.toast(this.nameOf(b) + ' ✕', '#ffb347');
    if (this.isHost) this.checkEnd();
  };

  // Görev toplamı (host): tamamlanan görevi ekle, herkese bildir
  P.addTaskDone = function (n) {
    this.taskDone += n;
    this.publishTasks();
    this.emitEv('tasks', [this.taskDone, this.taskTotal]);
    this.checkEnd();
  };
}

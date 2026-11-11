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
import { STATIONS, UPLOAD_STATION, TASKS_PER_PLAYER } from '../systems/Tasks.js';
import { canStand, TUNNELS, EMERGENCY_BUTTON } from '../map/BunkerMap.js';
import { nearestTunnel } from '../systems/Combat.js';
import { SPEED } from '../entities/CountryBall.js';

const TASK_MIN_GAP = 1500;      // iki görev arası en az (ms): en kısa mini oyun bile bundan uzun
const TASK_RANGE = 230;

const POS_RATE = 1 / 10;       // saniyede en fazla 10 konum (sadece değişince)
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
    const onChat = (m) => this.onChatMsg(m);
    net.on('relay', onRelay);
    net.on('playerLeft', onLeft);
    net.on('chat', onChat);
    this.events.once('shutdown', () => { net.off('relay', onRelay); net.off('playerLeft', onLeft); net.off('chat', onChat); });
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
    this.idleT = (this.idleT || 0) + dt;
    if (this.posT > 0) return;
    this.posT = POS_RATE;
    // SUNUCU TASARRUFU: konum sadece değişince gönderilir; duran oyuncu saniyede bir "buradayım" der
    const me = this.player;
    const cur = [Math.round(me.x), Math.round(me.y), me.facing === 'left' ? 1 : 0, me.inTunnel ? 2 : (me.isMoving ? 1 : 0)];
    const key = cur.join(',');
    if (key !== this.lastPosKey || this.idleT >= 1) {
      this.lastPosKey = key; this.idleT = 0;
      net.relay({ k: 'p', x: cur[0], y: cur[1], f: cur[2], m: cur[3] });
    }
    if (this.isHost) {
      // sadece yeri değişen botlar (+ 2 sn'de bir hepsi)
      this.botFull = (this.botFull || 0) - POS_RATE;
      const full = this.botFull <= 0;
      if (full) this.botFull = 2;
      const rows = [];
      this.balls.forEach((b) => {
        if (!b.brain) return;
        const r = [b.id, Math.round(b.x), Math.round(b.y), b.facing === 'left' ? 1 : 0, b.isMoving ? 1 : 0];
        const k = r.join(',');
        if (full || k !== b.lastSent) { b.lastSent = k; rows.push(r); }
      });
      if (rows.length) net.relay({ k: 'bp', b: rows });
    }
  };

  // ---------- Gelen mesajlar ----------
  P.onRelay = function (from, d) {
    const fromHost = net.room && from === net.room.hostId;
    if (d.k === 'pp') {                               // sunucunun toplu konum mesajı
      (d.a || []).forEach(([id, x, y, f, m, lobby]) => { if (!lobby && id !== net.id) this.onRelay(id, { k: 'p', x, y, f, m }); });
      return;
    }
    if (d.k === 'p') {
      const b = this.ball(from);
      if (b && !b.isMe && !b.brain && this.validPos(b, d)) { b.net = { x: d.x, y: d.y, f: d.f ? 1 : 0, m: d.m === 2 ? 2 : (d.m ? 1 : 0) }; b.inTunnel = (d.m === 2 && b.alive) ? 'net' : null; }
    } else if (!fromHost && (d.k === 'bp' || d.k === 'ev')) {
      // sahte host mesajı: yok say (sunucu da engeller)
    } else if (d.k === 'bp' && this.isClient) {
      d.b.forEach(([id, x, y, f, m]) => { const b = this.ball(id); if (b) b.net = { x, y, f, m }; });
    } else if (d.k === 'req' && this.isHost) {
      this.onRequest(this.ball(from), d);
    } else if (d.k === 'ev' && this.isClient) {
      this.applyEv(d.n, d.a || []);
    }
  };

  // HİLE KORUMASI: hız / ışınlanma / duvardan geçme. Herkes başkalarının konumunu kendisi kontrol eder;
  // geçersiz konum yok sayılır (hileci diğerlerinde olduğu yerde kalır, uzaktan öldüremez/bildiremez).
  P.validPos = function (b, d) {
    const x = Number(d.x), y = Number(d.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const now = performance.now();
    const last = b.netValid || { x: b.x, y: b.y, t: now - 100 };
    const dt = Math.min(2, Math.max(0.1, (now - last.t) / 1000));
    const dist = Math.hypot(x - last.x, y - last.y);
    const mul = (b.speedMul || 1) * (b.alive ? 1 : 1.6);              // hayalet ve kurucu hız ayarı
    let ok = dist <= SPEED * 1.5 * mul * dt + 80;
    // Katil tüneli: iki ucu da tünel olmalı
    if (!ok && b.alive && nearestTunnel(TUNNELS, last.x, last.y) && nearestTunnel(TUNNELS, x, y)) ok = true;
    // Canlılar duvarın içinde duramaz (hayaletler serbest)
    if (ok && b.alive && !canStand(x, y)) ok = false;
    if (ok) b.netValid = { x, y, t: now };
    return ok;
  };

  // Host: bir oyuncunun isteğini kontrol et ve uygula
  P.onRequest = function (who, d) {
    if (!who || this.over) return;
    const near = (a, b, r) => a && b && Math.hypot(a.x - b.x, a.y - b.y) <= r + SLACK;
    switch (d.a) {
      case 'kill': {
        const t = this.ball(d.t);
        if (!this.meeting && who.alive && !who.inTunnel && who.role === 'impostor' && t && !t.inTunnel && t.role !== 'impostor' && who.cooldown <= 0 && t.alive && near(who, t, KILL_RANGE)) this.kill(who, t);
        break;
      }
      case 'shoot': {
        const t = this.ball(d.t);
        if (!this.meeting && who.alive && who.role === 'sheriff' && who.cooldown <= 0 && t && !t.inTunnel && t.alive && near(who, t, SHOOT_RANGE)) this.shoot(who, t);
        break;
      }
      case 'report': {
        const body = this.bodyOf(d.b);
        if (who.alive && !who.inTunnel && body && near(who, body, REPORT_RANGE)) this.callMeeting(who, body);
        break;
      }
      case 'emergency':
        if (who.alive && !this.sabotage && near(who, EMERGENCY_BUTTON, 260) && (who.emergencyLeft === undefined ? 1 : who.emergencyLeft) > 0) { who.emergencyLeft = 0; this.callMeeting(who, null); }
        break;
      case 'vote': {
        // sadece 'skip' ya da yaşayan bir oyuncunun numarası
        const m = this.meeting;
        const target = m && d.id !== 'skip' ? [...m.ids.entries()].find(([, v]) => v === String(d.id)) : null;
        if (d.id === 'skip' || (target && target[0].alive)) this.castVote(who, d.id === 'skip' ? 'skip' : String(d.id));
        break;
      }
      case 'task': {
        // Katil görev yapamaz; en fazla 5 görev; her istasyon bir kez; istasyonun yanında olmalı; çok hızlı olamaz
        const st = STATIONS.find((x) => x.id === d.s);
        if (!st || who.role === 'impostor' || this.meeting) break;
        const done = who.taskIds || (who.taskIds = new Set());
        if (done.has(st.id) || done.size >= TASKS_PER_PLAYER) break;
        const now = performance.now();
        if (now - (who.lastTaskAt || 0) < TASK_MIN_GAP) break;
        const spot = st.type === 'download' ? UPLOAD_STATION : st;
        if (!near(who, spot, TASK_RANGE)) break;
        done.add(st.id); who.lastTaskAt = now;
        who.tasksDone = (who.tasksDone || 0) + 1;
        this.addTaskDone(1);
        break;
      }
      case 'fix':
        if (this.sabotage && who.alive && who.role !== 'impostor' && near(who, this.sabotage.def.fix, FIX_RANGE)) this.fixSabotage();
        break;
      case 'sab':
        if (who.alive && who.role === 'impostor' && !this.sabotage && this.sabCd <= 0) this.startSabotage(d.type);
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
        case 'shoot': if (B(0) && B(1)) this.shoot(B(0), B(1), a[2]); break;
        case 'meeting': if (B(0)) this.callMeeting(B(0), a[1] != null ? this.bodyOf(a[1]) : null); break;
        case 'chat': if (B(0)) this.showChat(B(0), a[1], this.ball(a[2]), a[3]); break;
        case 'phase': this.setMeetingPhase(a[0]); break;
        case 'voted': if (B(0)) this.castVote(B(0), '?'); break;
        case 'results': this.showVoteResults(a[0], a[1], this.ball(a[2]), a[3], a[4]); break;
        case 'endMeeting': this.endMeeting(this.ball(a[0])); break;
        case 'sab': this.startSabotage(a[0]); break;
        case 'sabFix': this.fixSabotage(); break;
        case 'tasks': this.taskDone = a[0]; this.taskTotal = a[1]; this.publishTasks(); break;
        case 'over': this.finishGame(a[0], a[1]); break;
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

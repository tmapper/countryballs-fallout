// ============================================================
// GameExtras.js - GameScene'e eklenen sistemler: ceset/kan, BİLDİR + toplantı + oylama,
// sabotaj, mini harita. (GameScene.js çok büyümesin diye ayrı dosyada; installExtras
// fonksiyonu bu metotları GameScene'e ekler.)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { canSee, KILL_COOLDOWN } from '../systems/Combat.js';
import { EMERGENCY_BUTTON, gameSpawn, getRoomAt } from '../map/BunkerMap.js';
import { SABOTAGES, SABOTAGE_TYPES, SABOTAGE_COOLDOWN, FIX_RANGE, BOT_FIX_TIME } from '../systems/Sabotage.js';
import { MeetingScreen, SabotageMenu } from '../ui/MeetingScreen.js';
import { MiniMap } from '../ui/MiniMap.js';
import { sfx, startLoop, stopLoop, playMusic } from '../systems/Sound.js';
import { gameOver } from '../systems/GameFlow.js';
import { net } from '../systems/Net.js';

export const REPORT_RANGE = 170;        // oyuncu cesede bu kadar yakınsa BİLDİR çıkar
export const BOT_REPORT_RANGE = 420;    // bot cesedi bu mesafeden görürse bildirir
export const EMERGENCY_RANGE = 230;     // acil toplantı düğmesine yakınlık
const DISCUSS_TIME = 12;
const VOTE_TIME = 25;
const RESULT_TIME = 3.5;
const EJECT_TIME = 4.2;

// Ekranlar bir kez oluşturulur (her maçta yeniden DOM eklenmesin)
const meetingUI = new MeetingScreen();
const sabMenu = new SabotageMenu();
export const minimap = new MiniMap();

const nameOf = (b) => b.name || i18n.t('countries.' + b.flag);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------- Kan gölü dokusu (gerçekçi, düzensiz, sıçramalı) ----------------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function blob(c, r, cx, cy, rx, ry, n = 22, jag = 0.28) {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 - jag / 2 + r() * jag;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i === 0) c.moveTo(x, y); else c.quadraticCurveTo(cx + Math.cos(a - Math.PI / n) * rx * (1 + jag / 2), cy + Math.sin(a - Math.PI / n) * ry * (1 + jag / 2), x, y);
  }
  c.closePath();
}

export function paintBloodPool(seed) {
  const W = 300, H = 170, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), r = rng(seed), cx = W / 2, cy = H / 2;
  // ana gölet: koyu kenar, ortası daha parlak kırmızı
  c.fillStyle = 'rgba(40,0,0,.55)'; blob(c, r, cx + 3, cy + 4, 108, 52); c.fill();
  c.fillStyle = '#4a0004'; blob(c, r, cx, cy, 104, 50); c.fill();
  for (let i = 0; i < 4; i++) { c.fillStyle = '#4a0004'; blob(c, r, cx + (r() - 0.5) * 150, cy + (r() - 0.5) * 60, 22 + r() * 30, 12 + r() * 16, 14, 0.4); c.fill(); }
  const g = c.createRadialGradient(cx - 10, cy - 6, 6, cx, cy, 100);
  g.addColorStop(0, '#a3101a'); g.addColorStop(0.55, '#7c0710'); g.addColorStop(1, '#520207');
  c.fillStyle = g; blob(c, r, cx, cy, 92, 42); c.fill();
  // pıhtılaşmış koyu damarlar
  c.strokeStyle = 'rgba(30,0,0,.45)'; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < 5; i++) { c.beginPath(); let x = cx + (r() - 0.5) * 120, y = cy + (r() - 0.5) * 50; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 14; c.lineTo(x, y); } c.stroke(); }
  // ıslak parlama
  c.fillStyle = 'rgba(255,190,190,.30)'; c.beginPath(); c.ellipse(cx - 30, cy - 16, 28, 7, -0.15, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,230,230,.45)'; c.beginPath(); c.ellipse(cx - 36, cy - 18, 10, 3, -0.15, 0, 7); c.fill();
  // sıçrayan damlalar
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 0.8 + r() * 0.55, x = cx + Math.cos(a) * 118 * d, y = cy + Math.sin(a) * 60 * d, s = 1.5 + r() * 5;
    c.fillStyle = r() < 0.5 ? '#6a0309' : '#8a0a12';
    c.beginPath(); c.ellipse(x, y, s * (1 + r()), s, a, 0, 7); c.fill();
    if (r() < 0.4) { c.beginPath(); c.ellipse(x + Math.cos(a) * s * 2.5, y + Math.sin(a) * s * 1.6, s * 0.5, s * 0.4, 0, 0, 7); c.fill(); }
  }
  return cv;
}

export function installExtras(GameScene) {
  const P = GameScene.prototype;
  P.nameOf = nameOf;

  // ---------- kurulum (create sonunda çağrılır) ----------
  P.setupExtras = function () {
    this.meeting = null;
    this.sabotage = null;
    this.sabCd = 20;
    this.emergencyLeft = 1;
    this.reportScan = 0;
    this.alarmEl = null;
    minimap.show();
    const kb = this.input.keyboard;
    kb.on('keydown-R', () => this.reportNearest());
    kb.on('keydown-F', () => this.openSabotage());
    kb.on('keydown', (e) => { if (sabMenu.isOpen && /^[1-3]$/.test(e.key)) sabMenu.pickIndex(Number(e.key) - 1); });
    this.events.once('shutdown', () => {
      meetingUI.close(); sabMenu.close(); minimap.hide(); this.clearAlarm();
    });
  };

  // ---------- ceset ----------
  P.spawnBody = function (ball) {
    const n = 1 + (Math.floor(Math.random() * 6));
    const key = 'blood_' + n;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, paintBloodPool(n * 7919));
    const c = this.add.container(ball.x, ball.y);
    const pool = this.add.image(4, -10, key).setScale(0.15).setAlpha(0.95).setAngle((Math.random() - 0.5) * 30);
    const s = this.add.sprite(0, -30, `idle:${ball.flag}`, 0).setScale(ball.scaleFactor * 0.95).setAngle(90).setTint(0xb0b0b0);
    c.add([pool, s]);
    c.setDepth(ball.y - 1);
    // kan yavaşça yayılır
    this.tweens.add({ targets: pool, scale: 0.62, duration: 2200, ease: 'Cubic.easeOut' });
    c.ball = ball;
    this.bodies.push(c);
  };

  P.nearestBody = function (from, range, needSight = true) {
    let best = null, bd = range;
    this.bodies.forEach((b) => {
      const d = Math.hypot(b.x - from.x, b.y - from.y);
      if (d < bd && (!needSight || canSee(this.grid, from, b))) { best = b; bd = d; }
    });
    return best;
  };

  P.reportNearest = function () {
    const me = this.player;
    if (this.over || this.meeting || !me.alive) return;
    const body = this.nearestBody(me, REPORT_RANGE);
    if (!body) return;
    if (this.isClient) this.req('report', { b: body.ball.id });
    else this.callMeeting(me, body);
  };

  // Botlar gördükleri cesedi kısa bir şaşkınlıktan sonra bildirir
  P.updateBotReports = function (dt) {
    if (this.isClient) return;
    this.reportScan -= dt;
    const scan = this.reportScan <= 0;
    if (scan) this.reportScan = 0.3;
    for (const b of this.balls) {
      if (!b.brain || !b.alive || b.isMe || b.role === 'impostor') continue;
      if (b.reportT !== undefined) { b.reportT -= dt; if (b.reportT <= 0) { const body = b.reportBody; b.reportT = undefined; this.callMeeting(b, body); return; } continue; }
      if (!scan || !this.bodies.length) continue;
      const body = this.nearestBody(b, BOT_REPORT_RANGE);
      if (body) { b.reportT = 0.7 + Math.random() * 1.2; b.reportBody = body; }
    }
  };

  // ---------- TOPLANTI ----------
  P.callMeeting = function (caller, body) {
    if (this.over || this.meeting) return;
    this.emitEv('meeting', [caller.id, body ? body.ball.id : null]);
    const m = this.meeting = { caller, body, votes: new Map(), accuse: new Map(), phase: 'discuss', left: DISCUSS_TIME, timers: [] };
    this.cancelSabotage();
    if (this.taskPanel) this.taskPanel.close(true);
    sabMenu.close();
    minimap.hide();
    this.balls.forEach((b) => { b.reportT = undefined; });
    sfx(body ? 'body_found' : 'meeting');
    playMusic('music_meeting');
    const room = body ? getRoomAt(body.x, body.y - 8) : null;
    m.ids = new Map(this.balls.map((b, i) => [b, String(i)]));
    meetingUI.open({
      title: i18n.t(body ? 'meeting.bodyTitle' : 'meeting.buttonTitle'),
      sub: body ? i18n.t('meeting.reportedBy', { name: nameOf(caller), room: room ? i18n.t('rooms.' + room) : '' }) : i18n.t('meeting.calledBy', { name: nameOf(caller) }),
      reporterFlag: caller.flag,
      kind: body ? 'body' : 'button',
      canVote: this.player.alive,
      players: this.balls.map((b) => ({ id: m.ids.get(b), flag: b.flag, name: nameOf(b), alive: b.alive, me: b.isMe })),
      onVote: (id) => this.castVote(this.player, id)
    });
    // Bot sohbeti (tartışma süresince) - sadece botlar konuşur, oyuncular sesli konuşur
    if (this.isClient) { m.timers.push(this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickMeeting(0.25) })); return; }
    const alive = this.balls.filter((b) => b.alive && !b.isMe && (b.brain || !this.online));
    alive.forEach((b) => {
      const t = 0.8 + Math.random() * (DISCUSS_TIME - 2);
      m.timers.push(this.time.delayedCall(t * 1000, () => this.botChat(b, room)));
    });
    m.timers.push(this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickMeeting(0.25) }));
  };

  P.botChat = function (b, room) {
    const m = this.meeting;
    if (!m || !b.alive) return;
    const others = this.balls.filter((o) => o.alive && o !== b);
    let key, target = null;
    const s = b.brain && b.brain.suspect;
    if (s && s.alive) { key = 'chat.sawKill'; target = s; }
    else if (b.role === 'impostor') {
      if (Math.random() < 0.45 && others.length) { key = 'chat.suspect'; target = pick(others); } else key = pick(['chat.notMe', 'chat.wasTasks']);
    } else if (b === m.caller && m.body && room) key = 'chat.bodyIn';
    else if ([...m.accuse.values()].includes(b)) { key = 'chat.defend'; target = [...m.accuse.entries()].find(([, v]) => v === b)[0]; }
    else key = pick(['chat.wasTasks', 'chat.noIdea', 'chat.whereBody', 'chat.skipVote']);
    this.showChat(b, key, target, room);
  };

  P.showChat = function (b, key, target, room) {
    const m = this.meeting;
    if (!m) return;
    if (target && (key === 'chat.sawKill' || key === 'chat.suspect')) m.accuse.set(b, target);
    this.emitEv('chat', [b.id, key, target ? target.id : null, room]);
    meetingUI.addChat(b.flag, nameOf(b), i18n.t(key, { target: target ? nameOf(target) : '', room: room ? i18n.t('rooms.' + room) : '' }));
  };

  // Tartışma -> oylama geçişi (host karar verir, client uygular)
  P.setMeetingPhase = function (phase) {
    const m = this.meeting;
    if (!m || m.phase === phase) return;
    m.phase = phase;
    if (phase === 'vote') m.left = VOTE_TIME;
    meetingUI.setPhase(phase, m.left);
  };

  P.tickMeeting = function (dt) {
    const m = this.meeting;
    if (!m) return;
    m.left -= dt;
    if (this.isClient) { if (m.phase === 'discuss' || m.phase === 'vote') meetingUI.setPhase(m.phase, Math.max(0, m.left)); return; }
    if (m.phase === 'discuss') {
      meetingUI.setPhase('discuss', m.left);
      if (m.left <= 0) {
        this.setMeetingPhase('vote');
        this.emitEv('phase', ['vote']);
        this.balls.filter((b) => b.alive && !b.isMe && (b.brain || !this.online)).forEach((b) => {
          m.timers.push(this.time.delayedCall((1 + Math.random() * 12) * 1000, () => this.castVote(b, this.botVoteFor(b))));
        });
      }
    } else if (m.phase === 'vote') {
      meetingUI.setPhase('vote', m.left);
      const voters = this.balls.filter((b) => b.alive);
      if (m.left <= 0 || voters.every((b) => m.votes.has(b))) this.finishVoting();
    }
  };

  P.botVoteFor = function (b) {
    const m = this.meeting;
    const others = this.balls.filter((o) => o.alive && o !== b);
    const idOf = (o) => m.ids.get(o);
    const s = b.brain && b.brain.suspect;
    if (b.role !== 'impostor' && s && s.alive) return idOf(s);
    // Sohbette en çok suçlananı takip et (bazen)
    const counts = new Map();
    m.accuse.forEach((t, who) => { if (who !== b && t.alive && t !== b) counts.set(t, (counts.get(t) || 0) + 1); });
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
    if (b.role === 'impostor') {
      if (top && Math.random() < 0.7) return idOf(top[0]);
      return Math.random() < 0.3 || !others.length ? 'skip' : idOf(pick(others.filter((o) => o.role !== 'impostor')) || pick(others));
    }
    if (top && Math.random() < 0.5) return idOf(top[0]);
    if (Math.random() < 0.6 || !others.length) return 'skip';
    return idOf(pick(others));
  };

  P.castVote = function (voter, id) {
    const m = this.meeting;
    if (!m || !voter || !voter.alive || m.votes.has(voter)) return;
    if (this.isClient && !this.applyingNet) {          // kendi oyumu host'a gönder
      if (m.phase !== 'vote') return;
      m.votes.set(voter, id);
      this.req('vote', { id });
      meetingUI.markVoted(m.ids.get(voter));
      sfx('vote', 0.7);
      return;
    }
    if (!this.isClient && m.phase !== 'vote') return;
    m.votes.set(voter, id);
    this.emitEv('voted', [voter.id]);
    meetingUI.markVoted(m.ids.get(voter));
    sfx('vote', 0.7);
  };

  P.finishVoting = function () {
    const m = this.meeting;
    if (!m || m.phase !== 'vote') return;
    const byId = {}, skips = [];
    m.votes.forEach((id, voter) => { if (id === 'skip') skips.push(voter.flag); else if (id != null && id !== '?') (byId[id] = byId[id] || []).push(voter.flag); });
    const ranked = Object.entries(byId).map(([id, v]) => [id, v.length]).sort((a, b) => b[1] - a[1]);
    let ejected = null, tie = false;
    if (ranked.length) {
      const [id, n] = ranked[0];
      tie = ranked[1] && ranked[1][1] === n;
      if (!tie && n > skips.length) ejected = this.balls[Number(id)];
      if (n === skips.length) tie = true;
    }
    this.emitEv('results', [byId, skips, ejected ? ejected.id : null, tie]);
    this.showVoteResults(byId, skips, ejected, tie);
  };

  // Sonuçları göster, sonra atılma ekranı. (Host ayrıca toplantıyı bitirir.)
  P.showVoteResults = function (byId, skips, ejected, tie) {
    const m = this.meeting;
    if (!m) return;
    m.phase = 'results';
    meetingUI.showResults(byId, skips);
    m.timers.push(this.time.delayedCall(RESULT_TIME * 1000, () => {
      if (ejected) {
        const imp = ejected.role === 'impostor';
        meetingUI.showEject(i18n.t('meeting.ejected', { name: nameOf(ejected) }), i18n.t(imp ? 'meeting.wasImpostor' : 'meeting.notImpostor', { name: nameOf(ejected) }), ejected.flag);
      } else {
        meetingUI.showEject(i18n.t('meeting.noEject'), tie ? i18n.t('meeting.tie') : '', null);
      }
      if (!this.isClient) m.timers.push(this.time.delayedCall(EJECT_TIME * 1000, () => this.endMeeting(ejected)));
    }));
  };

  P.endMeeting = function (ejected) {
    const m = this.meeting;
    if (!m) return;
    this.emitEv('endMeeting', [ejected ? ejected.id : null]);
    m.timers.forEach((t) => t.remove(false));
    meetingUI.close();
    if (ejected) this.die(ejected, { noBody: true });
    // cesetler kaldırılır, herkes masanın etrafına döner
    this.bodies.forEach((b) => b.destroy());
    this.bodies = [];
    const n = this.balls.length;
    this.balls.forEach((b, i) => {
      if (!b.alive && !b.isMe) return;
      const p = gameSpawn(i, n);
      b.setPosition(p.x, p.y); b.setDepth(b.y);
      if (b.brain) b.brain.reset();
      b.fixing = false;
      if (b.role === 'impostor') b.cooldown = KILL_COOLDOWN;
      else if (b.role === 'sheriff') b.cooldown = Math.max(b.cooldown, 5);
    });
    this.cameras.main.centerOn(this.player.x, this.player.y - 40);
    this.meeting = null;
    this.sabCd = Math.max(this.sabCd, 15);
    minimap.show();
    playMusic('music_game');
    this.checkEnd();
  };

  // ---------- SABOTAJ ----------
  P.openSabotage = function () {
    const me = this.player;
    if (this.over || this.meeting || me.role !== 'impostor' || !me.alive || this.sabotage || this.sabCd > 0) return;
    if (this.taskPanel && this.taskPanel.isOpen) return;
    sabMenu.open(SABOTAGE_TYPES, (t) => (this.isClient ? this.req('sab', { type: t }) : this.startSabotage(t)));
  };

  P.startSabotage = function (type) {
    if (this.over || this.meeting || this.sabotage || (this.sabCd > 0 && !this.applyingNet)) return false;
    const def = SABOTAGES[type];
    if (!def) return false;
    this.emitEv('sab', [type]);
    this.sabotage = { type, def, left: def.time };
    // en yakın masum botlar tamire koşar
    const crew = this.balls.filter((b) => b.brain && b.alive && b.role !== 'impostor')
      .sort((a, b) => dist(a, def.fix) - dist(b, def.fix)).slice(0, def.fixers);
    crew.forEach((b) => { b.fixing = true; b.fixT = 0; b.brain.doing = null; b.brain.finishing = null; b.brain.goTo(def.fix.x, def.fix.y); });
    if (type === 'lights') sfx('power_down');
    else { startLoop(type === 'reactor' ? 'alarm_loop' : 'oxygen_alert'); this.showAlarm(); }
    this.toast(i18n.t('sabotage.' + type + 'On', { s: def.time }), '#ff5a4f');
    return true;
  };

  P.showAlarm = function () {
    if (this.alarmEl) return;
    this.alarmEl = document.createElement('div');
    this.alarmEl.className = 'sab-alarm';
    document.body.appendChild(this.alarmEl);
  };
  P.clearAlarm = function () { if (this.alarmEl) { this.alarmEl.remove(); this.alarmEl = null; } };

  P.endSabotageFx = function () {
    stopLoop('alarm_loop', 400); stopLoop('oxygen_alert', 400);
    this.clearAlarm();
    this.registry.set('sabBanner', null);
    this.balls.forEach((b) => { if (b.fixing) { b.fixing = false; if (b.brain) b.brain.goal = null; } });
  };

  P.fixSabotage = function () {
    if (!this.sabotage) return;
    if (this.isClient && !this.applyingNet) { this.req('fix'); return; }
    this.emitEv('sabFix', []);
    this.endSabotageFx();
    this.sabotage = null;
    this.sabCd = SABOTAGE_COOLDOWN;
    sfx('power_up');
    this.toast(i18n.t('sabotage.fixed'), '#6be38a');
  };

  P.cancelSabotage = function () {
    if (!this.sabotage) return;
    this.endSabotageFx();
    this.sabotage = null;
    this.sabCd = Math.max(this.sabCd, SABOTAGE_COOLDOWN / 2);
  };

  P.canFix = function () {
    const s = this.sabotage, me = this.player;
    return !!(s && me.alive && me.role !== 'impostor' && dist(me, s.def.fix) <= FIX_RANGE);
  };

  P.updateSabotage = function (dt) {
    if (this.sabCd > 0) this.sabCd -= dt;
    const s = this.sabotage;
    if (s) {
      if (s.def.time) {
        s.left -= dt;
        if (s.left <= 0 && !this.isClient) {
          this.endSabotageFx();
          this.toast(i18n.t(s.type === 'reactor' ? 'sabotage.reactorFail' : 'sabotage.o2Fail'), '#ff5a4f');
          this.sabotage = null;
          this.finishGame('impostor');
          return;
        }
      }
      for (const b of this.balls) {
        if (!b.fixing || !b.alive) continue;
        if (dist(b, s.def.fix) < FIX_RANGE * 0.85) { b.fixT += dt; if (b.fixT >= BOT_FIX_TIME) { this.fixSabotage(); break; } } else b.fixT = 0;
      }
    } else if (this.sabCd <= 0 && !this.isClient) {
      // Bot Katil ara sıra sabotaj yapar
      const imp = this.balls.find((b) => b.role === 'impostor' && b.alive && !b.isMe);
      if (imp && Math.random() < dt / 40) this.startSabotage(pick(SABOTAGE_TYPES));
    }
    // ışıklar kesikse masumların görüşü daralır (yumuşak geçiş)
    const dark = s && s.type === 'lights' && this.player.alive && this.player.role !== 'impostor';
    const target = dark ? this.visionLightsOut : this.visionNormal;
    this.visionRadius += (target - this.visionRadius) * Math.min(1, dt * 3);
    // arayüz bandı
    const banner = s ? { text: i18n.t('sabotage.' + s.type + 'On', { s: Math.max(0, Math.ceil(s.left)) }), color: '#ff5a4f' } : null;
    this.registry.set('sabBanner', banner);
  };

  // Tamir sırasında bot: hedefe yürür, varınca bekler
  P.fixerThink = function (b, dt) {
    const fix = this.sabotage.def.fix;
    if (dist(b, fix) < FIX_RANGE * 0.7) return { x: 0, y: 0 };
    if (!b.brain.path.length) b.brain.goTo(fix.x, fix.y);
    return b.brain.update(dt);
  };

  // ---------- Acil toplantı düğmesi ----------
  P.nearEmergency = function () {
    const me = this.player;
    return me.alive && !this.sabotage && Math.hypot(me.x - EMERGENCY_BUTTON.x, me.y - EMERGENCY_BUTTON.y) < EMERGENCY_RANGE;
  };

  P.pressEmergency = function () {
    if (this.emergencyLeft <= 0) { this.toast(i18n.t('game.emergencyUsed'), '#ffb347'); return; }
    this.emergencyLeft--;
    if (this.isClient) this.req('emergency'); else this.callMeeting(this.player, null);
  };

  // ---------- Oyun sonu (sabotaj vb.) ----------
  P.finishGame = function (winner) {
    if (this.over) return;
    this.emitEv('over', [winner]);
    this.over = true;
    this.endSabotageFx();
    minimap.hide();
    this.registry.set('sabBanner', null);
    // Çevrimiçi maçta host sonucu sunucuya bildirir: sunucu kazanan/kaybedenleri ve XP'yi hesaplar
    if (this.isHost) net.matchResult(winner, this.balls.map((b) => ({ id: b.id, tasks: b.tasksDone || 0, kills: b.kills || 0 })));
    gameOver({
      winner,
      me: { role: this.player.role, alive: this.player.alive },
      players: this.balls.map((b) => ({ flag: b.flag, name: b.name, role: b.role, alive: b.alive, me: b.isMe }))
    });
  };

  // ---------- Mini harita ----------
  P.updateMinimap = function () {
    const s = this.sabotage;
    minimap.update({
      me: { x: this.player.x, y: this.player.y, alive: this.player.alive },
      tasks: this.myTasks,
      sabotage: s ? s.def.fix : null,
      room: this.registry.get('room')
    });
  };
}

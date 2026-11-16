// ============================================================
// GameExtras.js - GameScene'e eklenen sistemler: ceset/kan, BİLDİR + toplantı + oylama,
// sabotaj, mini harita. (GameScene.js çok büyümesin diye ayrı dosyada; installExtras
// fonksiyonu bu metotları GameScene'e ekler.)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { canSee, KILL_COOLDOWN } from '../systems/Combat.js';
import { EMERGENCY_BUTTON, gameSpawn, meetingSpawn, getRoomAt } from '../map/BunkerMap.js';
import { SABOTAGES, SABOTAGE_TYPES, SABOTAGE_COOLDOWN, FIX_RANGE, BOT_FIX_TIME } from '../systems/Sabotage.js';
import { MeetingScreen, SabotageMenu } from '../ui/MeetingScreen.js';
import { MiniMap } from '../ui/MiniMap.js';
import { sfx, startLoop, stopLoop, playMusic } from '../systems/Sound.js';
import { gameOver, stopKillCutscene } from '../systems/GameFlow.js';
import { net } from '../systems/Net.js';
import { staticBall } from '../entities/CountryBall.js';
import { ghostChat } from '../ui/Chat.js';

export const REPORT_RANGE = 170;        // oyuncu cesede bu kadar yakınsa BİLDİR çıkar
export const BOT_REPORT_RANGE = 520;    // bot cesedi bu mesafeden görürse bildirir
export const EMERGENCY_RANGE = 230;
export const EMERGENCY_COOLDOWN = 15;    // acil düğme bekleme süresi (sn): maç başı + her toplantı sonrası     // acil toplantı düğmesine yakınlık
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
    this.emergencyCd = EMERGENCY_COOLDOWN;   // acil düğme maç başında ve her toplantıdan sonra 15 sn kilitli
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
    const s = staticBall(this, ball.flag, ball.hat, 'x', ball.scaleFactor * 0.95).setPosition(0, -30).setAngle(90);
    s.sprite.setTint(0xb0b0b0);
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
    if (this.over || this.meeting || !me.alive || me.inTunnel) return;
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
      if (!b.brain || !b.alive || b.isMe) continue;
      if (b.reportT !== undefined) { b.reportT -= dt; if (b.reportT <= 0) { const body = b.reportBody; b.reportT = undefined; this.callMeeting(b, body); return; } continue; }
      if (!scan || !this.bodies.length) continue;
      const body = this.nearestBody(b, BOT_REPORT_RANGE);
      if (!body) continue;
      if (b.role === 'impostor') {
        // Katil: ceset başında görülüyorsa bazen kendisi bildirir (şüpheyi üstünden atmak için); bir kez karar verir
        if (!b.brain.bodyDecided) b.brain.bodyDecided = new Set();
        if (b.brain.bodyDecided.has(body)) continue;
        b.brain.bodyDecided.add(body);
        const watched = this.botVisible(b).some((o) => o.role !== 'impostor');
        if (!(watched && Math.random() < 0.6)) continue;
      }
      b.reportT = 0.7 + Math.random() * 1.2; b.reportBody = body;
    }
  };

  // ---------- TOPLANTI ----------
  P.callMeeting = function (caller, body) {
    if (this.over || this.meeting) return;
    stopKillCutscene();
    ghostChat.suspend(true);
    this.emitEv('meeting', [caller.id, body ? body.ball.id : null]);
    const m = this.meeting = { caller, body, votes: new Map(), accuse: new Map(), phase: 'discuss', left: this.cfg.discuss, timers: [], sheriffMisfire: !!this._sheriffMisfire };
    this._sheriffMisfire = false;
    this.cancelSabotage();
    if (this.taskPanel) this.taskPanel.close(true);
    this.taskOpen = false;
    sabMenu.close();
    minimap.hide();
    this.balls.forEach((b) => { b.reportT = undefined; if (b.inTunnel) { b.inTunnel = null; if (b.isMe) { b.setAlpha(1); this.clearTunnelArrows(); } } });
    const room = body ? getRoomAt(body.x, body.y - 8) : null;   // ceset nerede bulundu (ışınlanmadan ÖNCE)
    this.gatherInCafeteria();                                   // toplantı başlar başlamaz herkes kafeteryaya
    sfx(body ? 'body_found' : 'meeting');
    playMusic('music_meeting');
    m.ids = new Map(this.balls.map((b, i) => [b, String(i)]));
    if (!this.isClient) this.botLeads(body);
    meetingUI.open({
      title: i18n.t(body ? 'meeting.bodyTitle' : 'meeting.buttonTitle'),
      sub: body ? i18n.t('meeting.reportedBy', { name: nameOf(caller), room: room ? i18n.t('rooms.' + room) : '' }) : i18n.t('meeting.calledBy', { name: nameOf(caller) }),
      reporterFlag: caller.flag,
      kind: body ? 'body' : 'button',
      canVote: this.player.alive,
      ghost: !this.player.alive,
      onChat: (text) => this.sendChat(text),
      players: this.balls.map((b) => ({ id: m.ids.get(b), flag: b.flag, name: nameOf(b), alive: b.alive, me: b.isMe })),
      onVote: (id) => this.castVote(this.player, id)
    });
    // Bot sohbeti (tartışma süresince) - sadece botlar konuşur, oyuncular sesli konuşur
    if (this.isClient) { m.timers.push(this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickMeeting(0.25) })); return; }
    const alive = this.balls.filter((b) => b.alive && !b.isMe && (b.brain || !this.online));
    alive.forEach((b) => {
      const t = 0.8 + Math.random() * Math.max(1, (this.cfg.discuss || 10) - 2);
      m.timers.push(this.time.delayedCall(t * 1000, () => this.botChat(b, room)));
    });
    m.timers.push(this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickMeeting(0.25) }));
  };

  // Oyuncu sohbeti (toplantıda). Ölülerin mesajlarını sadece ölüler görür.
  P.sendChat = function (text) {
    if (!this.meeting) return;
    const me = this.player;
    if (this.online) net.chat(text, 'meet', !me.alive);
    else { meetingUI.addChat(me.flag, nameOf(me), text, { ghost: !me.alive, mine: true }); if (me.alive) this.readChat(me, text); }
  };

  // Botlar oyuncuların yazdıklarını okur: mesajda bir ülke/oyuncu adı geçerse o kişiyi suçlama sayar
  const norm = (t) => String(t || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  P.readChat = function (sender, text) {
    const m = this.meeting;
    if (!m || this.isClient || !sender || !sender.alive) return;
    const t = norm(text);
    if (/\b(skip|gec|gecelim|kanit yok|bilmiyorum)\b/.test(t)) return;
    // Olumsuzlama: "X degil", "not X", "X innocent/masum", "X katil degil"
    const NEG = /(degil|değil|not |yok|masum|innocent|temiz|crew|suspect degil|şüpheli degil|supheli degil|katil degil|benimle|with me|birlikteydi|yanimdaydi|yanımdaydı)/i;
    const POS = /(supheli|şüpheli|suspect|katil|impostor|imposter|goruyorum|gördüm|gordum|vent|tunel|tünel|kill|oldur|öldür)/i;
    const d = i18n.data || {};
    let best = null, bestLen = 0;
    this.balls.forEach((o) => {
      if (!o.alive || o === sender) return;
      const names = [o.name, (d.tr && d.tr.countries || {})[o.flag], (d.en && d.en.countries || {})[o.flag]];
      names.forEach((n) => { const k = norm(n); if (k.length >= 3 && k.length > bestLen && t.includes(k)) { best = o; bestLen = k.length; } });
    });
    if (!best) return;
    // İsim geçti ama olumsuz mu?
    if (NEG.test(t) && !POS.test(t)) {
      // Temize çıkarma: skor azalt, suçlama ekleme
      if (m.weight && m.weight.has(sender)) m.weight.delete(sender);
      if (m.accuse.get(sender) === best) m.accuse.delete(sender);
      if (!m.clear) m.clear = new Map();
      m.clear.set(best, (m.clear.get(best) || 0) + 1);
      return;
    }
    // Sadece isim geçti, suçlama fiili yoksa zayıf say (kandırılma azalır)
    const strong = POS.test(t);
    m.accuse.set(sender, best);
    if (!m.weight) m.weight = new Map();
    m.weight.set(sender, strong ? 3 : 1);
    const say = (b, key, target, ms) => m.timers.push(this.time.delayedCall(ms, () => { if (this.meeting === m && b.alive) this.showChat(b, key, target); }));
    if (best.brain && !m.defended) { m.defended = new Set(); }
    if (strong && best.brain && !m.defended.has(sender)) { m.defended.add(sender); say(best, 'chat.defend', sender, 1200 + Math.random() * 1500); }
    if (strong) {
      const ally = this.balls.find((b) => b.brain && b.alive && b !== best && b.role !== 'impostor' && (b.brain.suspect === best || b.brain.lead === best));
      if (ally) say(ally, 'chat.agree', best, 1800 + Math.random() * 1800);
    }
  };

  P.onChatMsg = function (m) {
    if (m.ch !== 'meet' || !this.meeting) return;
    const b = this.ball(m.from);
    const dead = !!m.dead || (b && !b.alive);          // ölü olduğunu gizleyip yaşayanlara yazamaz
    if (dead && this.player.alive) return;
    meetingUI.addChat(b ? b.flag : m.flag, b ? nameOf(b) : m.name, m.text, { ghost: dead, mine: m.from === net.id });
    if (!dead && b && !this.isClient) this.readChat(b, m.text);
  };

  // Ceset yakınında, ölümden kısa süre önce gördüğü kişi = ipucu (kesin değil).
  // MAZERET: ölüm anında (±3 sn) bot birini cesetten uzakta kendi gözüyle gördüyse o kişi temizdir.
  P.botLeads = function (body) {
    this.balls.forEach((b) => {
      if (!b.brain) return;
      const br = b.brain;
      br.lead = null; br.alibi = new Set();
      if (!body || b.role === 'impostor') return;
      const t0 = body.t || this.time.now;
      (br.hist || []).forEach((h) => {
        if (Math.abs(h.t - t0) > 3000) return;
        h.ps.forEach(([o, x, y]) => { if (o !== body.ball && Math.hypot(x - body.x, y - body.y) > 550) br.alibi.add(o); });
      });
      if (!br.seen) return;
      let best = null, bestScore = -Infinity;
      br.seen.forEach((e, o) => {
        if (o === b || o === body.ball || !o.alive || br.alibi.has(o)) return;
        if (e.t < t0 - 10000 || e.t > t0 + 1500) return;
        const d = Math.hypot(e.x - body.x, e.y - body.y);
        if (d > 420) return;
        // daha yakın ve ölüme daha yakın zamanda görülen daha şüpheli
        const sc = -d / 420 - (t0 - e.t) / 10000;
        if (sc > bestScore) { bestScore = sc; best = o; }
      });
      // Cesedin yanında kimse görülmediyse: kurbanı son 20 sn içinde biriyle BAŞ BAŞA gördü mü? ("X ile elektriğe gidiyordu")
      if (!best) {
        let bt = -1;
        (br.hist || []).forEach((h) => {
          if (h.t < t0 - 20000 || h.t > t0) return;
          const v = h.ps.find(([o]) => o === body.ball);
          if (!v) return;
          const near = h.ps.filter(([o, x, y]) => o !== body.ball && o !== b && o.alive && !br.alibi.has(o) && Math.hypot(x - v[1], y - v[2]) < 320);
          if (near.length === 1 && h.t > bt) { bt = h.t; best = near[0][0]; }
        });
      }
      br.lead = best;
    });
  };

  P.botChat = function (b, room) {
    const m = this.meeting;
    if (!m || !b.alive) return;
    const others = this.balls.filter((o) => o.alive && o !== b);
    let key, target = null;
    const s = b.brain && b.brain.suspect;
    const accuser = [...m.accuse.entries()].find(([, v]) => v === b);
    // Popüler suçlama (başkalarının söylediği)
    const tallies = new Map();
    m.accuse.forEach((t) => { if (t && t.alive) tallies.set(t, (tallies.get(t) || 0) + 1); });
    let popular = null, popN = 0;
    tallies.forEach((n, t) => { if (n > popN) { popN = n; popular = t; } });

    // Mazeret: suçlanan biri bu botla birlikteyse onu savunur (bir kez)
    const alibiFor = b.role !== 'impostor' && b.brain && b.brain.alibi
      ? [...m.accuse.values()].find((t) => t && t.alive && t !== b && b.brain.alibi.has(t) && !(m.alibiSaid && m.alibiSaid.has(b.id + '>' + t.id)))
      : null;
    // Katil ortağı suçlanıyorsa katil bot bazen sahte mazeret uydurur
    const allyAccused = b.role === 'impostor'
      ? [...m.accuse.values()].find((t) => t && t.alive && t !== b && t.role === 'impostor')
      : null;
    if (alibiFor) {
      key = 'chat.alibi'; target = alibiFor;
      (m.alibiSaid || (m.alibiSaid = new Set())).add(b.id + '>' + alibiFor.id);
      if (!m.clear) m.clear = new Map();
      m.clear.set(alibiFor, (m.clear.get(alibiFor) || 0) + 2);
    } else if (allyAccused && Math.random() < 0.5) {
      key = 'chat.alibi'; target = allyAccused;
      if (!m.clear) m.clear = new Map();
      m.clear.set(allyAccused, (m.clear.get(allyAccused) || 0) + 1);
    } else if (s && s.alive && b.role !== 'impostor') {
      // Gerçek tanık: katili gördü
      key = b.brain.sawVent ? 'chat.sawVent' : (Math.random() < 0.5 ? 'chat.sawKill' : 'chat.suspect');
      target = s;
    } else if (b.role === 'impostor') {
      // Katil: mümkün olduğunca masum gibi konuş; rastgele "şüpheli" demeyi AZALT
      const crew = others.filter((o) => o.role !== 'impostor');
      if (accuser && accuser[0].alive) {
        key = pick(['chat.defend', 'chat.notMe', 'chat.whyMe']);
        target = accuser[0];
        m.accuse.set(b, accuser[0]);
      } else if (m.body && b === m.caller) {
        key = pick(['chat.bodyIn', 'chat.foundBody', 'chat.whereBody']);
      } else if (popular && popular.role !== 'impostor' && Math.random() < 0.35) {
        // Sürüye uy: başkalarının şüphelendiği masumu destekle (kendini ele vermemek için)
        key = pick(['chat.agree', 'chat.suspect', 'chat.lookAt']);
        target = popular;
      } else if (Math.random() < 0.18 && crew.length) {
        // Nadiren rastgele suçla (eskiden %40'tı — bu yüzden her "şüpheli" katilden geliyordu)
        key = pick(['chat.suspect', 'chat.lookAt', 'chat.weird']);
        target = pick(crew);
      } else {
        key = pick(['chat.wasTasks', 'chat.noIdea', 'chat.skipVote', 'chat.needProof', 'chat.quiet', 'chat.whereWas']);
      }
    } else {
      // Masum / şerif: daha aktif konuşsun
      if (b.brain && b.brain.lead && b.brain.lead.alive) {
        key = pick(['chat.sawNear', 'chat.suspect', 'chat.lookAt']);
        target = b.brain.lead;
      } else if (b === m.caller && m.body && room) {
        key = pick(['chat.bodyIn', 'chat.foundBody']);
      } else if (accuser) {
        key = pick(['chat.defend', 'chat.notMe', 'chat.whyMe']);
        target = accuser[0];
      } else if (popular && popular !== b && Math.random() < 0.45) {
        key = pick(['chat.agree', 'chat.suspect', 'chat.lookAt']);
        target = popular;
      } else if (Math.random() < 0.35 && others.length) {
        // Zayıf şüphe: rastgele birine (gerçek oyuncu gibi spekülasyon)
        key = pick(['chat.suspect', 'chat.weird', 'chat.lookAt', 'chat.whereWas']);
        target = pick(others);
      } else {
        key = pick(['chat.wasTasks', 'chat.noIdea', 'chat.whereBody', 'chat.skipVote', 'chat.needProof', 'chat.quiet', 'chat.stayTogether']);
      }
    }
    this.showChat(b, key, target, room);
  };

  P.showChat = function (b, key, target, room) {
    const m = this.meeting;
    if (!m) return;
    if (target && ['chat.sawKill', 'chat.sawVent', 'chat.suspect', 'chat.sawNear', 'chat.agree', 'chat.lookAt', 'chat.weird'].includes(key)) {
      m.accuse.set(b, target);
      if (!m.weight) m.weight = new Map();
      m.weight.set(b, key === 'chat.suspect' ? 1 : (key === 'chat.sawNear' || key === 'chat.agree') ? 2 : 4);
    }
    this.emitEv('chat', [b.id, key, target ? target.id : null, room]);
    meetingUI.addChat(b.flag, nameOf(b), i18n.t(key, { target: target ? nameOf(target) : '', room: room ? i18n.t('rooms.' + room) : '' }));
  };

  // Tartışma -> oylama geçişi (host karar verir, client uygular)
  P.setMeetingPhase = function (phase) {
    const m = this.meeting;
    if (!m || m.phase === phase) return;
    m.phase = phase;
    if (phase === 'vote') m.left = this.cfg.vote;
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
          // Oylama süresine göre: sürenin %10-%60'ı içinde (kısa oylamada da süre bitmeden oy verir)
          const span = Math.max(2, (this.cfg.vote || VOTE_TIME) - 2);
          const at = Math.min(span, 1 + span * (0.1 + Math.random() * 0.5));
          m.timers.push(this.time.delayedCall(at * 1000, () => this.castVote(b, this.botVoteFor(b))));
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
    const idOf = (o) => m.ids.get(o);
    const br = b.brain || {};
    const alibi = br.alibi || new Set();
    // KRİZ: katiller bir öldürme uzaklıktaysa (atlamak = kaybetmek) masumlar boş geçmez
    const alive = this.balls.filter((o) => o.alive);
    const imps = alive.filter((o) => o.role === 'impostor').length;
    const crisis = imps > 0 && imps + 1 >= alive.length - imps;
    // Şerif masum vurup öldüyse → kanıt karışık, skip eğilimi (kriz hariç)
    if (m.sheriffMisfire && !crisis) {
      if (b.role !== 'impostor' && Math.random() < 0.75) return 'skip';
    }
    if (b.role !== 'impostor' && br.suspect && br.suspect.alive) return idOf(br.suspect);   // kendi gözüyle gördü
    const score = new Map();
    m.accuse.forEach((t, who) => {
      if (!t || !t.alive || t === b || who === b || !who.alive) return;
      let w = (m.weight && m.weight.get(who)) || 1;
      // Temize çıkarıldıysa skor düşür
      if (m.clear && m.clear.get(t)) w = Math.max(0, w - m.clear.get(t));
      // Suçlayanın kendisi bu botun gözünde şüpheliyse (cesedin yanında gördüğü) suçlamasına güvenme
      if (b.role !== 'impostor' && who === br.lead) w = Math.max(0, w - 2);
      if (w > 0) score.set(t, (score.get(t) || 0) + w);
    });
    const ranked = [...score.entries()].sort((x, y) => y[1] - x[1]);
    if (b.role === 'impostor') {
      // Ortağına asla oy vermez; masumlardan en çok suçlanana yüklenir. Krizde eşik düşer (kazanmak için bir atış yeter).
      const crewTop = ranked.find(([t]) => t.role !== 'impostor');
      const need = crisis ? 1 : 3;
      if (crewTop && crewTop[1] >= need && Math.random() < (crisis ? 0.95 : 0.7)) return idOf(crewTop[0]);
      const allyTop = ranked[0] && ranked[0][0].role === 'impostor';
      if (allyTop && crewTop && Math.random() < 0.6) return idOf(crewTop[0]);    // ortağı kurtarmak için oyu böl
      return 'skip';
    }
    // Masum: mazereti olanı ele (kendi gözüyle birlikte olduğu kişi)
    const clean = ranked.filter(([t]) => !alibi.has(t));
    const top = clean[0];
    const lead = br.lead && br.lead.alive && !alibi.has(br.lead) ? br.lead : null;
    if (top && top[1] >= 5) return idOf(top[0]);
    if (lead && top && top[0] === lead && top[1] >= 2) return idOf(lead);
    if (top && top[1] >= 4 && Math.random() < 0.7) return idOf(top[0]);
    if (lead && Math.random() < 0.45) return idOf(lead);
    if (top && top[1] >= 3 && Math.random() < 0.35) return idOf(top[0]);
    if (crisis) {
      // Geçmek kaybettirir: en güçlü ipucuna oy ver
      if (lead) return idOf(lead);
      if (top) return idOf(top[0]);
    }
    return 'skip';
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
    this.emitEv('results', [byId, skips, ejected ? ejected.id : null, tie, ejected ? ejected.role === 'impostor' : false]);
    this.showVoteResults(byId, skips, ejected, tie);
  };

  // Sonuçları göster, sonra atılma ekranı. (Host ayrıca toplantıyı bitirir.)
  P.showVoteResults = function (byId, skips, ejected, tie, wasImp) {
    const m = this.meeting;
    if (!m) return;
    if (ejected && wasImp !== undefined && !ejected.role) ejected.role = wasImp ? 'impostor' : 'crewmate';
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

  // Herkesi ana masanın etrafına ışınla (hayalet olan ben de gelirim, öbür ölüler yerinde kalır)
  P.gatherInCafeteria = function () {
    const n = this.balls.length;
    this.balls.forEach((b, i) => {
      if (!b.alive && !b.isMe) return;
      const p = meetingSpawn(i, n);
      b.setPosition(p.x, p.y); b.setDepth(b.y);
      b.netValid = null; b.net = null; b.botDir = null;
      if (b.brain) b.brain.reset();
      b.fixing = false;
    });
    this.cameras.main.centerOn(this.player.x, this.player.y - 40);
    if (this.fog) this.fog.update(this.player.x, this.player.y - 16, this.visionRadius);
  };

  P.endMeeting = function (ejected) {
    const m = this.meeting;
    if (!m) return;
    this.emitEv('endMeeting', [ejected ? ejected.id : null]);
    m.timers.forEach((t) => t.remove(false));
    // Botlar toplantıdan bir "güvenmediğim kişi" çıkarır: atılmayan en çok suçlanan ya da cesedin yanında gördüğü
    if (!this.isClient) {
      const tally = new Map();
      m.accuse.forEach((t, who) => { if (t && t.alive && t !== ejected) tally.set(t, (tally.get(t) || 0) + ((m.weight && m.weight.get(who)) || 1) - ((m.clear && m.clear.get(t)) || 0)); });
      let topT = null, topN = 2;
      tally.forEach((n, t) => { if (n > topN) { topN = n; topT = t; } });
      this.balls.forEach((b) => {
        if (!b.brain || !b.alive || b.role === 'impostor') return;
        const br = b.brain, al = br.alibi || new Set();
        const cand = br.lead && br.lead.alive && br.lead !== ejected ? br.lead : topT;
        br.distrust = cand && cand !== b && !al.has(cand) ? cand : null;
        br.btnGo = false;
        // Şerif: herkesin üstünde birleştiği (atılamamış) kişiyi şüpheli sayar ve gördüğünde vurur — risk alır
        if (b.role === 'sheriff' && topT && topT !== b && !al.has(topT) && topN >= 4 && Math.random() < 0.6) br.suspect = topT;
        // Toplantıdan sonra masumların yarısı bir arkadaşla birlikte gezer (yalnız kalan kolay av olur)
        br.buddy = null;
        if (Math.random() < 0.75) {
          let bb = null, bd = Infinity;
          this.balls.forEach((o) => { if (o === b || !o.alive || o === br.distrust) return; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < bd) { bd = d; bb = o; } });
          if (bb) { br.buddy = bb; br.buddyUntil = this.time.now + 30000 + Math.random() * 20000; }
        }
      });
    }
    meetingUI.close();
    if (ejected) this.die(ejected, { noBody: true, noGun: true });   // atılan şerifin silahı da gider
    // cesetler kaldırılır, herkes masanın etrafına döner
    this.bodies.forEach((b) => b.destroy());
    this.bodies = [];
    this.gatherInCafeteria();                                   // toplantıdan sonra herkes ana masanın etrafında başlar
    this.balls.forEach((b) => {
      if (b.role === 'impostor') b.cooldown = this.cfg.killCd;
      else if (b.role === 'sheriff') b.cooldown = Math.max(b.cooldown, 5);
    });
    this.meeting = null;
    ghostChat.suspend(false);
    this.sabCd = 0;                              // toplantıdan sonra sabotaj beklemesi sıfırlanır: katil hemen sabotaj yapabilir
    this.emergencyCd = EMERGENCY_COOLDOWN;
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
    this.balls.forEach((b) => { if (b.alive) b.setMood('wide', 1.3); });
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
    if (this.emergencyCd > 0) this.emergencyCd -= dt;
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
    }
    // (Bot katillerin sabotaj kararı artık GameScene.botSabotage içinde, duruma göre)
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

  // ---------- ŞERİF SİLAHI ----------
  // Şerif ölünce (öldürülür / masumu vurup ölür) silahı yere düşer. Yaşayan bir masum üstünden geçince alır ve ŞERİF olur.
  // Host / tek başına oyun karar verir; client yanına gelince ister ('gun' isteği), herkes 'gunTake' olayıyla görür.
  const GUN_RANGE = 70;
  P.dropGun = function (x, y) {
    this.guns = this.guns || [];
    const g = { id: (this.gunSeq = (this.gunSeq || 0) + 1), x, y, taken: false, spr: null };
    this.guns.push(g);
    this.showGun(g);
    this.emitEv('gunDrop', [g.id, Math.round(x), Math.round(y)]);
    return g;
  };

  P.showGun = function (g) {
    const c = this.add.container(g.x, g.y - 10).setDepth(g.y);
    const glow = this.add.circle(0, 0, 34, 0x3e8bff, 0.28);
    const ring = this.add.circle(0, 0, 26, 0x000000, 0).setStrokeStyle(4, 0x7fb6ff, 0.9);
    const ic = this.add.text(0, -2, '🔫', { fontSize: '34px' }).setOrigin(0.5);
    c.add([glow, ring, ic]);
    this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.08, duration: 800, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: ic, y: -10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    g.spr = c;
  };

  P.takeGun = function (ball, g) {
    if (!g || g.taken || !ball) return;
    g.taken = true;
    if (g.spr) { g.spr.destroy(); g.spr = null; }
    this.emitEv('gunTake', [ball.id, g.id]);
    if (ball.alive && (!this.isClient || ball.isMe)) {
      ball.role = 'sheriff';
      ball.cooldown = Math.max(ball.cooldown || 0, 5);
      if (ball.brain) { ball.brain.doing = null; ball.gunGo = null; }
    }
    if (ball.isMe) {
      this.registry.set('role', 'sheriff');
      this.toast(i18n.t('game.gotGun'), '#7fb6ff');
      sfx('vote', 0.8);
      this.applyRoleTags();
    }
  };

  P.updateGuns = function () {
    if (!this.guns || !this.guns.length || this.meeting || this.over) return;
    for (const g of this.guns) {
      if (g.taken) continue;
      if (this.isClient) {                       // sadece kendim: yanına gelince host'a sor
        const me = this.player;
        if (me.alive && me.role !== 'impostor' && Math.hypot(me.x - g.x, me.y - g.y) < GUN_RANGE && !(g.askT > this.time.now)) { g.askT = this.time.now + 800; this.req('gun', { g: g.id }); }
        continue;
      }
      // Host / tek başına: üstünden geçen ilk yaşayan masum (katil ve hayalet alamaz)
      const taker = this.balls.find((b) => b.alive && b.role !== 'impostor' && b.role !== 'sheriff' && !b.inTunnel && Math.hypot(b.x - g.x, b.y - g.y) < GUN_RANGE);
      if (taker) { this.takeGun(taker, g); continue; }
      // Silahı gören masum bot ona yürür
      this.balls.forEach((b) => {
        if (!b.brain || !b.alive || b.role === 'impostor' || b.role === 'sheriff' || b.fixing || b.gunGo === g) return;
        if (Math.hypot(b.x - g.x, b.y - g.y) < 450 && canSee(this.grid, b, g, 450)) { b.gunGo = g; b.brain.doing = null; b.brain.goTo(g.x, g.y); }
      });
    }
  };

  P.gunById = function (id) { return (this.guns || []).find((g) => g.id === id) || null; };

  // ---------- Acil toplantı düğmesi ----------
  P.nearEmergency = function () {
    const me = this.player;
    return me.alive && !this.sabotage && Math.hypot(me.x - EMERGENCY_BUTTON.x, me.y - EMERGENCY_BUTTON.y) < EMERGENCY_RANGE;
  };

  P.pressEmergency = function () {
    if (this.sabotage) return;                                    // sabotaj sürerken düğme kapalı
    if (this.emergencyLeft <= 0) { this.toast(i18n.t('game.emergencyUsed'), '#ffb347'); return; }
    if (this.emergencyCd > 0) { this.toast(i18n.t('game.emergencyWait', { s: Math.ceil(this.emergencyCd) }), '#ffb347'); return; }
    this.emergencyLeft--;
    if (this.isClient) this.req('emergency'); else this.callMeeting(this.player, null);
  };

  // ---------- Oyun sonu (sabotaj vb.) ----------
  P.finishGame = function (winner, roles) {
    if (this.over) return;
    // Maç sonunda roller herkese açıklanır (client o ana kadar bilmez)
    if (roles) this.balls.forEach((b) => { if (roles[b.id]) b.role = roles[b.id]; });
    this.emitEv('over', [winner, Object.fromEntries(this.balls.map((b) => [b.id, b.role]))]);
    this.over = true;
    ghostChat.hide();
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

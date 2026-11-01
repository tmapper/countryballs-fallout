// ============================================================
// GameScene.js - Oyun dünyası: sığınak, hareket, görüş, ROLLER
// ============================================================
// GameFlow.startMatch() bu sahneyi rol animasyonu oynarken arkada kurar ve uyutur;
// animasyon bitince uyandırır. Veri:
//   { players: [{ flag, role, me }, ...] }   (me = bu cihazdaki oyuncu)
// Rol kuralları ve sayılar: systems/Combat.js
// Kontroller: hareket WASD/ok/joystick · Q/Boşluk = aksiyon (öldür/vur) · E = tünel · Esc = lobi
import { i18n } from '../systems/I18n.js';
import { InputController } from '../systems/InputController.js';
import { FogOfWar } from '../systems/FogOfWar.js';
import { CountryBall } from '../entities/CountryBall.js';
import { BotBrain } from '../systems/BotBrain.js';
import { ROLE_COLORS } from '../systems/Roles.js';
import { RES } from '../systems/Resolution.js';
import { backToLobby, playKillCutscene, gameOver } from '../systems/GameFlow.js';
import {
  KILL_RANGE, SHOOT_RANGE, KILL_COOLDOWN, FIRST_KILL_COOLDOWN, SHOOT_COOLDOWN, FIRST_SHOOT_COOLDOWN,
  findTarget, witnesses, nearestTunnel, checkWinner, canSee, BOT_AGGRESSIVE
} from '../systems/Combat.js';
import { WORLD, gameSpawn, TUNNELS, canStand, getRoomAt, buildGrid, world } from '../map/BunkerMap.js';
import { MapRenderer } from '../map/MapRenderer.js';
import { TaskPanel } from '../ui/TaskPanel.js';
import { PROP_IMG } from '../map/PropImages.js';
import { STATIONS, TASK_ICON, TASKS_PER_PLAYER, pickTasks, nearestTask } from '../systems/Tasks.js';
import { sfx, startLoop, stopLoop, stopAllLoops } from '../systems/Sound.js';
import { installExtras, REPORT_RANGE } from './GameExtras.js';
import { installNet } from './GameNet.js';
import { installFx } from './GameFx.js';

// Görüş yarıçapları (dünya pikseli). İleride "ışıklar kesildi" sabotajında
// VISION_LIGHTS_OUT kullanılacak.
export const VISION_NORMAL = 760;
export const VISION_LIGHTS_OUT = 260;

const countryName = (b) => b.name || i18n.t('countries.' + b.flag);

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create(data) {
    const players = (data && data.players) || [{ flag: 'TR', role: 'crewmate', me: true }];
    const mode = (data && data.net) || 'offline';     // 'offline' | 'host' | 'client'
    this.over = false;
    // Tek başına (bot yok): serbest test, kazanma koşulu yok
    this.sandbox = players.length === 1 && mode === 'offline';

    // Görüş hesabı için duvar ızgarası (bir kez hesaplanır)
    world.sealed = true;            // bomba düştü: dışarısı kapalı
    this.grid = buildGrid(16, true);
    this.visionRadius = VISION_NORMAL;
    this.visionNormal = VISION_NORMAL;
    this.visionLightsOut = VISION_LIGHTS_OUT;

    const me = players.find((p) => p.me);
    // Tüneller sadece Katil'e görünür
    this.map = new MapRenderer(this);
    this.map.build({ showTunnels: me && me.role === 'impostor', sealed: true });
    this.bombDone = false;

    // Oyuncular: masanın etrafında başlarlar
    const n = players.length;
    this.balls = players.map((p, i) => {
      const { x, y } = gameSpawn(i, n); // acil toplantı masasının etrafında halka
      const ball = new CountryBall(this, x, y, p.flag, { isMe: p.me, role: p.role });
      ball.id = p.id || 'b' + i;
      ball.name = p.name || '';
      ball.cooldown = p.role === 'impostor' ? FIRST_KILL_COOLDOWN : p.role === 'sheriff' ? FIRST_SHOOT_COOLDOWN : 0;
      // Botları sadece host (ya da tek başına oyun) yönetir; diğer oyuncular ağdan gelir
      const isBot = mode === 'offline' ? !p.me : !!p.bot;
      if (!p.me && isBot && mode !== 'client') ball.brain = new BotBrain(ball);
      if (!p.me && !ball.brain) ball.net = { x, y, f: 0, m: 0 };
      return ball;
    });
    this.player = this.balls.find((b) => b.isMe);
    this.bodies = [];
    this.setupNet(mode);
    this.registry.set('online', this.online);
    if (this.online) this.registry.set('showRoles', false);

    // ---- Görevler: Katil görev almaz. Botların görevleri zamanla kendiliğinden biter (simülasyon).
    this.taskPanel = new TaskPanel();
    this.taskOpen = false;
    // Katil'in sahte görev listesi var (kimseye belli olmasın diye), ama görev yapamaz
    this.fakeTasks = this.player.role === 'impostor';
    this.myTasks = pickTasks(TASKS_PER_PLAYER);
    this.taskTotal = this.balls.filter((b) => b.role !== 'impostor').length * TASKS_PER_PLAYER;
    this.taskDone = 0;
    // Botlar görevlerine gerçekten yürür ve başında bekler (Katil bot da sahte görev yapar)
    this.balls.forEach((b) => {
      if (!b.brain) return;
      b.botTasks = pickTasks(TASKS_PER_PLAYER, { flat: true });
      if (b.role !== 'impostor') b.tasksLeft = TASKS_PER_PLAYER;
      b.onBotTask = (t) => {
        t.done = true;
        if (b.role === 'impostor' || !b.alive || this.over || !b.tasksLeft) return;
        b.tasksLeft--;
        this.addTaskDone(1);
      };
    });
    this.buildTaskMarkers();
    this.events.once('shutdown', () => { this.taskPanel.close(true); stopAllLoops(); });

    this.registry.set('flag', this.player.flag);
    this.registry.set('role', this.player.role);
    this.registry.set('playerCount', n);
    this.registry.set('room', null);
    this.registry.set('dead', false);
    this.publishTasks();
    // Not: Phaser 'changedata' olayını sadece daha önce var olan anahtar için yayar
    if (this.registry.get('showRoles') === undefined) this.registry.set('showRoles', false);
    const onRoles = () => this.applyRoleTags();
    onRoles();
    this.registry.events.on('changedata-showRoles', onRoles);
    i18n.onChange(onRoles);
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata-showRoles', onRoles);
      i18n.offChange(onRoles);
    });

    // Girdi: klavye + (UIScene'deki) joystick
    this.controls = new InputController(this, null);

    // Kamera: oyuncuyu takip eder, dünya sınırında durur, ekran boyuna göre yakınlaşır
    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 40);
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyZoom, this));

    // Savaş sisi + F2 ile açıp kapatma (haritayı incelemek için)
    this.fog = new FogOfWar(this, WORLD.w, WORLD.h, this.grid);
    const kb = this.input.keyboard;
    kb.on('keydown-F2', () => this.fog.setEnabled(!this.fog.enabled));
    kb.on('keydown-ESC', () => { if (this.taskPanel.isOpen) this.taskPanel.close(); else if (!this.online) backToLobby(); });
    kb.on('keydown-Q', () => this.doAction());
    kb.on('keydown-SPACE', () => this.doAction());
    kb.on('keydown-E', () => this.interact());
    this.setupExtras();   // ceset bildirme, toplantı, sabotaj, mini harita (GameExtras.js)
    this.setupFx();       // ışık, toz, kan, duman (GameFx.js)
    // Not: UIScene'i GameFlow açar (rol animasyonu bitince)
  }

  // Yakınlaştırma CSS boyuna göre hesaplanır, 1080p çizim için RES.k ile çarpılır
  applyZoom() {
    this.cameras.main.setZoom(Phaser.Math.Clamp(RES.cssH / 1000, 0.5, 1.2) * RES.k);
  }

  // "Rolleri göster" açıksa her topun üstünde rolü yazar; kapalıysa sadece "Sen"
  applyRoleTags() {
    const show = !!this.registry.get('showRoles');
    this.balls.forEach((b) => {
      if (show) b.showTag((b.isMe ? i18n.t('ui.you') + ' · ' : '') + i18n.t('roles.' + b.role), ROLE_COLORS[b.role]);
      else b.showTag(b.isMe ? i18n.t(b.alive ? 'ui.you' : 'ui.ghost') : (this.online ? b.name : ''), '#ffffff');
    });
  }

  toast(text, color = '#ffffff') {
    this.game.events.emit('toast', text, color);
  }

  // ---------------- Aksiyonlar ----------------

  // Bu cihazdaki oyuncunun aksiyon butonu (Q / Boşluk / ekrandaki buton)
  doAction() {
    const me = this.player;
    if (this.over || this.meeting || !me.alive || me.cooldown > 0) return;
    if (me.role === 'impostor') {
      const t = findTarget(this.grid, me, this.balls, KILL_RANGE);
      if (t) { if (this.isClient) { this.req('kill', { t: t.id }); me.cooldown = 1; } else this.kill(me, t); }
    } else if (me.role === 'sheriff') {
      const t = findTarget(this.grid, me, this.balls, SHOOT_RANGE);
      if (t) { if (this.isClient) { this.req('shoot', { t: t.id }); me.cooldown = 1; } else this.shoot(me, t); }
    }
  }

  // ---------------- Görevler ----------------

  nearTask() { return this.fakeTasks ? null : nearestTask(this.myTasks, this.player.x, this.player.y); }

  // Her görev istasyonunda: yerde yanıp sönen halka + üstünde zıplayan görev resmi (sadece KENDİ görevlerin)
  buildTaskMarkers() {
    this.markers = {};
    if (this.fakeTasks) return;
    this.myTasks.forEach((t) => this.makeMarker(t));
  }

  makeMarker(t) {
    {
      const ic = TASK_ICON[t.type];
      const c = this.add.container(t.x, t.y).setDepth(t.y - 1);
      const ring = this.add.ellipse(0, 0, 120, 56, 0xffd23f, 0.22).setStrokeStyle(5, 0xffd23f, 0.95);
      this.tweens.add({ targets: ring, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
      let icon;
      if (ic.img && PROP_IMG[ic.img]) {
        const key = 'task_' + ic.img;
        if (!this.textures.exists(key)) this.textures.addImage(key, PROP_IMG[ic.img]);
        icon = this.add.image(0, -66, key); icon.setScale(78 / icon.height);
      } else {
        icon = this.add.text(0, -66, ic.emoji, { fontSize: '56px', resolution: 2 }).setOrigin(0.5);
      }
      this.tweens.add({ targets: icon, y: icon.y - 12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const bang = this.add.text(0, -122, '!', { fontFamily: 'Arial', fontSize: '40px', fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
      c.add([ring, icon, bang]);
      this.markers[t.id] = c;
    }
  }

  publishTasks() {
    this.registry.set('tasks', this.myTasks.map((t) => ({ id: t.id, type: t.type, room: t.room, done: t.done, step: !!t.next })));
    this.registry.set('fakeTasks', !!this.fakeTasks);
    this.registry.set('taskProgress', { done: this.taskDone, total: this.taskTotal });
  }

  // E / KULLAN butonu: Katil tünele girer, diğerleri yakındaki görevi açar
  interact() {
    const me = this.player;
    if (this.over || this.meeting) return;
    if (this.canFix()) { this.fixSabotage(); return; }
    if (me.role === 'impostor' && this.nearestTunnelOk()) { this.useTunnel(); return; }
    if (this.taskPanel.isOpen) return;
    const t = this.nearTask();
    if (!t) { if (this.nearEmergency()) this.pressEmergency(); return; }
    this.taskOpen = true;
    this.taskPanel.open(t.type, { onDone: () => this.completeTask(t), onClose: () => { this.taskOpen = false; } });
  }

  completeTask(t) {
    if (this.markers[t.id]) { this.markers[t.id].destroy(); delete this.markers[t.id]; }
    // İki aşamalı görev: ilk adım bitti -> ikinci adım başka yerde
    if (t.next) {
      Object.assign(t, { type: t.next.type, x: t.next.x, y: t.next.y, room: t.next.room, next: null });
      this.makeMarker(t);
      this.publishTasks();
      sfx('wire_connect');
      this.toast(i18n.t('tasks.stepDone'), '#ffd23f');
      return;
    }
    t.done = true;
    sfx('task_done');
    this.fxTaskDone();
    this.toast(i18n.t('tasks.completed'), '#6be38a');
    this.player.tasksDone = (this.player.tasksDone || 0) + 1;   // maç sonu istatistiği için
    if (this.isClient) { this.publishTasks(); this.req('task'); return; }   // toplamı host tutar
    this.addTaskDone(1);
  }

  updateBotTasks() { /* botlar görevlerini yürüyerek yapar (BotBrain + onBotTask) */ }


  // Katil: yakındaki tünele gir, bağlı tünelden çık
  nearestTunnelOk() { return !!nearestTunnel(TUNNELS, this.player.x, this.player.y); }

  useTunnel() {
    const me = this.player;
    if (this.over || this.meeting || !me.alive || me.role !== 'impostor') return;
    const t = nearestTunnel(TUNNELS, me.x, me.y);
    if (!t || (this.tunnelLock || 0) > this.time.now) return;
    const dest = TUNNELS.find((x) => x.id === t.links[0]);
    if (!dest) return;
    this.tunnelLock = this.time.now + 600;
    sfx('tunnel');
    this.fxTunnel(me.x, me.y);
    me.setPosition(dest.x, dest.y);
    this.time.delayedCall(60, () => this.fxTunnel(me.x, me.y));
    me.setDepth(me.y);
    this.cameras.main.centerOn(me.x, me.y - 40);
    this.cameras.main.flash(180, 0, 0, 0);
  }

  kill(killer, victim) {
    if (this.meeting || this.over) return;
    this.emitEv('kill', [killer.id, victim.id]);
    // Öldüren, ölenin tam üstüne ışınlanır (Among Us gibi); kamera kaymadan geçer
    killer.setPosition(victim.x, victim.y);
    killer.setDepth(killer.y);
    if (killer.isMe) this.cameras.main.centerOn(killer.x, killer.y - 40);
    killer.cooldown = KILL_COOLDOWN;
    killer.kills = (killer.kills || 0) + 1;      // maç sonu istatistiği için (host raporlar)
    const seen = witnesses(this.grid, killer, victim, this.balls);
    // Ses: olayın içindeysen öldürme sesi, uzaktan gördüysen ceset bulundu sesi
    if (killer.isMe || victim.isMe) sfx('kill');
    else if (this.player.alive && canSee(this.grid, this.player, victim)) sfx('body_found');
    this.die(victim);
    // Gören botlar öldüreni şüpheli olarak işaretler (bot Şerif onu vurmaya gider)
    seen.forEach((w) => { if (w.brain) w.brain.suspect = killer; });
    // Öldürme animasyonu sadece ÖLENE oynar (öldüren oyuna devam eder)
    if (victim.isMe) {
      const clip = Math.random() < 0.5 ? 'kill1' : 'kill2';
      playKillCutscene(clip, killer.flag, victim.flag, i18n.t('game.killedBy', { name: countryName(killer) }), 'kill');
    }
    if (victim.isMe) this.toast(i18n.t('game.youDied'), '#ff6b6b');
    this.checkEnd();
  }

  shoot(sheriff, target) {
    if (this.meeting || this.over) return;
    this.emitEv('shoot', [sheriff.id, target.id]);
    sheriff.cooldown = SHOOT_COOLDOWN;
    this.fxShot(sheriff, target);
    if (sheriff.isMe || target.isMe || !this.player.alive || canSee(this.grid, this.player, sheriff)) sfx('shoot');
    if (target.role === 'impostor') {
      this.die(target);
      // Vurulma animasyonu sadece VURULANA oynar
      if (target.isMe) {
        playKillCutscene('sheriff_kill', sheriff.flag, target.flag, i18n.t('game.shotBySheriff', { name: countryName(sheriff) }), 'sheriff');
      }
      this.toast(i18n.t('game.impostorShot', { name: countryName(sheriff) }), ROLE_COLORS.sheriff);
    } else {
      // Yanlış kişi: Şerif ölür, hedef yaşar
      this.die(sheriff);
      this.toast(i18n.t(sheriff.isMe ? 'game.youMisfired' : 'game.sheriffMisfired', { name: countryName(sheriff) }), '#ffb347');
    }
    this.checkEnd();
  }

  die(ball, opts = {}) {
    if (!ball.alive) return;
    ball.alive = false;
    ball.brain = null;
    // Ölen botun yapılmamış görevleri toplamdan düşer (ölü bot görev yapmaz). Oyuncu hayalet olarak devam eder.
    if (!ball.isMe && ball.tasksLeft) { this.taskTotal -= ball.tasksLeft; ball.tasksLeft = 0; this.publishTasks(); }
    if (ball.isMe && this.taskPanel) this.taskPanel.close();
    if (!opts.noBody) { this.spawnBody(ball); this.fxDeath(ball); }
    if (ball.isMe) {
      // Hayalet: yürüyebilir, herkesi görür, kimse onu görmez
      ball.setAlpha(0.45);
      ball.shadow.setVisible(false);
      this.fog.setEnabled(false);
      this.registry.set('dead', true);
    } else {
      ball.setVisible(false);
    }
    this.applyRoleTags();
  }

  checkEnd() {
    if (this.over || this.sandbox || this.meeting || this.isClient) return;
    let winner = checkWinner(this.balls);
    // Tüm masumların görevleri bittiyse masumlar kazanır
    if (!winner && this.taskTotal > 0 && this.taskDone >= this.taskTotal) winner = 'crew';
    if (!winner) return;
    this.endSabotageFx();
    this.finishGame(winner);
  }

  // ---------------- Botlar ----------------

  botThink(b, dt) {
    if (b.fixing && this.sabotage) return this.fixerThink(b, dt);   // sabotaj tamirine koşuyor
    if (!BOT_AGGRESSIVE) return b.brain.update(dt); // botlar sadece gezer
    let chase = null;
    if (b.role === 'impostor' && b.cooldown <= 0) {
      const t = findTarget(this.grid, b, this.balls, KILL_RANGE);
      // Tanık yoksa (ya da bazen cesurca) öldür
      if (t && (witnesses(this.grid, b, t, this.balls).length === 0 || Math.random() < 0.002)) {
        this.kill(b, t);
        return { x: 0, y: 0 };
      }
      chase = this.nearestVisible(b, (o) => o.alive && o !== b, 500);
    } else if (b.role === 'sheriff' && b.brain.suspect) {
      const s = b.brain.suspect;
      if (!s.alive) b.brain.suspect = null;
      else {
        if (b.cooldown <= 0 && Math.hypot(s.x - b.x, s.y - b.y) <= SHOOT_RANGE && canSee(this.grid, b, s)) {
          this.shoot(b, s);
          return { x: 0, y: 0 };
        }
        if (canSee(this.grid, b, s, 700)) chase = s;
      }
    }
    return b.brain.update(dt, chase);
  }

  nearestVisible(from, filter, range) {
    let best = null, bestD = range;
    this.balls.forEach((o) => {
      if (!filter(o)) return;
      const d = Math.hypot(o.x - from.x, o.y - from.y);
      if (d < bestD && canSee(this.grid, from, o)) { best = o; bestD = d; }
    });
    return best;
  }

  // ---------------- Döngü ----------------

  // Maç başında, oyun ilk göründüğünde: nükleer bomba düşer, kapı mühürlenir
  playBomb() {
    if (this.bombDone) return;
    this.bombDone = true;
    const cam = this.cameras.main;
    cam.flash(1800, 255, 255, 255);
    cam.shake(2600, 0.010);
    // Ses: elektrik gider, kapı mühürlenir, alarm çalar, sonra elektrik geri gelir
    sfx('power_down');
    this.time.delayedCall(350, () => sfx('door_seal'));
    this.time.delayedCall(900, () => startLoop('alarm_loop'));
    this.time.delayedCall(6500, () => { stopLoop('alarm_loop', 800); sfx('power_up'); });
    this.time.delayedCall(350, () => this.map.sealedObjs.forEach((o) => o.setVisible(true)));
    this.time.delayedCall(400, () => this.toast(i18n.t('game.bombTitle'), '#ffcc33'));
    this.time.delayedCall(2200, () => this.toast(i18n.t('game.bombSub'), '#ffffff'));
  }

  update(time, delta) {
    const dt = Math.min(delta, 100) / 1000; // yavaş cihazda ağır çekim olmasın, büyük takılmada ışınlanmasın
    this.netUpdate(Math.min(delta, 100) / 1000);
    this.updateFx(Math.min(delta, 100) / 1000, time);
    // Toplantıda herkes donar
    if (this.meeting) { this.registry.set('hud', { action: null }); return; }
    const ui = this.scene.get('UIScene');
    this.controls.joystick = ui && ui.joystick ? ui.joystick : null;
    const dir = this.taskOpen ? { x: 0, y: 0 } : this.controls.update();   // görev açıkken yürüme yok
    this.updateBotTasks(dt);
    if (!this.over && !this.sandbox) { this.updateSabotage(dt); this.updateBotReports(dt); }
    if (this.meeting) return;   // bu karede toplantı başladıysa

    // canStand: yürünebilir alan kontrolü. Duvara çarpınca durur ama duvar boyunca kayar.
    this.player.move(dir, dt, canStand);

    this.balls.forEach((b) => { if (b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt); });

    // Botlar (oyun bittiyse dururlar)
    if (!this.over) {
      this.balls.forEach((b) => {
        if (!b.brain || !b.alive) return;
        const moved = b.move(this.botThink(b, dt), dt, canStand);
        if (b.brain) b.brain.report(moved, dt);
      });
    }

    // Gözün konumu: ayak noktasının biraz yukarısı (ayak izi kutusunun içinde kalsın)
    this.fog.update(this.player.x, this.player.y - 16, this.visionRadius);

    // Arayüze bilgi ver
    this.registry.set('playerPos', { x: Math.round(this.player.x), y: Math.round(this.player.y) });
    const room = getRoomAt(this.player.x, this.player.y - 8);
    if (room !== this.registry.get('room')) this.registry.set('room', room);
    this.registry.set('hud', this.hudState());
    this.registry.set('taskArrow', this.arrowTarget());
    this.updateMinimap();
  }

  // Ekranda olmayan en yakın hedefe ok: sabotaj tamiri (kırmızı) ya da görev (sarı)
  arrowTarget() {
    const me = this.player;
    let t = null, color = 0xffd23f;
    if (this.sabotage && me.role !== 'impostor' && me.alive) { t = this.sabotage.def.fix; color = 0xff5a4f; }
    else if (!this.fakeTasks) t = this.myTasks.filter((x) => !x.done).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    if (!t) return null;
    const v = this.cameras.main.worldView;
    if (t.x > v.x + 40 && t.x < v.right - 40 && t.y > v.y + 60 && t.y < v.bottom - 40) return null;
    return { ang: Math.atan2(t.y - me.y, t.x - me.x), color };
  }

  // UIScene'deki aksiyon butonlarının durumu
  hudState() {
    const me = this.player;
    const st = { action: null, ready: false, cooldown: 0, tunnel: false, task: false, useLabel: 'use', report: false, sabotage: false };
    if (this.over || this.meeting) return st;
    st.task = !this.taskOpen && !!this.nearTask();
    if (st.task) st.useLabel = 'use';
    if (!this.taskOpen && this.canFix()) { st.task = true; st.useLabel = 'fix'; }
    else if (!st.task && !this.taskOpen && this.nearEmergency() && this.emergencyLeft > 0) { st.task = true; st.useLabel = 'meeting'; }
    if (!me.alive) return st;
    st.report = !!this.nearestBody(me, REPORT_RANGE);
    if (me.role === 'impostor') { st.sabotage = true; st.sabReady = !this.sabotage && this.sabCd <= 0; st.sabCd = this.sabotage ? 0 : Math.max(0, Math.ceil(this.sabCd)); st.sabFrac = Math.min(1, Math.max(0, this.sabCd) / 30); }
    if (me.role === 'impostor') {
      st.action = 'kill';
      st.ready = me.cooldown <= 0 && !!findTarget(this.grid, me, this.balls, KILL_RANGE);
      st.tunnel = !!nearestTunnel(TUNNELS, me.x, me.y);
    } else if (me.role === 'sheriff') {
      st.action = 'shoot';
      st.ready = me.cooldown <= 0 && !!findTarget(this.grid, me, this.balls, SHOOT_RANGE);
    }
    st.cooldown = Math.ceil(me.cooldown);
    const cdMax = me.role === 'impostor' ? KILL_COOLDOWN : SHOOT_COOLDOWN;
    st.cdFrac = Math.min(1, me.cooldown / cdMax);
    return st;
  }
}

installExtras(GameScene);
installNet(GameScene);
installFx(GameScene);

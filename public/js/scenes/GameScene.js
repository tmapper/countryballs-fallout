// ============================================================
// GameScene.js - Oyun dünyası: sığınak, hareket, görüş, ROLLER
// ============================================================
// GameFlow.startMatch() bu sahneyi rol animasyonu oynarken arkada kurar ve uyutur;
// animasyon bitince uyandırır. Veri:
//   { players: [{ flag, role, me }, ...] }   (me = bu cihazdaki oyuncu)
// Rol kuralları ve sayılar: systems/Combat.js
// Kontroller: hareket WASD/ok/joystick · Q/Boşluk = aksiyon (öldür/vur) · E = tünel · Esc = lobi
import { ghostChat } from '../ui/Chat.js';
import { net } from '../systems/Net.js';
import { gameSettings } from '../ui/GameSettings.js';
import { i18n } from '../systems/I18n.js';
import { InputController } from '../systems/InputController.js';
import { FogOfWar } from '../systems/FogOfWar.js';
import { CountryBall } from '../entities/CountryBall.js';
import { BotBrain, navFrameStart, warmNav } from '../systems/BotBrain.js';
import { ROLE_COLORS, impCount } from '../systems/Roles.js';
import { RES, getQuality, setQuality } from '../systems/Resolution.js';
import { backToLobby, playKillCutscene, gameOver } from '../systems/GameFlow.js';
import {
  KILL_RANGE, SHOOT_RANGE, KILL_COOLDOWN, FIRST_KILL_COOLDOWN, SHOOT_COOLDOWN, FIRST_SHOOT_COOLDOWN,
  findTarget, witnesses, nearestTunnel, checkWinner, canSee, BOT_AGGRESSIVE
} from '../systems/Combat.js';
import { SABOTAGES } from '../systems/Sabotage.js';
import { WORLD, gameSpawn, TUNNELS, canStand, getRoomAt, buildGrid, world, useMap } from '../map/BunkerMap.js';
import { DEFAULT_CFG } from '../systems/RoomConfig.js';
import { MapRenderer } from '../map/MapRenderer.js';
import { TaskPanel } from '../ui/TaskPanel.js';
import { PROP_IMG } from '../map/PropImages.js';
import { STATIONS, TASK_ICON, TASKS_PER_PLAYER, pickTasks, nearestTask } from '../systems/Tasks.js';
import { sfx, startLoop, stopLoop, stopAllLoops } from '../systems/Sound.js';
import { installExtras, REPORT_RANGE } from './GameExtras.js';
import { installNet } from './GameNet.js';
import { installFx } from './GameFx.js';
import { installTunnel } from './GameTunnel.js';

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
    // Kurucu ayarları (çevrimiçi odadan gelir; tek kişilik oyunda varsayılan)
    this.cfg = { ...DEFAULT_CFG, ...((data && data.cfg) || {}) };
    useMap(this.cfg.map);           // harita: ÖNCE seçilmeli (ızgara, çizim, görev noktaları buna göre)
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
      const ball = new CountryBall(this, x, y, p.flag, { isMe: p.me, role: p.role, hat: p.hat });
      ball.id = p.id || 'b' + i;
      ball.name = p.name || '';
      ball.cooldown = p.role === 'impostor' ? Math.min(FIRST_KILL_COOLDOWN, this.cfg.killCd) : p.role === 'sheriff' ? FIRST_SHOOT_COOLDOWN : 0;
      ball.speedMul = this.cfg.speed;   // kurucunun seçtiği oyuncu hızı (herkese aynı)
      // Botları sadece host (ya da tek başına oyun) yönetir; diğer oyuncular ağdan gelir
      const isBot = mode === 'offline' ? !p.me : !!p.bot;
      ball.isBot = isBot;
      if (!p.me && isBot && mode !== 'client') ball.brain = new BotBrain(ball);
      if (!p.me && !ball.brain) ball.net = { x, y, f: 0, m: 0 };
      return ball;
    });
    this.player = this.balls.find((b) => b.isMe);
    if (this.balls.some((b) => b.brain)) warmNav();   // yol ızgarasını ilk bot hareketinde değil, yükleme sırasında kur
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
    // Çevrimiçi client başkalarının rolünü bilmez (hile koruması); maçta her zaman 1 Katil var
    this.taskTotal = (this.balls.length - impCount(this.balls.length)) * TASKS_PER_PLAYER;
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
    this.events.once('shutdown', () => { this.taskPanel.close(true); gameSettings.close(); ghostChat.hide(); stopAllLoops(); });

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
    // F2 sis aç/kapa: sadece test modunda (?debug=1) ve çevrimdışı (yoksa duvar hilesi olurdu)
    if (/[?&]debug=1/.test(location.search)) kb.on('keydown-F2', () => { if (!this.online) this.fog.setEnabled(!this.fog.enabled); });
    kb.on('keydown-ESC', () => { if (this.taskPanel.isOpen) this.taskPanel.close(); else if (!gameSettings.isOpen) gameSettings.open({ onLeave: () => backToLobby() }); });
    kb.on('keydown-Q', () => this.doAction());
    kb.on('keydown-SPACE', () => this.doAction());
    kb.on('keydown-E', () => this.interact());
    this.setupExtras();   // ceset bildirme, toplantı, sabotaj, mini harita (GameExtras.js)
    this.setupFx();       // ışık, toz, kan, duman (GameFx.js)
    this.setupCull();
    // Not: UIScene'i GameFlow açar (rol animasyonu bitince)
  }

  // Yakınlaştırma CSS boyuna göre hesaplanır, 1080p çizim için RES.k ile çarpılır
  applyZoom() {
    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(RES.cssH, RES.cssW) / 1000, RES.cssW < RES.cssH ? 0.45 : 0.5, 1.2) * RES.k);
  }

  // "Rolleri göster" açıksa her topun üstünde rolü yazar; kapalıysa sadece "Sen"
  // İsim etiketleri: kendi topunda "Sen" yerine ADIN yazar. Katillerin adı KIRMIZI (sadece katiller görür:
  // kendin katilsen kendi adın ve ortaklarının adı kırmızı). "Rolleri göster" (test) açıksa rol de yazar.
  applyRoleTags() {
    const show = !!this.registry.get('showRoles');
    const iAmImp = this.player && this.player.role === 'impostor';
    const iAmSh = this.player && this.player.role === 'sheriff';
    const nameOf = (b) => b.name || (b.isMe ? (net.profile.name || '') : '') || i18n.t('countries.' + b.flag);
    this.balls.forEach((b) => {
      if (show) { b.showTag(`${nameOf(b)} · ${i18n.t('roles.' + b.role)}`, ROLE_COLORS[b.role]); return; }
      const red = iAmImp && b.role === 'impostor';
      const blue = iAmSh && b.role === 'sheriff';
      if (b.isMe) b.showTag(nameOf(b) + (b.alive ? '' : ' 👻'), red ? ROLE_COLORS.impostor : blue ? ROLE_COLORS.sheriff : '#ffffff');
      else if (red) b.showTag(nameOf(b), ROLE_COLORS.impostor);
      else if (blue) b.showTag(nameOf(b), ROLE_COLORS.sheriff);
      else b.showTag(this.online ? b.name : '', '#ffffff');
    });
  }

  toast(text, color = '#ffffff') {
    this.game.events.emit('toast', text, color);
  }

  // ---------------- Aksiyonlar ----------------

  // Bu cihazdaki oyuncunun aksiyon butonu (Q / Boşluk / ekrandaki buton)
  doAction() {
    const me = this.player;
    if (this.over || this.meeting || !me.alive || me.cooldown > 0 || me.inTunnel) return;
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
    if (me.inTunnel) { this.useTunnel(); return; }
    if (this.canFix()) { this.fixSabotage(); return; }
    if (me.role === 'impostor' && this.nearestTunnelOk()) { this.useTunnel(); return; }
    if (this.taskPanel.isOpen) return;
    const t = this.nearTask();
    if (!t) { if (this.nearEmergency()) this.pressEmergency(); return; }
    this.taskOpen = true;
    this.releaseControls();
    this.releaseControls();   // panel açılırken parmak/tuş durumu temiz olsun (panel üstünde parmak kalkınca olay kaybolur)
    this.taskPanel.open(t.type, { onDone: () => this.completeTask(t), onClose: () => { this.taskOpen = false; this.releaseControls(); } });
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
    this.player.setMood('happy', 1.5);
    sfx('task_done');
    this.fxTaskDone();
    this.toast(i18n.t('tasks.completed'), '#6be38a');
    this.player.tasksDone = (this.player.tasksDone || 0) + 1;   // maç sonu istatistiği için
    if (this.isClient) { this.publishTasks(); this.req('task', { s: t.id }); return; }   // toplamı host tutar
    this.addTaskDone(1);
  }

  updateBotTasks() { /* botlar görevlerini yürüyerek yapar (BotBrain + onBotTask) */ }


  // Katil: yakındaki tünele gir, bağlı tünelden çık
  nearestTunnelOk() { return !!nearestTunnel(TUNNELS, this.player.x, this.player.y); }

  kill(killer, victim) {
    if (this.meeting || this.over) return;
    this.emitEv('kill', [killer.id, victim.id]);
    // Öldüren, ölenin tam üstüne ışınlanır (Among Us gibi); kamera kaymadan geçer
    killer.setPosition(victim.x, victim.y);
    killer.setDepth(killer.y);
    if (killer.isMe) this.cameras.main.centerOn(killer.x, killer.y - 40);
    killer.cooldown = this.cfg.killCd;
    killer.kills = (killer.kills || 0) + 1;      // maç sonu istatistiği için (host raporlar)
    const seen = witnesses(this.grid, killer, victim, this.balls);
    // Ses: olayın içindeysen öldürme sesi, uzaktan gördüysen ceset bulundu sesi
    if (killer.isMe || victim.isMe) sfx('kill');
    else if (this.player.alive && canSee(this.grid, this.player, victim)) sfx('body_found');
    this.die(victim);
    const body = this.bodies[this.bodies.length - 1];
    if (body) body.t = this.time.now;
    // Gören botlar öldüreni şüpheli olarak işaretler (bot Şerif onu vurmaya gider), masum tanık hemen bildirir
    seen.forEach((w) => {
      if (!w.brain || w.role === 'impostor') return;
      w.brain.suspect = killer;
      if (w.role !== 'sheriff' && body && !this.isClient && w.reportT === undefined) { w.reportT = 0.6 + Math.random() * 0.8; w.reportBody = body; }
    });
    // Öldürme animasyonu sadece ÖLENE oynar (öldüren oyuna devam eder)
    if (victim.isMe) {
      const clip = Math.random() < 0.5 ? 'kill1' : 'kill2';
      playKillCutscene(clip, killer.flag, victim.flag, i18n.t('game.killedBy', { name: countryName(killer) }), 'kill');
    }
    if (victim.isMe) this.toast(i18n.t('game.youDied'), '#ff6b6b');
    this.checkEnd();
  }

  shoot(sheriff, target, hitArg) {
    if (this.meeting || this.over) return;
    // Client hedefin rolünü bilmez: sonuç host'tan gelir
    const hit = hitArg !== undefined ? !!hitArg : target.role === 'impostor';
    if (hit && !target.role) target.role = 'impostor';
    this.emitEv('shoot', [sheriff.id, target.id, hit ? 1 : 0]);
    sheriff.cooldown = SHOOT_COOLDOWN;
    this.fxShot(sheriff, target);
    if (sheriff.isMe || target.isMe || !this.player.alive || canSee(this.grid, this.player, sheriff)) sfx('shoot');
    if (hit) {
      this.die(target);
      // Vurulma animasyonu sadece VURULANA oynar
      if (target.isMe) {
        playKillCutscene('sheriff_kill', sheriff.flag, target.flag, i18n.t('game.shotBySheriff', { name: countryName(sheriff) }), 'sheriff');
      }
      this.toast(i18n.t('game.impostorShot', { name: countryName(sheriff) }), ROLE_COLORS.sheriff);
    } else {
      // Yanlış kişi: Şerif ölür, hedef yaşar
      this.die(sheriff);
      if (this.meeting) this.meeting.sheriffMisfire = true;
      else this._sheriffMisfire = true; // bir sonraki toplantıya taşı
      this.toast(i18n.t(sheriff.isMe ? 'game.youMisfired' : 'game.sheriffMisfired', { name: countryName(sheriff) }), '#ffb347');
    }
    this.checkEnd();
  }

  die(ball, opts = {}) {
    if (!ball.alive) return;
    ball.alive = false;
    ball.brain = null;
    // Ölen botun yapılmamış görevleri toplamdan düşer (ölü bot görev yapmaz). Oyuncu hayalet olarak devam eder.
    if (!ball.isMe && ball.tasksLeft && !this.isClient) { this.taskTotal -= ball.tasksLeft; ball.tasksLeft = 0; this.publishTasks(); this.emitEv('tasks', [this.taskDone, this.taskTotal]); }
    if (ball.isMe && this.taskPanel) this.taskPanel.close();
    if (!opts.noBody) { this.spawnBody(ball); this.fxDeath(ball); }
    // Şerif ölünce silahını düşür (masumlar alabilir)
    if (ball.role === 'sheriff' && !opts.noGun) {
      this.guns = this.guns || [];
      this.guns.push({ x: ball.x, y: ball.y, taken: false, spr: null });
      this.spawnGunPickup(this.guns[this.guns.length - 1]);
    }
    if (ball.isMe) {
      // Ölüler sohbeti: sadece diğer ölüler görür
      ghostChat.show({ local: !this.online, me: { name: ball.name || net.profile.name || i18n.t('countries.' + ball.flag), flag: ball.flag } });
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

  // ---------------- BOT ZEKASI (adil) ----------------
  // Botlar SADECE kendi görüş alanında (oyuncuyla aynı yarıçap, duvar arkası görünmez) gördüklerini bilir.
  // Aynı hız, aynı bekleme süreleri, aynı menziller; kararlarda insan gibi kısa tepki gecikmesi var.
  botSight(b) {
    const lightsOut = this.sabotage && this.sabotage.type === 'lights' && b.role !== 'impostor';
    return lightsOut ? this.visionLightsOut : this.visionNormal;
  }

  botVisible(b) {
    const R = this.botSight(b);
    return this.balls.filter((o) => o !== b && o.alive && Math.hypot(o.x - b.x, o.y - b.y) <= R && canSee(this.grid, b, o, R));
  }

  botThink(b, dt) {
    if (b.fixing && this.sabotage) return this.fixerThink(b, dt);   // sabotaj tamirine koşuyor
    const br = b.brain;
    br.react = Math.max(0, (br.react || 0) - dt);
    let chase = null;

    if (b.role === 'impostor') {
      const seen = this.botVisible(b);
      const crew = seen.filter((o) => o.role !== 'impostor');      // katil ortaklarını tanır (insan katil de görür)
      // Kaçış: az önce öldürdü -> yakında tünel varsa kullan, yoksa uzaklaş
      if (br.flee > 0) {
        br.flee -= dt;
        if (br.fleeTunnel && this.botTunnel(b)) br.fleeTunnel = false;
        return br.update(dt);
      }
      // Tenha mı? Görüş alanında hedeften başka masum yoksa saldır
      if (b.cooldown <= 0 && crew.length === 1) {
        const t = crew[0];
        const d = Math.hypot(t.x - b.x, t.y - b.y);
        if (d <= KILL_RANGE && br.react <= 0 && !br.aimT) { br.aimT = 0.25 + Math.random() * 0.35; }   // tepki gecikmesi
        if (br.aimT) {
          br.aimT -= dt;
          if (br.aimT <= 0) {
            br.aimT = 0;
            // Hâlâ menzilde ve hâlâ tenha mı?
            const still = this.botVisible(b).filter((o) => o.role !== 'impostor');
            if (still.length === 1 && still[0] === t && Math.hypot(t.x - b.x, t.y - b.y) <= KILL_RANGE) {
              this.kill(b, t);
              br.flee = 2.5; br.fleeTunnel = Math.random() < 0.7;
              br.reset(); br.wait = 0;
              return { x: 0, y: 0 };
            }
          }
        }
        if (d < this.botSight(b) * 0.85) chase = t;                  // yalnız hedefe yaklaş
      } else br.aimT = 0;
      // Mantıklı sabotaj (ortak bekleme süresi)
      if (!this.sabotage && this.sabCd <= 0 && !this.isClient && br.react <= 0) this.botSabotage(b, crew);
      // Ara sıra yer değiştirmek için tünel (kimse görmüyorsa)
      if (br.tunGoal) {
        if (crew.length) br.tunGoal = null;                          // görülürse vazgeç
        else if (Math.hypot(br.tunGoal.x - b.x, br.tunGoal.y - b.y) < 70) { br.tunGoal = null; this.botTunnel(b); }
      } else if (!chase && crew.length === 0 && Math.random() < dt / 14) {
        // Avlanmak için başka bölgeye geç: en yakın tünele yürü
        let best = null, bd = 1400;
        TUNNELS.forEach((t) => { const d = Math.hypot(t.x - b.x, t.y - b.y); if (d < bd) { bd = d; best = t; } });
        if (best) { br.tunGoal = best; br.goTo(best.x, best.y); }
      }
    } else if (b.role === 'sheriff') {
      this.botRemember(b, dt);
      // Öldürürken gördüğü kişi (tanık olduğu cinayet) = şüpheli. Gördüğü anda vurmaya çalışır.
      const s = br.suspect;
      if (s && !s.alive) br.suspect = null;
      else if (s) {
        const R = this.botSight(b);
        const visible = canSee(this.grid, b, s, R);
        if (visible) {
          if (b.cooldown <= 0 && Math.hypot(s.x - b.x, s.y - b.y) <= SHOOT_RANGE) {
            if (!br.aimT) br.aimT = 0.3 + Math.random() * 0.4;
            br.aimT -= dt;
            if (br.aimT <= 0) { br.aimT = 0; this.shoot(b, s); return { x: 0, y: 0 }; }
          }
          chase = s;
        }
      }
    } else if ((this.botRemember(b, dt), br.suspect) && br.suspect.alive && canSee(this.grid, b, br.suspect, this.botSight(b))) {
      // Masum: katili gördüyse ondan uzaklaş
      const s = br.suspect, dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d < 400) return { x: (dx / d) * 0.8, y: (dy / d) * 0.8 };
    }
    return br.update(dt, chase);
  }

  // Bot katil tünele girer: SADECE yanında tünel varsa (oyuncuyla aynı kural)
  botTunnel(b) {
    if (this.over || this.meeting || !b.alive) return false;
    const t = nearestTunnel(TUNNELS, b.x, b.y);
    if (!t || (b.tunnelLock || 0) > this.time.now) return false;
    const dest = TUNNELS.find((x) => x.id === t.links[0]);
    if (!dest) return false;
    b.tunnelLock = this.time.now + 4000;
    this.ventWitness(b);
    if (canSee(this.grid, this.player, b, this.visionRadius)) { this.fxTunnel(b.x, b.y); }
    b.setPosition(dest.x, dest.y); b.setDepth(b.y);
    b.brain.reset(); b.brain.wait = 0.3;
    return true;
  }

  // Tünele girerken görülen kişi kesin katildir (masum botlar bunu bilir, Şerif vurmaya gider)
  ventWitness(user) {
    if (this.isClient) return;
    this.balls.forEach((o) => {
      if (!o.brain || !o.alive || o === user || o.role === 'impostor') return;
      if (Math.hypot(o.x - user.x, o.y - user.y) <= this.botSight(o) && canSee(this.grid, o, user, this.botSight(o))) {
        o.brain.suspect = user; o.brain.sawVent = true;
      }
    });
  }

  // Masum botların hafızası: kimi, ne zaman, nerede gördü (sadece kendi görüşü)
  botRemember(b, dt) {
    const br = b.brain;
    br.memT = (br.memT || 0) - dt;
    if (br.memT > 0) return;
    br.memT = 0.7 + Math.random() * 0.3;
    if (!br.seen) br.seen = new Map();
    const now = this.time.now;
    this.botVisible(b).forEach((o) => br.seen.set(o, { t: now, x: o.x, y: o.y }));
  }

  // Sabotaj kararı: kalabalığın yanındaysa IŞIKLAR (karanlıkta tek tek avla); öldürme beklemesi uzunsa
  // masumları dağıtmak için reaktör/O2 (tamir noktası bulunduğu yerden uzak olanı seçer)
  botSabotage(b, crewSeen) {
    if (this.sabCd > 0 || this.sabotage) return;
    let type = null;
    if (crewSeen.length >= 2 && b.cooldown <= 3) type = 'lights';
    else if (b.cooldown > 8 && Math.random() < 0.5) {
      const far = ['reactor', 'o2'].map((k) => [k, Math.hypot(SABOTAGES[k].fix.x - b.x, SABOTAGES[k].fix.y - b.y)]).sort((x, y) => y[1] - x[1]);
      type = far[0][0];
    }
    b.brain.react = 4 + Math.random() * 6;                          // her karede düşünmesin
    if (type) this.startSabotage(type);
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
    // Gerçek geçen süre: telefon kasınca oyun AĞIR ÇEKİME girmesin.
    const dt = Math.min(delta, 250) / 1000;
    this.netUpdate(dt);
    this.updateFx(dt, time);
    // Toplantıda herkes donar
    if (this.meeting) {
      if (!this._lastHud || this._lastHud.action !== null) {
        this._lastHud = { action: null };
        this.registry.set('hud', this._lastHud);
      }
      const lookDt = Math.min(delta, 250) / 1000;
      this.balls.forEach((b) => b.updateLooks(lookDt, time));
      return;
    }
    const ui = this.scene.get('UIScene');
    this.controls.joystick = ui && ui.joystick ? ui.joystick : null;
    if (this.taskOpen && !this.taskPanel.isOpen) { this.taskOpen = false; this.releaseControls(); }
    // HATA DÜZELTMESİ: eskiden görev paneli açılınca update() tamamen duruyordu; botlar, öldürme/sabotaj sayaçları
    // ve rapor kontrolü görev bitene kadar DONUYORDU. Artık dünya akmaya devam eder; sadece oyuncunun kendi hareketi,
    // sis, mini harita ve arayüz hesabı atlanır (panel açıkken zaten görünmüyorlar).
    const busy = !!this.taskOpen;
    if (busy) {
      if (!this._lastHud || this._lastHud.task !== true || this._lastHud.action !== null) {
        this._lastHud = { action: null, task: true };
        this.registry.set('hud', this._lastHud);
      }
    }
    const dir = busy ? { x: 0, y: 0 } : this.controls.update();
    this.updateBotTasks(dt);
    if (!this.over && !this.sandbox) { this.updateSabotage(dt); this.updateBotReports(dt); }
    if (this.meeting) return;

    if (!busy) {
      const stand = this.player.alive ? canStand : (x, y) => x > 0 && y > 0 && x < WORLD.w && y < WORLD.h;
      if (this.player.inTunnel) { this.updateTunnelInput(dir); }
      const moved = this.player.inTunnel ? false : this.player.move(dir, dt, stand);
      if (this.player.alive && !this.player.inTunnel && (dir.x || dir.y) && !moved) { this.stuckT = (this.stuckT || 0) + dt; if (this.stuckT > 0.5) { this.stuckT = 0; this.unstick(this.player); } } else this.stuckT = 0;
    }

    this.balls.forEach((b) => { if (b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt); });

    // Botlar: kare atlatma — düşük kalite / kalabalık odada daha seyrek
    // HATA DÜZELTMESİ: eskiden botlar her karede çalışsa bile süre "dt x atlama" sayılıyordu
    // (6 ve altı topta botlar 2 kat hızlı koşuyordu). Artık gerçekten geçen süre biriktirilir.
    if (!this.over) {
      this._botFrame = (this._botFrame || 0) + 1;
      this._botAcc = (this._botAcc || 0) + dt;
      const botSkip = (getQuality() === 'low' || this.balls.length > 12) ? 3 : 2;
      const runBots = (this._botFrame % botSkip) === 0 || this.balls.length <= 6;
      // AKICILIK: bot "düşünmesi" (yol bulma, görüş) 2-3 karede bir; YÜRÜMESİ ise her karede.
      // Eskiden yürüme de seyrekti, botlar ekranda 20-30 FPS'de zıplıyormuş gibi görünüyordu.
      if (runBots) {
        const botDt = Math.min(this._botAcc, 0.25); this._botAcc = 0;
        navFrameStart();   // bu karede yol bulmaya ayrılan süre (~3 ms) sıfırlanır; botlar sırayla yol alır, hepsi birden dondurmaz
        this.balls.forEach((b) => { if (b.brain && b.alive) b.botDir = this.botThink(b, botDt); });
      }
      this.balls.forEach((b) => {
        if (!b.brain || !b.alive || !b.botDir) return;
        const mv = b.move(b.botDir, dt, canStand);
        if (b.brain) b.brain.report(mv, dt);
      });
    }

    if (busy) {
      this.updateSight(dt); this.updateCull(dt);
      const lookDt = Math.min(delta, 250) / 1000;
      this.balls.forEach((b) => b.updateLooks(lookDt, time));
      return;
    }   // panel açık: oyuncu duruyor, sis/harita/arayüz yeniden hesaplanmaz

    this.fog.update(this.player.x, this.player.y - 16, this.visionRadius);
    this.updateSight(dt);
    this.updateCull(dt);

    // Arayüze bilgi ver — sadece değişince yaz (her kare registry event'i tetiklemeyi önler)
    const px = Math.round(this.player.x), py = Math.round(this.player.y);
    const lastPos = this._lastPlayerPos;
    if (!lastPos || lastPos.x !== px || lastPos.y !== py) {
      this._lastPlayerPos = { x: px, y: py };
      this.registry.set('playerPos', this._lastPlayerPos);
    }
    const room = getRoomAt(this.player.x, this.player.y - 8);
    if (room !== this.registry.get('room')) this.registry.set('room', room);
    const hud = this.hudState();
    // Basit shallow karşılaştırma; sık değişen alanlar
    const lastHud = this._lastHud;
    if (!lastHud || lastHud.action !== hud.action || lastHud.ready !== hud.ready || lastHud.task !== hud.task ||
        lastHud.report !== hud.report || lastHud.sabotage !== hud.sabotage || lastHud.useLabel !== hud.useLabel ||
        lastHud.cooldown !== hud.cooldown || lastHud.tunnel !== hud.tunnel || lastHud.inGame !== hud.inGame ||
        lastHud.sabReady !== hud.sabReady || lastHud.cdFrac !== hud.cdFrac || lastHud.sabFrac !== hud.sabFrac ||
        lastHud.tunnelExit !== hud.tunnelExit) {
      this._lastHud = Object.assign({}, hud);
      this.registry.set('hud', hud);
    }
    this.updateMoods(hud);
    this.registry.set('taskArrow', this.arrowTarget());
    this.updateMinimap();
    // Göz/şapka güncellemesi: tek döngü (eski: her top kendi postupdate dinleyicisi)
    const lookDt = Math.min(delta, 250) / 1000;
    this.balls.forEach((b) => b.updateLooks(lookDt, time));
  }

  // Görev/panel kapanınca: tüm sahnelerde basılı tuşları ve joystick'i bırak (takılı kalıp yürüyememe hatası)
  releaseControls() {
    this.game.scene.getScenes(true).forEach((sc) => {
      try { sc.input.keyboard.resetKeys(); } catch (e) { /* yoksay */ }
      try {
        // Phaser pointer capture'ları temizle (görev paneli sonrası donma)
        const mgr = sc.input && sc.input.manager;
        if (mgr && mgr.pointers) mgr.pointers.forEach((ptr) => { try { if (ptr && ptr.active) ptr.reset(); } catch (e2) {} });
      } catch (e) { /* yoksay */ }
    });
    const ui = this.scene.get('UIScene');
    if (ui && ui.joystick && ui.joystick.reset) ui.joystick.reset();
    try { if (this.input && this.input.keyboard) this.input.keyboard.resetKeys(); } catch (e) {}
    this.unstick(this.player);
  }

  // Bir şekilde eşyanın/duvarın içinde kaldıysa en yakın boş yere çek (yoksa hiç yürüyemez)
  unstick(b) {
    if (!b || !b.alive || canStand(b.x, b.y)) return;
    for (let r = 10; r <= 200; r += 10) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
        if (canStand(x, y)) { b.setPosition(x, y); return; }
      }
    }
  }

  // ---------------- PERFORMANS ----------------
  // Harita eşyaları: kamera dışındakiler HİÇ çizilmez; görüş alanının dışında (karanlıkta) kalan
  // eşyalar ve ışıklar da çizilmez (zaten sisin altında görünmüyorlar). 6 kez/sn kontrol edilir.
  setupCull() {
    const skip = new Set([this.fog && this.fog.image, this.fxLight].filter(Boolean));
    this.cullList = this.children.list.filter((o) => o.visible && !skip.has(o) && o.depth < 999000 &&
      (o.type === 'Image' || o.type === 'Sprite' || o.type === 'TileSprite' || o.type === 'Text') && o.getBounds &&
      !(o.width >= 3000 || o.height >= 3000))
      .map((o) => ({ o, b: o.getBounds(), far: o.depth > -7.5 }));
    this.cullT = 0;
    this.fpsLow = 0;
  }

  updateCull(dt) {
    this.cullT -= dt;
    if (this.cullT > 0 || !this.cullList) return;
    // Düşük kalitede daha seyrek cull (CPU tasarrufu)
    this.cullT = getQuality() === 'low' ? 0.28 : 0.16;
    const v = this.cameras.main.worldView, M = 160;
    const me = this.player, seeAll = !me.alive || !this.fog.enabled;
    const R = this.visionRadius + 260;
    this.cullList.forEach((c) => {
      if (!c.o.scene) return;
      const b = c.b;
      let on = b.right > v.x - M && b.x < v.right + M && b.bottom > v.y - M && b.y < v.bottom + M;
      if (on && c.far && !seeAll) {
        const nx = Math.max(b.x, Math.min(me.x, b.right)), ny = Math.max(b.y, Math.min(me.y, b.bottom));
        on = (nx - me.x) ** 2 + (ny - me.y) ** 2 < R * R;
      }
      if (c.o.visible !== on) c.o.setVisible(on);
    });
    // Otomatik kalite: oyun sürekli yavaşsa (30 kare/sn altı) bir kez düşük grafiğe geç
    const fps = this.game.loop.actualFps;
    this.fpsLow = fps < 30 ? this.fpsLow + 0.16 : Math.max(0, this.fpsLow - 0.32);
    if (this.fpsLow > 6 && getQuality() === 'high' && !this.autoLowDone) {
      this.autoLowDone = true;
      setQuality('low');
      this.toast(i18n.t('ui.autoLow'), '#ffd23f');
    }
  }

  // Görüş: duvar arkasındaki / görüş alanı dışındaki oyuncular ve cesetler hiç görünmez (yumuşak geçişle)
  updateSight(dt) {
    const me = this.player;
    const all = !me.alive || !this.fog.enabled;
    this.sightT = (this.sightT || 0) - dt;
    if (this.sightT <= 0) {
      this.sightT = getQuality() === 'low' ? 0.14 : 0.08;
      const r = this.visionRadius + 30;
      const see = (o) => all || canSee(this.grid, me, o, r);
      this.balls.forEach((b) => { if (!b.isMe && b.alive) b.seen = see(b); });
      // Hayaletler birbirini görür (ölü gerçek oyuncular; ölü botlar dolaşmadığı için gizli kalır)
      this.balls.forEach((b) => { if (!b.isMe && !b.alive) b.ghostSeen = !me.alive && !b.left && !b.brain && !b.isBot; });
      this.bodies.forEach((c) => { c.seen = see(c); });
    }
    const k = Math.min(1, dt * 12);
    const fade = (o) => {
      const a = (o.sightA ?? 0) + ((o.seen ? 1 : 0) - (o.sightA ?? 0)) * k;
      o.sightA = a;
      o.setAlpha(a);
      o.setVisible(a > 0.02);
    };
    this.balls.forEach((b) => {
      if (!b.isMe && b.alive) fade(b);
      else if (!b.isMe && !b.alive && b.ghostSeen !== b.ghostShown) {
        b.ghostShown = b.ghostSeen;
        b.setVisible(!!b.ghostSeen).setAlpha(0.45);
        if (b.shadow) b.shadow.setVisible(false);
      }
    });
    this.bodies.forEach(fade);
  }

  // Yüz ifadeleri (sadece bu ekranda): katil/şerif hedefe kilitlenince kısık göz, ceset görünce şaşkın
  updateMoods(hud) {
    const me = this.player;
    if (!me.alive) return;
    if (hud.ready && (me.role === 'impostor' || me.role === 'sheriff') && (!me.mood || me.mood.style === 'squint')) me.setMood('squint', 0.3);
    const body = this.nearestBody(me, 520);
    if (body && !body.seen) { body.seen = true; me.setMood('wide', 1.8); }
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
    const st = { action: null, ready: false, cooldown: 0, tunnel: false, task: false, useLabel: 'use', report: false, sabotage: false, inGame: false };
    if (this.over || this.meeting) return st;
    st.inGame = true;
    st.task = !this.taskOpen && !!this.nearTask();
    if (st.task) st.useLabel = 'use';
    if (!this.taskOpen && this.canFix()) { st.task = true; st.useLabel = 'fix'; }
    else if (!st.task && !this.taskOpen && this.nearEmergency() && this.emergencyLeft > 0) { st.task = true; st.useLabel = 'meeting'; }
    if (!me.alive) return st;
    st.report = !me.inTunnel && !!this.nearestBody(me, REPORT_RANGE);
    if (me.role === 'impostor') { st.sabotage = true; st.sabReady = !this.sabotage && this.sabCd <= 0; st.sabCd = this.sabotage ? 0 : Math.max(0, Math.ceil(this.sabCd)); st.sabFrac = Math.min(1, Math.max(0, this.sabCd) / 30); }
    if (me.role === 'impostor') {
      st.action = 'kill';
      st.ready = !me.inTunnel && me.cooldown <= 0 && !!findTarget(this.grid, me, this.balls, KILL_RANGE);
      st.tunnel = !!me.inTunnel || !!nearestTunnel(TUNNELS, me.x, me.y);
      st.tunnelExit = !!me.inTunnel;
    } else if (me.role === 'sheriff') {
      st.action = 'shoot';
      st.ready = me.cooldown <= 0 && !!findTarget(this.grid, me, this.balls, SHOOT_RANGE);
    }
    st.cooldown = Math.ceil(me.cooldown);
    const cdMax = me.role === 'impostor' ? this.cfg.killCd : SHOOT_COOLDOWN;
    st.cdFrac = Math.min(1, me.cooldown / cdMax);
    return st;
  }
}

installExtras(GameScene);
installNet(GameScene);
installFx(GameScene);
installTunnel(GameScene);

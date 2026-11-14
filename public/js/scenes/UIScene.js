// ============================================================
// UIScene.js - Arayüz katmanı (HUD): metinler, rol, aksiyon butonları, joystick
// ============================================================
// 1080p çizim: Bu sahnenin kamerası RES.k kadar yakınlaştırılır, böylece buradaki
// tüm konumlar/boyutlar ekranın CSS pikseliyle yazılır (16px = telefonda 16px).
// Yazılar resolution: RES.k ile çizilir ki bulanık olmasın.
// GameScene her karede registry 'hud' = { action, ready, cooldown, tunnel } yazar.
import { isMobile } from '../systems/Device.js';
import { gameSettings } from '../ui/GameSettings.js';
import { i18n } from '../systems/I18n.js';
import { Joystick } from '../systems/Joystick.js';
import { RES } from '../systems/Resolution.js';
import { ROLE_COLORS } from '../systems/Roles.js';
import { backToLobby } from '../systems/GameFlow.js';

const ICONS = { kill: '🔪', shoot: '🎯', tunnel: '🕳', report: '📢', sabotage: '☢', use: '✋', fix: '🔧', meeting: '🚨' };
const ACTION_COLORS = { kill: 0xc0262d, shoot: 0x2d6fd6, tunnel: 0x5f7a2a, report: 0xd6452f, sabotage: 0x8a1c22, use: 0xd9a400, fix: 0x2f9e5a, meeting: 0xc0262d };

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(RES.k);

    const small = Math.min(RES.cssW, RES.cssH) < 520;
    this.small = small;
    const res = Math.max(1, Math.min(4, RES.k));
    this.res = res;
    const style = this.baseStyle = {
      fontFamily: 'Arial', fontSize: small ? '14px' : '18px', color: '#ffffff',
      stroke: '#000', strokeThickness: 4, resolution: res
    };
    const lh = small ? 22 : 28;
    this.title = this.add.text(16, 12, '', { ...style, fontSize: small ? '16px' : '22px', fontStyle: 'bold' });
    this.help = this.add.text(16, 12 + lh + 4, '', style);
    this.pos = this.add.text(16, 12 + lh * 2 + 4, '', style).setVisible(!small);
    const y3 = small ? 12 + lh * 2 + 4 : 12 + lh * 3 + 4;
    this.roomText = this.add.text(16, y3, '', { ...style, fontSize: small ? '16px' : '20px', color: '#ffcc00' });
    this.roleText = this.add.text(16, y3 + lh + 4, '', { ...style, fontSize: small ? '18px' : '22px', fontStyle: 'bold' });
    this.goalText = this.add.text(16, y3 + lh * 2 + 10, '', { ...style, fontSize: small ? '13px' : '16px', wordWrap: { width: 300 } });

    // Bilgi paneli ve Rolleri göster kaldırıldı (kullanıcı isteği)
    this.infoOpen = false;
    this.info = this.add.container(0, small ? 40 : 48);
    this.info.add([this.title, this.help, this.pos, this.roomText, this.roleText, this.goalText]);
    this.info.setVisible(false);
    this.infoBtn = null;
    this.rolesBtn = null;

    // Sağ üst: Lobi butonu + tam ekran
    const btn = { ...style, strokeThickness: 0, backgroundColor: 'rgba(14,18,25,0.82)', padding: { x: 12, y: 8 } };
    this.lobbyBtn = this.add.text(0, 12, '', btn).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.lobbyBtn.on('pointerdown', (pointer, lx, ly, event) => event.stopPropagation()); // joystick almasın
    this.lobbyBtn.on('pointerup', () => gameSettings.open({ onLeave: () => backToLobby() }));

    // Joystick sadece dokunmatik cihazda (veya adres sonuna ?joystick=1 yazılırsa)
    const touch = isMobile() || /[?&]joystick=1/.test(location.search);   // oyuncunun seçtiği cihaz
    this.isTouch = touch;
    this.joystick = new Joystick(this, { enabled: touch });
    this.input.addPointer(2); // en fazla 3 parmak (joystick + aksiyon)

    this.fsBtn = null;
    if (touch && this.sys.game.device.fullscreen.available) {
      this.fsBtn = this.add.text(0, small ? 88 : 104, '⛶', { ...style, fontSize: '22px', backgroundColor: '#1d3a1d', padding: { x: 10, y: 4 } })
        .setOrigin(1, 0).setInteractive();
      this.fsBtn.on('pointerdown', (pointer, lx, ly, event) => event.stopPropagation());
      this.fsBtn.on('pointerup', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
      });
    }

    // Mobil: küçük "Joystik resetle" butonu (joystick takılırsa basılır)
    this.joyResetBtn = null;
    if (touch) {
      this.joyResetBtn = this.add.text(0, small ? 126 : 146, '', { ...style, fontSize: '12px', strokeThickness: 0, backgroundColor: 'rgba(40,60,90,0.85)', padding: { x: 8, y: 5 } })
        .setOrigin(1, 0).setInteractive().setDepth(600);
      this.joyResetBtn.on('pointerdown', (pointer, lx, ly, event) => event.stopPropagation());
      this.joyResetBtn.on('pointerup', () => this.resetControls());
    }

    // Sağ alt: aksiyon butonları (Öldür / Vur) ve Tünel
    const R = (small ? 46 : 54) * (isMobile() ? 1.2 : 1);   // mobilde büyük butonlar (parmak)
    this.actionBtn = this.makeRoundButton(R, () => this.gameScene().doAction());
    this.tunnelBtn = this.makeRoundButton(R * 0.78, () => this.gameScene().useTunnel());
    this.useBtn = this.makeRoundButton(R * 0.78, () => this.gameScene().interact());
    this.reportBtn = this.makeRoundButton(R * 0.86, () => this.gameScene().reportNearest());
    this.sabBtn = this.makeRoundButton(R * 0.78, () => this.gameScene().openSabotage());

    // Sabotaj uyarı bandı (üst orta, görev çubuğunun altında)
    this.sabText = this.add.text(0, 0, '', { ...style, fontSize: small ? '16px' : '22px', fontStyle: 'bold', color: '#ff5a4f', strokeThickness: 6, align: 'center' })
      .setOrigin(0.5, 0).setDepth(1500);

    // Görev listesi (sol) ve görev ilerleme çubuğu (üst orta)
    this.taskText = this.add.text(16, 0, '', { ...style, fontSize: small ? '13px' : '16px', color: '#ffd23f', lineSpacing: 2 });
    this.taskBg = this.add.graphics().setDepth(-1);
    this.taskText.setDepth(1);
    this.applyInfo();
    // Görev oku (görev ekranda değilse kenarda yönü gösterir)
    this.arrow = this.add.container(0, 0).setDepth(450).setVisible(false);
    const ag = this.add.graphics();
    ag.fillStyle(0x000000, 0.45).fillTriangle(-16, -14, 24, 0, -16, 14);
    ag.fillStyle(0xffd23f, 1).fillTriangle(-13, -11, 20, 0, -13, 11);
    this.arrowG = ag;
    this.arrowTxt = this.add.text(0, 0, '', { ...style, fontSize: '13px', fontStyle: 'bold', color: '#ffd23f' }).setOrigin(0.5);
    this.arrow.add([ag]);
    this.arrowLabel = this.arrowTxt;
    this.barG = this.add.graphics().setDepth(400);
    this.barText = this.add.text(0, 0, '', { ...style, fontSize: small ? '12px' : '14px', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(401);

    // Ortada kısa bildirimler (öldün, şerif yanlış kişiyi vurdu...)
    this.toastText = this.add.text(0, 0, '', {
      ...style, fontSize: small ? '18px' : '24px', fontStyle: 'bold', align: 'center', strokeThickness: 6,
      wordWrap: { width: Math.min(560, RES.cssW - 40) }
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(2000);
    this.onToast = (text, color) => this.showToast(text, color);
    this.game.events.on('toast', this.onToast);

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.refreshTexts();
    i18n.onChange(this.refreshTexts = this.refreshTexts.bind(this));
    this.events.once('shutdown', () => {
      i18n.offChange(this.refreshTexts);
      this.scale.off('resize', this.layout, this);
      this.game.events.off('toast', this.onToast);
    });
  }

  gameScene() { return this.scene.get('GameScene'); }

  // Joystik resetle: joystick, basılı tuşlar ve hareket kilidi sıfırlanır
  resetControls() {
    if (this.joystick) this.joystick.reset();
    try { this.input.keyboard.resetKeys(); } catch (e) { /* yoksay */ }
    const g = this.gameScene();
    if (g && g.releaseControls) g.releaseControls();
    this.game.events.emit('toast', i18n.t('ui.joyResetDone'), '#6be38a');
  }

  toggleInfo() {
    this.infoOpen = !this.infoOpen;
    try { localStorage.setItem('cfs.hudInfo', this.infoOpen ? '1' : '0'); } catch (e) { /* yoksay */ }
    this.applyInfo(true);
  }

  // Bilgi paneli: soldan kayarak açılır, sola kayıp solarak kapanır
  applyInfo(animate = false) {
    const y0 = this.small ? 40 : 48;
    this.tweens.killTweensOf(this.info);
    if (!animate) {
      this.info.setVisible(this.infoOpen).setAlpha(1).setPosition(0, y0);
    } else if (this.infoOpen) {
      this.info.setVisible(true).setAlpha(0).setPosition(-40, y0 - 10);
      this.tweens.add({ targets: this.info, alpha: 1, x: 0, y: y0, duration: 260, ease: 'Cubic.easeOut' });
    } else {
      this.tweens.add({ targets: this.info, alpha: 0, x: -40, duration: 200, ease: 'Cubic.easeIn', onComplete: () => this.info.setVisible(false) });
    }
    if (this.infoBtn) this.infoBtn.setText(`${this.infoOpen ? '▲' : '▼'} ${i18n.t('ui.info')} (H)`);
  }

  makeRoundButton(r, onPress) {
    const c = this.add.container(0, 0).setDepth(500);
    const g = this.add.graphics();
    const icon = this.add.text(0, -r * 0.16, '', { fontSize: Math.round(r * 0.62) + 'px', resolution: this.res }).setOrigin(0.5);
    const label = this.add.text(0, r * 0.44, '', { ...this.baseStyle, fontSize: Math.round(r * 0.24) + 'px', fontStyle: 'bold', strokeThickness: 3 }).setOrigin(0.5);
    const cd = this.add.text(0, -r * 0.1, '', { ...this.baseStyle, fontSize: Math.round(r * 0.62) + 'px', fontStyle: 'bold', strokeThickness: 5 }).setOrigin(0.5);
    c.add([g, icon, label, cd]);
    c.setSize(r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    c.input.cursor = 'pointer';                       // fareyle de basılır
    c.on('pointerover', () => { c.hover = true; });
    c.on('pointerout', () => { c.hover = false; });
    c.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      if (!c.ready) { this.tweens.add({ targets: c, angle: { from: -6, to: 0 }, duration: 180, ease: 'Back.easeOut' }); return; }
      this.tweens.add({ targets: c, scale: { from: 0.86, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      onPress();
    });
    c.g = g; c.icon = icon; c.label = label; c.cd = cd; c.r = r; c.bg = g;
    c.setVisible(false);
    return c;
  }

  drawButton(b, color, ready, frac) {
    const g = b.g, r = b.r;
    const key = `${color}|${ready}|${Math.round((frac || 0) * 60)}`;
    if (key === b.lastKey) return;
    b.lastKey = key;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillCircle(3, 5, r);                                  // gölge
    const base = Phaser.Display.Color.IntegerToColor(ready ? color : 0x2a3039);
    const dark = base.clone().darken(30).color, light = base.clone().lighten(18).color;
    g.fillStyle(dark, 0.95).fillCircle(0, 0, r);
    g.fillStyle(base.color, 0.95).fillCircle(0, -2, r - 5);
    g.fillStyle(light, 0.55).fillEllipse(0, -r * 0.45, r * 1.3, r * 0.55);           // üst parlama
    g.lineStyle(3, 0xffffff, ready ? 0.95 : 0.35).strokeCircle(0, 0, r - 1.5);
    if (frac > 0) {                                                                   // bekleme süresi: kararan dilim
      g.fillStyle(0x000000, 0.55);
      g.slice(0, 0, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false).fillPath();
      g.lineStyle(4, 0xffd23f, 0.95);
      g.beginPath(); g.arc(0, 0, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false); g.strokePath();
    }
  }

  // Buton rolüne aitse HEP görünür; kullanılamıyorsa %50 şeffaf ve basılmaz (kaybolmaz)
  setButton(b, visible, text, color, ready, cooldown, frac = 0, iconKey = '') {
    if (visible && !b.visible) {
      b.setVisible(true).setScale(0.3);
      b.appearing = true;
      this.tweens.add({ targets: b, scale: 1, duration: 260, ease: 'Back.easeOut', onComplete: () => { b.appearing = false; } });
    } else if (!visible) b.setVisible(false);
    if (!visible) return;
    if (ready && !b.wasReady && !b.appearing) this.tweens.add({ targets: b, scale: { from: 1.15, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    b.wasReady = ready;
    b.ready = !!ready && !(cooldown > 0);
    const target = b.ready ? (b.hover ? 1 : 0.96) : 0.5;
    b.setAlpha(b.alpha + (target - b.alpha) * 0.25);
    this.drawButton(b, color, ready, cooldown > 0 ? frac : 0);
    b.label.setText(text);
    b.icon.setText(ICONS[iconKey] || '').setAlpha(cooldown > 0 ? 0.25 : 1);
    b.cd.setText(cooldown > 0 ? String(cooldown) : '');
    b.label.setAlpha(1);
  }

  showToast(text, color) {
    const y = RES.cssH * 0.22;
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(text).setColor(color || '#ffffff').setAlpha(0).setScale(0.6).setY(y - 24);
    this.tweens.add({ targets: this.toastText, alpha: 1, scale: 1, y, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toastText, alpha: 0, y: y - 18, delay: 2600, duration: 500, ease: 'Cubic.easeIn' });
  }

  update() {
    const online = !!this.registry.get('online');
    const p = this.registry.get('playerPos');
    if (p) this.pos.setText(i18n.t('ui.position', p));
    const room = this.registry.get('room');
    this.roomText.setText(room ? `${i18n.t('ui.room')}: ${i18n.t('rooms.' + room)}` : '');
    const h = this.registry.get('hud') || {};
    const label = h.action === 'kill' ? i18n.t('actions.kill') : h.action === 'shoot' ? i18n.t('actions.shoot') : '';
    this.setButton(this.actionBtn, !!h.action, label, ACTION_COLORS[h.action], h.ready, h.cooldown, h.cdFrac, h.action);
    this.setButton(this.tunnelBtn, h.action === 'kill', i18n.t(h.tunnelExit ? 'actions.tunnelExit' : 'actions.tunnel'), ACTION_COLORS.tunnel, h.tunnel, 0, 0, 'tunnel');
    const ul = h.useLabel || 'use';
    const inGame = !!h.inGame, isDead = !!this.registry.get('dead');
    // KULLAN: hep görünür (görev yanındayken parlar). Katilde tünelin solunda, şerifte tünelin yerinde.
    this.setButton(this.useBtn, inGame, i18n.t('actions.' + ul), ACTION_COLORS[ul], !!h.task, 0, 0, ul);
    if (h.action === 'kill') this.useBtn.setPosition(this.tunnelBtn.x - this.tunnelBtn.r - 16 - this.useBtn.r, this.tunnelBtn.y);
    else this.useBtn.setPosition(h.action ? this.tunnelBtn.x : this.actionBtn.x, h.action ? this.tunnelBtn.y : this.actionBtn.y);
    // BİLDİR: canlıyken hep görünür, cesede yakınken parlar
    this.setButton(this.reportBtn, inGame && !isDead, i18n.t('actions.report'), ACTION_COLORS.report, !!h.report, 0, 0, 'report');
    this.reportBtn.setPosition(this.actionBtn.x, this.actionBtn.y - this.actionBtn.r - 16 - this.reportBtn.r);
    // SABOTAJ: sadece Katil, tünel butonunun üstünde
    this.setButton(this.sabBtn, !!h.sabotage, i18n.t('actions.sabotage'), ACTION_COLORS.sabotage, !!h.sabReady, h.sabCd || 0, h.sabFrac || 0, 'sabotage');
    this.drawArrow();
    this.sabBtn.setPosition(this.tunnelBtn.x, this.tunnelBtn.y - this.tunnelBtn.r - 16 - this.sabBtn.r);
    if (h.report && h.sabotage) this.reportBtn.setPosition(this.sabBtn.x - this.sabBtn.r - 16 - this.reportBtn.r, this.sabBtn.y);
    const sb = this.registry.get('sabBanner');
    const bt = sb ? sb.text : '';
    if (bt !== this.lastBanner) { this.lastBanner = bt; this.sabText.setText(bt); }
    this.sabText.setAlpha(sb ? 0.65 + 0.35 * Math.abs(Math.sin(this.time.now / 300)) : 0);
    this.drawTasks();
    const dead = !!this.registry.get('dead');
    if (dead !== this.wasDead) { this.wasDead = dead; this.refreshTexts(); }
  }

  drawTasks() {
    const tasks = this.registry.get('tasks') || [];
    const pr = this.registry.get('taskProgress') || { done: 0, total: 0 };
    const ty = 48; // bilgi paneli kaldırıldığı için sabit üst boşluk
    this.taskText.setPosition(26, ty + 8);
    const fake = !!this.registry.get('fakeTasks');
    const lines = tasks.length ? [i18n.t(fake ? 'tasks.fakeTitle' : 'tasks.title')].concat(tasks.map((t) => `${t.done ? '✔' : t.step ? '①' : '•'} ${i18n.t('tasks.' + t.type)} (${i18n.t('rooms.' + t.room)})`)) : [];
    const txt = lines.join('\n');
    if (txt !== this.lastTaskTxt || ty !== this.lastTaskY) {
      this.lastTaskTxt = txt; this.lastTaskY = ty; this.taskText.setText(txt);
      this.taskText.setColor(fake ? '#ff8a80' : '#ffd23f');
      this.taskBg.clear();
      if (txt) this.taskBg.fillStyle(0x0e1219, 0.72).fillRoundedRect(16, ty, this.taskText.width + 22, this.taskText.height + 16, 10);
    }
    const W = RES.cssW, bw = this.small ? 170 : 260, bh = 16, x = (W - bw) / 2, y = 14;
    const f = pr.total > 0 ? Math.min(1, pr.done / pr.total) : 0;
    this.barG.clear();
    if (pr.total > 0) {
      this.barG.fillStyle(0x000000, 0.6).fillRoundedRect(x - 3, y - 3, bw + 6, bh + 6, 8);
      this.barG.fillStyle(0x1f2a1f, 1).fillRoundedRect(x, y, bw, bh, 6);
      if (f > 0) this.barG.fillStyle(0x4cd06a, 1).fillRoundedRect(x, y, Math.max(8, bw * f), bh, 6);
    }
    this.barText.setPosition(W / 2, y + bh + 4).setText(pr.total > 0 ? `${i18n.t('tasks.progress')} ${Math.round(f * 100)}%` : '');
  }

  // Görev/sabotaj noktası ekranda değilse kenarda yönünü gösteren ok
  drawArrow() {
    const a = this.registry.get('taskArrow');
    if (!a) { this.arrow.setVisible(false); return; }
    const W = RES.cssW, H = RES.cssH;
    const rx = W / 2 - 70, ry = H / 2 - 70;
    const x = W / 2 + Math.cos(a.ang) * rx, y = H / 2 + Math.sin(a.ang) * ry;
    const bob = Math.sin(this.time.now / 180) * 5;
    this.arrow.setVisible(true).setPosition(x + Math.cos(a.ang) * bob, y + Math.sin(a.ang) * bob).setRotation(a.ang);
    if (a.color !== this.arrowColor) {
      this.arrowColor = a.color;
      this.arrowG.clear();
      this.arrowG.fillStyle(0x000000, 0.45).fillTriangle(-16, -14, 24, 0, -16, 14);
      this.arrowG.fillStyle(a.color, 1).fillTriangle(-13, -11, 20, 0, -13, 11);
    }
  }

  layout() {
    this.cameras.main.setZoom(RES.k);
    const W = RES.cssW, H = RES.cssH;
    this.lobbyBtn.x = W - 16;
    if (this.fsBtn) this.fsBtn.x = W - 16;
    if (this.joyResetBtn) this.joyResetBtn.x = W - 16;
    const a = this.actionBtn, t = this.tunnelBtn;
    a.setPosition(W - 24 - a.r, H - 24 - a.r);
    t.setPosition(a.x - a.r - 18 - t.r, H - 24 - t.r);
    this.toastText.setPosition(W / 2, H * 0.22);
    this.sabText.setPosition(W / 2, this.small ? 50 : 62);
  }

  refreshTexts() {
    this.title.setText(i18n.t('game.title'));
    this.applyInfo();
    this.help.setText(this.isTouch ? i18n.t('ui.controlsMobile') : i18n.t('ui.controlsPc'));
    this.lobbyBtn.setText('⚙ ' + i18n.t('ui.settings'));
    if (this.joyResetBtn) this.joyResetBtn.setText('🎮 ' + i18n.t('ui.joyReset'));
    const role = this.registry.get('role');
    const dead = !!this.registry.get('dead');
    if (role) {
      this.roleText.setText(`${i18n.t('ui.yourRole')}: ${i18n.t('roles.' + role).toUpperCase()}${dead ? ' · ' + i18n.t('ui.ghost').toUpperCase() : ''}`)
        .setColor(ROLE_COLORS[role]);
      this.goalText.setText(dead ? i18n.t('goals.ghost') : i18n.t('goals.' + role));
    }
  }
}

// ============================================================
// LobbyScene.js - Yürünen lobi: sığınağın DIŞINDA düz bir çimenlik
// ============================================================
// Sığınağın içi görünmez. Üstte sığınağın giriş kapısı (BAŞLAT burada), solda BM bayraklı
// direk: yanına gidip E'ye basınca bayrak seçilir (dolu bayraklar seçilemez).
// Oyuncu topuyla gezer; botlar açıksa onlar da dolaşır (kimseye dokunmazlar).
// Ayar/bayrak/başlat butonları HTML'de (ui/Lobby.js). Lobi değişince
// GameFlow -> applyState(state) çağırır.
// Kamera: dünya kamerası + arayüz kamerası (joystick için, CSS pikseli koordinat).
import { i18n } from '../systems/I18n.js';
import { InputController } from '../systems/InputController.js';
import { Joystick } from '../systems/Joystick.js';
import { CountryBall } from '../entities/CountryBall.js';
import { RES } from '../systems/Resolution.js';
import { world } from '../map/BunkerMap.js';
import { paintGrassTile, paintBunkerDoor, paintStartPad } from '../map/MapPainter.js';
import { PROP_IMG } from '../map/PropImages.js';
import { startFromLobby, openLobbyFlagPicker } from '../systems/GameFlow.js';
import { net } from '../systems/Net.js';
import { flagPicker } from '../ui/FlagPicker.js';

// ---------------- Lobi alanı (kendi küçük dünyası) ----------------
export const LOBBY = { w: 2200, h: 1400 };
const FIELD = { x: 160, y: 300, w: 1880, h: 960 };          // yürünebilir çimen
const DOOR = { x: 1100, y: 300 };                            // sığınak kapısının ortası (alanın üst kenarı)
const START = { x: 1100, y: 420, r: 190 };                   // BAŞLAT bölgesi
const POLE = { x: 470, y: 640, r: 170 };                     // BM direği (bayrak seç)
const FOOT_W = 26, FOOT_D = 22;
const SOLIDS = [                                             // çarpışma: ağaçlar, kayalar, kum torbaları, direk
  { x: POLE.x, y: POLE.y, r: 26 },
  ...[[300, 420], [1900, 430], [280, 1150], [1920, 1140], [760, 1180], [1460, 1190]].map(([x, y]) => ({ x, y, r: 36, tree: true })),
  ...[[1600, 700], [700, 960]].map(([x, y]) => ({ x, y, r: 30, rock: true }))
];
const SAND = [{ x: 820, y: 360, w: 120, h: 44 }, { x: 1260, y: 360, w: 120, h: 44 }];
function lobbyStand(x, y) {
  const x0 = x - FOOT_W, x1 = x + FOOT_W, y0 = y - FOOT_D;
  if (x0 < FIELD.x || x1 > FIELD.x + FIELD.w || y0 < FIELD.y + 40 || y > FIELD.y + FIELD.h) return false;
  for (const s of SOLIDS) { const nx = Math.max(x0, Math.min(s.x, x1)), ny = Math.max(y0, Math.min(s.y, y)); if ((nx - s.x) ** 2 + (ny - s.y) ** 2 < s.r * s.r) return false; }
  for (const r of SAND) if (x1 > r.x && x0 < r.x + r.w && y > r.y && y0 < r.y + r.h) return false;
  return true;
}
const near = (p, z) => (p.x - z.x) ** 2 + (p.y - z.y) ** 2 <= z.r * z.r;
function lobbySpawn(i) {
  const cols = 5, col = i % cols, row = Math.floor(i / cols);
  return { x: 1100 + (col - 2) * 120, y: 820 + row * 110 };
}

export class LobbyScene extends Phaser.Scene {
  constructor() { super('LobbyScene'); }

  create(data) {
    const state = data || {};
    world.sealed = false;   // lobi bomba ÖNCESİ: dışarısı açık
    this.uiObjects = [];
    this.drawRoom();

    this.lobbyStand = lobbyStand;
    const sp = lobbySpawn(0);
    this.player = new CountryBall(this, sp.x, sp.y, state.myFlag || 'TR', { isMe: true });
    this.player.showTag(i18n.t('ui.you'), '#ffffff');
    this.bots = [];
    this.online = !!state.online;
    this.remotes = new Map();
    this.posT = 0;
    if (this.online) {
      // Çevrimiçi oda: diğer oyuncular ağdan gelir, botlar yok
      const onRelay = (m) => { const d = m.d || {}; if (d.k === 'lp') { const b = this.remotes.get(m.from); if (b) b.net = { x: d.x, y: d.y, f: d.f, m: d.m }; } };
      net.on('relay', onRelay);
      this.events.once('shutdown', () => net.off('relay', onRelay));
      this.applyRoom(state.room);
    } else {
      this.applyState(state);
    }

    this.controls = new InputController(this, null);
    this.inZone = false;
    this.inFlag = false;
    this.input.keyboard.on('keydown-E', () => { if (this.inFlag) openLobbyFlagPicker(); else if (this.inZone) startFromLobby(); });
    this.input.keyboard.on('keydown-ENTER', () => { if (this.inZone) startFromLobby(); });
    this.events.once('shutdown', () => flagPicker.close());

    // Dünya kamerası
    const cam = this.cameras.main;
    cam.setBounds(0, 0, LOBBY.w, LOBBY.h);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 40);
    this.applyZoom();

    // Arayüz kamerası (joystick): CSS pikseli koordinat
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setZoom(RES.k);
    const touch = this.sys.game.device.input.touch || /[?&]joystick=1/.test(location.search);
    this.joystick = new Joystick(this, { enabled: touch, camera: this.uiCam });
    this.uiObjects.push(this.joystick.base, this.joystick.thumb);
    this.input.addPointer(2);
    this.controls.joystick = this.joystick;
    this.syncCameras();

    this.scale.on('resize', this.onResize, this);
    this.onLang = () => this.refreshTexts();
    i18n.onChange(this.onLang);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      i18n.offChange(this.onLang);
    });
  }

  onResize() {
    this.applyZoom();
    this.uiCam.setSize(this.scale.width, this.scale.height).setZoom(RES.k);
  }

  applyZoom() {
    this.cameras.main.setZoom(Phaser.Math.Clamp(RES.cssH / 1000, 0.5, 1.2) * RES.k);
  }

  // Her kamera sadece kendi nesnelerini çizsin
  syncCameras() {
    const ui = new Set(this.uiObjects);
    this.cameras.main.ignore(this.uiObjects);
    this.uiCam.ignore(this.children.list.filter((o) => !ui.has(o)));
  }

  drawRoom() {
    const s = this;
    const tex = (k, c) => { if (!s.textures.exists(k)) s.textures.addCanvas(k, typeof c === 'function' ? c() : c); return k; };
    const fit = (o, k) => { const sc = 1 / (s.textures.get(k).getSourceImage()._s || 1); if (o.setTileScale) o.setTileScale(sc, sc); else o.setScale(sc); return o; };
    // Gökyüzü yok: her yer çimen, kenarlarda koyu orman
    fit(s.add.tileSprite(0, 0, LOBBY.w, LOBBY.h, tex('lobbygrass', paintGrassTile)).setOrigin(0).setDepth(-20), 'lobbygrass');
    const edge = s.add.graphics().setDepth(-19);
    edge.fillStyle(0x0f2a12, 0.55); edge.fillRect(0, 0, LOBBY.w, FIELD.y - 30); edge.fillRect(0, FIELD.y + FIELD.h + 30, LOBBY.w, LOBBY.h);
    edge.fillRect(0, 0, FIELD.x - 30, LOBBY.h); edge.fillRect(FIELD.x + FIELD.w + 30, 0, LOBBY.w, LOBBY.h);
    // Alanın etrafında ağaç sırası (dışarısı orman)
    const tree = PROP_IMG.agac;
    if (tree) {
      if (!s.textures.exists('lobbytree')) s.textures.addImage('lobbytree', tree);
      const ring = [];
      for (let x = 60; x < LOBBY.w; x += 150) { ring.push([x, FIELD.y - 40]); ring.push([x + 70, FIELD.y + FIELD.h + 150]); }
      for (let y = FIELD.y + 60; y < FIELD.y + FIELD.h + 100; y += 150) { ring.push([FIELD.x - 70, y]); ring.push([FIELD.x + FIELD.w + 80, y]); }
      ring.forEach(([x, y], i) => { if (Math.abs(x - DOOR.x) < 330 && y < FIELD.y) return; const sc = 0.55 + ((i * 37) % 10) / 30; s.add.image(x, y, 'lobbytree').setOrigin(0.5, 1).setScale(sc).setDepth(y); });
      SOLIDS.filter((o) => o.tree).forEach((o) => s.add.image(o.x, o.y + 20, 'lobbytree').setOrigin(0.5, 1).setScale(0.6).setDepth(o.y));
    }
    if (PROP_IMG.kaya) { if (!s.textures.exists('lobbyrock')) s.textures.addImage('lobbyrock', PROP_IMG.kaya); SOLIDS.filter((o) => o.rock).forEach((o) => s.add.image(o.x, o.y + 18, 'lobbyrock').setOrigin(0.5, 1).setScale(0.18).setDepth(o.y)); }
    if (PROP_IMG.kum) { if (!s.textures.exists('lobbysand')) s.textures.addImage('lobbysand', PROP_IMG.kum); SAND.forEach((r) => s.add.image(r.x + r.w / 2, r.y + r.h + 8, 'lobbysand').setOrigin(0.5, 1).setScale(r.w * 1.1 / 512).setDepth(r.y + r.h)); }
    // Sığınak girişi: tepeye gömülü beton yapı + kapı
    const bunker = s.add.graphics().setDepth(-6.5);
    bunker.fillStyle(0x2c3a24, 1).fillEllipse(DOOR.x, DOOR.y - 60, 900, 260);           // toprak tümsek
    bunker.fillStyle(0x3a4a2e, 1).fillEllipse(DOOR.x, DOOR.y - 80, 820, 200);
    bunker.fillStyle(0x5b636c, 1).fillRoundedRect(DOOR.x - 260, DOOR.y - 150, 520, 150, 18);  // beton cephe
    bunker.fillStyle(0x7b848e, 1).fillRoundedRect(DOOR.x - 260, DOOR.y - 150, 520, 26, { tl: 18, tr: 18, bl: 0, br: 0 });
    for (let i = 0; i < 12; i++) bunker.fillStyle(i % 2 ? 0x151719 : 0xd9a400, 1).fillRect(DOOR.x - 250 + i * 41.6, DOOR.y - 18, 41.6, 14);
    const doorKey = tex('lobbydoor', paintBunkerDoor);
    fit(s.add.image(DOOR.x, DOOR.y - 12, doorKey).setOrigin(0.5, 1).setDepth(-6), doorKey);
    this.doorSign = s.add.text(DOOR.x, DOOR.y - 175, '☢ BUNKER-07 ☢', { fontFamily: 'Arial Black, Arial', fontSize: '28px', color: '#ffd23f', stroke: '#000', strokeThickness: 6, resolution: 2 }).setOrigin(0.5).setDepth(-5);
    const padKey = tex('lobbypad', () => paintStartPad(START.r));
    fit(s.add.image(START.x - START.r - 10, START.y - START.r - 10, padKey).setOrigin(0).setDepth(-7), padKey);
    // Toprak yol: kapıdan aşağı
    const path = s.add.graphics().setDepth(-8);
    path.fillStyle(0x7a6a4e, 0.55).fillRoundedRect(DOOR.x - 90, DOOR.y, 180, 560, 40);
    // BM direği: mavi bayrak + beyaz amblem, dalgalanır
    const pole = s.add.graphics().setDepth(POLE.y);
    pole.fillStyle(0x000000, 0.3).fillEllipse(POLE.x + 10, POLE.y + 6, 90, 26);
    pole.fillStyle(0x6b737c, 1).fillRoundedRect(POLE.x - 26, POLE.y - 14, 52, 22, 6);
    pole.fillStyle(0xd7dde3, 1).fillRect(POLE.x - 5, POLE.y - 330, 10, 320);
    pole.fillStyle(0xffd23f, 1).fillCircle(POLE.x, POLE.y - 334, 9);
    this.unFlag = s.add.container(POLE.x + 5, POLE.y - 320).setDepth(POLE.y + 1);
    const fg = s.add.graphics();
    fg.fillStyle(0x5b92e5, 1).fillRect(0, 0, 150, 96);
    fg.lineStyle(5, 0xffffff, 1).strokeCircle(75, 48, 26);
    fg.lineStyle(3, 0xffffff, 1).strokeCircle(75, 48, 14).lineBetween(49, 48, 101, 48).lineBetween(75, 22, 75, 74);
    fg.lineStyle(4, 0xffffff, 0.9); fg.beginPath(); fg.arc(75, 50, 36, Math.PI * 0.62, Math.PI * 1.15); fg.strokePath(); fg.beginPath(); fg.arc(75, 50, 36, -Math.PI * 0.15, Math.PI * 0.38); fg.strokePath();
    this.unFlag.add(fg);
    this.tweens.add({ targets: this.unFlag, scaleX: 0.9, angle: 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.poleRing = s.add.ellipse(POLE.x, POLE.y + 4, 260, 110, 0x5b92e5, 0.18).setStrokeStyle(4, 0x9cc4ff, 0.8).setDepth(-7);
    this.tweens.add({ targets: this.poleRing, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });
    const style = { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 6, align: 'center', resolution: Math.min(4, RES.k * 1.5) };
    this.poleHint = s.add.text(POLE.x, POLE.y - 390, '', { ...style, color: '#cfe3ff' }).setOrigin(0.5).setDepth(5000);
    this.hint = s.add.text(START.x, START.y - 230, '', style).setOrigin(0.5).setDepth(5000);
  }

  refreshTexts() {
    if (this.hint) this.hint.setText(i18n.t(this.inZone ? (this.online && !net.isHost ? 'online.waitHost' : 'lobby.pressStart') : 'lobby.goToDoor'));
    if (this.poleHint) this.poleHint.setText(i18n.t(this.inFlag ? 'lobby.poleHintNear' : 'lobby.poleHint'));
    if (this.player) this.player.showTag(i18n.t('ui.you'), '#ffffff');
  }

  // Çevrimiçi oda: oyuncu listesi değişti (gelen/giden/bayrak)
  applyRoom(room) {
    if (!room) return;
    const me = room.players.find((p) => p.id === net.id);
    if (me && me.flag !== this.player.flag) this.player.setFlag(me.flag);
    const want = new Map(room.players.filter((p) => p.id !== net.id).map((p) => [p.id, p]));
    this.remotes.forEach((b, id) => { if (!want.has(id)) { b.destroy(); this.remotes.delete(id); } });
    let i = 1;
    want.forEach((p, id) => {
      let b = this.remotes.get(id);
      if (!b) {
        const sp = lobbySpawn(i);
        b = new CountryBall(this, sp.x, sp.y, p.flag, {});
        b.net = { x: sp.x, y: sp.y, f: 0, m: 0 };
        this.remotes.set(id, b);
      } else if (b.flag !== p.flag) b.setFlag(p.flag);
      b.showTag(p.name, '#ffffff');
      i++;
    });
    if (this.uiCam) this.syncCameras();
  }

  // Bayrak / bot listesi değişti
  applyState(state) {
    if (state.myFlag && this.player) this.player.setFlag(state.myFlag);
    const want = state.botFlags || [];
    // Artık listede olmayan botları kaldır, yenileri ekle
    this.bots = this.bots.filter((b) => {
      if (want.includes(b.flag)) return true;
      b.destroy();
      return false;
    });
    want.forEach((flag) => {
      if (this.bots.some((b) => b.flag === flag)) return;
      const p = lobbySpawn(this.bots.length + 1);
      const b = new CountryBall(this, p.x, p.y, flag, {});
      b.target = null;
      b.wait = Math.random() * 2;
      this.bots.push(b);
    });
    if (this.uiCam) this.syncCameras();
  }

  randomPoint() {
    for (let i = 0; i < 20; i++) {
      const p = { x: FIELD.x + 100 + Math.random() * (FIELD.w - 200), y: FIELD.y + 200 + Math.random() * (FIELD.h - 260) };
      if (lobbyStand(p.x, p.y)) return p;
    }
    return lobbySpawn(0);
  }

  update(time, delta) {
    const dt = Math.min(delta, 100) / 1000;
    this.player.move(flagPicker.isOpen ? { x: 0, y: 0 } : this.controls.update(), dt, lobbyStand);
    if (this.online) {
      this.remotes.forEach((b) => b.netStep(dt));
      this.posT -= dt;
      if (this.posT <= 0) {
        this.posT = 0.1;
        const p = this.player;
        net.relay({ k: 'lp', x: Math.round(p.x), y: Math.round(p.y), f: p.facing === 'left' ? 1 : 0, m: p.isMoving ? 1 : 0 });
      }
    }
    // Başlat bölgesi: kapıdaki direğin yanına gelince "BAŞLAT" belirir (E veya buton)
    const z = near(this.player, START);
    const f = near(this.player, POLE);
    if (z !== this.inZone || f !== this.inFlag) {
      this.inZone = z; this.inFlag = f;
      this.refreshTexts();
      this.game.events.emit('lobby-zone', z);
      this.game.events.emit('lobby-flag-zone', f);
    }
    // Botlar: rastgele bir noktaya yürü, bekle, tekrar
    this.bots.forEach((b) => {
      const dir = { x: 0, y: 0 };
      if (b.wait > 0) b.wait -= dt;
      else {
        if (!b.target) b.target = this.randomPoint();
        const dx = b.target.x - b.x, dy = b.target.y - b.y, d = Math.hypot(dx, dy);
        if (d < 12) { b.target = null; b.wait = 1 + Math.random() * 3; } else { dir.x = (dx / d) * 0.6; dir.y = (dy / d) * 0.6; }
      }
      if (!b.move(dir, dt, lobbyStand) && (dir.x || dir.y)) b.target = null;
    });
  }
}

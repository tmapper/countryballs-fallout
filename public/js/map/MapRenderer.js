// ============================================================
// MapRenderer.js - Haritayı Phaser sahnesine yerleştirir
// ============================================================
// Asıl çizimi MapPainter.js yapar (Canvas). Burada o canvas'ları doku (texture)
// yapıp doğru yerlere koyuyoruz. Katman sırası (depth): toprak -20 < duvar -19 <
// zemin -8 < eşyalar -7 < kapı/kapaklar -6 < oyuncular (depth = y) < sis.
import { isMobile } from '../systems/Device.js';
import { tiled } from '../systems/Tiled.js';
import { getQuality } from '../systems/Resolution.js';
import { i18n } from '../systems/I18n.js';
import { RES } from '../systems/Resolution.js';
import { WORLD, ROOMS, CORRIDORS, TUNNELS, WALKABLE, START_POINT, WALL_FACE, WALL_THICK, MAP, PROPS } from './BunkerMap.js';
import {
  WALL_BANDS, FLOOR_TYPES, paintVoidTile, paintSoilTile, paintGrassTile, paintFloorTile,
  paintRoomDecor, paintBunkerDoor, paintSealedDoor, paintStartPad, paintTunnelHatch,
  paintCorridorDecor, paintWallFaceTile, setTexScale, texScale
} from './MapPainter.js';

export class MapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.labels = [];
    this.tunnelImages = [];
  }

  // Doku: yoksa (ya da farklı çözünürlükte üretildiyse) üret. canvas bir fonksiyon da olabilir.
  tex(key, canvas) {
    const T = this.scene.textures;
    if (T.exists(key) && (T.get(key).getSourceImage()._s || 1) !== texScale()) T.remove(key);
    if (!T.exists(key)) T.addCanvas(key, typeof canvas === 'function' ? canvas() : canvas);
    return key;
  }

  // Yüksek çözünürlüklü dokuyu dünya boyutunda göster
  fit(obj, key) {
    const s = 1 / (this.scene.textures.get(key).getSourceImage()._s || 1);
    if (obj.setTileScale) obj.setTileScale(s, s); else obj.setScale(s);
    return obj;
  }

  // opts.showTunnels: tüneller sadece Katil'e görünür (varsayılan: görünür)
  build(opts = {}) {
    const s = this.scene;
    // Ekranda dünyanın 1 pikseli kaç piksel görünecek -> dokuları ona göre net üret
    const base = Phaser.Math.Clamp(RES.cssH / 1000, 0.5, 1.2) * RES.k;
    const mobile = isMobile();
    setTexScale(mobile || getQuality() === 'low' ? 1 : Math.max(1, Math.min(1.5, Math.round(base * 2) / 2)));   // Düşük grafik: harita dokuları 1x (bellek)

    // 1) Binanın dışı: koyu boşluk (Among Us tarzı)
    // Duvarların arkası: TOPRAK (sığınak yerin altında). Bellek dostu büyük karolar (Tiled.js).
    s.cameras.main.setBackgroundColor('#3a2a1c');
    tiled(s, -600, -600, WORLD.w + 1200, WORLD.h + 1200, this.tex('soil', paintSoilTile), -20, 2);

    // 2) Duvarlar: yürünebilir alanları büyüterek katman katman çiz (gölge -> koyu -> açık kenar).
    //    Her katman TÜM dikdörtgenler için ayrı çizilir ki birleşim yerleri düzgün çıksın.
    const walls = s.add.graphics().setDepth(-19);
    for (const [grow, hex, alpha] of WALL_BANDS) {
      walls.fillStyle(parseInt(hex.slice(1), 16), alpha);
      WALKABLE.forEach((r) => walls.fillRect(r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2));
    }


    // 2b) Duvarların ön yüzü: her yürünebilir alanın üst kenarında görünen duvar (3/4 görünüm).
    //     Zeminler sonra çizildiği için, başka bir odanın/koridorun üstüne düşen kısım örtülür.
    const faceKey = this.tex('wallface', paintWallFaceTile);
    // Ön yüzün üstünde duvarın kalınlığı (yan duvarlarla aynı renk), dışında kontur
    const caps = s.add.graphics().setDepth(-18.6);
    const T = WALL_THICK;
    caps.fillStyle(0x06080b, 1);
    WALKABLE.forEach((r) => caps.fillRect(r.x - T - 4, r.y - WALL_FACE - T - 4, r.w + T * 2 + 8, T + 4));
    caps.fillStyle(0x6c7683, 1);
    WALKABLE.forEach((r) => caps.fillRect(r.x - T, r.y - WALL_FACE - T, r.w + T * 2, T));
    caps.fillStyle(0x8d97a4, 1);
    WALKABLE.forEach((r) => caps.fillRect(r.x - T + 6, r.y - WALL_FACE - T + 4, r.w + (T - 6) * 2, T - 10));
    WALKABLE.forEach((r) => tiled(s, r.x, r.y - WALL_FACE, r.w, WALL_FACE, faceKey, -18.5, 3));

    // 3) Zeminler: tekrar eden doku (TileSprite)
    FLOOR_TYPES.forEach((t) => this.tex('floor_' + t, () => paintFloorTile(t)));
    this.tex('grass', paintGrassTile);
    Object.values(ROOMS).forEach((r) => this.floor(r, r.floor === 'grass' ? 'grass' : 'floor_' + r.floor));
    CORRIDORS.forEach((c) => this.floor(c, 'floor_corridor'));
    // Koridor süsü (kenar şeritleri, ışıklar); odaların zemininin altında kalsın diye zeminle aynı katmanda
    CORRIDORS.forEach((c) => { const k = this.tex('cor_' + c.id, () => paintCorridorDecor(c)); this.fit(s.add.image(c.x, c.y, k).setOrigin(0).setDepth(-7.9), k); });

    // 4) Eşyalar: her oda tek bir resim (Canvas'ta önceden çizildi)
    Object.entries(ROOMS).forEach(([id, r]) => {
      const k = this.tex('decor_' + id, () => paintRoomDecor(id)); this.fit(s.add.image(r.x, r.y, k).setOrigin(0).setDepth(-7), k);
    });

    // 5) Sığınak kapısı, BAŞLAT bölgesi, tünel kapakları
    const e = ROOMS.entrance;
    this.fit(s.add.image(START_POINT.x - START_POINT.radius - 10, START_POINT.y - START_POINT.radius - 10,
      this.tex('startpad', () => paintStartPad(START_POINT.radius))).setOrigin(0).setDepth(-6.5), 'startpad');
    this.sealedObjs = [];
    if (opts.sealed) {
      // Bomba düştü: kapı kapalı, dışarısı kavruk. Bu nesneler GameScene'de bomba anında görünür.
      const scorch = s.add.rectangle(e.x - 40, e.y - 10, e.w + 80, e.h + 60, 0x1a0a04, 0.55).setOrigin(0).setDepth(-4).setVisible(false);
      const door = this.fit(s.add.image(MAP.doorX - 110, e.y - 100, this.tex('sealeddoor', paintSealedDoor)).setOrigin(0).setDepth(-3).setVisible(false), 'sealeddoor');
      this.sealedObjs.push(scorch, door);
    } else {
      this.fit(s.add.image(MAP.doorX - 210, e.y - 60, this.tex('bunkerdoor', paintBunkerDoor)).setOrigin(0).setDepth(-6), 'bunkerdoor');
    }
    this.tex('hatch', paintTunnelHatch);
    // Tünel kapakları: Aşama 5'te Katil dışındakilere setVisible(false) yapılacak
    this.tunnelImages = TUNNELS.map((t) => this.fit(s.add.image(t.x, t.y - 8, 'hatch').setDepth(-6).setVisible(opts.showTunnels !== false), 'hatch'));

    // 5b) Canlı ışıklar: reaktör nabzı, laboratuvar tankları, ekran titreşimi, duvar lambaları
    this.ambient();

    // 6) Oda isimleri (dil değişince güncellenir)
    Object.entries(ROOMS).forEach(([id, r]) => {
      if (id === 'entrance') return;
      const t = s.add.text(r.x + r.w / 2, r.y + 40, '', {
        fontFamily: 'Arial Black, Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#000000', strokeThickness: 6, resolution: Math.min(3, texScale() * 1.5)
      }).setOrigin(0.5).setAlpha(0.42).setDepth(-5);
      this.labels.push({ id, text: t });
    });
    this.refreshLabels();
    i18n.onChange(this.refreshLabels = this.refreshLabels.bind(this));
    s.events.once('shutdown', () => i18n.offChange(this.refreshLabels));
  }

  ambient() {
    const s = this.scene;
    if (!s.textures.exists('glow')) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      s.textures.addCanvas('glow', c);
    }
    const glow = (x, y, size, tint, a0, a1, dur, depth = -6.8) => {
      const im = s.add.image(x, y, 'glow').setDisplaySize(size, size).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a0).setDepth(depth);
      s.tweens.add({ targets: im, alpha: a1, scale: im.scale * 1.08, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * dur });
      return im;
    };
    PROPS.forEach((p) => {
      if (p.type === 'core') glow(p.x, p.y, p.r * 5, 0xff8a2a, 0.35, 0.75, 1300);
      else if (p.type === 'vat') glow(p.x, p.y, p.r * 4, 0x6dff7a, 0.25, 0.6, 900);
      else if (p.type === 'tank') glow(p.x, p.y, p.r * 3, 0x7fe8ff, 0.12, 0.28, 1600);
      else if (p.type === 'monitorbank') glow(p.x + p.w / 2, p.y + p.h, p.w * 0.9, 0x5ab4ff, 0.1, 0.28, 220 + Math.random() * 300);
      else if (p.type === 'roundtable') glow(p.x, p.y, 260, 0xff3030, 0.08, 0.35, 900);
      else if (p.type === 'dish') { const d = s.add.image(p.x, p.y - 4, 'glow').setDisplaySize(30, 30).setTint(0xff4030).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6.7); s.tweens.add({ targets: d, alpha: 0.1, duration: 500, yoyo: true, repeat: -1 }); }
    });
    // Her odanın üst duvarındaki lambalar hafifçe titrer, bazıları ara sıra söner
    Object.entries(ROOMS).forEach(([id, r]) => {
      if (id === 'entrance') return;
      for (let x = r.x + 192 + 70; x < r.x + r.w; x += 384) {
        const im = s.add.image(x, r.y - WALL_FACE + 26, 'glow').setDisplaySize(180, 110).setTint(0xffe7a8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(-18.4);
        if (Math.random() < 0.25) s.time.addEvent({ delay: 2000 + Math.random() * 4000, loop: true, callback: () => { im.setAlpha(0.05); s.time.delayedCall(80 + Math.random() * 120, () => im.setAlpha(0.35)); } });
      }
    });
  }

  floor(r, key) {
    tiled(this.scene, r.x, r.y, r.w, r.h, key, -8, 4);
  }

  refreshLabels() {
    this.labels.forEach((l) => l.text.setText(i18n.t('rooms.' + l.id).toUpperCase()));
  }
}

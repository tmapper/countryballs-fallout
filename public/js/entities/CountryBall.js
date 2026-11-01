// ============================================================
// CountryBall.js - Oyuncu karakteri (bayraklı top)
// ============================================================
// ÖNEMLİ: Bu nesnenin (x, y) konumu topun YERE DEĞDİĞİ noktadır (pivot = alt orta).
// Yani player.y = ayakların yeri. Böylece:
//   - Gölge, tam ayağın altında durur
//   - Duvar/oda çarpışmaları ve "önde/arkada" sıralama (depth = y) doğru olur
// Görünüm: duruyorsa 'idle' (SabitDurma), yürüyorsa 'walk_r' / 'walk_l'
import { baked, ensureIdle, hasSkin, skinKey } from '../systems/CharacterAtlas.js';
import { RES } from '../systems/Resolution.js';
import { sfx } from '../systems/Sound.js';

export const SPEED = 290;        // saniyede piksel
export const BALL_WIDTH = 96;    // dünyada topun genişliği (piksel)

export class CountryBall extends Phaser.GameObjects.Container {
  // opts: { isMe, role, name }
  constructor(scene, x, y, flag = 'TR', opts = {}) {
    super(scene, x, y);
    this.flag = flag;
    this.isMe = !!opts.isMe;
    this.role = opts.role || null;
    this.facing = 'right';
    this.isMoving = false;
    this.alive = true;     // öldüyse false (ceset GameScene'de ayrı çizilir)
    this.cooldown = 0;     // öldürme/vurma bekleme süresi (saniye)

    // Tüm klipler aynı kamera ölçeğinden geldiği için tek ölçek kullanılır
    this.scaleFactor = BALL_WIDTH / baked.walk.ballWidth;
    // Duruş karesi hemen; yürüme dokusu hazır değilse arka planda gelir (donma olmasın)
    ensureIdle(scene, flag);

    // Gölge: konteynerin (0,0) noktası = ayak, gölge tam orada
    this.shadow = scene.add.ellipse(0, -4, BALL_WIDTH * 0.85, 18, 0x000000, 0.3);
    this.sprite = scene.add.sprite(0, 0, skinKey('idle', flag), 0);
    this.sprite.setScale(this.scaleFactor);

    // Başının üstündeki etiket (rol testi için "Rolleri göster")
    const top = -baked.walk.ballHeight * this.scaleFactor - 6;
    this.tag = scene.add.text(0, top, '', {
      fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000000', strokeThickness: 5, resolution: Math.min(4, RES.k * 1.5)
    }).setOrigin(0.5, 1).setVisible(false);

    this.add([this.shadow, this.sprite, this.tag]);
    scene.add.existing(this);
    this.refreshVisual();
    this.setDepth(y);
  }

  // Bayrağı değiştir (ilk kullanımda skin üretilir)
  setFlag(flag) {
    if (flag === this.flag) return;
    this.flag = flag;
    ensureIdle(this.scene, flag);
    this.refreshVisual(true);
  }

  showTag(text, color) {
    this.tag.setText(text || '').setColor(color || '#ffffff').setVisible(!!text);
  }

  // Doğru doku + pivot + animasyonu uygular
  refreshVisual(force = false) {
    let skin = this.isMoving ? (this.facing === 'left' ? 'walk_l' : 'walk_r') : 'idle';
    if (!hasSkin(this.scene, skin, this.flag)) skin = 'idle'; // yürüme dokusu henüz hazır değil
    const clip = skin === 'idle' ? 'idle' : 'walk';
    this.shownSkin = skin;
    const info = baked[clip];
    const key = skinKey(skin, this.flag);
    // Sola yürüme = sağa yürümenin aynası
    this.sprite.setFlipX(skin === 'walk_l');
    if (skin !== 'idle') {
      // Yön değişince adım kaldığı yerden devam etsin
      const a = this.sprite.anims;
      const start = a.isPlaying && a.currentAnim ? Math.max(0, a.currentAnim.frames.indexOf(a.currentFrame)) : 0;
      this.sprite.play({ key, startFrame: start }, !force && this.sprite.anims.getName() === key);
    } else {
      this.sprite.anims.stop();
      this.sprite.setTexture(key, 0);
    }
    // Pivot: origin = pivot / kare boyutu (0..1 arası)
    this.sprite.setOrigin(info.pivot.x / info.fw, info.pivot.y / info.fh);
  }

  // Ağdan gelen konuma yumuşakça yaklaş (uzak oyuncular ve host'un botları)
  netStep(dt) {
    const n = this.net;
    if (!n) return;
    const k = Math.min(1, dt * 14);
    const dx = n.x - this.x, dy = n.y - this.y;
    if (Math.abs(dx) + Math.abs(dy) > 600) { this.x = n.x; this.y = n.y; }      // ışınlanma (tünel, toplantı)
    else { this.x += dx * k; this.y += dy * k; }
    const facing = n.f ? 'left' : 'right', moving = !!n.m;
    const late = moving && this.shownSkin === 'idle' && hasSkin(this.scene, 'walk_r', this.flag);
    if (late || facing !== this.facing || moving !== this.isMoving) { this.facing = facing; this.isMoving = moving; this.refreshVisual(); }
    this.setDepth(this.y);
  }

  // dir: yön vektörü (uzunluk <= 1), dt: geçen süre (saniye)
  // canStand(x, y): o noktaya basılabilir mi? (duvar kontrolü). Verilmezse serbest hareket.
  move(dir, dt, canStand = () => true) {
    const nx = this.x + dir.x * SPEED * dt;
    const ny = this.y + dir.y * SPEED * dt;
    const ox = this.x, oy = this.y;
    // X ve Y'yi AYRI AYRI dene: duvara çapraz çarpınca durmak yerine duvar boyunca kayarız
    if (canStand(nx, this.y)) this.x = nx;
    if (canStand(this.x, ny)) this.y = ny;

    // Gerçekten yer değiştirdi mi? (duvara yaslanıp basılı tutarken yürüme animasyonu oynamasın)
    const moving = Math.abs(this.x - ox) + Math.abs(this.y - oy) > 0.01;

    // Sağa/sola basılınca bakış yönü değişir (sadece yukarı/aşağı giderken eski yön kalır)
    let newFacing = this.facing;
    if (dir.x > 0.1) newFacing = 'right';
    else if (dir.x < -0.1) newFacing = 'left';

    // Yürürken doku arka planda hazır olduysa geçiş yap
    const late = moving && this.shownSkin === 'idle' && hasSkin(this.scene, 'walk_r', this.flag);
    if (late || newFacing !== this.facing || moving !== this.isMoving) {
      this.facing = newFacing;
      this.isMoving = moving;
      this.refreshVisual();
    }
    // Adım sesi: kendi topun yürürken belirli aralıkla
    if (this.isMe && this.alive && moving) {
      this.stepT = (this.stepT || 0) - dt;
      if (this.stepT <= 0) { sfx('step'); this.stepT = 0.34; }
    } else this.stepT = 0;
    // Aşağıda olan öndedir
    this.setDepth(this.y);
    return moving;
  }
}

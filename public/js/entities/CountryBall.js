// ============================================================
// CountryBall.js - Oyuncu karakteri (bayraklı top)
// ============================================================
// ÖNEMLİ: Bu nesnenin (x, y) konumu topun YERE DEĞDİĞİ noktadır (pivot = alt orta).
// Yani player.y = ayakların yeri. Böylece:
//   - Gölge, tam ayağın altında durur
//   - Duvar/oda çarpışmaları ve "önde/arkada" sıralama (depth = y) doğru olur
// Görünüm: duruyorsa 'idle' (SabitDurma), yürüyorsa 'walk_r' / 'walk_l'
import { baked, ensureIdle, hasSkin, skinKey, wantSkin } from '../systems/CharacterAtlas.js';
import { RES } from '../systems/Resolution.js';
import { sfx } from '../systems/Sound.js';
import { ensureLookTextures, ensureHatTexture, hatDef } from '../systems/Looks.js';

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
    wantSkin(flag, this.isMe);

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

    // Canlı gözler + şapka (her karede topun animasyon karesine göre yerleşir)
    ensureLookTextures(scene);
    this.eyeL = scene.add.image(0, 0, 'eye_round');
    this.eyeR = scene.add.image(0, 0, 'eye_round');
    this.hatImg = scene.add.image(0, 0, 'eye_round').setVisible(false);
    this.hat = 'none';
    this.blinkT = 1 + Math.random() * 4;
    this.idleT = 0;
    this.mood = null;
    this.lookY = 0;

    this.add([this.shadow, this.sprite, this.eyeL, this.eyeR, this.hatImg, this.tag]);
    scene.add.existing(this);
    this.refreshVisual();
    this.setHat(opts.hat || 'none');
    this.setDepth(y);
    this.onLooks = (time, delta) => this.updateLooks(Math.min(delta, 100) / 1000, time);
    scene.events.on('postupdate', this.onLooks);
    this.once('destroy', () => scene.events.off('postupdate', this.onLooks));
    this.updateLooks(0, 0);
  }

  setHat(id) {
    this.hat = id && hatDef(id).draw ? id : 'none';
    // İsim etiketi şapkanın üstüne çıksın
    const top = -baked.walk.ballHeight * this.scaleFactor - 6;
    this.tag.y = this.hat === 'none' ? top : top - hatDef(this.hat).w * 0.62 * this.scaleFactor;
    if (this.hat === 'none') { this.hatImg.setVisible(false); return; }
    this.hatImg.setTexture(ensureHatTexture(this.scene, this.hat)).setOrigin(0.5, 470 / 512).setVisible(true);
  }

  // Yüz ifadesi: style = 'wide' | 'squint' | 'happy' | 'half' | 'closed' | 'x', saniye
  setMood(style, secs = 1.5) { this.mood = style ? { style, left: secs } : null; }

  updateLooks(dt, time) {
    if (!this.scene || !this.sprite) return;
    // ifade seçimi
    if (this.mood) { this.mood.left -= dt; if (this.mood.left <= 0) this.mood = null; }
    this.idleT = this.isMoving ? 0 : this.idleT + dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.13) this.blinkT = 2.2 + Math.random() * 3.5;
    let style = 'round', k = 1;
    if (this.mood) { style = this.mood.style; if (style === 'wide') { style = 'round'; k = 1.22; } }
    else if (this.blinkT < 0) style = 'closed';
    else if (!this.alive) style = 'half';
    else if (this.idleT > 9) style = 'half';
    const clip = this.shownSkin === 'idle' || !this.shownSkin ? 'idle' : 'walk';
    const info = baked[clip];
    if (!info || !info.eyes) return;
    const fi = Math.min(info.eyes.length - 1, Math.max(0, Number(this.sprite.frame && this.sprite.frame.name) || 0));
    const p = info.pivot, sp = this.sprite, flip = sp.flipX ? -1 : 1;
    const sx = sp.scaleX, sy = sp.scaleY;
    const L = (u, v) => [sp.x + (u - p.x) * sx * flip, sp.y + (v - p.y) * sy];
    const pair = info.eyes[fi];
    const look = this.isMoving ? this.lookY * 5 : 0;
    const pts = pair.map((e) => { const [x, y] = L(e[0], e[1] + look); return { x, y, w: e[2] * sx * k, h: e[3] * sy * k }; }).sort((a, b) => a.x - b.x);
    const key = 'eye_' + style;
    [this.eyeL, this.eyeR].forEach((img, i) => {
      const e = pts[i];
      if (img.texture.key !== key) img.setTexture(key);
      img.setPosition(e.x, e.y).setDisplaySize(e.w, e.h).setFlipX(i === 1);
    });
    if (this.hat !== 'none') {
      const def = hatDef(this.hat), t = info.tops[fi];
      const bob = def.float ? Math.sin(time / 380) * 6 : 0;
      const [hx, hy] = L(t[0], t[1] + def.sink * 1.55 + bob);
      const sc = (def.w / 300) * sx;
      this.hatImg.setPosition(hx, hy).setScale(sc, (def.w / 300) * sy).setFlipX(flip < 0).setAngle((def.tilt || 0) * flip);
    }
  }

  // Bayrağı değiştir (ilk kullanımda skin üretilir)
  setFlag(flag) {
    if (flag === this.flag) return;
    this.flag = flag;
    ensureIdle(this.scene, flag);
    wantSkin(flag, this.isMe);
    this.wantedT = 0;
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
    this.lookY = dir.y;
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

    // Yürüyor ama yürüme dokusu henüz yok: sıranın başına al
    if (moving && this.shownSkin === 'idle' && !this.wantedT) { this.wantedT = 1; wantSkin(this.flag, true); }
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

// Hareketsiz top (ceset, hayalet ruhu): duruş karesi + gözler + şapka, merkezden döner.
export function staticBall(scene, flag, hat, eyeStyle, scale) {
  ensureIdle(scene, flag); ensureLookTextures(scene);
  const info = baked.idle, cx = info.fw / 2, cy = info.fh / 2;
  const c = scene.add.container(0, 0);
  const s = scene.add.sprite(0, 0, skinKey('idle', flag), 0).setScale(scale);
  c.add(s);
  info.eyes[0].map((e) => e).sort((a, b) => a[0] - b[0]).forEach((e, i) => {
    c.add(scene.add.image((e[0] - cx) * scale, (e[1] - cy) * scale, 'eye_' + eyeStyle).setDisplaySize(e[2] * scale, e[3] * scale).setFlipX(i === 1));
  });
  if (hat && hat !== 'none' && hatDef(hat).draw) {
    const def = hatDef(hat), t = info.tops[0];
    c.add(scene.add.image((t[0] - cx) * scale, (t[1] + def.sink * 1.55 - cy) * scale, ensureHatTexture(scene, hat)).setOrigin(0.5, 470 / 512).setScale((def.w / 300) * scale).setAngle(def.tilt || 0));
  }
  c.sprite = s;
  return c;
}

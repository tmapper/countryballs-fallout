// ============================================================
// CountryBall.js - Oyuncu karakteri (bayraklı top)
// ============================================================
// ÖNEMLİ: Bu nesnenin (x, y) konumu topun YERE DEĞDİĞİ noktadır (pivot = alt orta).
// Yani player.y = ayakların yeri. Böylece:
//   - Gölge, tam ayağın altında durur
//   - Duvar/oda çarpışmaları ve "önde/arkada" sıralama (depth = y) doğru olur
// Görünüm: duruyorsa 'idle' (SabitDurma), yürüyorsa 'walk_r' / 'walk_l'
import { baked, ensureIdle, hasSkin, skinKey, wantSkin } from '../systems/CharacterAtlas.js';
import { SKIN_SCALE } from '../systems/SkinFactory.js';
import { RES } from '../systems/Resolution.js';
import { sfx } from '../systems/Sound.js';
import { ensureLookTextures, ensureHatTexture, hatDef } from '../systems/Looks.js';

const NET_DELAY = 140;   // ms: uzaktaki oyuncular bu kadar geriden, akıcı oynatılır
export const SPEED = 290;        // saniyede piksel
export const BALL_WIDTH = 96;
export const GHOST_SPEED = 1.5;   // hayaletler %50 hızlı    // dünyada topun genişliği (piksel)

// Gölge dokusu: tek sefer çizilen yumuşak kenarlı siyah elips (şekil nesnesi yerine, dikiş çizgisi olmaz)
function shadowTexture(scene) {
  const key = 'ball_shadow';
  if (!scene.textures.exists(key)) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
    const c = cv.getContext('2d');
    c.translate(64, 16); c.scale(1, 0.25);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 62);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.85, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 62, 0, Math.PI * 2); c.fill();
    scene.textures.addCanvas(key, cv);
  }
  return key;
}

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
    // (Phaser Ellipse şekli yarı saydam dolgusunda ortada ince açık bir çizgi bırakıyordu -> hazır doku kullan)
    this.shadow = scene.add.image(0, -4, shadowTexture(scene)).setDisplaySize(BALL_WIDTH * 0.85, 18).setAlpha(0.3);
    this.sprite = scene.add.sprite(0, 0, skinKey('idle', flag), 0);
    this.sprite.setScale(this.scaleFactor / SKIN_SCALE);   // skin dokusu yarı çözünürlükte

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
    // postupdate dinleyicisi sahne tarafında tek döngüde toplanır (her top için ayrı event maliyeti yok)
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
    // PERFORMANS: duvar arkasında / kamera dışında (gizli) toplar için göz-şapka konumu hesaplanmaz (her kare, her top)
    if (!this.visible || this.alpha <= 0.02) return;
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
    const sx = sp.scaleX * SKIN_SCALE, sy = sp.scaleY * SKIN_SCALE;   // kare birimi -> dünya
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

  // Başının üstünde kısa emoji / hızlı sohbet balonu (topla birlikte hareket eder, sisle birlikte gizlenir)
  showEmote(text, big) {
    const sc = this.scene; if (!sc || !sc.sys) return;
    if (this._emo) { sc.tweens.killTweensOf(this._emo); this._emo.destroy(); this._emo = null; }
    if (this._emoTimer) { this._emoTimer.remove(); this._emoTimer = null; }
    const y = this.tag.y - (this.tag.visible ? 28 : 4);
    const t = sc.add.text(0, y, text, big
      ? { fontFamily: 'Arial', fontSize: '48px', resolution: Math.min(4, RES.k * 1.5) }
      : { fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#ffffff', backgroundColor: 'rgba(18,26,18,0.9)',
          padding: { left: 10, right: 10, top: 5, bottom: 5 }, resolution: Math.min(4, RES.k * 1.5) }).setOrigin(0.5, 1);
    this.add(t); this._emo = t;
    t.setScale(0.3);
    sc.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this._emoTimer = sc.time.delayedCall(2500, () => {
      this._emoTimer = null;
      sc.tweens.add({ targets: t, alpha: 0, y: y - 14, duration: 300, onComplete: () => { t.destroy(); if (this._emo === t) this._emo = null; } });
    });
  }

  clearEmote() {
    if (this._emoTimer) { this._emoTimer.remove(); this._emoTimer = null; }
    if (this._emo) { this.scene.tweens.killTweensOf(this._emo); this._emo.destroy(); this._emo = null; }
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
  // ÇEVRİMİÇİ AKICILIK: uzaktaki oyuncunun konumları ~10/sn ve düzensiz aralıklarla (sunucu 100 ms'de bir toplar) gelir.
  // Eskiden top her yeni konuma hızla atılıp bekliyordu (kesik kesik / "kasma" görüntüsü). Artık gelen konumlar
  // sıraya alınır ve top NET_DELAY kadar geriden, iki konum arasında düz çizgide sabit hızla oynatılır.
  netStep(dt) {
    const n = this.net;
    if (!n) { this.netBuf = null; this._netLast = null; this._netOff = null; return; }
    const now = performance.now();
    const hasTs = Number.isFinite(n.ts);
    if (n !== this._netLast) {                         // yeni konum geldi -> sıraya ekle
      this._netLast = n;
      const buf = this.netBuf || (this.netBuf = []);
      let t = now;
      if (hasTs) {
        // GÖNDERİCİ ZAMANI: konum ne zaman yollandıysa o anki yere konur (sunucu toplaması / ağ titremesi hızı bozmaz).
        // off = yerel saat - gönderici saati (en hızlı gelen pakete göre). Zıplamasın diye yavaşça değişir.
        const off = now - n.ts;
        if (this._netOff == null || Math.abs(off - this._netOff) > 1500) { this._netOff = off; buf.length = 0; }
        else if (off < this._netOff) this._netOff -= Math.min(this._netOff - off, 3);
        else this._netOff += 0.2;
        t = n.ts + this._netOff;
        this._netLate = Math.max(now - t, (this._netLate == null ? 120 : this._netLate) * 0.997);   // son gecikmelerin tepe değeri
      }
      const lastNow = buf[buf.length - 1];
      if (!lastNow || Math.abs(n.x - lastNow.x) + Math.abs(n.y - lastNow.y) > 600) {      // ilk konum / ışınlanma
        buf.length = 0; this.x = n.x; this.y = n.y;
        buf.push({ t, x: n.x, y: n.y, m: n.m });
      } else if (hasTs) {
        if (t > lastNow.t) {                                                               // eski / aynı paket: atla
          // Duran oyuncu yürümeye başladı: eski konum "az önce" sayılsın (ışınlanır gibi kaymasın)
          if (t - lastNow.t > 250 && lastNow.m === 0 && (n.x !== lastNow.x || n.y !== lastNow.y)) buf.push({ t: t - 100, x: lastNow.x, y: lastNow.y, m: 0 });
          buf.push({ t, x: n.x, y: n.y, m: n.m });
        }
      } else {
        // Zaman damgası olmayan eski sürüm: varış zamanına göre
        if (now - lastNow.t > 300) { lastNow.t = now - 100; while (buf.length > 1) buf.shift(); }
        let tt = Math.max(now, lastNow.t + 60);
        if (tt - now > 250) tt = now;
        buf.push({ t: tt, x: n.x, y: n.y, m: n.m });
      }
      if (buf.length > 16) buf.shift();
    }
    const buf = this.netBuf;
    // Gecikme: zaman damgalıysa ağın o anki titremesine göre (140-400 ms) yavaşça ayarlanır
    let delay = NET_DELAY;
    if (hasTs) {
      const want = Math.min(400, Math.max(140, (this._netLate || 120) + 110));
      this._netDelay = this._netDelay == null ? want : this._netDelay + (want - this._netDelay) * Math.min(1, dt * (want > this._netDelay ? 1 : 0.2));
      delay = this._netDelay;
    }
    const T = now - delay;
    while (buf.length > 2 && buf[1].t <= T) buf.shift();                         // geçmiş konumları at
    const a = buf[0], b = buf[1];
    let tx, ty;
    if (!b || T <= a.t) { tx = a.x; ty = a.y; }
    else if (T >= b.t) {
      // Tampon bitti (sunucu bir konumu atlamış olabilir): hâlâ yürüyorsa en çok 120 ms aynı yönde devam et
      tx = b.x; ty = b.y;
      if (hasTs && n.m === 1 && b.t > a.t) { const e = Math.min(120, T - b.t) / (b.t - a.t); tx += (b.x - a.x) * e; ty += (b.y - a.y) * e; }
    }
    else { const u = (T - a.t) / (b.t - a.t); tx = a.x + (b.x - a.x) * u; ty = a.y + (b.y - a.y) * u; }
    // Çok küçük titremeleri yumuşat (ilk karede zıplama olmasın)
    const k = Math.min(1, dt * 20);
    const ox = this.x, oy = this.y;
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    // Yürüme animasyonu: konum hâlâ kayıyorsa yürüyor say (durma paketi topun durmasından önce gelir)
    const facing = n.f ? 'left' : 'right', moving = n.m === 1 || (n.m !== 2 && Math.abs(this.x - ox) + Math.abs(this.y - oy) > 0.6);
    const late = moving && this.shownSkin === 'idle' && hasSkin(this.scene, 'walk_r', this.flag);
    if (late || facing !== this.facing || moving !== this.isMoving) { this.facing = facing; this.isMoving = moving; this.refreshVisual(); }
    this.setDepth(this.y);
  }

  // dir: yön vektörü (uzunluk <= 1), dt: geçen süre (saniye)
  // canStand(x, y): o noktaya basılabilir mi? (duvar kontrolü). Verilmezse serbest hareket.
  move(dir, dt, canStand = () => true) {
    // Büyük adımı küçük parçalara böl: kasma anında duvarın/eşyanın içinden geçmesin
    if (dt > 0.04) {
      const n = Math.ceil(dt / 0.04);
      let moved = false;
      for (let i = 0; i < n; i++) moved = this.move(dir, dt / n, canStand) || moved;
      return moved;
    }
    this.lookY = dir.y;
    const sp = SPEED * (this.speedMul || 1) * (this.alive ? 1 : GHOST_SPEED);   // hayalet daha hızlı; kurucu hız ayarı
    const nx = this.x + dir.x * sp * dt;
    const ny = this.y + dir.y * sp * dt;
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
  const s = scene.add.sprite(0, 0, skinKey('idle', flag), 0).setScale(scale / SKIN_SCALE);
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

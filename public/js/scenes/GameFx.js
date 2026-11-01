// ============================================================
// GameFx.js - Oyun içi görsel efektler (GameScene'e eklenir)
// ============================================================
//   - Oyuncunun etrafında sıcak bir ışık (el feneri hissi) + ekranda hafif vinyet
//   - Yürürken: hafif zıplama/esneme ve ayak altında toz
//   - Odalarda havada süzülen toz zerreleri
//   - Ölüm: kan sıçraması patlaması, ekran sarsıntısı, hayalet yukarı süzülür
//   - Tünel: giriş/çıkışta duman bulutu
//   - Vurma: namlu parlaması ve mermi izi
//   - Görev bitince yeşil ışıltı
// Tüm efektler tek bir küçük "nokta" dokusuyla yapılır; parçacık sayıları düşük tutulur (kasmasın).
import { WORLD, ROOMS } from '../map/BunkerMap.js';

function makeDot(scene) {
  if (scene.textures.exists('fxdot')) return;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  scene.textures.addCanvas('fxdot', c);
}

function makeLight(scene) {
  if (scene.textures.exists('fxlight')) return;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,236,200,.55)'); g.addColorStop(0.4, 'rgba(255,220,170,.18)'); g.addColorStop(1, 'rgba(255,210,150,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  scene.textures.addCanvas('fxlight', c);
}

export function installFx(GameScene) {
  const P = GameScene.prototype;

  P.setupFx = function () {
    makeDot(this); makeLight(this);
    // Oyuncu ışığı
    this.fxLight = this.add.image(0, 0, 'fxlight').setBlendMode(Phaser.BlendModes.ADD).setDepth(999990).setDisplaySize(900, 900).setAlpha(0.55);
    // Yürüme tozu
    this.fxDust = this.add.particles(0, 0, 'fxdot', {
      lifespan: 520, speedX: { min: -40, max: 40 }, speedY: { min: -35, max: -5 }, scale: { start: 0.55, end: 1.3 },
      alpha: { start: 0.35, end: 0 }, tint: 0xc9c2b4, emitting: false
    }).setDepth(5);
    // Kan
    this.fxBlood = this.add.particles(0, 0, 'fxdot', {
      lifespan: { min: 380, max: 750 }, speed: { min: 120, max: 420 }, angle: { min: 180, max: 360 }, gravityY: 900,
      scale: { start: 0.7, end: 0.25 }, alpha: { start: 1, end: 0.6 }, tint: [0x8a0a12, 0xa3101a, 0x5a0207], emitting: false
    }).setDepth(999000);
    // Duman (tünel)
    this.fxSmoke = this.add.particles(0, 0, 'fxdot', {
      lifespan: 900, speed: { min: 30, max: 140 }, scale: { start: 1.6, end: 4 }, alpha: { start: 0.55, end: 0 },
      tint: [0x3a4030, 0x5a6248, 0x22261c], emitting: false
    }).setDepth(999000);
    // Kıvılcım (görev bitti, namlu)
    this.fxSpark = this.add.particles(0, 0, 'fxdot', {
      lifespan: 600, speed: { min: 60, max: 260 }, scale: { start: 0.6, end: 0 }, alpha: { start: 1, end: 0 },
      blendMode: 'ADD', tint: 0x7dff9a, emitting: false
    }).setDepth(999001);
    // Odalarda süzülen toz: kamera etrafında az sayıda zerre
    this.fxMotes = this.add.particles(0, 0, 'fxdot', {
      lifespan: 6000, speedX: { min: -8, max: 8 }, speedY: { min: -14, max: -2 }, scale: { min: 0.12, max: 0.3 },
      alpha: { start: 0, end: 0, ease: (t) => Math.sin(t * Math.PI) * 0.45 }, blendMode: 'ADD', tint: 0xffe6be,
      frequency: 320, quantity: 1, maxParticles: 24,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-900, -600, 1800, 1200) }
    }).setDepth(999980);
    // Ekran vinyeti (kenarlar hafif koyu)
    this.fxVignette = document.createElement('div');
    this.fxVignette.className = 'game-vignette';
    document.body.appendChild(this.fxVignette);
    this.events.once('shutdown', () => { if (this.fxVignette) this.fxVignette.remove(); this.fxVignette = null; });
    this.fxStepT = 0;
  };

  P.updateFx = function (dt, time) {
    const me = this.player;
    if (!me) return;
    this.fxLight.setPosition(me.x, me.y - 40).setVisible(me.alive && this.fog.enabled);
    const lightsOut = this.sabotage && this.sabotage.type === 'lights';
    this.fxLight.setAlpha(lightsOut ? 0.75 : 0.5 + Math.sin(time / 900) * 0.04);
    this.fxMotes.setPosition(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y);
    // Yürüyen herkes: esneme + toz
    this.balls.forEach((b) => {
      if (!b.visible || !b.sprite) return;
      if (b.isMoving && b.alive) {
        b.bobT = (b.bobT || 0) + dt * 11;
        const s = Math.sin(b.bobT);
        b.sprite.setScale(b.scaleFactor * (1 + s * 0.035), b.scaleFactor * (1 - s * 0.045));
        b.stepFx = (b.stepFx || 0) - dt;
        if (b.stepFx <= 0) { b.stepFx = 0.22; this.fxDust.emitParticleAt(b.x + (Math.random() - 0.5) * 30, b.y - 4, 2); }
      } else if (b.bobT) {
        b.bobT = 0; b.sprite.setScale(b.scaleFactor);
      }
    });
    // Hayalet: hafifçe süzülür
    if (!me.alive) { me.ghostT = (me.ghostT || 0) + dt; me.sprite.y = Math.sin(me.ghostT * 2.2) * 8 - 6; }
  };

  // Ölüm: kan patlaması + sarsıntı + kısa kırmızı flaş (sadece yakında görünüyorsa)
  P.fxDeath = function (ball) {
    const near = Math.hypot(ball.x - this.player.x, ball.y - this.player.y) < 900;
    this.fxBlood.emitParticleAt(ball.x, ball.y - 40, near ? 26 : 10);
    if (ball.isMe || near) this.cameras.main.shake(260, ball.isMe ? 0.012 : 0.006);
    // Hayalet ruhu yukarı süzülür
    const ghost = this.add.sprite(ball.x, ball.y - 30, `idle:${ball.flag}`, 0).setScale(ball.scaleFactor * 0.9).setAlpha(0.6).setTint(0xcfe6ff).setDepth(999002).setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({ targets: ghost, y: ghost.y - 160, alpha: 0, scale: ball.scaleFactor * 1.1, duration: 1500, ease: 'Sine.easeOut', onComplete: () => ghost.destroy() });
  };

  P.fxTunnel = function (x, y) {
    this.fxSmoke.emitParticleAt(x, y - 10, 14);
  };

  P.fxShot = function (from, to) {
    const g = this.add.graphics().setDepth(999003).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(6, 0xfff2a8, 1).lineBetween(from.x, from.y - 40, to.x, to.y - 40);
    g.lineStyle(2, 0xffffff, 1).lineBetween(from.x, from.y - 40, to.x, to.y - 40);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    this.fxSpark.setParticleTint(0xffd27a);
    this.fxSpark.emitParticleAt(from.x, from.y - 40, 10);
    this.fxSpark.setParticleTint(0x7dff9a);
  };

  P.fxTaskDone = function () {
    this.fxSpark.emitParticleAt(this.player.x, this.player.y - 50, 22);
  };
}

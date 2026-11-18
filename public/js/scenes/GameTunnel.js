// ============================================================
// GameTunnel.js - Katilin tünel sistemi (GameScene'e eklenir)
// ============================================================
// Katil tünele girince tünelin İÇİNDE kalır (görünmez, öldürülemez, saldıramaz):
//   - yön tuşları / joystick: ok yönündeki başka tünele geç
//   - E / ÇIK butonu: bulunduğun tünelden dışarı çık
// Ağda bu durum konum mesajındaki m = 2 ile yayılır (sunucu sadece Katil için kabul eder).
import { TUNNELS } from '../map/BunkerMap.js';
import { nearestTunnel, pickTunnelDir } from '../systems/Combat.js';
import { sfx } from '../systems/Sound.js';
import { i18n } from '../systems/I18n.js';

export function installTunnel(GameScene) {
  const P = GameScene.prototype;

  // Katil: tünel butonu / E. Dışarıdaysa tünele girer; içerideyse tünelden ÇIKAR.
  // İçerideyken yön tuşları / joystick ile ok yönündeki başka tünele geçilir.
  P.useTunnel = function () {
    const me = this.player;
    if (this.over || this.meeting || !me.alive || me.role !== 'impostor') return;
    if ((this.tunnelLock || 0) > this.time.now) return;
    if (me.inTunnel) { this.exitTunnel(); return; }
    const t = nearestTunnel(TUNNELS, me.x, me.y);
    if (!t) return;
    this.tunnelLock = this.time.now + 500;
    this.ventWitness(me);                 // girişi görenler (tünele girmeden ÖNCE: sonra görünmez olur)
    sfx('tunnel');
    this.fxTunnel(me.x, me.y);
    me.inTunnel = t.id;
    me.setPosition(t.x, t.y); me.setDepth(me.y);
    // Kendine hafif görünür; başkaları updateSight ile tamamen gizlenir
    me.setAlpha(0.22); me.setVisible(true);
    this.cameras.main.centerOn(me.x, me.y - 40);
    this.cameras.main.flash(180, 0, 0, 0);
    this.tunnelHints = (this.tunnelHints || 0) + 1;
    if (this.tunnelHints <= 2) this.toast(i18n.t('ui.tunnelHint'), '#ffd23f');
  };

  P.exitTunnel = function () {
    const me = this.player;
    if (!me.inTunnel) return;
    this.tunnelLock = this.time.now + 500;
    me.inTunnel = null; me.setAlpha(1); me.setVisible(true); me.sightA = 1; me.seen = true;
    this.clearTunnelArrows();
    this.ventWitness(me);                 // çıkışı görenler
    sfx('tunnel');
    this.fxTunnel(me.x, me.y);
    this.cameras.main.flash(180, 0, 0, 0);
  };

  P.pickTunnel = function (from, dx, dy) { return pickTunnelDir(TUNNELS, from, dx, dy); }

  P.hopTunnel = function (dx, dy) {
    const me = this.player;
    const dest = this.pickTunnel(me.inTunnel, dx, dy);
    if (!dest) return false;
    this.tunnelLock = this.time.now + 350;
    sfx('tunnel');
    me.inTunnel = dest.id;
    me.setPosition(dest.x, dest.y); me.setDepth(me.y);
    this.cameras.main.centerOn(me.x, me.y - 40);
    this.cameras.main.flash(90, 0, 0, 0);
    return true;
  };

  // İçerideyken: yön tuşu/joystick -> başka tünele geç (her itişte bir kez)
  P.updateTunnelInput = function (dir) {
    const mag = Math.hypot(dir.x, dir.y);
    if (mag < 0.3) this.hopLatch = false;
    else if (mag > 0.55 && !this.hopLatch && (this.tunnelLock || 0) <= this.time.now) {
      this.hopLatch = true;
      this.hopTunnel(dir.x, dir.y);
    }
    this.drawTunnelArrows();
  };

  // Dört yönde gidilebilecek tünelleri gösteren oklar (oyuncunun etrafında)
  P.drawTunnelArrows = function () {
    const me = this.player;
    if (!this.tArrows) this.tArrows = this.add.graphics().setDepth(90000);
    const g = this.tArrows;
    g.clear();
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
      if (!this.pickTunnel(me.inTunnel, dx, dy)) return;
      const cx = me.x + dx * 120, cy = me.y - 40 + dy * 120, s = 26;
      g.fillStyle(0xffd23f, 0.95).lineStyle(4, 0x000000, 0.7);
      g.beginPath();
      g.moveTo(cx + dx * s, cy + dy * s);
      g.lineTo(cx - dx * s * 0.2 - dy * s, cy - dy * s * 0.2 + dx * s);
      g.lineTo(cx - dx * s * 0.2 + dy * s, cy - dy * s * 0.2 - dx * s);
      g.closePath(); g.fillPath(); g.strokePath();
    });
  };

  P.clearTunnelArrows = function () { if (this.tArrows) this.tArrows.clear(); }

}

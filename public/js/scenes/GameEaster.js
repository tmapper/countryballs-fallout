// ============================================================
// GameEaster.js - Gizli sürpriz: FİEX'İN ORDUSU
// ============================================================
// Oyunda kendine ordu kuran Fiex'in anısına: haritanın dışında, toprağın içinde gizli bir ordu kampı.
// SADECE ÖLÜLER (hayaletler) görür; hayaletler duvarlardan geçtiği için oraya sadece onlar gidebilir.
// Oyunu DEĞİŞTİRMEZ: çarpışma yok, görev yok, ağ mesajı yok; sadece süs (her cihazda yerel çizilir).
import { WORLD, WALKABLE, EMERGENCY_BUTTON } from '../map/BunkerMap.js';
import { staticBall } from '../entities/CountryBall.js';
import { i18n } from '../systems/I18n.js';

const FIEX_FLAG = 'TR';                                  // Fiex'in bayrağı (istersen değiştir)
const SOLDIER_FLAGS = ['TR', 'AZ', 'TR', 'KZ', 'TR', 'KG', 'TR', 'AZ', 'TR', 'KZ'];
const CAMP_W = 760, CAMP_H = 420;

// Haritanın dışında, kampın sığacağı ve hiçbir oda/koridora yakın olmayan boş yer (merkeze en yakını).
// Sıkışık haritada (Klasik) önce daha küçük pay, sonra küçültülmüş kamp denenir.
function findCampSpot() {
  for (const [M, edge, sc] of [[220, 300, 1], [150, 80, 1], [110, 40, 0.75], [80, 20, 0.6]]) {
    const W = CAMP_W * sc, H = CAMP_H * sc, best = { d: Infinity, x: 0, y: 0, sc };
    for (let y = edge + 100; y < WORLD.h - H - edge; y += 50) {
      for (let x = edge; x < WORLD.w - W - edge; x += 50) {
        const clear = WALKABLE.every((r) => x + W + M < r.x || x - M > r.x + r.w || y + H + M < r.y - 140 || y - M > r.y + r.h);
        if (!clear) continue;
        const d = Math.hypot(x + W / 2 - EMERGENCY_BUTTON.x, y + H / 2 - EMERGENCY_BUTTON.y);
        if (d < best.d) { best.d = d; best.x = x; best.y = y; }
      }
    }
    if (best.d < Infinity) return best;
  }
  return null;
}

export function installEaster(GameScene) {
  const P = GameScene.prototype;

  P.buildFiexArmy = function () {
    const spot = findCampSpot();
    if (!spot) return;
    const c = this.add.container(spot.x, spot.y).setDepth(spot.y + CAMP_H).setVisible(false).setAlpha(0).setScale(spot.sc);
    this.fiex = { c, x: spot.x + CAMP_W * spot.sc / 2, y: spot.y + CAMP_H * spot.sc / 2, greeted: false };
    const k = (this.player && this.player.scaleFactor) || 1;
    // Kamp zemini: hayalet mavisi toprak, ateş, bayrak direği
    const g = this.add.graphics();
    g.fillStyle(0x9fd0ff, 0.10).fillRoundedRect(0, 0, CAMP_W, CAMP_H, 40);
    g.lineStyle(4, 0x9fd0ff, 0.35).strokeRoundedRect(0, 0, CAMP_W, CAMP_H, 40);
    g.fillStyle(0x6b5a3a, 0.9).fillRect(70, 40, 10, 200);                     // direk
    g.fillStyle(0xe30a17, 0.9).fillRect(80, 44, 110, 70);                     // sancak
    g.fillStyle(0xffffff, 0.95).fillCircle(122, 79, 20); g.fillStyle(0xe30a17, 1).fillCircle(129, 79, 16);
    g.fillStyle(0xffffff, 0.95).fillCircle(152, 79, 6);
    const fire = this.add.circle(CAMP_W - 60, CAMP_H - 55, 24, 0xffa63d, 0.85);
    this.tweens.add({ targets: fire, scale: 1.25, alpha: 0.5, duration: 420, yoyo: true, repeat: -1 });
    c.add([g, fire]);
    // Pankart
    const title = this.add.text(CAMP_W / 2, -40, "FİEX'İN ORDUSU", { fontFamily: 'Impact, Arial Black, sans-serif', fontSize: '64px', color: '#ffd23f', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5);
    const sub = this.add.text(CAMP_W / 2, 18, i18n.t('easter.fiexSub'), { fontFamily: 'Arial', fontSize: '26px', color: '#cfe8ff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    c.add([title, sub]);
    // Komutan Fiex (taçlı, büyük) + iki sıra asker (miğferli), hepsi hafif saydam hayalet
    const boss = staticBall(this, FIEX_FLAG, 'crown', 'round', k * 1.35).setPosition(200, 250);
    const bossName = this.add.text(200, 330, 'Fiex', { fontFamily: 'Arial Black, Arial', fontSize: '30px', color: '#ffd23f', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    c.add([boss, bossName]);
    this.tweens.add({ targets: boss, y: 238, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const soldiers = [];
    SOLDIER_FLAGS.forEach((f, i) => {
      const row = Math.floor(i / 5), col = i % 5;
      const s = staticBall(this, f, 'army', 'round', k * 0.8).setPosition(330 + col * 78, 170 + row * 120);
      soldiers.push(s); c.add(s);
      // Yerinde sayma (marş): sırayla zıplar
      this.tweens.add({ targets: s, y: s.y - 14, duration: 260, yoyo: true, repeat: -1, delay: (col + row) * 130, ease: 'Quad.easeOut' });
    });
    this.fiex.soldiers = soldiers;
  };

  // Her karede (updateSight içinden): sadece ben ölüysem görünür; yanına gelince bir kez selam
  P.updateFiexArmy = function (dt) {
    const F = this.fiex;
    if (!F) return;
    const dead = this.player && !this.player.alive;
    const target = dead ? 0.8 : 0;
    const a = F.c.alpha + (target - F.c.alpha) * Math.min(1, dt * 3);
    F.c.setAlpha(a);
    F.c.setVisible(a > 0.02);
    if (dead && !F.greeted && Math.hypot(this.player.x - F.x, this.player.y - F.y) < 520) {
      F.greeted = true;
      this.toast(i18n.t('easter.fiexHello'), '#ffd23f');
      F.soldiers.forEach((s, i) => this.tweens.add({ targets: s, angle: -12, duration: 160, yoyo: true, repeat: 3, delay: i * 40 }));
    }
  };
}

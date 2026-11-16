// ============================================================
// GameEmote.js - OYUN İÇİ EMOJİ + HIZLI SOHBET
// ============================================================
// G tuşu (Ayarlar > Tuş atama'dan değişir) ya da sağ üstteki 😀 düğmesi menüyü açar.
// Seçilen emoji/söz oyuncunun başının üstünde 2.5 sn görünür. Sadece GÖRÜŞ alanındakiler görür
// (top sisin içindeyse balon da görünmez). Ölülerin emojisini sadece ölüler görür.
// Ağ: herkes kendi emojisini { k:'emo', e } ile yollar (sunucu hız sınırı koyar); botlarınkini host 'emo' olayıyla.
// Botlar yakındaki oyuncunun emojisine bazen karşılık verir; "Beni takip et" deyince bir süre peşine takılabilir.
import { net } from '../systems/Net.js';
import { i18n } from '../systems/I18n.js';
import { onAction } from '../systems/Keys.js';
import { canSee } from '../systems/Combat.js';
import { sfx } from '../systems/Sound.js';

export const EMOJIS = ['👋', '😂', '😱', '🤔', '👍', '👎', '😡', '❤️'];
export const PHRASES = ['follow', 'come', 'tasks', 'sus', 'help', 'thanks', 'where', 'safe'];
export const EMOTE_COUNT = EMOJIS.length + PHRASES.length;
const COOLDOWN = 1500;

export const emoteText = (e) => e < EMOJIS.length ? EMOJIS[e] : i18n.tf('emote.p.' + PHRASES[e - EMOJIS.length], PHRASES[e - EMOJIS.length]);
const isPhrase = (e, id) => e >= EMOJIS.length && PHRASES[e - EMOJIS.length] === id;
// Botun cevabı: aynı emoji ya da uygun tepki
const REPLY = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 6: 3, 7: 7 };

export function installEmote(GameScene) {
  const P = GameScene.prototype;

  P.setupEmotes = function () {
    this._emoT = 0;
    const off = onAction('emote', () => { if (this.sys.isActive()) this.toggleEmoteMenu(); });
    this.events.once('shutdown', () => { off(); this.closeEmoteMenu(); });
  };

  P.toggleEmoteMenu = function () {
    if (this._emoMenu) { this.closeEmoteMenu(); return; }
    if (this.meeting || !this.player || (this.taskPanel && this.taskPanel.isOpen)) return;
    const root = document.createElement('div'); root.className = 'emo-menu';
    const grid = document.createElement('div'); grid.className = 'emo-grid'; root.appendChild(grid);
    for (let e = 0; e < EMOTE_COUNT; e++) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = e < EMOJIS.length ? 'emo-btn emo-e' : 'emo-btn emo-p';
      b.textContent = emoteText(e);
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      b.addEventListener('click', () => { this.sendEmote(e); this.closeEmoteMenu(); });
      grid.appendChild(b);
    }
    root.addEventListener('pointerdown', (ev) => { if (ev.target === root) this.closeEmoteMenu(); });
    document.body.appendChild(root);
    this._emoMenu = root;
    this._emoEsc = (ev) => { if (ev.code === 'Escape') { ev.stopPropagation(); this.closeEmoteMenu(); } };
    window.addEventListener('keydown', this._emoEsc, true);
  };

  P.closeEmoteMenu = function () {
    if (this._emoMenu) { this._emoMenu.remove(); this._emoMenu = null; }
    if (this._emoEsc) { window.removeEventListener('keydown', this._emoEsc, true); this._emoEsc = null; }
  };

  P.sendEmote = function (e) {
    const me = this.player, now = performance.now();
    if (!me || this.meeting || !(e >= 0 && e < EMOTE_COUNT)) return;
    if (now - (this._emoT || 0) < COOLDOWN) return;
    this._emoT = now;
    this.showEmoteOn(me, e);
    if (this.online) net.relay({ k: 'emo', e });
    if (!this.online || this.isHost) this.botsReactEmote(me, e);
  };

  // Görünürlük: ölü topun emojisini canlılar görmez. Balon topun içinde olduğu için sis/gizlenme ile birlikte gizlenir.
  P.showEmoteOn = function (ball, e) {
    if (!ball || !ball.showEmote) return;
    if (!ball.alive && this.player && this.player.alive && !ball.isMe) return;
    if (this.meeting) return;
    ball.showEmote(emoteText(e), e < EMOJIS.length);
    if (!ball.isMe && this.player && Math.hypot(ball.x - this.player.x, ball.y - this.player.y) < 700) sfx('ui_click', 0.25);
  };

  // Ağdan gelen oyuncu emojisi
  P.onEmoteNet = function (from, e) {
    e = Number(e);
    if (!(e >= 0 && e < EMOTE_COUNT) || (e | 0) !== e) return;
    const b = this.ball(from);
    if (!b || b.isMe || b.brain) return;
    this.showEmoteOn(b, e);
    if (this.isHost) this.botsReactEmote(b, e);
  };

  // Host/çevrimdışı: yakındaki, onu GÖREN bir bot bazen karşılık verir
  P.botsReactEmote = function (src, e) {
    if (!src || !src.alive || this.meeting) return;
    const near = this.balls.filter((b) => b.brain && b.alive && b !== src && Math.hypot(b.x - src.x, b.y - src.y) < 420 && canSee(this.grid, b, src, 420));
    if (!near.length) return;
    const bot = near[Math.floor(Math.random() * near.length)];
    const br = bot.brain;
    const follow = isPhrase(e, 'follow') || isPhrase(e, 'come');
    if (follow && bot.role !== 'impostor' && br.distrust !== src && Math.random() < 0.7) {
      br.buddy = src; br.buddyUntil = this.time.now + 20000 + Math.random() * 10000;
    }
    let r = REPLY[e];
    if (r == null) r = isPhrase(e, 'thanks') ? 7 : isPhrase(e, 'sus') ? 3 : isPhrase(e, 'help') || follow || isPhrase(e, 'safe') ? 4 : null;
    if (r == null || Math.random() > 0.6) return;
    this.time.delayedCall(500 + Math.random() * 900, () => {
      if (!bot.alive || this.meeting || !bot.active) return;
      this.botEmote(bot, r);
    });
  };

  P.botEmote = function (bot, e) {
    if ((bot._emoAt || 0) > this.time.now - COOLDOWN) return;
    bot._emoAt = this.time.now;
    this.showEmoteOn(bot, e);
    this.emitEv('emo', [bot.id, e]);
  };
}

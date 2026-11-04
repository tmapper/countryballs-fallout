// ============================================================
// main.js - Oyunun giriş noktası: Phaser'ı ayarlar ve başlatır
// ============================================================
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { RES, measure, gameSize, attachResolution } from './systems/Resolution.js';
import { initFlow } from './systems/GameFlow.js';
import { setChatGame } from './ui/Chat.js';
import { runStartPrompts } from './ui/StartPrompts.js';
import { net } from './systems/Net.js';

// iOS: iki parmakla yakınlaştırmayı engelle
document.addEventListener('gesturestart', (e) => e.preventDefault());

measure();
const size = gameSize();

const config = {
  type: Phaser.AUTO,            // WebGL varsa onu, yoksa Canvas kullan
  parent: 'game',               // index.html'deki <div id="game">
  backgroundColor: '#0b0f0b',
  scale: {
    // 1080p: oyun RES.k kat büyük çizilir, ekrana 1/RES.k ile sığdırılır (Resolution.js)
    mode: Phaser.Scale.NONE,
    width: size.width,
    height: size.height,
    zoom: 1 / RES.k
  },
  render: { antialias: true },
  // Gerçek kare süresi (yumuşatma yok): yavaş telefonda oyun hızı düşmesin
  fps: { smoothStep: false },
  input: { activePointers: 3 },
  scene: [BootScene, LobbyScene, GameScene, UIScene]
};

const game = new Phaser.Game(config);
attachResolution(game);
initFlow(game);

setChatGame(game);
runStartPrompts();   // ilk açılış: Mobil mi PC mi? + Yeni Güncelleme! notu

// Konsol kapalı (hile zorlaşsın): F12 / Ctrl+Shift+I-J-C / Ctrl+U / sağ tık engellenir,
// konsol çıktısı susturulur, oyun nesnesine konsoldan erişilemez.
// Geliştirirken adrese ?debug=1 ekle: konsol açık, CFS.game erişilebilir.
if (/[?&]debug=1/.test(location.search)) {
  window.CFS = { game };
} else {
  // Tarayıcı kısayolları kapalı (Ctrl+E/L/K adres çubuğu, Ctrl+R/F5 yenile, Ctrl+S/P/F/D/H/J/O/U...).
  // Yazı alanında kopyala/yapıştır/geri al (Ctrl+A/C/V/X/Z/Y) çalışmaya devam eder.
  const ALLOW = ['a', 'c', 'v', 'x', 'z', 'y'];
  const block = (e) => {
    const k = (e.key || '').toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (['F1', 'F3', 'F5', 'F6', 'F7', 'F10', 'F12'].includes(e.key) || (mod && !ALLOW.includes(k)) || (e.altKey && ['arrowleft', 'arrowright', 'home', 'd'].includes(k))) {
      e.preventDefault(); e.stopPropagation();
    }
  };
  // Tam ekranda Ctrl+W / Ctrl+T / Alt+F4 gibi tuşlar da yakalanır (Chrome/Edge: Keyboard Lock)
  document.addEventListener('fullscreenchange', () => {
    try { if (document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(); } catch (e) { /* yoksay */ }
  });
  // Yanlışlıkla kapatma / geri gitme: tarayıcı "Siteden ayrılsın mı?" diye sorar
  window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => history.pushState(null, '', location.href));
  window.addEventListener('keydown', block, true);
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  ['log', 'info', 'warn', 'error', 'debug', 'table', 'dir', 'trace'].forEach((m) => { try { console[m] = () => {}; } catch (e) { /* yoksay */ } });
  // Geliştirici araçları açılırsa: 'debugger' satırı sadece araçlar açıkken durur -> süre uzar -> yakalanır.
  // Yakalanınca oyun durur, sunucu bağlantısı kesilir (çevrimiçi hile yapılamaz), sayfa yenilenmeden açılmaz.
  let caught = false;
  const lock = () => {
    if (caught) return;
    caught = true;
    net.block();
    try { game.loop.sleep(); } catch (e) { /* yoksay */ }
    const d = document.createElement('div');
    d.className = 'devlock';
    d.innerHTML = '<div><b>⚠</b><h2>Geliştirici araçları kapalı olmalı</h2><p>Hile koruması: oyun durduruldu ve sunucu bağlantısı kesildi.<br>Geliştirici araçlarını kapatıp sayfayı yenile.</p></div>';
    document.body.appendChild(d);
  };
  const trap = new Function('debugger');
  setInterval(() => {
    const t = performance.now();
    trap();
    if (performance.now() - t > 80) lock();
  }, 700);
}

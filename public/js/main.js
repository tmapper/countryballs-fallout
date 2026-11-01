// ============================================================
// main.js - Oyunun giriş noktası: Phaser'ı ayarlar ve başlatır
// ============================================================
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { RES, measure, gameSize, attachResolution } from './systems/Resolution.js';
import { initFlow } from './systems/GameFlow.js';

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
  input: { activePointers: 3 },
  scene: [BootScene, LobbyScene, GameScene, UIScene]
};

const game = new Phaser.Game(config);
attachResolution(game);
initFlow(game);

// Hata ayıklama için tarayıcı konsolundan erişim: CFS.game.scene.getScene('GameScene')
window.CFS = { game };

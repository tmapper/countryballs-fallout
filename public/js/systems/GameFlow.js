// ============================================================
// GameFlow.js - Oyunun akışı:
//   Ana menü -> (Tek başına: botlu lobi | Çevrimiçi: lobi tarayıcısı -> oda) -> Rol animasyonu -> Oyun
// ============================================================
// Sahnelerin birbirini bilmesine gerek kalmasın diye geçişler burada.
//   showLobby()   : yükleme bitince ve "Lobi" butonunda
//   startMatch()  : lobide "Başlat" -> roller dağıtılır -> animasyon -> oyun
//   backToLobby() : oyunu durdurup lobiye döner (rol testleri için)
//   playKillCutscene() / gameOver() : GameScene çağırır (öldürme animasyonu, sonuç ekranı)
//
// Akıcılık için: Oyun sahnesi, rol animasyonunun BAŞINDA (siyah "SENİN_" kısmı)
// arkada kurulur ve uyutulur. Animasyon bitince sadece uyandırılır -> donma olmaz.
import { Lobby } from '../ui/Lobby.js';
import { RoleReveal } from '../ui/RoleReveal.js';
import { KillCutscene, preloadKills } from '../ui/KillCutscene.js';
import { ResultScreen } from '../ui/ResultScreen.js';
import { assignRoles } from './Roles.js';
import { initSkins, requestSkins, flushSkins, wantSkin } from './CharacterAtlas.js';
import { playMusic, stopMusic, stopAllLoops, sfx } from './Sound.js';
import { teamOf } from './Combat.js';
import { MainMenu } from '../ui/MainMenu.js';
import { LobbyBrowser, RoomHud } from '../ui/OnlineLobby.js';
import { net } from './Net.js';
import { FLAG_LIST } from './Flags.js';
import { i18n } from './I18n.js';
import { flagPicker } from '../ui/FlagPicker.js';
import { saveFlag } from './Flags.js';
import { lobbyChat } from '../ui/Chat.js';
import { hatPicker } from '../ui/HatPicker.js';
import { social } from '../ui/Social.js';
import { loadHat, saveHat, botHat } from './Looks.js';

let game = null;
let lobby = null;
let match = null; // { players, flags, built, revealDone }
let lastSettings = null;
const reveal = new RoleReveal();
const cutscene = new KillCutscene();
const result = new ResultScreen();
export const menu = new MainMenu();
const browser = new LobbyBrowser();
const roomHud = new RoomHud();
let mode = 'offline';            // 'offline' (botlarla tek başına) | 'online' (oda)

const isRunning = (key) => game.scene.isActive(key) || game.scene.isSleeping(key) || game.scene.isPaused(key);

export function initFlow(phaserGame) {
  game = phaserGame;
  initSkins(game);
  game.events.on('lobby-zone', (z) => lobby.setStartReady(z));
  game.events.on('lobby-flag-zone', (z) => { lobby.setFlagReady(z); roomHud.setFlagReady(z); });
  game.events.on('lobby-hat-zone', (z) => { lobby.setHatReady(z); roomHud.setHatReady(z); });
  net.profile.hat = loadHat();
  // Arkadaş odasına katıl (arkadaş listesi ya da davet kartı)
  social.ensure();
  social.onJoin = (code) => {
    if (match) { flash(i18n.t('social.busy')); return; }
    net.connect(); net.join(code);
  };
  document.addEventListener('cfs-social', (e) => menu.setSocialBadge && menu.setSocialBadge(e.detail));
  net.on('account', () => net.social());
  // Giriş yapınca alınmış şapkalar açılır: kayıtlı şapkayı sunucuya tekrar bildir
  net.on('account', () => { net.profile.hat = loadHat(); if (net.inRoom) net.setHat(net.profile.hat); else net.setProfile(); });
  lobby = new Lobby({
    onStart: startMatch,
    onMenu: () => showMainMenu(),
    onFlag: () => openLobbyFlagPicker(),
    onHat: () => openLobbyHatPicker(),
    // Bayrak/bot değişince yürünen lobideki topları güncelle
    onChange: (st) => { if (game.scene.isActive('LobbyScene')) game.scene.getScene('LobbyScene').applyState(st); }
  });

  // ---- Çevrimiçi olaylar ----
  net.on('joined', () => enterRoom());
  net.on('room', () => {
    roomHud.render();
    if (mode === 'online' && !match && game.scene.isActive('LobbyScene')) game.scene.getScene('LobbyScene').applyRoom(net.room);
  });
  net.on('start', (m) => { if (m.setup) startOnline(m.setup); });
  net.on('kicked', () => { flash(i18n.t('online.kicked')); match = null; reveal.stop(); cutscene.stop(); result.hide(); stopScenes(); roomHud.hide(); lobbyChat.hide(); showBrowser(false); });
  net.on('hostLeft', () => { if (mode === 'online') { flash(i18n.t('online.hostLeft')); returnToRoom(); } });
  net.on('disconnected', () => { if (mode === 'online') { flash(i18n.t('online.disconnected')); showMainMenu(); } });
}

// Lobideki BM direği: bayrak seç (dolu bayraklar seçilemez)
export function openLobbyFlagPicker() {
  if (flagPicker.isOpen) return;
  if (mode === 'online') {
    const room = net.room;
    if (!room) return;
    const me = room.players.find((p) => p.id === net.id);
    const taken = new Set(room.players.filter((p) => p.id !== net.id).map((p) => p.flag));
    flagPicker.open({ current: me ? me.flag : net.profile.flag, taken, onPick: (f) => { saveFlag(f); net.setFlag(f); } });
  } else {
    flagPicker.open({ current: lobby.myFlag, taken: new Set(lobby.botFlags), onPick: (f) => lobby.pickFlag(f) });
  }
}

// Lobideki şapka dolabı: şapka seç (kaydedilir, maçta da takılı)
export function openLobbyHatPicker() {
  if (hatPicker.isOpen || flagPicker.isOpen) return;
  const sc = game.scene.isActive('LobbyScene') ? game.scene.getScene('LobbyScene') : null;
  const flag = sc && sc.player ? sc.player.flag : net.profile.flag;
  hatPicker.open({
    current: loadHat(), flag,
    onPick: (id) => {
      saveHat(id);
      if (sc && sc.player) { sc.player.setHat(id); sc.player.setMood('happy', 1.4); }
      if (mode === 'online') net.setHat(id); else net.profile.hat = id;
    }
  });
}

// Odaya girince bayrağım başkasındaysa boştaki ilk bayrağı al
function ensureFreeFlag() {
  const room = net.room;
  if (!room) return;
  const me = room.players.find((p) => p.id === net.id);
  const taken = new Set(room.players.filter((p) => p.id !== net.id).map((p) => p.flag));
  if (me && taken.has(me.flag)) { const free = FLAG_LIST.find((f) => !taken.has(f)); if (free) net.setFlag(free); }
}

// Ekranın ortasında kısa bir mesaj (oyun dışı ekranlarda)
function flash(text) {
  const d = document.createElement('div');
  d.className = 'flash-msg';
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

function stopScenes() {
  // Tüm sahneleri durdur; çok maç sonrası biriken dinleyici/obje sızıntısını azaltmak için
  ['LobbyScene', 'UIScene', 'GameScene', 'BootScene'].forEach((k) => {
    if (isRunning(k)) {
      try { game.scene.stop(k); } catch (e) { /* yoksay */ }
    }
  });
  // Phaser bazen stop sonrası bir frame daha tutar; remotes/bots için garanti
  try {
    const lobbySc = game.scene.getScene('LobbyScene');
    if (lobbySc && lobbySc.bots) { lobbySc.bots.forEach((b) => { try { b.destroy(); } catch (e) {} }); lobbySc.bots = []; }
    if (lobbySc && lobbySc.remotes) { lobbySc.remotes.forEach((b) => { try { b.destroy(); } catch (e) {} }); lobbySc.remotes.clear(); }
  } catch (e) { /* yoksay */ }
}

// ---------------- Ana menü ----------------
export function showMainMenu() {
  mode = 'offline';
  match = null;
  reveal.stop(); cutscene.stop(); result.hide();
  if (net.inRoom) net.leave();
  lobby.hide(); roomHud.hide(); browser.hide(); lobbyChat.hide();
  stopScenes();
  if (game.loop.running) game.loop.sleep();   // menüdeyken oyun motoru boşta çizim yapmasın
  stopAllLoops();
  playMusic('music_lobby');
  menu.show({
    onOnline: () => showBrowser(false),
    onCreate: () => showBrowser(true),
    onSolo: () => { mode = 'offline'; menu.hide(); showLobby(); }
  });
}

function showBrowser(create) {
  menu.hide();
  roomHud.hide(); lobbyChat.hide();
  browser.show({ onBack: () => { browser.hide(); showMainMenu(); }, createFocus: create });
}

// ---------------- Çevrimiçi oda (yürünen lobi + oda arayüzü) ----------------
function enterRoom() {
  if (!net.room) return;
  mode = 'online';
  match = null;
  menu.hide(); browser.hide(); lobby.hide(); result.hide();
  reveal.stop(); cutscene.stop();
  stopScenes();
  if (!game.loop.running) game.loop.wake();
  stopAllLoops();
  playMusic('music_lobby');
  const me = net.room.players.find((p) => p.id === net.id);
  game.scene.start('LobbyScene', { online: true, myFlag: me ? me.flag : net.profile.flag, myName: net.profile.name, room: net.room });
  roomHud.show({ onLeave: leaveRoom, onStart: hostStart, onFlag: openLobbyFlagPicker, onHat: openLobbyHatPicker, onInvite: () => social.openInvite() });
  lobbyChat.show();
  ensureFreeFlag();
}

function leaveRoom() {
  net.leave();
  roomHud.hide(); lobbyChat.hide();
  stopScenes();
  showBrowser(false);
}

// Maç bitti / host çıktı: odadaki yürünen lobiye dön
function returnToRoom() {
  match = null;
  reveal.stop(); cutscene.stop(); result.hide();
  if (net.isHost) net.end();
  if (net.inRoom) enterRoom(); else showBrowser(false);
}

// Host: oyuncular + istenirse test botları, rolleri dağıt, herkese gönder
function hostStart() {
  const room = net.room;
  if (!room || !net.isHost) return;
  const humans = room.players;
  const nBots = roomHud.botsToAdd();
  const used = new Set(humans.map((p) => p.flag));
  const pool = FLAG_LIST.filter((f) => !used.has(f)).sort(() => Math.random() - 0.5);
  const total = humans.length + nBots;
  if (total < 3) return;
  // Rolleri SUNUCU dağıtır (hile koruması); herkes, host dahil, 'start' mesajıyla başlar
  const players = [
    ...humans.map((p) => ({ id: p.id, name: p.name, flag: p.flag })),
    ...pool.slice(0, nBots).map((f, j) => ({ id: 'bot' + j, name: i18n.t('countries.' + f), flag: f, bot: true }))
  ];
  net.start({ players });
}

function startOnline(setup) {
  mode = 'online';
  roomHud.hide(); lobbyChat.hide();
  const players = setup.players.map((p) => ({ ...p, me: p.id === net.id, hat: p.bot ? botHat(p.flag) : (p.hat || 'none') }));
  if (!players.some((p) => p.me)) return;
  startWith(players, net.isHost ? 'host' : 'client', setup.cfg || null);
}

// Yürünen lobi odası (LobbyScene) + üstündeki HTML butonlar
export function showLobby() {
  mode = 'offline';
  menu.hide();
  if (isRunning('BootScene')) game.scene.stop('BootScene');
  if (!game.loop.running) game.loop.wake();
  lobby.show();
  lobby.setStartReady(false);
  stopAllLoops();
  playMusic('music_lobby');
  game.scene.start('LobbyScene', lobby.state());
}

// Lobi sahnesinde başlat bölgesindeyken E / buton: ayarlarla maçı başlat
export function startFromLobby() {
  if (mode === 'offline' && lobby && isRunning('LobbyScene')) { lobby.closeSheets(); startMatch(lobby.state()); }
}

// Oyun sahnesini kur. Animasyon hâlâ oynuyorsa kurulunca uyut (çizim/güncelleme yapmasın).
function buildGame(m) {
  if (m.built || match !== m) return;
  m.built = true;
  // DONMA DÜZELTMESİ: eskiden burada TÜM bayrakların yürüme kareleri (bayrak başına 64 kare) senkron çiziliyordu:
  // 8 kişide ~0,5 sn, 25 kişide ~1,5 sn (telefonda birkaç saniye) rol animasyonu ve oyun donuyordu.
  // Artık sadece duruş karesi hemen hazırlanır; yürüme kareleri arka planda (requestSkins kuyruğu) tamamlanır,
  // kendi topun en öne alınır. Yürüme dokusu hazır olmayan top kısa süre duruş karesiyle kayar.
  flushSkins(m.flags, undefined, ['idle']);
  const me = m.players.find((p) => p.me);
  if (me) flushSkins([me.flag]);    // kendi topunun yürüme kareleri hemen hazır (tek bayrak, kısa)
  game.scene.getScene('GameScene').events.once('create', (scene) => {
    if (match === m && !m.revealDone) scene.scene.sleep();
  });
  game.scene.start('GameScene', { players: m.players, net: m.net, cfg: m.cfg });
}

function enterGame(m) {
  if (match !== m) return;
  m.revealDone = true;
  if (!m.built) buildGame(m);
  game.scene.run('UIScene');
  playMusic('music_game');
  // Uyutma işlemi sıraya alınmış olabilir: birkaç kare boyunca kontrol edip uyandır.
  // Oyun ekrana çizilmeye başlayınca rol animasyonu örtüsünü yumuşakça kaldır.
  let tries = 0, ready = 0;
  const wake = () => {
    if (match !== m) return;
    if (game.scene.isSleeping('GameScene')) game.scene.wake('GameScene');
    if (game.scene.isActive('GameScene') && !game.scene.isSleeping('GameScene')) ready++;
    if (ready === 2) { game.scene.getScene('GameScene').playBomb(); reveal.fadeOut(); }
    if (++tries < 40) requestAnimationFrame(wake);
    else if (ready < 2) reveal.fadeOut();
  };
  wake();
}

// settings: { myFlag, botFlags, playerCount, forcedRole }
export function startMatch(settings) {
  lastSettings = settings;
  const roles = assignRoles(settings.playerCount, settings.forcedRole);
  const players = [
    { id: 'me', flag: settings.myFlag, role: roles[0], me: true, name: net.profile.name || '', hat: loadHat() },
    ...settings.botFlags.map((flag, i) => ({ id: 'b' + i, flag, role: roles[i + 1], me: false, hat: botHat(flag) }))
  ];
  startWith(players, 'offline');
}

// players: [{ id, flag, role, me, name, bot }]   netMode: 'offline' | 'host' | 'client'
function startWith(players, netMode, cfg = null) {
  net.lastReward = null;
  result.hide();
  cutscene.stop();
  preloadKills();
  const me = players.find((p) => p.me);
  const m = match = { players, net: netMode, cfg, flags: players.map((p) => p.flag), built: false, revealDone: false };
  if (!game.loop.running) game.loop.wake();
  requestSkins(m.flags);
  lobby.hide();
  menu.hide();
  stopMusic(400);   // rol videosunun kendi sesi var
  stopAllLoops();
  if (isRunning('LobbyScene')) game.scene.stop('LobbyScene');
  // ÖNEMLİ: play() bu tıklamanın içinde çağrılmalı (sesli oynatma izni)
  reveal.play(me.role, me.flag, () => enterGame(m));   // sesler videoya senkron (RoleReveal.js)
  // Video yüklenirken (ilk siyah kısım) oyunu arkada kur
  setTimeout(() => buildGame(m), 120);
}

export function backToLobby() {
  if (mode === 'online') { match = null; reveal.stop(); cutscene.stop(); result.hide(); stopScenes(); leaveRoom(); return; }
  match = null;
  reveal.stop();
  cutscene.stop();
  result.hide();
  if (isRunning('UIScene')) game.scene.stop('UIScene');
  if (isRunning('GameScene')) game.scene.stop('GameScene');
  showLobby();
}

// Öldürme / vurma animasyonu (sadece bu cihazdaki oyuncu olayın içindeyse)
export function playKillCutscene(clip, killerFlag, victimFlag, caption, tone) {
  cutscene.play(clip, killerFlag, victimFlag, caption, tone);
  // Animasyon bitince ölen tekrar "kill" sesini duyar (bu animasyon sadece ölene oynar)
  setTimeout(() => cutscene.whenIdle(() => sfx('kill')), 200);
}

// Toplantı başlarken öldürme animasyonu varsa kapat (üst üste binmesin)
export function stopKillCutscene() { if (cutscene.busy) cutscene.stop(); }

// Maç bitti: animasyon varsa bitmesini bekle, sonra sonuç ekranı
export function gameOver(res) {
  const m = match;
  setTimeout(() => cutscene.whenIdle(() => {
    if (match !== m) return;
    stopAllLoops();
    stopMusic(500);
    sfx(teamOf(res.me.role) === res.winner ? 'win' : 'lose');
    result.show(res, {
      online: mode === 'online',
      // Aynı ayarlarla yeni maç (bu tıklamanın içinde başlar -> rol videosu sesli oynar)
      onReplay: () => {
        if (isRunning('UIScene')) game.scene.stop('UIScene');
        if (isRunning('GameScene')) game.scene.stop('GameScene');
        startMatch(lastSettings);
      },
      onLobby: () => (mode === 'online' ? (stopScenes(), returnToRoom()) : backToLobby())
    });
  }), 700);
}

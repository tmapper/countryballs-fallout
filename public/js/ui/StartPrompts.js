// ============================================================
// StartPrompts.js - Açılışta: 1) "Mobil mi, PC mi?"  2) "Yeni Güncelleme!" (yenilikler listesi)
// ============================================================
// YENİ GÜNCELLEME NOTU: her sürümde sadece UPDATE nesnesini değiştir (id değişince herkese bir kez gösterilir).
import { i18n } from '../systems/I18n.js';
import { getDevice, setDevice, applyDeviceClass } from '../systems/Device.js';
import { icon } from './Icons.js';

export const UPDATE = {
  id: '0.9.20',
  tr: {
    title: 'Yeni Güncelleme!',
    items: [
      'Telefonda yazı yazarken (sohbet, komutlar) ekranın kararması ve küçülmesi düzeltildi',
      'Toplantı başlar başlamaz herkes KAFETERYAYA ışınlanır',
      'Yeni toplantı ekranı: adım göstergesi, geri sayım çubuğu, oy sayacı',
      'Daha akıcı: FPS sınırı kalktı, botlar artık her karede yürüyor (takılma yok)',
      'Ayarlar her yerde: lobide ve oda listesinde de dişli butonu',
      'Ana menü artık radyoaktif reaktör sığınağı: parlayan çekirdek, buhar, uyarı ışıkları',
      'Botlar artık 2 kat hızlı koşmuyor (6 ve altı oyunculu maçlardaki hata düzeltildi)',
      'Butonlar yenilendi: emoji yerine oyunun kendi ikonları',
      'Grafik ayarı artık gerçekten çalışıyor (Yüksek / Orta / Düşük) + FPS göstergesi',
      'Moderatörlük geldi: deneyimli oyuncular için gizli bir kapı…'
    ]
  },
  en: {
    title: 'New Update!',
    items: [
      'Fixed the screen going black / shrinking while typing on phones (chat, commands)',
      'As soon as a meeting starts, everyone is teleported to the CAFETERIA',
      'New meeting screen: phase steps, countdown bar, vote counter',
      'Smoother: no more FPS cap, bots now walk every frame (no stutter)',
      'Settings everywhere: gear button in the lobby and the room list too',
      'The main menu is now a radioactive reactor shelter: glowing core, steam, warning lights',
      'Bots no longer run twice as fast (bug in matches with 6 or fewer players fixed)',
      'Refreshed buttons: the game\'s own icons instead of emoji',
      'The graphics setting really works now (High / Medium / Low) + FPS counter',
      'Moderation is here: a hidden door for experienced players…'
    ]
  }
};
const SEEN_KEY = 'cfs.seenUpdate';

function modal(html) {
  const d = document.createElement('div');
  d.className = 'sp-modal';
  d.innerHTML = `<div class="sp-card">${html}</div>`;
  document.body.appendChild(d);
  return d;
}

function askDevice() {
  return new Promise((done) => {
    const tr = i18n.lang !== 'en';
    const d = modal(`<h2>${tr ? 'Nerede oynuyorsun?' : 'Where do you play?'}</h2>
      <p>${tr ? 'Kontroller ve ekran boyutu buna göre ayarlanır. Sonra Ayarlar\'dan değiştirebilirsin.' : 'Controls and screen layout adapt to this. You can change it later in Settings.'}</p>
      <div class="sp-choices"><button type="button" data-d="mobile"><b>${icon('gamepad')}</b>${tr ? 'Mobil' : 'Mobile'}<small>${tr ? 'Dokunmatik joystick' : 'Touch joystick'}</small></button>
      <button type="button" data-d="pc"><b>${icon('expand')}</b>PC<small>${tr ? 'Klavye + fare' : 'Keyboard + mouse'}</small></button></div>`);
    d.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { setDevice(b.dataset.d); d.remove(); done(); }));
  });
}

function showUpdate() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch (e) { /* yoksay */ }
  if (seen === UPDATE.id) return;
  const t = UPDATE[i18n.lang] || UPDATE.tr;
  const d = modal(`<div class="sp-badge">v${UPDATE.id}</div><h2>${icon('rocket')} ${t.title}</h2><ul>${t.items.map((x) => `<li>${x}</li>`).join('')}</ul>
    <button type="button" class="sp-ok">${i18n.lang === 'en' ? 'LET\'S PLAY' : 'OYNAYALIM'}</button>`);
  d.querySelector('.sp-ok').addEventListener('click', () => { try { localStorage.setItem(SEEN_KEY, UPDATE.id); } catch (e) { /* yoksay */ } d.remove(); });
}

export async function runStartPrompts() {
  applyDeviceClass();
  // Dil dosyaları yüklenene kadar bekle (yoksa İngilizce tarayıcıda Türkçe çıkıyordu)
  for (let i = 0; i < 100 && !Object.keys(i18n.data || {}).length; i++) await new Promise((r) => setTimeout(r, 100));
  if (!getDevice()) await askDevice();
  showUpdate();
}

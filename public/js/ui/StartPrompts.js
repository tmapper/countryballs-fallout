// ============================================================
// StartPrompts.js - Açılışta: 1) "Mobil mi, PC mi?"  2) "Yeni Güncelleme!" (yenilikler listesi)
// ============================================================
// YENİ GÜNCELLEME NOTU: her sürümde sadece UPDATE nesnesini değiştir (id değişince herkese bir kez gösterilir).
import { i18n } from '../systems/I18n.js';
import { getDevice, setDevice, applyDeviceClass } from '../systems/Device.js';

export const UPDATE = {
  id: '0.9.15',
  tr: {
    title: 'Yeni Güncelleme!',
    items: [
      '🛠 Görev yaptıktan sonra joystick\'in donması düzeltildi',
      '🎮 Mobilde sağ üstte küçük "Joystik resetle" butonu: joystick takılırsa basman yeter',
      '⏻ Ayarlar\'a ve ana menüye ÇIKIŞ butonu eklendi',
      '🚩 12 tarihi bayrak artık gerçek bayrak resimleriyle çiziliyor',
      '🌐 Sunucu adresi uzaktan güncellenebiliyor: sunucu değişince uygulamayı yeniden indirmen gerekmez'
    ]
  },
  en: {
    title: 'New Update!',
    items: [
      '🛠 Fixed the joystick freezing after finishing a task',
      '🎮 Small "Reset joystick" button at the top right on mobile: tap it if the joystick gets stuck',
      '⏻ Added an EXIT button to Settings and the main menu',
      '🚩 The 12 historical flags are now drawn from real flag images',
      '🌐 The server address can be updated remotely: no re-download when the server changes'
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
      <div class="sp-choices"><button type="button" data-d="mobile"><b>📱</b>${tr ? 'Mobil' : 'Mobile'}<small>${tr ? 'Dokunmatik joystick' : 'Touch joystick'}</small></button>
      <button type="button" data-d="pc"><b>🖥</b>PC<small>${tr ? 'Klavye + fare' : 'Keyboard + mouse'}</small></button></div>`);
    d.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { setDevice(b.dataset.d); d.remove(); done(); }));
  });
}

function showUpdate() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch (e) { /* yoksay */ }
  if (seen === UPDATE.id) return;
  const t = UPDATE[i18n.lang] || UPDATE.tr;
  const d = modal(`<div class="sp-badge">v${UPDATE.id}</div><h2>🚀 ${t.title}</h2><ul>${t.items.map((x) => `<li>${x}</li>`).join('')}</ul>
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

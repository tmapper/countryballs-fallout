// ============================================================
// StartPrompts.js - Açılışta: 1) "Mobil mi, PC mi?"  2) "Yeni Güncelleme!" (yenilikler listesi)
// ============================================================
// YENİ GÜNCELLEME NOTU: her sürümde sadece UPDATE nesnesini değiştir (id değişince herkese bir kez gösterilir).
import { i18n } from '../systems/I18n.js';
import { getDevice, setDevice, applyDeviceClass } from '../systems/Device.js';

export const UPDATE = {
  id: '0.9.16',
  tr: {
    title: 'Yeni Güncelleme!',
    items: [
      '🎟 Sığınak Bileti artık SAĞA KAYDIRARAK ilerliyor: barlar yatay bir yolda, parmakla / fareyle sürükle',
      '📐 Hiçbir ekranda kaydırma yok: menüler ve pencereler mobilde ve PC\'de ekrana tam sığıyor',
      '📦 Kasalar ve bayrak koleksiyonu Bilet ekranında sekmelere taşındı'
    ]
  },
  en: {
    title: 'New Update!',
    items: [
      '🎟 The Shelter Pass now moves sideways: bars sit on a horizontal track, drag or swipe to move on',
      '📐 No more scrolling anywhere: menus and windows fit the screen on mobile and PC',
      '📦 Crates and the flag collection moved into tabs on the Pass screen'
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

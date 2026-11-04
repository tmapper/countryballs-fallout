// ============================================================
// StartPrompts.js - Açılışta: 1) "Mobil mi, PC mi?"  2) "Yeni Güncelleme!" (yenilikler listesi)
// ============================================================
// YENİ GÜNCELLEME NOTU: her sürümde sadece UPDATE nesnesini değiştir (id değişince herkese bir kez gösterilir).
import { i18n } from '../systems/I18n.js';
import { getDevice, setDevice, applyDeviceClass } from '../systems/Device.js';

export const UPDATE = {
  id: '0.9.11',
  tr: {
    title: 'Yeni Güncelleme!',
    items: [
      '🗺 Büyük harita (HARİTA butonu) artık ekrana tam sığıyor',
      '💬 Botlar toplantıda yazdıklarını okur: bir ülke/oyuncu adı yazarsan ona oy verirler, suçlanan bot kendini savunur',
      '🧠 Botlar hafızalı: cesedin yanında kimi gördüklerini hatırlar, tünele gireni bilir, cinayeti görünce hemen bildirir ve kanıta göre oy verir',
      '🤖 Daha zeki botlar: katil tenhada öldürür, tünel ve sabotaj kullanır; şerif katili görünce vurur (hile yok, aynı kurallar)',
      '🗺 Yepyeni harita: çapraz halka, ortadan kestirme geçiş (eski harita da seçilebilir)',
      '⚙ Kurucu ayarları: harita, hız, tartışma/oylama süresi, öldürme bekleme, katil/şerif sayısı, 25 kişi',
      '👑 Kurucu oyuncu atabilir ve kuruculuğu devredebilir',
      '👻 Hayaletler duvarlardan geçer, daha hızlıdır ve birbirini görür',
      '💥 Öldürme animasyonunda patlama efekti',
      '⛰ Duvarların arkasında artık toprak var',
      '🎩 Botlar sadece ülkesine uygun şapka takar',
      '📱 Mobil / PC seçimi (Ayarlar\'dan değiştirilebilir)',
      '🛠 Görev sonrası donma ve bellek sorunları düzeltildi, oyun çok daha hafif'
    ]
  },
  en: {
    title: 'New Update!',
    items: [
      '🗺 The big map (MAP button) now fits the screen',
      '💬 Bots read meeting chat: type a country/player name and they vote for them, the accused bot defends itself',
      '🧠 Bots have memory: they remember who was near the body, know who vented, report kills instantly and vote on evidence',
      '🤖 Smarter bots: impostors kill when alone, use vents and sabotage; sheriffs shoot the killer on sight (no cheating, same rules)',
      '🗺 Brand new map: diagonal loop with a shortcut (old map still selectable)',
      '⚙ Host settings: map, speed, discussion/vote time, kill cooldown, impostor/sheriff count, 25 players',
      '👑 Host can kick players and transfer host',
      '👻 Ghosts pass through walls, move faster and see each other',
      '💥 Explosion effect in kill animations',
      '⛰ Soil behind the walls',
      '🎩 Bots only wear hats that fit their country',
      '📱 Mobile / PC choice (change it in Settings)',
      '🛠 Fixed freezing after tasks and memory issues, much lighter game'
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

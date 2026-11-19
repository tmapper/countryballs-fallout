// ============================================================
// StartPrompts.js - Açılışta: 1) "Mobil mi, PC mi?"  2) "Yeni Güncelleme!" (yenilikler listesi)
// ============================================================
// YENİ GÜNCELLEME NOTU: her sürümde sadece UPDATE nesnesini değiştir (id değişince herkese bir kez gösterilir).
import { i18n } from '../systems/I18n.js';
import { getDevice, setDevice, applyDeviceClass } from '../systems/Device.js';
import { icon } from './Icons.js';

export const UPDATE = {
  id: '0.9.23',
  tr: {
    title: 'Yeni Güncelleme!',
    items: [
      '5 yeni görev: Kahve doldur, İlaçları ayır, Jeneratörü kurla, Bitkileri sula, Yatakları düzelt',
      'Çok oyunculu akıcılık baştan yazıldı: kötü/değişken internette de takılma yok',
      'Ölen katiller hayaletken de sabotaj yapabilir',
      'Çok oyunculuda diğer oyuncular ve botlar çok daha akıcı hareket ediyor',
      'Emoji + hızlı sohbet: 😀 düğmesi ya da G tuşu ("Beni takip et" diyince botlar peşine takılabilir)',
      'Yeni oylama ekranı: karta dokun, ✓ OY VER ile onayla (yanlış oy yok), ATILIYOR / BERABERE damgası',
      'Daha akıllı botlar: kaçan katil, mazeret hatırlayan masumlar, şüpheliyi arayan şerif',
      'Ölen botlar hayalet olarak görevlerine devam eder',
      'Şerif ölünce silahı yere düşer: alan masum yeni şerif olur',
      'Kurucu oyundan çıkınca maç bitmez, başka oyuncu kurucu olur',
      'Acil düğme 15 sn bekler, sabotaj sırasında basılamaz; toplantıdan sonra sabotaj hemen hazır',
      'Tek kişilik: harita seçimi ve bot sayısı (MAÇ AYARLARI)',
      'Ayarlar: Tuş atama (PC), Buton yerleri (mobil), Performans modu; her yerde aynı ayarlar penceresi',
      'Görevler artık ilgili eşyaların yanında, haritalardaki yanlış yerdeki eşyalar düzeltildi',
      'Donma ve kasma düzeltmeleri, yeni yükleme ekranı, yeni jeton… ve hayaletler için gizli bir sürpriz 👻'
    ]
  },
  en: {
    title: 'New Update!',
    items: [
      '5 new tasks: Brew coffee, Sort medicine, Wind the generator, Water the plants, Make the beds',
      'Rewritten multiplayer smoothing: no stutter even on bad or changing connections',
      'Dead impostors can sabotage as ghosts',
      'Much smoother movement of other players and bots in multiplayer',
      'Emotes + quick chat: 😀 button or G key (say "Follow me" and bots may tag along)',
      'New voting screen: tap a card, confirm with ✓ VOTE (no misclicks), EJECTED / TIE stamps',
      'Smarter bots: impostors flee, crewmates remember alibis, sheriffs hunt suspects',
      'Dead bots keep doing their tasks as ghosts',
      'When the sheriff dies the gun drops: a crewmate who picks it up becomes the new sheriff',
      'If the host leaves, the match goes on with a new host',
      'Emergency button waits 15s and is disabled during sabotage; sabotage is ready right after a meeting',
      'Solo: map selection and bot count (MATCH SETTINGS)',
      'Settings: Key bindings (PC), Button layout (mobile), Performance mode; the same settings window everywhere',
      'Tasks now sit next to related objects, misplaced map objects fixed',
      'Freeze and stutter fixes, new loading screen, new coin… and a secret surprise for ghosts 👻'
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

const TURKISH_UI = new Set(['tr', 'az', 'tk']);   // Türkçeye yakın Latin harfli diller

function askDevice() {
  return new Promise((done) => {
    const tr = TURKISH_UI.has(i18n.lang);   // Türk dilleri Türkçe metni, diğerleri İngilizceyi görür
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
  const t = UPDATE[i18n.lang] || (TURKISH_UI.has(i18n.lang) ? UPDATE.tr : UPDATE.en || UPDATE.tr);
  const d = modal(`<div class="sp-badge">v${UPDATE.id}</div><h2>${icon('rocket')} ${t.title}</h2><ul>${t.items.map((x) => `<li>${x}</li>`).join('')}</ul>
    <button type="button" class="sp-ok">${TURKISH_UI.has(i18n.lang) ? 'OYNAYALIM' : 'LET\'S PLAY'}</button>`);
  d.querySelector('.sp-ok').addEventListener('click', () => { try { localStorage.setItem(SEEN_KEY, UPDATE.id); } catch (e) { /* yoksay */ } d.remove(); });
}

export async function runStartPrompts() {
  applyDeviceClass();
  // Dil dosyaları yüklenene kadar bekle (yoksa İngilizce tarayıcıda Türkçe çıkıyordu)
  for (let i = 0; i < 100 && !Object.keys(i18n.data || {}).length; i++) await new Promise((r) => setTimeout(r, 100));
  // Yükleme ekranı kapanmadan pencere açılmasın (üst üste binmesin)
  for (let i = 0; i < 300 && document.getElementById('cfs-loader'); i++) await new Promise((r) => setTimeout(r, 100));
  if (!getDevice()) await askDevice();
  showUpdate();
}

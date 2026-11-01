# Countryballs: Fallout Suspects

2D sosyal çıkarım oyunu (Phaser 3). Şu an tek oyunculu test sürümü: lobi → rol animasyonu → sığınak haritası, diğer oyuncular bot.

## Çalıştırma
```
npm install
npm start          # http://localhost:3000
```
- Mobil joystick'i masaüstünde denemek için: `http://localhost:3000/?joystick=1`
- Tek dosya sürümü (sunucusuz, telefonda direkt açılır): `node tools/build-html.js` → `dist/countryballs-fallout-suspects.html`

## Kontroller
- PC: WASD / ok tuşları, **F2** sis aç/kapa, **Esc** lobiye dön
- Mobil: ekranın sol yarısına dokunup sürükle; sağ üstte **Lobi** ve **Rolleri göster**

## Özellikler (Aşama 4.1)
- **Lobi**: 25 bayrak, oyuncu sayısı 4–10 (diğerleri bot), rol şansları, rol testi (kendi rolünü sabitle)
- **Roller**: 1 Katil + 1 Şerif + kalanlar Masum. Oyuncu başına şans = Katil 1/N, Şerif 1/N, Masum (N-2)/N (4 kişide %25 / %25 / %50)
- **Rol animasyonu**: "SENİN ROLÜN" videosu, yeşil top WebGL ile oyuncunun bayrağına boyanır
- **2K çizim**: oyun uzun kenarı ~2560 piksel olacak şekilde çizilir (`systems/Resolution.js`)
- **Botlar**: odalar arasında koridorlardan gezer (`systems/BotBrain.js`)
- Duran karakter `SabitDurma` karesiyle, yürüyen karakter yürüme klibiyle gösterilir

## Aşama 6: Yeni görevler, seviye sistemi, hesap istatistikleri
- **6 yeni görev türü, 14 yeni istasyon** (toplam 17 tür, 39 istasyon; oyuncu başına yine 5 görev): **yakıt** (çizgide KİLİTLE, 3 tur), **sıralı düğmeler** (1'den 9'a), **borular** (kareleri çevirip sol girişten sağ kenara yol aç), **atık ayrıştırma** (tehlikeli/normal), **frekans** (iki kaydırıcıyla dalgayı uydur), **biyometrik tarama** (elini basılı tut). Kod: `ui/TaskPanel.js`, istasyonlar: `systems/Tasks.js` (konumlar `BunkerMap.canStand` ile doğrulandı).
- **İstatistikler** (sunucuda, hesapla birlikte `data/accounts.json`): oynanan/kazanılan/kaybedilen maç, kazanma oranı, güncel ve en iyi seri, Katil/Şerif/Masum olarak oynanan maç, masum ve katil galibiyeti, yapılan görev, öldürme, terk edilen maç.
- **Seviye**: istatistiklerden hesaplanır (ayrıca saklanmaz). `XP = maç x 20 + galibiyet x 30 + görev x 4 + öldürme x 8`. Seviye n -> n+1 için `80 + 20n` XP gerekir, en yüksek seviye 100. Unvanlar: Sığınak Çaylağı (1), Sığınakçı (5), Gözcü (10), Dedektif (20), Komutan (35), Efsane (50). Formül ve eşikler `server/index.js` başında (`XP`, `TITLE_AT`); istemcideki eşikler `systems/Levels.js`.
- **Profil**: ana menüde KİMLİK KARTI'na tıkla. Maç sonu ekranında kazanılan XP, seviye atlama ve XP çubuğu görünür.
- **Nasıl sayılır?** Maç bitince host sonucu sunucuya bildirir (`matchResult`); kazananı sunucu, maç başında kaydettiği rollerden hesaplar. Sayılması için: maç en az 40 sn sürmüş olmalı ve en az 2 farklı hesaplı gerçek oyuncu bulunmalı (botlarla tek başına XP kasılamaz). Maç sırasında odadan çıkan oyuncu yenilgi yazılır. Tek başına (botlarla) oyun istatistiğe yazılmaz.
- **Sınır**: oyun "host yetkili" olduğu için kötü niyetli bir host sonucu yalan söyleyebilir. Görev (en çok 5) ve öldürme (en çok 10) sayıları sunucuda sınırlanır, ama tam hile önleme için ileride kuralların sunucuda çalışması gerekir (Aşama 7 fikri).
- **Hesapları yedekle**: sunucuyu `ADMIN_KEY=gizlisifre node server/index.js` ile başlatırsan `https://adres/api/backup?key=gizlisifre` hesapları (istatistiklerle) indirir. Render ücretsiz planda disk silindiği için ya kalıcı disk (`DATA_DIR`) kullan ya da düzenli yedek al.

## Aşama 5.4: Menü, lobi, hesaplar, performans
- **Ana menü**: sığınak terminali (yeşil fosforlu CRT, ok tuşları + Enter), sağ üstte KİMLİK KARTI. İsteğe bağlı görseller: `public/assets/menu/menu_bg.jpg`, `logo.png` (promptlar: `docs/GORSEL_PROMPTLARI.md`).
- **Hesaplar**: isim + şifre ile kayıt/giriş (sunucuda scrypt ile şifrelenir, `data/accounts.json`). Çevrimiçi oyun için giriş gerekir, tek başına oyun misafir olarak oynanır. Hesaplarda maç istatistikleri ve bunlardan hesaplanan seviye var (Aşama 6).
- **Lobi**: sığınağın dışında düz bir çimenlik (harita görünmez). Üstte sığınak kapısı (BAŞLAT), solda **BM bayraklı direk**: yanına gidip E (ya da BAYRAK SEÇ butonu) ile bayrak seçilir. Başkasının bayrağı seçilemez (sunucu da kontrol eder). Lobi arayüzündeki eski bayrak seçimi kaldırıldı.
- **Performans**: sis artık sadece kamera bölgesi kadar küçük bir doku (eskiden tüm dünya + bulanıklaştırma filtresi her karede), görüş ışınları azaltıldı, çözünürlük üst sınırı 1080p, harita dokuları en fazla 1.5x, ses efektleri havuzdan çalınır, menü 30 kare/sn.
- **Ses**: başlangıç alarmı, kapı ve elektrik sesleri kısıldı. Öldürme animasyonu bitince ölen kişi tekrar "kill" sesini duyar.

## Çok oyunculu kurulum
### A) Aynı evde / aynı Wi-Fi'da (en kolay, test için)
1. Bilgisayara Node.js kur (nodejs.org, LTS).
2. Bu klasörde: `node server/index.js`
3. Sen: http://localhost:3000 · Arkadaşların: http://BILGISAYARIN_IP:3000 (IP: Windows'ta `ipconfig` -> IPv4). Windows Güvenlik Duvarı sorarsa "İzin ver".

### B) İnternetten (Render.com, ücretsiz)
1. github.com'da yeni bir depo aç, bu klasörün içeriğini yükle.
2. render.com -> New -> Web Service -> depoyu seç.
   - Build Command: boş bırak (ya da `npm install`)
   - Start Command: `node server/index.js`
   - Instance type: Free
3. Render bir adres verir (ör. https://countryballs-fallout.onrender.com). Herkes bu adresten tarayıcıyla oynar.
4. Tek dosya HTML / exe / apk sürümünde: Ana menü -> Ayarlar -> Sunucu adresi kısmına bu adresi yaz.
- Ücretsiz planda sunucu 15 dk boş kalınca uyur; ilk açılış ~1 dk sürebilir.
- Ücretsiz planda disk kalıcı DEĞİL: sunucu yeniden başlarsa hesaplar silinir. Kalıcı olsun istersen Render'da bir Disk ekle (ücretli) ve ortam değişkeni `DATA_DIR=/var/data` ver; ya da ileride bir veritabanına geçeriz.

## Aşama 5.3: Oyun içi görünüm (`scenes/GameFx.js`)
- Oyuncunun etrafında sıcak ışık (ışıklar kesilince daha belirgin), ekranda hafif vinyet.
- Görüş sisi koyu lacivert ve kenarları yumuşak (duvar kenarında sert çizgi yok).
- Yürürken toplar hafifçe esner/zıplar, ayak altında toz kalkar; havada süzülen toz zerreleri.
- Ölüm: kan sıçraması, ekran sarsıntısı, ruh yukarı süzülür. Hayalet olunca top hafifçe süzülür.
- Tünel: giriş ve çıkışta duman bulutu. Şerif ateşi: mermi izi + namlu kıvılcımı. Görev bitince yeşil ışıltı.

## Aşama 5.2: Oynanış
- **Görevler**: 11 tür, 26 istasyon, oyuncu başına 5 görev. Yeni: **tuş takımı** (kodu gir), **hafıza** (yanan sırayı tekrarla, 3 tur), **kart okut** (doğru hızda kaydır), **hizala** (göstergeleri çevir), **veri indir → İletişim'e yükle** (iki aşamalı).
- Katil'in **sahte görev listesi** var (yapamaz), kimseye belli olmasın diye.
- **Botlar görevlerine gerçekten yürür** ve başında bekler; görev çubuğu onlar yaptıkça dolar (Katil bot da sahte görev yapar). Koridorda takılma hatası düzeltildi.
- **Görev oku**: en yakın görev ekranda değilse kenarda sarı ok yönü gösterir; sabotajda kırmızı ok tamir yerini gösterir.
- Görev listesi her zaman sol üstte (yarı saydam kutu).
- **Butonlar**: ikonlu, parlak yuvarlak butonlar; bekleme süresi dolan bir halka ve kararan dilimle gösterilir; basınca yaylanır.
- **Harita canlı**: reaktör nabız gibi parlar, laboratuvar tankları ve O2 tankları ışır, ekranlar titrer, duvar lambaları ara sıra göz kırpar, acil masası kırmızı yanar.
- Yürüme hızı 240 → 290.

## Aşama 5.0: Ana menü + çevrimiçi lobiler
- **Sinematik ana menü** (`ui/MainMenu.js`): sisli sığınak, dev kasa kapısı, uyarı ışıkları, yavaş kamera. Takma ad + bayrak, Çevrimiçi Oyna, Lobi Kur, Tek Başına (botlarla), Ayarlar (dil, ses, sunucu adresi), Nasıl Oynanır.
- **Lobiler** (`ui/OnlineLobby.js`): öne çıkanlar (en kalabalık 3 lobi), tüm lobiler, kodla katıl, lobi kur (ad, en fazla oyuncu, açık/özel). Oda içinde oyuncular birlikte yürür; kurucu test botlarını açıp kapatır ve oyunu başlatır.
- **Çok oyunculu** (`scenes/GameNet.js`): kurucunun oyunu yönetir (roller, öldürme, toplantı/oylama, sabotaj, görevler, botlar, oyun sonu); herkes kendi konumunu gönderir.
- **Sunucu** (`server/index.js`): ek paket gerekmez. `node server/index.js` -> http://localhost:3000

### İnternete koymak (ücretsiz, Render.com)
1. Bu klasörü GitHub'a yükle.
2. render.com -> New -> Web Service -> depoyu seç. Build Command: (boş) · Start Command: `node server/index.js`
3. Verilen adresi (ör. https://oyunun.onrender.com) arkadaşlarına gönder; tarayıcıdan direkt oynanır.
4. Tek dosya HTML / exe / apk ile oynayacaksan: Ayarlar -> Sunucu adresi kısmına bu adresi yaz.

## Aşama 4.1: Bildir, toplantı, sabotaj, mini harita, 1080p
- **Netlik**: oyun ekranın gerçek piksel çözünürlüğünde çizilir, en az 1080p en fazla 2K (telefonda 1080p). Harita dokuları gerektiğinde 1.5-2 kat çözünürlükte üretilir, sis 2 kat daha ince taneli (`systems/Resolution.js`, `map/MapRenderer.js`). Ana menü sahnesi önceden çizilmiş katmanlarla, kare hızı sınırlı (kasmaz).
- **Gerçekçi kan**: ölen topun altında düzensiz, ıslak parlamalı, sıçramalı ve yavaşça yayılan kan gölü (`scenes/GameExtras.js` → `paintBloodPool`).
- **BİLDİR** (R / ekrandaki buton): cesede yakınken toplantı başlar. Botlar da gördükleri cesedi bildirir. Ana salondaki masada **acil toplantı** (E, maçta 1 hak).
- **Toplantı + oylama** (`ui/MeetingScreen.js`): tartışma (12 sn, botlar sohbet eder: gördüklerini söyler, suçlar, savunur) → oylama (25 sn, oyuncu veya GEÇ) → sonuçlar → atılma ekranı ("X Katildi / değildi"). Sonra cesetler kalkar, herkes masaya döner.
- **Sabotaj** (Katil, F / SABOTAJ butonu, `systems/Sabotage.js`): Işıklar (masumların görüşü daralır), Reaktör ve Oksijen (45 sn içinde tamir edilmezse Katil kazanır). Tamir: elektrik panosu / reaktör vanası / O2 vanası başında E veya TAMİR. Botlar tamire koşar; bot Katil de sabotaj yapar. Toplantı sabotajı iptal eder.
- Sol üstteki bilgi yazıları **Bilgi (H)** butonuyla açılıp kapanır (tercih hatırlanır, kayarak açılır).
- **Animasyonlar**: toplantı başında büyük "CESET BULUNDU / ACİL TOPLANTI" giriş ekranı, panel ve oyuncu kartları sırayla gelir, oy damgası ve oy sayıları tek tek düşer, atılma yazıları yavaşça belirir; butonlar "pop" ile çıkar, hazır olunca nabız atar; bildirimler büyüyerek gelir; sabotaj menüsü ve mini harita kayarak açılır.
- **Mini harita** (`ui/MiniMap.js`): sağ üstte; konumun (mavi), görevlerin (sarı), sabotaj tamir yeri (yanıp sönen kırmızı). Tıklayınca büyür ve oda adları görünür.
- Sesler: `vote`, `music_meeting`, `oxygen_alert` artık kullanılıyor.

## Aşama 4.0: Yeni harita (Among Us tarzı)
- **Yeni düzen** (`map/BunkerMap.js`): 14 oda, 20 koridor, döngülü yollar. Yeni odalar: **Yemekhane, Laboratuvar, İletişim**. Dünya 6450x4100.
- **Görünüm** (`map/MapPainter.js`, `map/MapRenderer.js`): binanın dışı koyu boşluk; kalın açık renk duvarlar, **yan duvarlar** ve odaların üstünde paneli/lambalı **ön duvar yüzü** (`WALL_FACE`, `WALL_THICK`); zeminlerde tavan ışığı, kir ve duvar dibi gölgesi; koridorlarda kenar şeritleri ve ledler.
- Yeni eşyalar: uzun yemek masası, tezgâh, kimyasal tank, uydu çanağı, saksı bitkisi, havalandırma, su birikintisi, forklift. Ranza ve tünel kapağı artık gerçek görselle çiziliyor.
- 6 tünel çifti, 13 görev istasyonu (yeni: kablo-İletişim, Geiger-Laboratuvar, filtre-Yemekhane/Revir).
- **Görseller**: `tools/keyprops.py` yeşil perdeyi sadece resmin kenarına bağlı bölgelerden ve perdeyle aynı renkteki iç boşluklardan siler; otomattaki yeşil paketler gibi iç renkler korunur. Raf, ranza, revir yatağı ve jeneratördeki yeşil boşluklar temizlendi.

## Aşama 3.9: Sesler + düzeltmeler
- **Sesler** (`public/assets/sounds/*.mp3`, `js/systems/Sound.js`): lobi ve oyun müziği, adım, buton tıklama, öldürme, ateş, ceset bulundu, tünel, görev bitti, görev sesleri (kablo, şalter, vana, Geiger, filtre), bomba anı (elektrik gider, kapı mühürlenir, alarm, elektrik gelir), kazanma/kaybetme. **M** tuşu sesi açar/kapatır.
- "SENİN ROLÜN" ekranında videonun iki yanındaki boşluk videonun kenar rengini yavaşça alır (siyah kenar kalmaz).
- "SENİN ROLÜN" sesleri videoya senkron: yazı yazılırken daktilo tıkları, 1.4. saniyede rol açılırken role özel vuruş (Katil: bıçak, Şerif: silah, Masum: zafer).
- Öldürme/vurma animasyonu sadece ölene oynar; öldüren/vuran oyuna devam eder.
- **Düzeltme: öldürme animasyonu hiç oynamıyordu.** `KillCutscene` ilk karede zaman eksi çıkınca kare -1 oluyor, hata verip duruyordu; ekran kırmızı kalıyor, sonuç ekranı da gelmiyordu. Başlangıç zamanı artık ilk karenin zamanından alınıyor.
- Öldürme/vurma animasyonunun arkası artık kırmızı/mavi değil, koyu.
- Tek HTML: `assets/` altındaki **tüm** dosyalar (eşya resimleri ve sesler dahil) otomatik gömülür; `PropImages` ve `TaskPanel` resimleri `assetUrl()` ile yükler.

## Aşama 3.8: Görevler
- 5 görev türü (HTML/SVG mini oyun, `js/ui/TaskPanel.js`): **kablo** (kablo panosu resmi üstünde sürükle-bırak), **şalter** (5 şalteri yukarı çevir), **vana** (çarkı tut, ibreyi yeşilde tut), **Geiger** (kaydırıcıyla ayar), **filtre** (tozları temizle).
- 9 istasyon (`js/systems/Tasks.js` → `STATIONS`), her masum/şerife rastgele 4 görev. Katil görev almaz. İstasyon eklemek = listeye 1 satır.
- Görevin olduğu yerde yerde sarı halka + zıplayan görev resmi. Yaklaşınca **E** veya ekrandaki **KULLAN** butonu. Panel açıkken karakter durur, Esc kapatır.
- Üstte ortak görev çubuğu. Botların görevleri zamanla kendiliğinden biter (simülasyon, çok oyunculuda gerçek oyunculara dönüşecek). Ölen botun kalan görevleri toplamdan düşer.
- Tüm masumların görevi bitince **masumlar kazanır**. Ölen oyuncu hayalet olarak görev yapmaya devam eder.
- Düzeltme: sonuç ekranındaki "Lobiye dön" düğmesi CSS çakışmasıyla tam ekran oluyordu, düzeltildi. Eksik oda adları (kontrol, jeneratör, revir, yatakhane) eklendi.

## Aşama 3.7 yenilikleri
- **Gerçek eşya görselleri**: `public/assets/props/*.png` (yeşil perde temizlenmiş). Ağaç, kaya, varil, sandık, raf, otomat, jeneratör, revir yatağı, monitör masası, dolap, oksijen tankı, acil toplantı masası, reaktör çekirdeği ve kum torbaları artık bu görsellerle çiziliyor (`map/MapPainter.js` → `IMG_SPEC`). Görsel bulunamazsa eski kodla çizim devreye girer.
- **Görev görselleri hazır** (henüz kullanılmıyor, Aşama 5): `kablo_panosu`, `salter_paneli`, `sigorta_kutusu`, `vana_paneli`, `ranza`, `tunel`.
- **Geçilebilir süsler**: küçük taşlar ve çalılar `solid: false`, karakter takılmadan içinden geçer (`map/MapProps.js`). Ağaç, kum torbası, varil gibi büyük eşyalar hâlâ engeldir.
- **Bomba akışı**: Lobi = bomba ÖNCESİ, dışarısı açık ve yeşil. Maç başlayıp rol videosu bitince nükleer bomba düşer (beyaz flaş + sarsıntı + yazı), sığınak kapısı mühürlenir, giriş alanı kavrulur ve bir daha girilemez (`world.sealed` → `BunkerMap.canStand`, görüş sisinde de duvar sayılır, botlar da oraya gitmez).
- Yeni görsel eklemek: `python3 tools/keyprops.py <klasör>` (pillow + numpy gerekir).

## Klasör yapısı
```
public/
  index.html, css/style.css, lib/phaser.min.js
  locales/tr.json, en.json        -> tüm metinler (kodda metin yazma, anahtar kullan)
  assets/baked/                   -> hazır karakter kareleri (tools/bake.js üretir)
  assets/videos/                  -> rol videoları + roles.json, öldürme videoları (Aşama 5)
  assets/images/idle.png          -> SabitDurma kaynak resmi
  js/main.js                      -> Phaser ayarı
  js/scenes/   BootScene (yükleme) · GameScene (dünya) · UIScene (HUD)
  js/ui/       Lobby (HTML lobi) · RoleReveal (rol animasyonu)
  js/systems/  GameFlow (lobi↔oyun geçişleri) · Roles · Flags · CharacterAtlas · SkinFactory
               BotBrain · Resolution · Assets · I18n · InputController · Joystick · FogOfWar · Vision · ChromaKey
  js/entities/ CountryBall
  js/map/      BunkerMap (harita verisi) · MapRenderer (çizim)
server/index.js                   -> Express (Aşama 4'te Socket.io buraya)
tools/                            -> geliştirici araçları (aşağıda)
```

## Kod eklerken (birleştirme kolay olsun diye)
- Yeni özellik = mümkünse **yeni dosya** (`js/systems/` veya `js/ui/`), mevcut dosyada küçük bağlantı.
- Metinleri `locales/*.json`'a ekle, kodda `i18n.t('anahtar')` kullan.
- Ekran koordinatları: HUD'da (`UIScene`) her şey **CSS pikseli** (kamera `RES.k` ile yakınlaşır). Dünyada (`GameScene`) dünya pikseli.
- Lobi ↔ oyun geçişi için `GameFlow.startMatch()` / `backToLobby()` kullan, sahneleri elle başlatma.
- `import { a } from './x.js'` biçimini kullan (tek HTML paketleyici bu biçimi tanır).

## Araçlar (sadece varlık değişince gerekir)
- `node tools/build-html.js` — tek dosya HTML üretir (ek paket gerekmez)
- `node tools/bake.js` — yeşil perde karakter kliplerini `assets/baked/`'e pişirir (ffmpeg + Playwright gerekir)
- `node tools/roles.js` — `tools/source/role_*.mp4` videolarını sıkıştırır, top kutularını ölçer (ffmpeg gerekir)

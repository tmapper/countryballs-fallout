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

## Sürüm 0.9.15: Joystick donma düzeltmesi, çıkış butonu, joystik resetle
- **Görev sonrası joystick donması**: görev paneli ekranı kapladığı için parmak panelin üstünde kalkınca oyun "parmak kalktı" olayını almıyor, joystick eski parmağa bağlı kalıp yeni dokunuşları yok sayıyordu. Artık yeni dokunuş eskisini bırakıp joystick'i devralır (`systems/Joystick.js > onDown`), görev açılırken ve kapanırken joystick kesin sıfırlanır (`GameScene.releaseControls`). Görev tamamlanırken bir hata çıksa bile hareket kilidi açılır (`ui/TaskPanel.js`).
- **Joystik resetle**: sadece mobilde, sağ üstte küçük buton (`UIScene.resetControls`). Joystick, basılı tuşlar ve hareket kilidini sıfırlar.
- **Çıkış**: Ayarlar penceresinde ve ana menüde ÇIKIŞ butonu (`systems/ExitGame.js`). EXE'de pencereyi kapatır, APK'da Capacitor App eklentisi varsa uygulamayı kapatır, tarayıcıda sekmeyi kapatmayı hatırlatır.

## Sürüm 0.9.14: Gerçek tarihi bayraklar + uzaktan sunucu adresi
**Tarihi bayraklar**: 12 bayrak artık `public/assets/flags/<KOD>.webp` resimlerinden çizilir (`Flags.js > loadFlagImages`, açılışta yüklenir). Resim bulunamazsa eski kodla çizilmiş hali yedek olur. Bayrak değiştirmek için aynı adlı 900x600 webp'yi değiştirmen yeter.

**Sunucu değişince APK/EXE'yi yeniden indirtmeme** (`systems/RemoteConfig.js`, `systems/Net.js`):
- APK/EXE/tek dosya HTML açılırken `server.json` dosyasını internetten okur ve adresi telefona kaydeder. Sunucu değişince SADECE bu dosyayı güncellersin.
- `server.json` Render'da durmaz; GitHub Pages ya da siteni kullan. Biçim: `{ "servers": ["https://ana.onrender.com", "https://yedek.onrender.com"] }` (ilki esas, diğerleri yedek).
- Bağlanamazsa oyun dosyayı yeniden okur ve yedek adrese geçer; internet yoksa son bilinen adres kullanılır.
- Bir kere yapılacak kurulum: `RemoteConfig.js` içindeki `CONFIG_URLS` listesine `server.json` adresini yaz (isteğe bağlı `DEFAULT_SERVERS`), sonra APK/EXE'yi bir kez yeniden derleyip yükle.
- Ayarlar'daki "Sunucu adresi" kutusu hâlâ çalışır ve en yüksek önceliklidir (elle yazılan adres uzaktan okunanı ezer). Eski sürümün kaydettiği adres artık okunmaz.

## Sürüm 0.9.13: Sığınak Bileti, tarihi bayraklar, admin komutları
**Sığınak Bileti (Shelter Pass)** (`ui/ShelterPass.js`, `systems/Pass.js`, sunucuda `server/index.js`):
- 30 günlük sezon, 30 bar, bar başına 20 XP (en fazla 600 XP). Sezon tarihi sunucuda `SEASON_EPOCH`'tan hesaplanır; 30 gün dolunca yeni sezon otomatik başlar, bilet XP'si ve alınmamış ödüller sıfırlanır (kasa, bayrak ve jeton kalır).
- Bilet XP'si maç sonunda yazılır: oynanan maç +8, kazanma +6, görev +1, öldürme +2, günün ilk maçı +10 (`PASS_XP`). Sayıları değiştirmek için `PASS_XP`'e bak.
- Ödüller: her 3. bar kasa (9, 18, 24: Ender Kasa; 15, 30: Büyük Kasa; diğerleri Sığınak Kasası), diğer barlar jeton (50 ile başlar, 140'a kadar çıkar). Ödül alma ve kasa açma tamamen SUNUCUDA doğrulanır (`passClaim`, `passClaimAll`, `crateOpen`).
- Kasalardan 12 tarihi bayrak çıkar: Efsanevi: Osmanlı, Britanya İmparatorluğu, Roma. Destansı: Kutsal Roma, Bizans, SSCB, Japon İmparatorluğu, Fransa Krallığı, Rus İmparatorluğu. Ender: Bulgar Krallığı, İspanya İmparatorluğu, Ceneviz. Mevcut 25 bayrak "Sıradan"dır. Çift çıkan bayrak jetona dönüşür (Ender 150, Destansı 400, Efsanevi 1000).
- Tarihi bayrağı sadece sahibi seçebilir (sunucu `setFlag` ve `profile`'da kontrol eder); bayrak seçicide kilitli olanlar nadirlik rengiyle görünür.
- Nadirlik/şans/ödül tablosu hem `server/index.js` (HFLAGS, CRATE_ODDS, passReward) hem `Flags.js` (HIST_RARITY) hem `Pass.js` içinde durur; değiştirirsen üçünü birlikte güncelle.

**Admin sistemi:**
- Admin listesi Upstash'te `cfs:admins` adlı bir HASH'tir. Upstash Console > Data Browser > yeni anahtar `cfs:admins` (tür Hash) > alan = hesap adı (küçük harfle, örn. `ahmet`), değer = `1`. Değer `0` yapılırsa ya da alan silinirse admin kalkar. Sunucu listeyi dakikada bir okur (yeniden başlatma gerekmez) ve hesaba `admin: 0/1` olarak yansıtır; giriş yapan adminin kimlik kartında ADMİN yazar.
- Upstash yoksa (yerel deneme) `ADMINS=ahmet,ali` ortam değişkeni kullanılır.
- Komutlar lobi sohbetine `/` ile yazılır, sadece admin için çalışır, kimseye gösterilmez (cevap sadece adminin sohbetinde SİSTEM olarak çıkar). Adminlik olmayan biri `/komut` yazarsa normal mesaj olur.
  - `/imposter <hedef>`, `/sheriff <hedef>`, `/crew <hedef>`: sonraki maçta rol verir (ör. `/imposter finland`, `/sheriff turkey`). Hedef: bayrak kodu, Türkçe/İngilizce ülke adı ya da oyuncu adı. Botlar da hedef olabilir. Rol sayıları korunur (rol, eski sahibiyle takas edilir). `/roles`, `/clearroles`.
  - `/coins <hedef> <±n>`, `/xp <hedef> <n>` (bilet XP), `/crate <hedef> <common|rare|grand> [adet]`, `/flag <hedef> <bayrak|all>`: hedef `ben`, hesap adı, odadaki oyuncunun bayrağı ya da adı.
  - `/kick <hedef>`, `/say <metin>` (odaya YÖNETİM duyurusu), `/who` (oyuncu listesi, maç sırasında roller), `/season`, `/help`.

## Sürüm 0.9.12: Tünel içi gezinme + temizlik + testler
- **Tünelin içinde kalma** (`scenes/GameTunnel.js`): Katil tünele girince dışarı çıkmaz, tünelin içinde kalır. Yön tuşları / joystick ile ok yönündeki başka tünele geçer (`pickTunnelDir`, Combat.js), **E / ÇIK** ile bulunduğu tünelden çıkar. İçerideyken görünmez, öldürülemez, vurulamaz; öldüremez ve ceset bildiremez; sabotaj yapabilir. Toplantı başlayınca otomatik dışarı alınır. Giriş ve çıkışı gören botlar/oyuncular Katil'i tanır.
- Ağ: konum mesajındaki `m` alanı artık 0 duruyor, 1 yürüyor, **2 tünelde**. Sunucu `m = 2` bilgisini sadece Katil rolündeki oyuncudan ve oyun sırasında kabul eder (host da öldürme/vurma/bildirmede tünel kontrolü yapar).
- `canSee` (Combat.js) artık tünelin içindeki oyuncuyu hiç görmez (botlar, tanıklar, görüş alanı hep bu tek noktadan geçer).
- Botlar tüneli eskisi gibi anlık ışınlanma ile kullanır (içeride kalmazlar).
- `npm test`: bağımlılıksız birim testleri (`tests/combat.test.mjs`): kazanma kuralı, tünel menzili, yönlü tünel seçimi, tünelde görünmezlik.
- Temizlik: `package.json` sürümü 0.9.12 oldu, `s8.log` silindi, `.gitignore`'a `*.log` eklendi.

## Aşama 9.2 (Parti 3): Adil ve zeki botlar

- Botlar sadece kendi görüş alanında gördüklerini bilir (oyuncuyla aynı yarıçap, duvar arkası yok); hız, bekleme süresi ve menzil aynı.
- Katil bot: görüşünde tek bir masum varsa kısa bir tepki gecikmesiyle öldürür, sonra kaçar ve çoğu zaman tünele girer; kimse görmüyorsa avlanmak için tünele yürür.
- Mantıklı sabotaj: kalabalığın yanındaysa ışıklar, öldürme beklemesi uzunsa uzaktaki reaktör/O2.
- Şerif bot: tanık olduğu katili gördüğü anda menzildeyse vurur; masum botlar şüpheliden kaçar.

## Aşama 9.1 (Parti 2): Kurucu ayarları, harita seçimi, atma/devretme
- **Harita seçimi**: Kavşak (yeni, varsayılan) ve Klasik Sığınak. `map/BunkerMap.js` içinde `MAPS`; `useMap(id)` aktif haritayı yerinde değiştirir; görev istasyonları (`Tasks.js`, `onMapChange`) ve sabotaj noktaları kendiliğinden taşınır. Yeni harita: `MAPS`'e giriş + `locales maps.<id>`.
- **Oda ayarları** (odada "⚙ Oda ayarları", sadece kurucu değiştirir, herkes görür): harita, maks. oyuncu (4-25, varsayılan 25), oyuncu hızı (0.5x-2x), tartışma (0-180 sn), oylama (10-120 sn), öldürme bekleme (10-90 sn), katil sayısı ve şerif sayısı (Otomatik ya da 1-5). Sınırları sunucu da uygular (`server/index.js sanitizeCfg`). Varsayılanlar: `systems/RoomConfig.js`.
- **Atma**: kurucu oyuncu satırındaki ✕ (2 kez bas). Atılan aynı odaya tekrar giremez.
- **Kuruculuğu devret**: oyuncu satırındaki 👑 (2 kez bas, sadece lobideyken).
- Oda listesi artık sadece değiştiğinde yeniden çiziliyor (basılıyken yeniden çizilen butonlarda tıklama kayboluyordu).

## Aşama 9.0 (Parti 1): Yeni harita + hızlı düzeltmeler
- **Yeni harita** (`map/BunkerMap.js`): çapraz halka; solda merkez küme (ana salon + yemekhane + elektrik + jeneratör), sağ üstte büyük oda (O2 + kontrol + iletişim), sağda güvenlik -> laboratuvar, sağ altta depo + reaktör, altta revir, sol altta yatakhane. Ana salondan büyük odaya ORTADAN kestirme geçiş. Katil tünelleri odaların köşelerinde 8 kapak (4 çift). Oda boyutları aynı kaldığı için görevler/eşyalar bozulmadı; bütün istasyonların, tünellerin ve 25 kişilik doğma noktalarının ulaşılabilir olduğu test edildi.
- **Görev sonrası donma**: telefonda başparmak joystick'teyken görev bitince joystick bırakılıyordu -> yeni dokunuşu almıyordu. Artık sadece parmak gerçekten kalktıysa bırakılır. Ek olarak oyuncu bir şekilde eşyanın içinde kalırsa en yakın boş yere çekilir.
- **Hayaletler** tüm duvarlardan geçer, %50 hızlıdır, ölü oyuncular birbirini görür (yaşayanlar görmez).
- **Duvarların arkası toprak** (bellek dostu karolar).
- **Öldürme animasyonu**: arkada sarı-kırmızı patlama (ışınlar, parlama, halka).
- **Bot şapkaları**: botların çoğu şapkasız; şapka takanlar ülkesine uygun (`Looks.BOT_HATS`, ör. TR fes, NO viking, MX sombrero), her gün değişir.
- **Açılış**: "Mobil mi PC mi?" (Ayarlar'dan değişir; mobilde joystick + büyük butonlar + düşük grafik) ve "Yeni Güncelleme!" notu. Notu değiştirmek için `ui/StartPrompts.js` içindeki `UPDATE` (id değişince herkese bir kez çıkar).

## Aşama 8.4: Test turu + büyük bellek ve sunucu optimizasyonu
Test edilenler: 2 tarayıcılı online maç (roller gizli, öldürme, bildirme, oylama, oyun sonu, ödül, konum eşleşmesi), 17 görev türünün hepsi, 3 sabotaj, art arda 4 maç (sızıntı yok), telefon yatay/dikey yeni paneller, 25 kişilik sunucu yükü.
- **Bellek ~4 kat azaldı** (maçta 396 MB -> 110 MB, lobide 148 -> 46):
  - Harita dışındaki boşluk Phaser TileSprite ile 7650x5300'lük TEK tuval tutuyordu (162 MB). Artık düz arka plan rengi.
  - Oda zeminleri / duvar yüzleri / lobi çimeni: TileSprite yerine 4x4 büyütülmüş karolar (`systems/Tiled.js`).
  - Karakter yürüme dokuları yarı çözünürlükte (`SkinFactory.SKIN_SCALE = 0.5`): oyuncu başına 20 MB -> 5 MB.
  - Öldürme animasyonu resimleri maç başında hepsi değil, sadece oynanacak klip yüklenir ve bitince bırakılır.
  - Düşük grafikte harita dokuları 1x.
- **Sunucu**: oyuncu konumları (oyun `p`, lobi `lp`) tek tek herkese gitmiyor; sunucu odada biriktirip 100 ms'de bir TEK toplu mesaj (`pp`) yolluyor. 10 oyuncuda istemcilere giden mesaj 891/sn -> 99/sn (25 kişide ~24 kat az).
- Bilinmeyen görev türü artık çökme yerine kablo görevi açar.
- Telefon: ölüler sohbeti alt ortada (görev listesi ve joystick ile çakışmıyor), ayarlar paneli kısa ekrana sığıyor.

## Aşama 8.3: Ölüler sohbeti, ağır çekim düzeltmesi
- **Ölüler sohbeti**: ölünce sol ortada 💬👻 kutusu açılır (T tuşu). Yazılanları sadece ölüler görür; toplantıda gizlenir (toplantı sohbeti var), maç bitince kapanır. Sunucuda `chat` kanalı `ghost`.
- **Ağır çekim düzeltmesi**: oyun bir karede en fazla 0,1 sn ilerliyordu; telefon 10 kare/sn altına düşünce her şey yavaşlıyordu. Artık gerçek süre kullanılır (en fazla 0,25 sn), hareket 0,04 sn'lik adımlara bölünür (duvardan geçme yok), Phaser kare yumuşatması kapalı.
- Telefonda grafik varsayılan **Düşük** (Ayarlar'dan Yüksek yapılabilir).

## Aşama 8.2: Bot yol bulma, rol sayıları, isimler
- **Botlar eşyalara çarpmıyor**: harita 30 px hücrelere bölünür, A* ile duvar ve eşyaların etrafından yol bulunur (`BotBrain.navPath`). Takılırsa yolu yeniden hesaplar.
- **Rol sayıları oyuncuya göre**: Katil 1-7 kişi 1 · 8-12 kişi 2 · 13-19 kişi 3 · 20-25 kişi 4. Şerif 1-9 kişi 1 · 10-17 kişi 2 · 18-25 kişi 3. (`Roles.impCount/sheriffCount` + sunucuda aynısı.)
- **İsimler**: kendi topunda "Sen" yerine adın yazar (misafirsen bayrağın ülke adı). Katilsen kendi adın ve diğer katillerin adı kırmızı (sadece katiller görür).

## Aşama 8: Arkadaşlar + sıralama
- Ana menü -> **ARKADAŞLAR & SIRALAMA** (giriş gerekir). Oyuncu adıyla arkadaş isteği gönder; karşı taraf kabul edince arkadaş olursunuz (ikiniz de birbirinizi eklerseniz direkt arkadaş). Gelen istek sayısı menüde kırmızı rozet olarak görünür.
- Arkadaş listesi: çevrimiçi / lobide / maçta durumu. Arkadaşın açık bir lobideyse **KATIL** ile direkt girersin.
- Odadayken sağ üstte **📨 Davet et**: çevrimiçi arkadaşlarına davet gönderir; onlara her ekranda "Katıl / Yoksay" kartı çıkar.
- **Sıralama**: Bu hafta (her pazartesi sıfırlanır) ve Tüm zamanlar, XP'ye göre ilk 25 + senin sıran. Sunucu listeyi 30 sn önbellekte tutar (yük az).
- Hepsi sunucuda hesapla saklanır (`friends`, `freq`, `wxp`, `wk`). Mesajlar: social, friendAdd, friendAnswer, friendRemove, invite, board.

## Aşama 7.8: Harita butonu, 25 kişi, optimizasyon
- **Harita** artık normalde kapalı: sağ üstteki 🗺 HARİTA butonu (ya da Tab / Q) açar, tekrar basınca / Esc kapanır. Kapalıyken çizilmez ve ekranda dokunmaları engellemez (eskiden sağ üstteki küçük harita alttaki dokunmaları yutuyordu).
- **25 kişilik odalar**. Katil sayısı: 10 kişiye kadar 1, 11-17 kişide 2, 18+ kişide 3 (`Roles.impCount`, sunucuda `impCount`). Katiller birbirini görür (kırmızı etiket) ve birbirini öldüremez. 12 kişiden fazlasında masa etrafında iki halka.
- **Çizim**: kamera dışındaki eşyalar hiç çizilmez; görüş alanı dışında (karanlıkta) kalan eşyalar ve ışıklar da çizilmez. Cihaz sürekli 30 kare/sn altında kalırsa grafik bir kez otomatik Düşük'e geçer.
- **Sunucu tasarrufu**: konum sadece değişince gönderilir (duran oyuncu saniyede 1), saniyede en fazla 10; botlarda sadece hareket edenler. Lobi listesi 5 sn'de bir ve sadece sekme açıkken. Sunucuda mesaj tek sefer JSON'a çevrilip herkese aynı gönderilir; 16 KB'tan büyük mesaj ve saniyede 80'den fazla mesaj yok sayılır.

## Aşama 7.6: Jeton (oyun içi para) + şapka dükkanı
- **Jeton 🪙** gerçek para değil. Online maçlardan kazanılır: oyna +10, kazan +25, görev +2, öldürme +5. Yeni hesaba 200 jeton hoş geldin hediyesi.
- Bakiye ve alınan şapkalar **sunucuda** hesapla saklanır (Upstash/accounts.json); hile ile artırılamaz, alınmamış şapka takılamaz (sunucu kontrol eder).
- Şapka dolabı = dükkan: fiyatlar 100 / 250 / 500 / 1000 (taç, hale). Bedava: şapkasız, kırmızı/mavi kep, bere. Misafir sadece bedava şapkaları takar.
- Fiyat listesi iki yerde, aynı olmalı: `server/index.js` (HAT_PRICE) ve `public/js/systems/Looks.js` (HAT_PRICE).

## Aşama 7: Şapkalar + canlı gözler
- **29 şapka** (`systems/Looks.js`, hepsi kodla çizilir, her çözünürlükte keskin): silindir, kovboy, taç, bere, kep, fötr, parti, aşçı, viking, asker miğferi, baret, fes, ressam beresi, Noel Baba, cadı, korsan, mezuniyet, kulaklık, çiçek tacı, hale, pervaneli, melon, sombrero, uşanka, tavşan/kedi kulağı, uzaylı, radyasyon başlığı. Yeni şapka: `HATS` listesine bir `draw` fonksiyonu ekle.
- **Şapka dolabı**: lobide BM direğinin karşısında (sağda). Yanına git, E ya da ŞAPKA SEÇ. Seçim kaydedilir, maçta da takılı; çevrimiçi odada herkes görür. Botların şapkası bayraklarından türetilir.
- **Canlı gözler** (animasyon videolarındaki göz paketi): gözler artık karakter görüntüsünden ayrı çiziliyor (`tools/eyes.py` eski gözleri sildi, her karedeki yerlerini `baked.json`a yazdı). Göz kırpma, uzun süre durunca uykulu (yarı kapalı), görev bitince mutlu (^ ^), ceset görünce ve sabotajda şaşkın (büyük göz), katil/şerif hedefe kilitlenince kısık sinsi göz (sadece kendi ekranında, rol belli olmaz), hayalet yarı kapalı, cesette X göz. Lobide mesaj yazan mutlu olur. Öldürme animasyonları değişmedi.

## Aşama 6.2: Hile koruması
- Rolleri artık **sunucu** dağıtır; her oyuncuya sadece **kendi rolü** gider (tarayıcıdan katil okunamaz, host kendini katil seçemez). Roller maç sonunda açıklanır, şerif atışı ve atılan kişinin rolü host'tan gelir.
- Oyun olaylarını (öldürme, oyun bitti...) ve bot konumlarını **sadece host** gönderebilir (sunucu ve oyun ikisi de kontrol eder).
- Konum kontrolü: hız hilesi, ışınlanma ve duvardan geçme yok sayılır (katil tüneli hariç).
- Görev: katil görev sayamaz, oyuncu başına en fazla 5, her istasyon bir kez, istasyonun yanında olmalı, iki görev arası en az 1,5 sn.
- Oy: sadece yaşayan oyuncuya ya da "geç". Acil toplantı: düğmenin yanında olmalı. Sabotaj: bekleme süresi kontrol edilir.
- Toplantı sohbeti: ölü oyuncu kendini canlı gösterip yaşayanlara yazamaz.
- Çevrimiçi lobi kurmak/katılmak için giriş zorunlu (misafir başkasının adıyla giremez).
- Kalan sınır: host oyunu yönettiği için host hile yapabilir; diğer oyuncuların konumu herkese gittiği için "duvar arkasını görme" hilesi tam engellenemez (ikisi için kuralların sunucuda çalışması gerekir).

## Aşama 6.1: Sohbet, telefon ekranı, yürüme düzeltmeleri, kalıcı hesaplar
- **Sohbet**: çevrimiçi lobide sol altta 💬 (T tuşu ya da butona dokun). Yazılan mesaj yazanın başının üstünde balon olarak da çıkar. **Toplantıda** sohbet kutusuna yazılabilir; ölülerin mesajlarını sadece ölüler görür (👻). Sunucu mesajı 120 karakterle ve 0,6 sn'de 1 mesajla sınırlar. Kod: `ui/Chat.js`, sunucuda `chat` mesajı.
- **Yürüme hatası**: görev paneli açıkken toplantı başlarsa toplantıdan sonra karakter yürüyemiyordu; düzeltildi. Yazı alanına yazarken karakter artık kendi kendine yürümez.
- **Yürüme animasyonu**: yürüme kareleri her bayrak için arka planda üretilir; çevrimiçi lobide bu hiç istenmiyordu (o yüzden lobide yürüme animasyonu yoktu). Artık her top kendi dokusunu ister, yürümeye başlayan önce hazırlanır.
- **Telefon**: yatay telefonda ana menü iki sütun (logo + kimlik kartı solda, terminal sağda), oda ekranında başlat butonu sağ altta, toplantı tek ekrana sığar. Dikeyde kamera daha geniş görür.
- **Hesaplar kalıcı**: Render ücretsiz planda disk silindiği için hesaplar kayboluyordu. Artık hesaplar ücretsiz **Upstash Redis** veritabanına da yazılır (aşağıdaki kurulum). Ortam değişkenleri verilmezse eskisi gibi `data/accounts.json`.

### Upstash kurulumu (5 dk, ücretsiz, kart istemez)
1. upstash.com -> giriş yap (GitHub/Google) -> **Create Database** (Redis), bölge: Frankfurt (eu-central-1), Free plan.
2. Veritabanı sayfasında **REST API** kısmından `UPSTASH_REDIS_REST_URL` ve `UPSTASH_REDIS_REST_TOKEN` değerlerini kopyala.
3. Render -> servisin -> **Environment** -> bu iki değişkeni aynen ekle -> Save (sunucu yeniden başlar).
4. Render loglarında `Hesaplar: bulut (Upstash) - N hesap` yazısını görürsen tamamdır.

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

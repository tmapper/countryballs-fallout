# Oyun görselleri: Gemini promptları

Üretince bana gönder. Yeşil arka planı ben temizleyip oyuna yerleştiririm; isimleri değiştirme.
Hepsi mevcut eşyalarla (dolap, jeneratör, varil...) **aynı tarzda** olmalı. O yüzden her prompttan önce
aşağıdaki **ORTAK TARZ** metnini aynen yapıştır, sonra eşyanın kendi cümlesini ekle.

## ORTAK TARZ (her promptun başına koy)

> Single game prop for a 2D top-down cartoon game, slight 3/4 top-down view, bold clean dark outlines, flat cel shading with soft highlights, worn painted metal with small rust spots and scratches, yellow-and-black hazard stripes as accents, nuclear fallout bunker theme, centered, whole object visible, no text, no letters, no logos, no people, isolated on a solid pure green background (#00FF00, completely flat, no shadow on the background), square image 1024x1024.

## A) Görev istasyonları (şu an kodla çiziliyor, bunlarla çok daha güzel olur)

| Dosya adı | Prompt (ORTAK TARZ'dan sonra) |
|---|---|
| `geiger.png` | A metal desk console with a big analog Geiger counter: round dial with needle, a handheld probe on a coiled cable, small green screen. |
| `filtre.png` | A wall-mounted air filtration unit: square metal box with a round fan grille in front, a pull-out dirty filter cartridge, two pipes on top. |
| `tus_takimi.png` | A heavy security door keypad panel: 3x4 chunky numeric buttons, small red/green status lights, armored frame. |
| `hafiza_paneli.png` | A memory-game control console: 3x3 grid of big colorful square buttons (red, blue, green, yellow) on a slanted metal desk. |
| `kart_okuyucu.png` | A wall card-swipe reader: slim metal box with a card slot, a small display and a red/green light, an ID card hanging on a lanyard. |
| `hizalama.png` | A reactor alignment console: two large rotary knobs and a round radar-like screen with crosshair, on a slanted metal panel. |
| `sunucu.png` | A tall server rack cabinet with blinking blue and green lights, cable bundles at the bottom, a small download progress screen. |
| `uydu_anteni.png` | A satellite dish on a sturdy metal base, dish pointing up and to the side, cables going down, small control box at the base. |
| `yakit.png` | A fuel pump station: rounded red fuel tank with a gauge, a hose with a nozzle hanging on the side, hazard stripes on the base. |
| `sira_dugmeleri.png` | A wall panel with nine numbered round push buttons in a 3x3 grid, bulky metal frame, small indicator light on top. |
| `boru_paneli.png` | A pipe junction box: exposed square tiles of pipe segments in a grid on a metal panel, valves at the left and right edges. |
| `atik.png` | Two waste bins side by side: one yellow with a radioactive trefoil symbol, one grey normal bin, slightly dented, lids half open. |
| `telsiz.png` | An old military radio station on a desk: big frequency dial, two sliders, a microphone on a coiled cable, small antenna. |
| `biyometrik.png` | A biometric hand scanner on a pedestal: glowing green hand outline on a glass plate, metal housing, small screen above. |

## B) Mekan ve süs eşyaları (haritayı zenginleştirir)

| Dosya adı | Prompt (ORTAK TARZ'dan sonra) |
|---|---|
| `uzun_masa.png` | A long metal cafeteria table with two benches, a few trays and cups on it. |
| `bitki.png` | A potted plant in a dented metal bucket, a bit wilted, grown under a small grow lamp. |
| `forklift.png` | A small yellow warehouse forklift, slightly rusty, forks lowered. |
| `kolon.png` | A thick square concrete support pillar with hazard stripes at the bottom and a small wall lamp. |
| `kablo_makarasi.png` | A large wooden cable reel with thick black cable wrapped around it. |
| `alet_tezgahi.png` | A workbench with tools: wrench, hammer, screwdriver, a vise and a small toolbox. |
| `su_tanki.png` | A tall cylindrical water tank with a ladder, a valve and a water level gauge. |
| `acil_dolabi.png` | A wall-mounted red emergency cabinet with a first-aid cross and a fire extinguisher next to it. |

## C) Arayüz görselleri

**`menu_bg.jpg`** (ana menü arka planı, 16:9, en az 2560x1440). Bunda ORTAK TARZ kullanma:
> Cinematic wide 16:9 digital painting, interior of an abandoned underground nuclear fallout shelter. On the right third of the frame, a massive round steel vault door with yellow-black hazard stripes around its frame, a large valve wheel in the center, rivets, rust and scratches, slightly ajar with warm orange light leaking from behind it. Concrete walls with exposed pipes, cables and a faded radiation warning sign, two red rotating emergency lights casting red glow, dust particles floating in the air, thin fog on the floor. The left half of the image is darker and emptier (plain concrete wall in shadow) so menu text can be placed there. Moody, teal-and-orange color grading, high detail, stylized semi-realistic game key art. No text, no letters, no logos, no people, no characters.

**`logo.png`** (oyun logosu, düz yeşil arka plan):
> Video game logo on a solid pure green background (#00FF00, completely flat, no gradient, no shadow on the background). The logo reads exactly "COUNTRYBALLS" in smaller letters on top and "FALLOUT SUSPECTS" in large bold letters below. Heavy, chunky, slightly worn stencil-military typeface, off-white letters with dark outline, rusty metal texture and small scratches, a small yellow-and-black radiation trefoil symbol placed between the two words, subtle orange glow behind the letters. Centered, wide horizontal layout, clean edges, no other objects, no green inside the logo.

**`ikon.png`** (uygulama ikonu: exe / apk, 1024x1024):
> App icon, 1024x1024, rounded square. A cute round ball character with a plain white body, two big simple white oval eyes with thin dark outlines, half-lidded suspicious look, wearing a small yellow hard hat, in front of a round steel bunker vault door with yellow-black hazard stripes. Bold dark outlines, flat cartoon shading, strong readable silhouette, dark teal background with a soft orange glow behind the character. No text.

**`yukleme.jpg`** (yükleme ekranı, 16:9, 1920x1080):
> Wide 16:9 cartoon illustration, a dim nuclear bunker corridor seen from the front, a heavy round vault door closing at the end with warm orange light, flickering ceiling lamps, hazard stripes on the floor, dust in the air, bold dark outlines, flat cel shading, moody teal-and-orange colors. The bottom third of the image is plain and dark so a loading bar can be placed there. No text, no people, no characters.

## D) Sığınak Bileti görselleri (klasör: public/assets/menu/)

Kod bu dosyaları kendiliğinden bulur; yoksa emoji kullanır. Kasa ve jeton için ORTAK TARZ'ı (A bölümündeki) başa yapıştır, ama sonundaki "square image 1024x1024" kalsın.

| Dosya adı | Prompt (ORTAK TARZ'dan sonra) |
|---|---|
| `crate_common.png` | A closed olive-green military supply crate, wooden-and-metal with rusty corner brackets, a small white radiation trefoil stencil on the lid, a thin yellow-black hazard stripe. Plain and humble look. |
| `crate_rare.png` | A closed blue steel armored crate with glowing cyan latches, riveted plates, yellow-black hazard stripes on the edges, a faint blue glow leaking from the seams. Looks special but not luxurious. |
| `crate_grand.png` | A closed heavy golden-and-black vault crate with ornate gold corner plates, a big round gold lock in the center, warm orange-gold glow leaking from the seams and tiny sparkles. The most valuable looking crate. |
| `coin.png` | A single round gold bunker token coin seen straight on, thick rim, an embossed radiation trefoil in the center, a few scratches, bright highlights. |

**`pass_bg.jpg`** (Sığınak Bileti arka planı, 16:9, 1920x1080). Bunda ORTAK TARZ kullanma:
> Wide 16:9 digital painting, dim interior of a nuclear bunker supply room seen from the front: steel shelves with crates and barrels, a long metal workbench in the lower third, hanging cables and a few yellow-black hazard stripes, soft green terminal glow from the right, thin dust in the air. Very dark and low contrast with the center kept calm and plain so UI cards can sit on top. Moody green-and-amber color grading, stylized semi-realistic game art. No text, no letters, no logos, no people, no characters.

## İpuçları
- Gemini bazen arka planı yeşil yapmaz ya da gölge ekler; o zaman "solid flat #00FF00 background, no shadow" kısmını tekrar yazıp yeniden üret.
- Eşyanın içinde yeşil renk olmasın (yeşil ekranla birlikte silinir). Bitki için arka planı mavi iste: `#0000FF` yaz, bana da söyle.
- Countryball karakterlerini Gemini'ye çizdirme; karakterler oyunda bayrakla otomatik giydiriliyor.

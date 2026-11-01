// ============================================================
// ChromaKey.js - Yeşil perdeyi şeffaf yapar (Phaser'dan bağımsız, saf Canvas)
// ============================================================
// SORUN: Countryball'un gövdesi de arka planla AYNI yeşil. Klasik "bu rengi sil"
// yöntemi topun içini de silerdi.
// ÇÖZÜM: "Taşırma (flood fill)". Resmin KENARLARINDAKİ yeşilden başlayıp komşu
// yeşil pikselleri sileriz. Topun siyah çerçevesine gelince durur, çünkü
// çerçevenin içine yeşil dışarıdan ulaşamaz. Böylece gövde ve gözler korunur.

// Köşelerden 4 piksel okuyup perdenin rengini otomatik bulur.
export function detectKeyColor(imageData) {
  const { data, width: w, height: h } = imageData;
  const pts = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

export function removeBackground(imageData, key, tolerance = 60) {
  const { data, width: w, height: h } = imageData;
  const total = w * h;
  const removed = new Uint8Array(total);   // 1 = arka plan olarak silinecek
  const stack = new Int32Array(total);
  let sp = 0;

  // Bir pikselin perde rengine uzaklığı (küçük = yeşile yakın)
  const dist = (p) => {
    const i = p * 4;
    return Math.abs(data[i] - key.r) + Math.abs(data[i + 1] - key.g) + Math.abs(data[i + 2] - key.b);
  };
  const tryPush = (p) => {
    if (!removed[p] && dist(p) < tolerance) { removed[p] = 1; stack[sp++] = p; }
  };

  // 1) Başlangıç noktaları: resmin dört kenarı
  for (let x = 0; x < w; x++) { tryPush(x); tryPush((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { tryPush(y * w); tryPush(y * w + w - 1); }

  // 2) Yayıl: yeşil komşuları da ekle
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    if (x > 0) tryPush(p - 1);
    if (x < w - 1) tryPush(p + 1);
    if (p >= w) tryPush(p - w);
    if (p < total - w) tryPush(p + w);
  }

  // 3) Silinenleri şeffaf yap; sınırdaki pikselleri yumuşat (yeşil hale kalmasın)
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (removed[p]) { data[i + 3] = 0; continue; }
    const x = p % w;
    const nearRemoved =
      (x > 0 && removed[p - 1]) || (x < w - 1 && removed[p + 1]) ||
      (p >= w && removed[p - w]) || (p < total - w && removed[p + w]);
    if (!nearRemoved) continue;
    const d = dist(p);
    if (d < tolerance * 3) {
      const a = Math.min(1, Math.max(0, (d - tolerance) / (tolerance * 2)));
      data[i + 3] = Math.round(255 * a);
      // Yeşil tonu bastır (kenar griye/siyaha dönsün)
      data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
    }
  }
  return imageData;
}

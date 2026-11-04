// ============================================================
// Tiled.js - Tekrarlayan desen (zemin, çimen, duvar yüzü) için BELLEK DOSTU yerleştirme
// ============================================================
// Phaser'ın TileSprite'ı her biri için kendi boyunda bir tuval açıyor: haritanın dışındaki boşluk
// tek başına 7650x5300 (162 MB), oda zeminleri ~50 MB tutuyordu. Bunun yerine küçük doku bir kez
// N x N büyütülür (ör. 128 -> 512) ve alan bu büyük karolarla döşenir; kenarlarda kırpılır.
// Görüntü aynı, bellek çok daha az; karolar kamera dışında kalınca çizilmez (GameScene.updateCull).
export function tiled(scene, x, y, w, h, key, depth, repeat = 4) {
  const T = scene.textures;
  const src = T.get(key).getSourceImage();
  const s = 1 / (src._s || 1);                       // doku pikseli -> dünya
  const bigKey = `${key}__x${repeat}`;
  if (!T.exists(bigKey)) {
    const c = document.createElement('canvas');
    c.width = src.width * repeat; c.height = src.height * repeat;
    const x2 = c.getContext('2d');
    for (let j = 0; j < repeat; j++) for (let i = 0; i < repeat; i++) x2.drawImage(src, i * src.width, j * src.height);
    c._s = src._s || 1;
    T.addCanvas(bigKey, c);
  }
  const bw = src.width * repeat * s, bh = src.height * repeat * s;   // büyük karonun dünya boyu
  const out = [];
  for (let ty = 0; ty < h; ty += bh) {
    for (let tx = 0; tx < w; tx += bw) {
      const im = scene.add.image(x + tx, y + ty, bigKey).setOrigin(0).setScale(s).setDepth(depth);
      const cw = Math.min(bw, w - tx), ch = Math.min(bh, h - ty);
      if (cw < bw || ch < bh) im.setCrop(0, 0, Math.ceil(cw / s), Math.ceil(ch / s));
      out.push(im);
    }
  }
  return out;
}

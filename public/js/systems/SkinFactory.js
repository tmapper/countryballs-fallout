// ============================================================
// SkinFactory.js - Bayrağı topun gövdesine giydirir
// ============================================================
// Her kare için (hepsi Canvas birleştirme işlemi):
//  1) Bayrağı topun kutusuna esnetip çiz (top ezilince bayrak da ezilir)
//  2) 'multiply' ile gölge katmanını çarp  -> yuvarlak görünüm
//  3) 'destination-in' ile top silüetine kırp -> bayrak topun dışına taşmaz
//  4) Üstüne çerçeve + gözleri koy (overlay)
// İşlem KARE KARE yapılabilir (composeFrame): böylece büyük bir skin, oyunu
// dondurmadan birçok küçük parçada üretilir (bkz. CharacterAtlas.requestSkins).
// mirrorFlag: sola yürüme, sağa yürüme karelerinin aynası (flipX) olarak çizilir.
//   Sprite çevrilince bayrak da ters dönmesin diye bayrağı ÖNCEDEN ters çizeriz.
import { getFlagCanvas } from './Flags.js';

// BELLEK: skin'ler yarı çözünürlükte üretilir. Bir bayrağın yürüme dokusu eskiden ~20 MB'tı (iki yön),
// 25 kişilik maçta ~500 MB ediyordu (telefon kasıyor/çöküyordu). Top ekranda en fazla ~130 px göründüğü
// için 0.5 ölçek gözle fark edilmez, bellek 4'te 1. Sprite ölçeği bunu telafi eder (CountryBall).
export const SKIN_SCALE = 0.5;

export function createSkinCanvas(info) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(info.layers.overlay.width * SKIN_SCALE);
  cv.height = Math.ceil(info.layers.overlay.height * SKIN_SCALE);
  return cv;
}

// Tek bir kareyi (atlas hücresini) üretir. Diğer hücrelere dokunmaz (clip).
export function composeFrame(c, info, i, flagCode, mirrorFlag = false) {
  const L = info.layers;
  const flag = getFlagCanvas(flagCode);
  const f = info.frames[i];
  const b = info.bboxes[i];
  c.save();
  c.setTransform(SKIN_SCALE, 0, 0, SKIN_SCALE, 0, 0);   // tüm çizim orijinal birimlerde, tuvale yarı boyda
  c.imageSmoothingQuality = 'high';
  c.beginPath();
  c.rect(f.x, f.y, f.w, f.h);
  c.clip();
  if (mirrorFlag) {
    c.save();
    c.translate(f.x + b.x + b.w, f.y + b.y);
    c.scale(-1, 1);
    c.drawImage(flag, 0, 0, flag.width, flag.height, 0, 0, b.w, b.h);
    c.restore();
  } else {
    c.drawImage(flag, 0, 0, flag.width, flag.height, f.x + b.x, f.y + b.y, b.w, b.h);
  }
  c.globalCompositeOperation = 'multiply';
  c.drawImage(L.shade, f.x, f.y, f.w, f.h, f.x, f.y, f.w, f.h);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(L.sil, f.x, f.y, f.w, f.h, f.x, f.y, f.w, f.h);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(L.overlay, f.x, f.y, f.w, f.h, f.x, f.y, f.w, f.h);
  c.restore();
}

// Tüm kareleri bir kerede üretir (küçük skin'ler ve lobi önizlemesi için)
export function composeSkin(info, flagCode, mirrorFlag = false) {
  const cv = createSkinCanvas(info);
  const c = cv.getContext('2d');
  for (let i = 0; i < info.frames.length; i++) composeFrame(c, info, i, flagCode, mirrorFlag);
  return cv;
}

// ============================================================
// Assets.js - Dosya adreslerini çözer (sunucu sürümü + tek dosya HTML sürümü)
// ============================================================
// Normalde dosyalar sunucudan gelir ("assets/baked/walk_sil.png" gibi).
// Tek dosyalık HTML sürümünde ise build aracı her şeyi window.CFS_ASSETS içine
// gömer. Kodun geri kalanı bu farkı bilmez; sadece assetUrl()/loadJSON() kullanır.

const blobCache = {};

function embedded(path) {
  return typeof window !== 'undefined' && window.CFS_ASSETS ? window.CFS_ASSETS[path] : undefined;
}

// Bir dosyanın kullanılabilir adresini döndürür.
// Gömülü videoları Blob adresine çeviririz (iPhone data: adresinden video oynatmıyor).
export function assetUrl(path) {
  const emb = embedded(path);
  if (typeof emb !== 'string') return path;
  if (/^data:(video|audio)\//.test(emb)) {
    if (!blobCache[path]) {
      const comma = emb.indexOf(',');
      const mime = emb.slice(5, emb.indexOf(';'));
      const bin = atob(emb.slice(comma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blobCache[path] = URL.createObjectURL(new Blob([bytes], { type: mime }));
    }
    return blobCache[path];
  }
  return emb;
}

// Dosyaları tarayıcı önbelleğine ısıt: tek tek, boşta kalan zamanda, oyunu yavaşlatmadan.
// (Gömülü tek dosya sürümünde zaten bellekte; atlanır.) Sunucu Cache-Control gönderdiği için sonraki istek ağa gitmez.
const warmed = new Set();
export function prefetchAssets(paths) {
  const todo = paths.filter((p) => !warmed.has(p) && typeof embedded(p) !== 'string');
  todo.forEach((p) => warmed.add(p));
  const next = () => {
    const p = todo.shift();
    if (!p) return;
    fetch(p).then((r) => r.arrayBuffer()).catch(() => { warmed.delete(p); }).then(() => setTimeout(next, 250));
  };
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 800));
  idle(next, { timeout: 3000 });
}

export async function loadJSON(path) {
  const emb = embedded(path);
  if (emb && typeof emb === 'object') return emb;
  const res = await fetch(path);
  if (!res.ok) throw new Error('Dosya yüklenemedi: ' + path);
  return res.json();
}

export function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel yüklenemedi: ' + path));
    img.src = assetUrl(path);
  });
}

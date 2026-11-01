// ============================================================
// tools/bake.js - Green screen karakter kliplerini "pişirir" (geliştirici aracı)
// ============================================================
// Oyun açılışında video işlemek telefonda yavaş ve iPhone'da sorunlu. Bu yüzden
// kareleri BİR KEZ burada işleyip PNG katmanları + baked.json olarak kaydediyoruz.
// Oyun sadece bu hazır dosyaları yükler.
//
// Gerekenler: ffmpeg (PATH'te) ve Playwright (npm i -D playwright && npx playwright install chromium)
// Kullanım:   node tools/bake.js
// Çıktı:      public/assets/baked/<klip>_{overlay,sil,shade}.png + public/assets/baked/baked.json
//
// Yeni klip eklemek için aşağıdaki CLIPS listesine bir satır ekle.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public/assets/baked');

// size: kare çözünürlüğü (kaynak 1080'den küçültülür). 400 -> top ~260px genişlik (2K ekranda net).
const SIZE = 400;
const FPS = 16;
const MAX_ATLAS = 4096; // telefonların çoğu en az 4096px doku destekler

// src: video ya da tek kare resim (png). Sola yürüme, sağa yürümenin aynası olduğu
// için ayrıca pişirilmez; oyunda flipX ile çevrilir (bellekten yarı yarıya tasarruf).
const CLIPS = [
  { key: 'walk', src: 'public/assets/videos/walk_right.mp4' },
  { key: 'idle', src: 'public/assets/images/idle.png' }
];

function extractFrames(src, dir) {
  fs.mkdirSync(dir, { recursive: true });
  if (/\.(png|jpe?g|webp)$/i.test(src)) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=${SIZE}:${SIZE}`, path.join(dir, '000.png')]);
    return;
  }
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', src]).toString());
  const count = Math.max(1, Math.round(dur * FPS));
  for (let i = 0; i < count; i++) {
    const t = Math.min((i + 0.5) / FPS, dur - 0.001);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', '-vf', `scale=${SIZE}:${SIZE}`, path.join(dir, String(i).padStart(3, '0') + '.png')]);
  }
}

// Tarayıcıda çalışan pişirme fonksiyonu (ChromaKey.js'deki removeBackground'u kullanır)
async function bakeInPage({ urls, opts }) {
  const { size, tolerance, pad, maxAtlas } = opts;
  const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
  const work = document.createElement('canvas'); work.width = work.height = size;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  const imgs = []; let key = null;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (const u of urls) {
    const im = await load(u);
    wctx.clearRect(0, 0, size, size); wctx.drawImage(im, 0, 0, size, size);
    const img = wctx.getImageData(0, 0, size, size);
    if (!key) key = detectKeyColor(img);
    removeBackground(img, key, tolerance);
    const d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (d[(y * size + x) * 4 + 3] > 40) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    imgs.push(img);
  }
  const count = imgs.length;
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
  const x1 = Math.min(size, maxX + 1 + pad), y1 = Math.min(size, maxY + 1 + pad);
  const fw = x1 - x0, fh = y1 - y0;
  const cols = Math.min(count, Math.floor(maxAtlas / fw));
  const rows = Math.ceil(count / cols);
  const mk = () => { const c = document.createElement('canvas'); c.width = cols * fw; c.height = rows * fh; return c; };
  const layers = { overlay: mk(), sil: mk(), shade: mk() };
  const lctx = { overlay: layers.overlay.getContext('2d'), sil: layers.sil.getContext('2d'), shade: layers.shade.getContext('2d') };
  const keyG = key.g; const frames = [], bboxes = [];
  const tmp = document.createElement('canvas'); tmp.width = fw; tmp.height = fh;
  const tctx = tmp.getContext('2d');
  imgs.forEach((img, i) => {
    const dx = (i % cols) * fw, dy = Math.floor(i / cols) * fh;
    const d = img.data;
    const ov = tctx.createImageData(fw, fh), sl = tctx.createImageData(fw, fh), sh = tctx.createImageData(fw, fh);
    let bx0 = fw, by0 = fh, bx1 = -1, by1 = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const si = ((y + y0) * size + (x + x0)) * 4, o = (y * fw + x) * 4;
      const r = d[si], g = d[si + 1], b = d[si + 2], a = d[si + 3];
      // "Yeşillik oranı": gövde yeşil, çerçeve koyu, göz beyaz -> oran düşük
      const ratio = g > 0 ? (g - Math.max(r, b)) / g : 0;
      const t = Math.min(1, Math.max(0, (ratio - 0.35) / 0.4));
      const w = t * t * (3 - 2 * t);
      ov.data[o] = r; ov.data[o + 1] = g; ov.data[o + 2] = b; ov.data[o + 3] = a * (1 - w); // çerçeve + gözler
      sl.data[o + 3] = a;                                                                   // silüet
      const s = Math.round(255 * Math.min(1, g / keyG));
      sh.data[o] = sh.data[o + 1] = sh.data[o + 2] = w > 0.5 ? s : 255; sh.data[o + 3] = 255; // gölge
      if (a > 40) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    }
    tctx.putImageData(ov, 0, 0); lctx.overlay.drawImage(tmp, dx, dy);
    tctx.putImageData(sl, 0, 0); lctx.sil.drawImage(tmp, dx, dy);
    tctx.putImageData(sh, 0, 0); lctx.shade.drawImage(tmp, dx, dy);
    frames.push({ x: dx, y: dy, w: fw, h: fh });
    bboxes.push({ x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 });
  });
  return {
    png: { overlay: layers.overlay.toDataURL(), sil: layers.sil.toDataURL(), shade: layers.shade.toDataURL() },
    meta: {
      bboxes, frames, count, fw, fh, cols, rows,
      pivot: { x: (minX + maxX + 1) / 2 - x0, y: (maxY + 1) - y0 },
      ballWidth: maxX - minX + 1, ballHeight: maxY - minY + 1
    }
  };
}

(async () => {
  const { chromium } = require('playwright');
  const chroma = fs.readFileSync(path.join(ROOT, 'public/js/systems/ChromaKey.js'), 'utf8').replace(/export /g, '');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: chroma });
  fs.mkdirSync(OUT, { recursive: true });
  const all = {};
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cfs-bake-'));
  for (const clip of CLIPS) {
    const dir = path.join(tmpRoot, clip.key);
    extractFrames(path.join(ROOT, clip.src), dir);
    const urls = fs.readdirSync(dir).sort().map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
    const res = await page.evaluate(bakeInPage, { urls, opts: { size: SIZE, tolerance: 60, pad: 2, maxAtlas: MAX_ATLAS } });
    for (const [layer, url] of Object.entries(res.png)) {
      fs.writeFileSync(path.join(OUT, `${clip.key}_${layer}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    all[clip.key] = { ...res.meta, fps: clip.src.endsWith('.png') ? 1 : FPS };
    console.log(`${clip.key}: ${res.meta.count} kare, ${res.meta.fw}x${res.meta.fh}, atlas ${res.meta.cols}x${res.meta.rows}`);
  }
  fs.writeFileSync(path.join(OUT, 'baked.json'), JSON.stringify(all));
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  await browser.close();
})();

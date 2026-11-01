// ============================================================
// tools/build-html.js - Tüm oyunu TEK bir HTML dosyasına paketler
// ============================================================
// Kullanım: node tools/build-html.js   (ek paket gerekmez)
// Çıktı:    dist/countryballs-fallout-suspects.html
// İçine gömülenler: Phaser, CSS, tüm JS modülleri, dil dosyaları, karakter
// kareleri ve rol videoları. Sunucu/internet gerekmez; telefonda direkt açılır.
//
// Nasıl çalışır: main.js'den başlayıp import'ları takip eder. Her modül bir
// fonksiyona sarılır; import satırları __req('yol') çağrısına çevrilir.
// Not: Yeni bir varlık (resim/video/json) eklersen aşağıdaki ASSETS listesine ekle.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'dist');

// Gömülecek dosyalar (public/ altındaki yollar). Kod bunları assetUrl()/loadJSON() ile ister.
// public/assets altındaki TÜM dosyalar + dil dosyaları gömülür (videolar, animasyonlar, resimler)
function walk(dir) {
  return fs.readdirSync(path.join(PUB, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]);
}
const ASSETS = ['locales/tr.json', 'locales/en.json', ...walk('assets')];
const MIME = { '.png': 'image/png', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

// ---- JS modüllerini topla ----
const modules = new Map(); // yol -> kod
const order = [];

function rel(p) { return path.relative(PUB, p).split(path.sep).join('/'); }

function transform(file) {
  let src = fs.readFileSync(file, 'utf8');
  const deps = [];
  // import { a, b as c } from './x.js';
  src = src.replace(/^\s*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_, names, spec) => {
    const dep = rel(path.resolve(path.dirname(file), spec));
    deps.push(dep);
    const list = names.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2')).join(', ');
    return `const { ${list} } = __req(${JSON.stringify(dep)});`;
  });
  // import './x.js';
  src = src.replace(/^\s*import\s*['"]([^'"]+)['"];?/gm, (_, spec) => {
    const dep = rel(path.resolve(path.dirname(file), spec));
    deps.push(dep);
    return `__req(${JSON.stringify(dep)});`;
  });
  if (/^\s*import\s/m.test(src)) throw new Error('Desteklenmeyen import biçimi: ' + rel(file));
  // export const/let/function/class
  const exported = [];
  src = src.replace(/^export\s+(const|let|var|function|async function|class)\s+(\w+)/gm, (_, kw, name) => {
    exported.push(name);
    return `${kw} ${name}`;
  });
  // export { a, b };
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => {
    names.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => exported.push(s));
    return '';
  });
  if (/^export\s/m.test(src)) throw new Error('Desteklenmeyen export biçimi: ' + rel(file));
  const ret = exported.map((n) => (n.includes(' as ') ? n.replace(/^(\w+)\s+as\s+(\w+)$/, '$2: $1') : n)).join(', ');
  return { code: `${src}\nreturn { ${ret} };`, deps };
}

function visit(file) {
  const key = rel(file);
  if (modules.has(key)) return;
  modules.set(key, null); // döngü koruması
  const { code, deps } = transform(file);
  deps.forEach((d) => visit(path.join(PUB, d)));
  modules.set(key, code);
  order.push(key);
}
visit(path.join(PUB, 'js/main.js'));

// ---- Varlıkları göm ----
const assets = {};
for (const a of ASSETS) {
  const file = path.join(PUB, a);
  const ext = path.extname(a).toLowerCase();
  if (ext === '.json') assets[a] = JSON.parse(fs.readFileSync(file, 'utf8'));
  else assets[a] = `data:${MIME[ext]};base64,` + fs.readFileSync(file).toString('base64');
}

const css = fs.readFileSync(path.join(PUB, 'css/style.css'), 'utf8');
const phaser = fs.readFileSync(path.join(PUB, 'lib/phaser.min.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const head = indexHtml.slice(indexHtml.indexOf('<head>') + 6, indexHtml.indexOf('</head>'))
  .replace(/\s*<link rel="stylesheet"[^>]*>/g, '');

const modCode = order.map((k) => `__def(${JSON.stringify(k)}, function () {\n${modules.get(k)}\n});`).join('\n');

const html = `<!DOCTYPE html>
<html lang="tr">
<head>${head}
<style>
${css}
</style>
</head>
<body>
<div id="game"></div>
<script>
${phaser.replace(/<\/script/gi, '<\\/script')}
</script>
<script>
window.CFS_ASSETS = ${JSON.stringify(assets)};
</script>
<script>
(function () {
'use strict';
var __defs = {}, __cache = {};
function __def(k, fn) { __defs[k] = fn; }
function __req(k) {
  if (!(k in __cache)) { if (!__defs[k]) throw new Error('Modül yok: ' + k); __cache[k] = __defs[k](); }
  return __cache[k];
}
${modCode}
__req('js/main.js');
})();
</script>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, 'countryballs-fallout-suspects.html');
fs.writeFileSync(out, html);
console.log(`${out}  (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB, ${order.length} modül)`);

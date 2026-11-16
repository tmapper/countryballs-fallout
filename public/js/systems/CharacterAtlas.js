// ============================================================
// CharacterAtlas.js - Hazır (pişirilmiş) karakter karelerini Phaser'a yükler
// ============================================================
// Kareler tools/bake.js ile önceden hazırlanır: public/assets/baked/
//   baked.json            -> kare konumları, pivot, top boyu...
//   <klip>_overlay.png    -> çerçeve + gözler
//   <klip>_sil.png        -> topun silüeti
//   <klip>_shade.png      -> gövdenin gölgesi
// Klipler: 'walk' (sağa yürüme; sola = aynası), 'idle' (SabitDurma, tek kare)
//
// SKIN ÜRETİMİ (performans): Bir bayrağın yürüme dokusu büyük (~3900x650).
// Hepsini maç başında bir kerede üretmek telefonu saniyelerce dondurur. Bu yüzden:
//   requestSkins(flags) -> arka planda, kare kare, her seferinde birkaç ms çalışır
//                          (lobi açıkken botların bayrakları da hazırlanır)
//   flushSkins(flags)   -> eksik kalan varsa hemen bitirir (maç başlarken)
import { loadJSON, loadImage } from './Assets.js';
import { createSkinCanvas, composeFrame, SKIN_SCALE } from './SkinFactory.js';

const LAYERS = ['overlay', 'sil', 'shade'];
import { perf } from './Perf.js';

// Pişirilmiş bilgiler: baked.walk.pivot, baked.idle.layers ...
export const baked = {};

// Skin = bir bayrağın bir klipteki dokusu. walk_l, walk_r'nin aynası olarak çizilir.
export const SKINS = {
  idle: { clip: 'idle', mirrorFlag: false },
  walk_r: { clip: 'walk', mirrorFlag: false },
  walk_l: { clip: 'walk', mirrorFlag: true }
};

export async function loadCharacters() {
  const meta = await loadJSON('assets/baked/baked.json');
  await Promise.all(Object.entries(meta).map(async ([clip, m]) => {
    const imgs = await Promise.all(LAYERS.map((l) => loadImage(`assets/baked/${clip}_${l}.png`)));
    const layers = {};
    LAYERS.forEach((l, i) => { layers[l] = imgs[i]; });
    baked[clip] = { ...m, layers };
  }));
}

// Doku/animasyon anahtarı: "walk_r:TR" gibi
export const skinKey = (skin, flag) => `${skin}:${flag}`;

// ---------------- Arka plan üretim kuyruğu ----------------
let target = null;        // { textures, anims } (Phaser'ın genel yöneticileri)
const queue = [];         // { flag, skin, cv?, c?, i }
let timer = null;

export function initSkins(game) {
  target = { textures: game.textures, anims: game.anims };
}

function register(mgr, job) {
  const key = skinKey(job.skin, job.flag);
  if (mgr.textures.exists(key)) return;
  const info = baked[SKINS[job.skin].clip];
  const tex = mgr.textures.addCanvas(key, job.cv);
  const k = SKIN_SCALE;
  info.frames.forEach((f, i) => tex.add(i, 0, Math.round(f.x * k), Math.round(f.y * k), Math.round(f.w * k), Math.round(f.h * k)));
  if (info.count > 1 && !mgr.anims.exists(key)) {
    mgr.anims.create({ key, frames: info.frames.map((_, i) => ({ key, frame: i })), frameRate: info.fps, repeat: -1 });
  }
}

// Bir işi bir kare ilerletir; bittiyse true
function step(job) {
  const def = SKINS[job.skin];
  const info = baked[def.clip];
  if (!job.cv) { job.cv = createSkinCanvas(info); job.c = job.cv.getContext('2d'); job.i = 0; }
  composeFrame(job.c, info, job.i, job.flag, def.mirrorFlag);
  job.i++;
  return job.i >= info.frames.length;
}

function work() {
  timer = null;
  const end = performance.now() + perf().skinSlice;   // performans moduna göre 6/4/3 ms (kare akıcı kalsın)
  while (queue.length && performance.now() < end) {
    const job = queue[0];
    if (step(job)) { queue.shift(); register(target, job); }
  }
  if (queue.length) timer = setTimeout(work, 16);
}

const missing = (mgr, flag, skin) => !mgr.textures.exists(skinKey(skin, flag));

// Bu bayrakların skin'lerini arka planda hazırla; listede olmayanları bellekten sil.
// (Oyun sahnesi çalışırken çağırma: kullanılan bir dokuyu silebilir.)
export function requestSkins(flags) {
  if (!target) return;
  const want = new Set(flags);
  pruneSkins(target, want);
  for (let i = queue.length - 1; i >= 0; i--) if (!want.has(queue[i].flag)) queue.splice(i, 1);
  // Kendi bayrağın (ilk sıradaki) önce hazırlansın
  [...want].forEach((flag) => Object.keys(SKINS).forEach((skin) => {
    if (missing(target, flag, skin) && !queue.some((j) => j.flag === flag && j.skin === skin)) queue.push({ flag, skin });
  }));
  if (queue.length && !timer) timer = setTimeout(work, 16);
}

// Bu bayrağın yürüme dokusu lazım (hiç silmeden). front: sıranın başına al (kendi topun / şu an yürüyen)
export function wantSkin(flag, front = false) {
  if (!target) return;
  ['walk_r', 'walk_l'].forEach((skin) => {
    if (!missing(target, flag, skin)) return;
    const i = queue.findIndex((j) => j.flag === flag && j.skin === skin);
    if (i >= 0) { if (front && i > 1) queue.unshift(queue.splice(i, 1)[0]); }
    else if (front) queue.unshift({ flag, skin }); else queue.push({ flag, skin });
  });
  if (queue.length && !timer) timer = setTimeout(work, 16);
}

// Eksik kalanları hemen bitir (gerekirse senkron). skins: sadece bu skin'ler (varsayılan hepsi)
export function flushSkins(flags, mgr = target, skins = Object.keys(SKINS)) {
  flags.forEach((flag) => skins.forEach((skin) => {
    if (!missing(mgr, flag, skin)) return;
    let job = queue.find((j) => j.flag === flag && j.skin === skin);
    if (job) queue.splice(queue.indexOf(job), 1);
    else job = { flag, skin };
    while (!step(job)) { /* kalan kareler */ }
    register(mgr, job);
  }));
}

// Eski API: tüm skin'leri hemen hazırlar. Skin hazırsa hiçbir şey yapmaz.
export function ensureSkin(scene, flag) {
  flushSkins([flag], { textures: scene.textures, anims: scene.anims });
}

// Sadece duruş karesi (tek kare, çok hızlı). Yürüme skin'leri arka planda gelir.
export function ensureIdle(scene, flag) {
  flushSkins([flag], { textures: scene.textures, anims: scene.anims }, ['idle']);
}

export const hasSkin = (scene, skin, flag) => scene.textures.exists(skinKey(skin, flag));

// Bellek tasarrufu: listede olmayan bayrakların dokularını sil (telefon için önemli)
export function pruneSkins(mgr, keepFlags) {
  const keep = keepFlags instanceof Set ? keepFlags : new Set(keepFlags);
  mgr.textures.getTextureKeys().forEach((key) => {
    const [skin, flag] = key.split(':');
    if (!SKINS[skin] || !flag || keep.has(flag)) return;
    if (mgr.anims.exists(key)) mgr.anims.remove(key);
    mgr.textures.remove(key);
  });
}

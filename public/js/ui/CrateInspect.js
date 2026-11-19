// ============================================================
// CrateInspect.js - 3D kasa inceleme (yerel Three.js + GLB)
// common = sığınak (yeşil), rare = ender (mavi), grand = büyük (altın)
// ============================================================
import { i18n } from '../systems/I18n.js';
import { assetUrl } from '../systems/Assets.js';
import { sfx } from '../systems/Sound.js';
import { CRATE_ODDS, RARITY_COLOR, RARITY_ORDER } from '../systems/Pass.js';
import { HIST_FLAGS, getFlagThumb } from '../systems/Flags.js';

const MODEL = {
  common: 'assets/crates/common.glb',
  rare: 'assets/crates/rare.glb',
  grand: 'assets/crates/grand.glb'
};
const PREVIEW = {
  common: 'assets/menu/crate_common.png',
  rare: 'assets/menu/crate_rare.png',
  grand: 'assets/menu/crate_grand.png'
};

let THREE = null;
let GLTFLoader = null;
let loadingLib = null;

function loadThree() {
  if (THREE && GLTFLoader) return Promise.resolve();
  if (loadingLib) return loadingLib;
  loadingLib = Promise.all([
    import('../vendor/three.module.js'),
    import('../vendor/GLTFLoader.js')
  ]).then(([T, G]) => {
    THREE = T;
    GLTFLoader = G.GLTFLoader;
  }).catch((err) => {
    loadingLib = null;
    throw err;
  });
  return loadingLib;
}

function poolFor(tier) {
  const odds = CRATE_ODDS[tier] || {};
  // Osmanlı (OTT) mistik: sadece bilet 30. seviye, kasadan ÇIKMAZ — önizlemede gösterme
  const flags = (HIST_FLAGS || []).filter((c) => c !== 'OTT').slice(0, 12);
  return { odds, flags };
}

export class CrateInspect {
  constructor() {
    this.root = null;
    this.tier = null;
    this.onOpen = null;
    this._raf = 0;
    this._scene = null;
    this._renderer = null;
    this._cam = null;
    this._mesh = null;
    this._drag = false;
    this._lx = 0;
    this._ly = 0;
    this._rotY = 0.55;
    this._rotX = 0.28;
  }

  get isOpen() { return !!(this.root && !this.root.classList.contains('hidden')); }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'crate-inspect hidden';
    r.innerHTML = `
      <div class="ci-card">
        <div class="ci-head">
          <h2 class="ci-title"></h2>
          <button class="ci-x" type="button" aria-label="close">✕</button>
        </div>
        <div class="ci-stage">
          <img class="ci-fallback" alt="" />
          <canvas class="ci-canvas"></canvas>
          <div class="ci-hint"></div>
          <div class="ci-load">…</div>
        </div>
        <div class="ci-body">
          <p class="ci-sub"></p>
          <div class="ci-odds"></div>
          <div class="ci-flags"></div>
        </div>
        <div class="ci-foot">
          <button class="mm-tbtn ci-cancel" type="button"></button>
          <button class="mm-tbtn primary ci-open" type="button"></button>
        </div>
      </div>`;
    document.body.appendChild(r);
    r.querySelector('.ci-x').addEventListener('click', () => this.close());
    r.querySelector('.ci-cancel').addEventListener('click', () => this.close());
    r.querySelector('.ci-open').addEventListener('click', () => {
      sfx('crate_click', 1);
      const fn = this.onOpen;
      this.close();
      if (fn) fn();
    });
    r.addEventListener('pointerdown', (e) => { if (e.target === r) this.close(); });
    const canvas = r.querySelector('.ci-canvas');
    const onDown = (e) => {
      this._drag = true;
      this._lx = e.clientX;
      this._ly = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const onMove = (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._lx, dy = e.clientY - this._ly;
      this._lx = e.clientX; this._ly = e.clientY;
      this._rotY += dx * 0.012;
      this._rotX = Math.max(-0.85, Math.min(0.95, this._rotX + dy * 0.012));
    };
    const onUp = () => { this._drag = false; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }

  open(tier, { onOpen } = {}) {
    if (!this.root) this.build();
    this.tier = tier;
    this.onOpen = onOpen;
    this._rotY = 0.55;
    this._rotX = 0.28;
    const r = this.root;
    r.classList.remove('hidden');
    document.body.appendChild(r);

    r.querySelector('.ci-title').textContent = i18n.t('pass.tier.' + tier);
    r.querySelector('.ci-sub').textContent = i18n.t('pass.inspectSub');
    r.querySelector('.ci-hint').textContent = i18n.t('pass.inspectHint');
    r.querySelector('.ci-cancel').textContent = i18n.tf('menu.back', 'Geri');
    r.querySelector('.ci-open').textContent = i18n.t('pass.open');

    const { odds, flags } = poolFor(tier);
    r.querySelector('.ci-odds').innerHTML = Object.entries(odds)
      .sort((a, b) => RARITY_ORDER.indexOf(a[0]) - RARITY_ORDER.indexOf(b[0]))
      .map(([rr, w]) => `<span style="color:${RARITY_COLOR[rr] || '#fff'}">${i18n.t('pass.rarity.' + rr)} <b>%${w}</b></span>`)
      .join('');
    const fl = r.querySelector('.ci-flags');
    fl.innerHTML = flags.length
      ? `<div class="ci-flags-label">${i18n.t('pass.inspectFlags')}</div>` +
        flags.map((c) => `<img alt="" title="${c}" src="${getFlagThumb(c, 48, 32)}">`).join('')
      : '';

    const fb = r.querySelector('.ci-fallback');
    fb.src = assetUrl(PREVIEW[tier] || PREVIEW.common);
    fb.style.display = 'block';

    const loadEl = r.querySelector('.ci-load');
    loadEl.style.display = 'flex';
    loadEl.textContent = i18n.tf('ui.loading', 'Yükleniyor…');

    const canvas = r.querySelector('.ci-canvas');
    canvas.style.opacity = '0';

    this.start3d(tier).catch((err) => {
      console.warn('[CrateInspect] 3D yüklenemedi', err);
      loadEl.textContent = i18n.tf('pass.inspect2d', 'Önizleme (2D)');
      setTimeout(() => { loadEl.style.display = 'none'; }, 1200);
    });
  }

  async start3d(tier) {
    await loadThree();
    const canvas = this.root.querySelector('.ci-canvas');
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssW = Math.max(160, rect.width || 320);
    const cssH = Math.max(140, rect.height || 240);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    this.stop3d();

    const scene = this._scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a120e);
    const cam = this._cam = new THREE.PerspectiveCamera(40, cssW / cssH, 0.05, 40);
    cam.position.set(0, 0.08, 2.15);
    cam.lookAt(0, 0.05, 0);
    const renderer = this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(canvas.width, canvas.height, false);
    if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.15);
    key.position.set(2.2, 3.5, 2.5);
    const fill = new THREE.DirectionalLight(0x88ccff, 0.35);
    fill.position.set(-2, 1.2, -1.5);
    scene.add(key, fill);

    const raw = MODEL[tier] || MODEL.common;
    const url = assetUrl(raw);
    console.log('[CrateInspect] loading', tier, url);
    await new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        try {
          const root = gltf.scene || gltf.scenes[0];
          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          root.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          root.scale.setScalar(1.15 / maxDim);
          // Sahne ortasına al (altta kalmasın)
          root.position.y += size.y * 0.05;
          scene.add(root);
          this._mesh = root;
          this.root.querySelector('.ci-fallback').style.display = 'none';
          canvas.style.opacity = '1';
          this.root.querySelector('.ci-load').style.display = 'none';
          resolve();
        } catch (e) { reject(e); }
      }, undefined, reject);
    });

    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (this._mesh) {
        this._mesh.rotation.y = this._rotY;
        this._mesh.rotation.x = this._rotX;
        if (!this._drag) this._rotY += 0.005;
      }
      renderer.render(scene, cam);
    };
    loop();
  }

  stop3d() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._renderer) {
      try { this._renderer.dispose(); } catch (e) {}
      this._renderer = null;
    }
    this._scene = null;
    this._mesh = null;
  }

  close() {
    if (!this.root) return;
    this.root.classList.add('hidden');
    this.stop3d();
    this.onOpen = null;
  }
}

export const crateInspect = new CrateInspect();

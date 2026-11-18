// ============================================================
// CrateInspect.js - 3D kasa inceleme: döndür, içeriği gör, sonra aç
// Three.js CDN ile GLB yükler (common / rare / grand)
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

let THREE = null;
let GLTFLoader = null;
let loadingLib = null;

function loadThree() {
  if (THREE && GLTFLoader) return Promise.resolve();
  if (loadingLib) return loadingLib;
  loadingLib = Promise.all([
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'),
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js')
  ]).then(([T, G]) => {
    THREE = T;
    GLTFLoader = G.GLTFLoader;
  });
  return loadingLib;
}

// HIST_FLAGS + rarity pools from Pass
function poolFor(tier) {
  // Pass CRATE_ODDS is rarity weights; flags come from server open result.
  // Preview: show rarity bars + sample of historical flags if available.
  const odds = CRATE_ODDS[tier] || {};
  const flags = (typeof HIST_FLAGS !== 'undefined' && HIST_FLAGS.length) ? HIST_FLAGS.slice(0, 12) : [];
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
    this._rotY = 0.6;
    this._rotX = 0.35;
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
          <canvas class="ci-canvas"></canvas>
          <div class="ci-hint" data-t="pass.inspectHint">Sürükleyerek döndür</div>
          <div class="ci-load">…</div>
        </div>
        <div class="ci-body">
          <p class="ci-sub"></p>
          <div class="ci-odds"></div>
          <div class="ci-flags"></div>
        </div>
        <div class="ci-foot">
          <button class="mm-tbtn ci-cancel" type="button" data-t="menu.back">Geri</button>
          <button class="mm-tbtn primary ci-open" type="button" data-t="pass.open">Aç</button>
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
    const onDown = (e) => { this._drag = true; this._lx = e.clientX; this._ly = e.clientY; canvas.setPointerCapture?.(e.pointerId); };
    const onMove = (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._lx, dy = e.clientY - this._ly;
      this._lx = e.clientX; this._ly = e.clientY;
      this._rotY += dx * 0.01;
      this._rotX = Math.max(-0.8, Math.min(0.9, this._rotX + dy * 0.01));
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
    const r = this.root;
    r.classList.remove('hidden');
    r.querySelector('.ci-title').textContent = i18n.t('pass.tier.' + tier);
    r.querySelector('.ci-sub').textContent = i18n.t('pass.inspectSub');
    r.querySelectorAll('[data-t]').forEach((n) => { try { n.textContent = i18n.t(n.dataset.t); } catch (e) {} });
    const { odds, flags } = poolFor(tier);
    const od = r.querySelector('.ci-odds');
    od.innerHTML = Object.entries(odds)
      .sort((a, b) => (RARITY_ORDER.indexOf(a[0]) - RARITY_ORDER.indexOf(b[0])))
      .map(([rr, w]) => `<span style="color:${RARITY_COLOR[rr] || '#fff'}">${i18n.t('pass.rarity.' + rr)} <b>%${w}</b></span>`)
      .join('');
    const fl = r.querySelector('.ci-flags');
    fl.innerHTML = flags.length
      ? `<div class="ci-flags-label">${i18n.t('pass.inspectFlags')}</div>` +
        flags.map((c) => `<img alt="" title="${c}" src="${getFlagThumb(c, 48, 32)}">`).join('')
      : '';
    r.querySelector('.ci-load').classList.remove('hidden');
    r.querySelector('.ci-load').textContent = i18n.tf('ui.loading', 'Yükleniyor…');
    this.start3d(tier);
  }

  async start3d(tier) {
    try {
      await loadThree();
    } catch (e) {
      this.root.querySelector('.ci-load').textContent = i18n.tf('ui.loadError', '3D yüklenemedi');
      return;
    }
    const canvas = this.root.querySelector('.ci-canvas');
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 240;
    canvas.width = w * Math.min(2, window.devicePixelRatio || 1);
    canvas.height = h * Math.min(2, window.devicePixelRatio || 1);

    if (this._renderer) {
      cancelAnimationFrame(this._raf);
      this._renderer.dispose();
      this._scene = null;
    }

    const scene = this._scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b120e);
    const cam = this._cam = new THREE.PerspectiveCamera(42, w / h, 0.05, 50);
    cam.position.set(0, 0.35, 2.2);
    const renderer = this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    const dir = new THREE.DirectionalLight(0xfff0d0, 1.1);
    dir.position.set(2, 4, 3);
    const rim = new THREE.DirectionalLight(0x7dff9a, 0.35);
    rim.position.set(-2, 1, -2);
    scene.add(amb, dir, rim);

    const loader = new GLTFLoader();
    const url = assetUrl(MODEL[tier] || MODEL.common);
    loader.load(url, (gltf) => {
      const root = gltf.scene || gltf.scenes[0];
      // center + scale
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      root.scale.setScalar(1.15 / maxDim);
      scene.add(root);
      this._mesh = root;
      this.root.querySelector('.ci-load').classList.add('hidden');
    }, undefined, () => {
      this.root.querySelector('.ci-load').textContent = i18n.tf('ui.loadError', 'Model yüklenemedi');
    });

    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (this._mesh) {
        this._mesh.rotation.y = this._rotY;
        this._mesh.rotation.x = this._rotX;
        if (!this._drag) this._rotY += 0.004;
      }
      renderer.render(scene, cam);
    };
    loop();
  }

  close() {
    if (!this.root) return;
    this.root.classList.add('hidden');
    cancelAnimationFrame(this._raf);
    if (this._renderer) {
      try { this._renderer.dispose(); } catch (e) {}
      this._renderer = null;
    }
    this._scene = null;
    this._mesh = null;
    this.onOpen = null;
  }
}

export const crateInspect = new CrateInspect();

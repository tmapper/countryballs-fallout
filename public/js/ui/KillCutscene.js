// ============================================================
// KillCutscene.js - Öldürme / vurma animasyonu (iki bayraklı)
// ============================================================
// tools/kills.py her öldürme videosunu iki katmana ayırır:
//   overlay : çerçeve, gözler, bıçak/tabanca (RGBA)
//   data    : R = gölge, G = öldürenin gövdesi, B = ölenin gövdesi
// Bu dosya, oyunun üstünde şeffaf bir WebGL tuvalinde kareleri sırayla çizer;
// gövdelere öldürenin ve ölenin bayrağını giydirir.
// Sadece bu cihazdaki oyuncu olayın içindeyse (öldüren/ölen/vuran) oynatılır.
import { loadJSON, loadImage, assetUrl, prefetchAssets } from '../systems/Assets.js';
import { isMemSave, dropGL } from '../systems/MemSaver.js';
import { getFlagCanvas } from '../systems/Flags.js';
import { RES } from '../systems/Resolution.js';

export const KILL_CLIPS = ['kill1', 'kill2'];
export const SHOOT_CLIP = 'sheriff_kill';

let META = null;
const images = {};
export async function loadKillMeta() {
  META = await loadJSON('assets/kills/kills.json');
}
// BELLEK: atlaslar yarı çözünürlüğe indirildi (~5 MB GPU / klibe). Sadece oynayacağı klibin resimleri yüklenir ve bitince atılır.
export function preloadKills() {
  if (!META) loadKillMeta().catch(() => {});
  // Animasyon dosyaları (6 PNG, ~2 MB) maç başında boşta kalan zamanda indirilip tarayıcı önbelleğine alınır.
  // Çözülmüş resim bellekte TUTULMAZ; öldürme anında sadece çözme kalır.
  prefetchAssets([...KILL_CLIPS, SHOOT_CLIP].flatMap((c) => [`assets/kills/${c}_overlay.png`, `assets/kills/${c}_data.png`]));
}
function loadClip(clip) {
  ['overlay', 'data'].forEach((layer) => {
    const k = `${clip}_${layer}`;
    if (!images[k]) images[k] = loadImage(`assets/kills/${k}.png`).catch((e) => { delete images[k]; throw e; });
  });
}
function dropClip(clip) { delete images[`${clip}_overlay`]; delete images[`${clip}_data`]; }

const VERT = `
attribute vec2 p;
varying vec2 v;
void main() { v = vec2((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D uOv, uData, uFlagA, uFlagB;
uniform vec4 uFrame;  // karenin atlas içindeki yeri (0..1)
uniform vec4 uBoxA;   // öldürenin bayrak kutusu (kare içinde 0..1)
uniform vec4 uBoxB;   // ölenin bayrak kutusu
varying vec2 v;
void main() {
  vec2 auv = uFrame.xy + v * uFrame.zw;
  vec4 o = texture2D(uOv, auv);
  vec4 d = texture2D(uData, auv);
  vec3 fa = texture2D(uFlagA, clamp((v - uBoxA.xy) / uBoxA.zw, 0.0, 1.0)).rgb;
  vec3 fb = texture2D(uFlagB, clamp((v - uBoxB.xy) / uBoxB.zw, 0.0, 1.0)).rgb;
  vec3 body = (fa * d.g + fb * d.b) * d.r;   // ön-çarpılmış renk
  float m = clamp(d.g + d.b, 0.0, 1.0);
  float a = o.a + m * (1.0 - o.a);
  gl_FragColor = vec4(o.rgb * o.a + body * (1.0 - o.a), a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export class KillCutscene {
  constructor() {
    this.root = null;
    this.active = null;
    this.idleCallbacks = [];
  }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'killcut hidden';
    // Arkada sarı-kırmızı patlama (ışınlar + parlama + kıvılcım halkası), önde animasyon
    r.innerHTML = '<div class="kc-boom"><i class="kc-rays"></i><i class="kc-core"></i><i class="kc-ring"></i></div><canvas></canvas><div class="killcut-text"></div>';
    document.body.appendChild(r);
    this.canvas = r.querySelector('canvas');
    this.text = r.querySelector('.killcut-text');
    const gl = this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    ['uOv', 'uData', 'uFlagA', 'uFlagB', 'uFrame', 'uBoxA', 'uBoxB'].forEach((n) => { this.u[n] = gl.getUniformLocation(prog, n); });
    ['uOv', 'uData', 'uFlagA', 'uFlagB'].forEach((n, i) => gl.uniform1i(this.u[n], i));
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); // data kanalları renk düzeltmesine girmesin
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.clearColor(0, 0, 0, 0);
  }

  texture(unit, source) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return t;
  }

  get busy() { return !!this.active; }

  // Animasyon bitince (ya da hiç oynamıyorsa hemen) çağrılır
  whenIdle(fn) {
    if (!this.active) fn(); else this.idleCallbacks.push(fn);
  }

  // clip: 'kill1' | 'kill2' | 'sheriff_kill'; flagA = öldüren/vuran, flagB = ölen
  async play(clip, flagA, flagB, caption = '', tone = 'kill') {
    if (!this.root) this.build();
    if (!META) { try { await loadKillMeta(); } catch (e) { /* yoksay */ } }   // ilk öldürmede henüz yüklenmemiş olabilir
    if (!this.gl || !META || !META[clip]) return;
    if (this.active) this.stop();
    const meta = META[clip];
    const token = this.active = { clip, raf: 0, textures: [] };
    this.root.classList.remove('hidden', 'fade');
    this.root.dataset.tone = tone;
    this.text.textContent = caption;
    let ov, data;
    try {
      loadClip(clip);
      [ov, data] = await Promise.all([images[`${clip}_overlay`], images[`${clip}_data`]]);
    } catch (e) {
      console.warn('Öldürme animasyonu yüklenemedi', e);
      this.stop();
      return;
    }
    if (this.active !== token) return;
    const gl = this.gl;
    // Tuval: karenin en-boy oranında, ekrana sığan en büyük boy (1080p çözünürlükte)
    const maxW = window.innerWidth * 0.94, maxH = window.innerHeight * 0.7;
    const s = Math.min(maxW / meta.fw, maxH / meta.fh);
    const cssW = meta.fw * s, cssH = meta.fh * s;
    this.canvas.width = Math.round(Math.min(meta.fw * 1.6, cssW * RES.k));
    this.canvas.height = Math.round(this.canvas.width * meta.fh / meta.fw);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    token.textures = [this.texture(0, ov), this.texture(1, data), this.texture(2, getFlagCanvas(flagA)), this.texture(3, getFlagCanvas(flagB))];

    const W = ov.width, H = ov.height;
    const box = (b, fb) => {
      const x = b || fb || [0, 0, meta.fw, meta.fh];
      return [x[0] / meta.fw, x[1] / meta.fh, Math.max(1, x[2]) / meta.fw, Math.max(1, x[3]) / meta.fh];
    };
    // Başlangıç zamanı ilk karenin zaman damgasından alınır. (requestAnimationFrame'in verdiği
    // zaman performance.now()'dan önce olabilir; o zaman t eksi çıkıp kare -1 oluyordu ve
    // animasyon hiç oynamadan ekran kararmış/kırmızı kalıyordu.)
    let start = -1;
    const hold = 450;
    const total = (meta.count / meta.fps) * 1000;
    let lastA = null, lastB = null;
    const draw = (now) => {
      if (this.active !== token) return;
      if (start < 0) start = now;
      const t = Math.max(0, now - start);
      const i = Math.max(0, Math.min(meta.count - 1, meta.frames.length - 1, Math.floor((t / 1000) * meta.fps)));
      const [fx, fy] = meta.frames[i];
      lastA = meta.boxA[i] || lastA; lastB = meta.boxB[i] || lastB;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(this.u.uFrame, fx / W, fy / H, meta.fw / W, meta.fh / H);
      gl.uniform4fv(this.u.uBoxA, box(lastA));
      gl.uniform4fv(this.u.uBoxB, box(lastB));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (t < total + hold) token.raf = requestAnimationFrame(draw);
      else this.finish(token);
    };
    token.raf = requestAnimationFrame(draw);
    // Güvenlik: sekme arka plandayken requestAnimationFrame durur; animasyon asla bitmeyip
    // maç sonu ekranını / sesleri bekletmesin diye süre dolunca her durumda kapat.
    token.safety = setTimeout(() => this.finish(token), total + hold + 1200);
  }

  finish(token) {
    if (this.active !== token) return;
    this.root.classList.add('fade');
    setTimeout(() => {
      if (this.active !== token) return;
      this.stop();
    }, 260);
  }

  stop() {
    const a = this.active;
    this.active = null;
    if (a) {
      cancelAnimationFrame(a.raf);
      clearTimeout(a.safety);
      dropClip(a.clip);
      if (this.gl) a.textures.forEach((t) => this.gl.deleteTexture(t)); // GPU belleğini hemen boşalt
    }
    if (this.root) this.root.classList.add('hidden');
    // Belleği küçült: tam ekran WebGL çizim alanını da bırak (sonraki öldürmede yeniden kurulur)
    if (isMemSave() && this.root && !this.active) {
      if (this.gl) dropGL(this.gl, this.canvas);
      this.root.remove(); this.root = null; this.canvas = null; this.gl = null; this.u = null;
    }
    const cbs = this.idleCallbacks.splice(0);
    cbs.forEach((fn) => fn());
  }
}

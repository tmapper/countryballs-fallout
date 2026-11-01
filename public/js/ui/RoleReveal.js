// ============================================================
// RoleReveal.js - "SENİN ROLÜN: ..." animasyonu (bayraklı)
// ============================================================
// Rol videosu (role_<rol>.mp4) tam ekran oynatılır. Videodaki top yeşil;
// WebGL shader her karede yeşil gövdeyi oyuncunun bayrağıyla değiştirir:
//   - "yeşillik oranı" -> gövde maskesi (yumuşak kenarlı)
//   - yeşilin parlaklığı -> gölge (top yuvarlak görünsün)
//   - bayrak, topun o karedeki kutusuna (roles.json) esnetilir
// WebGL yoksa video olduğu gibi (yeşil top) oynar.
import { RES } from '../systems/Resolution.js';
import { sfx } from '../systems/Sound.js';

// Sesler videonun karelerine bağlı (video takılsa da senkron kalır):
//   0-0.5 sn "SENİN ROLÜN" yazılırken daktilo tıkları, 1.4 sn'de rol açılırken role özel vuruş.
const TYPE_CUES = [0.02, 0.1, 0.18, 0.26, 0.34, 0.42];
const REVEAL_AT = 1.4;
const REVEAL_SFX = { impostor: ['kill', 1], sheriff: ['shoot', 1], crewmate: ['win', 0.8] };
import { assetUrl, loadJSON } from '../systems/Assets.js';
import { getFlagCanvas } from '../systems/Flags.js';
import { i18n } from '../systems/I18n.js';
import { ROLE_COLORS } from '../systems/Roles.js';

let META = null;
export async function loadRoleMeta() {
  META = await loadJSON('assets/videos/roles.json');
}

const VERT = `
attribute vec2 p;
varying vec2 v;
void main() { v = vec2((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D uVid;
uniform sampler2D uFlag;
uniform vec4 uBox;     // topun kutusu: x, y, w, h (0..1)
uniform float uKeyG;   // perdedeki en parlak yeşil
varying vec2 v;
void main() {
  vec4 c = texture2D(uVid, v);
  float g = c.g;
  float ratio = g > 0.0 ? (g - max(c.r, c.b)) / g : 0.0;
  float t = clamp((ratio - 0.35) / 0.4, 0.0, 1.0);
  float w = t * t * (3.0 - 2.0 * t);
  vec2 fuv = clamp((v - uBox.xy) / uBox.zw, 0.0, 1.0);
  vec3 flag = texture2D(uFlag, fuv).rgb;
  float shade = min(1.0, g / uKeyG);
  gl_FragColor = vec4(mix(c.rgb, flag * shade, w), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function makeTexture(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

export class RoleReveal {
  constructor() {
    this.root = null;
    this.active = null;
  }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'reveal hidden';
    r.innerHTML = '<canvas class="reveal-canvas"></canvas><div class="reveal-caption"></div><div class="reveal-skip"></div>';
    document.body.appendChild(r);
    this.canvas = r.querySelector('canvas');
    this.caption = r.querySelector('.reveal-caption');
    this.skip = r.querySelector('.reveal-skip');
    r.addEventListener('pointerdown', () => {
      if (this.active && performance.now() - this.active.started > 700) this.finish();
    });
  }

  setupGL() {
    if (this.gl !== undefined) return this.gl;
    let gl = null;
    try {
      gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
      if (gl) {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        this.u = {
          vid: gl.getUniformLocation(prog, 'uVid'), flag: gl.getUniformLocation(prog, 'uFlag'),
          box: gl.getUniformLocation(prog, 'uBox'), keyG: gl.getUniformLocation(prog, 'uKeyG')
        };
        this.texVid = makeTexture(gl);
        this.texFlag = makeTexture(gl);
        gl.uniform1i(this.u.vid, 0);
        gl.uniform1i(this.u.flag, 1);
      }
    } catch (e) {
      console.warn('Rol animasyonu: WebGL yok, bayraksız oynatılıyor', e);
      gl = null;
    }
    this.gl = gl;
    if (!gl) this.ctx2d = this.canvas.getContext('2d');
    return gl;
  }

  // Videonun sol/sağ kenarındaki renkleri örnekle, ekranın boş kenarlarını o renge yavaşça boya
  matchEdges(video) {
    if (!this.sampler) { this.sampler = document.createElement('canvas'); this.sampler.width = 4; this.sampler.height = 16; this.sctx = this.sampler.getContext('2d', { willReadFrequently: true }); }
    this.edgeTick = (this.edgeTick || 0) + 1;
    if (this.edgeTick % 2) return;
    let d;
    try { this.sctx.drawImage(video, 0, 0, 4, 16); d = this.sctx.getImageData(0, 0, 4, 16).data; } catch (e) { return; }
    const px = (x, y) => { const i = (y * 4 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const avg = (y) => { const a = px(0, y), b = px(3, y); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
    const want = { top: avg(1), mid: avg(8), bot: avg(14) };
    const k = 0.09;                                   // yavaş geçiş (~1 sn)
    const e = this.edge;
    ['top', 'mid', 'bot'].forEach((p) => { for (let i = 0; i < 3; i++) e[p][i] += (want[p][i] - e[p][i]) * k; });
    const c = (v) => `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})`;
    this.root.style.background = `linear-gradient(to bottom, ${c(e.top)} 0%, ${c(e.mid)} 50%, ${c(e.bot)} 100%)`;
  }

  // Tuval boyutu: ekrana sığan kare, 1080p çözünürlükte (kaynak 1080 olduğu için en fazla 1080)
  resize() {
    const side = Math.min(window.innerWidth, window.innerHeight);
    const px = Math.round(Math.min(1080, side * RES.k));
    if (this.canvas.width !== px) { this.canvas.width = px; this.canvas.height = px; }
    this.canvas.style.width = this.canvas.style.height = side + 'px';
  }

  // Bu fonksiyon bir tıklamanın İÇİNDE çağrılmalı (tarayıcılar sesli oynatmaya ancak böyle izin verir)
  play(role, flag, onDone) {
    if (!this.root) this.build();
    this.stop();
    const meta = META && META[role];
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.playsInline = true;
    video.preload = 'auto';
    video.src = assetUrl(`assets/videos/role_${role}.mp4`);

    const a = this.active = { role, video, onDone, started: performance.now(), raf: 0, timer: 0, shown: false, cue: 0, revealed: false };
    clearTimeout(this.fadeTimer);
    this.root.classList.remove('hidden', 'fade');
    // Video kare (1:1); ekranın kenarları videonun kenar rengini yavaşça takip etsin
    this.edge = { top: [0, 0, 0], mid: [0, 0, 0], bot: [0, 0, 0] };
    this.root.style.background = '#000';
    // Önceki maçın son karesi görünmesin: yeni video ilk karesini verene kadar tuval gizli
    this.canvas.style.visibility = 'hidden';
    this.root.style.setProperty('--role', ROLE_COLORS[role]);
    this.skip.textContent = i18n.t('ui.tapToSkip');
    // Video Türkçe yazılı; başka dildeyken altına rol adını yaz
    this.caption.textContent = i18n.lang === 'tr' ? '' : `${i18n.t('ui.yourRole')}: ${i18n.t('roles.' + role)}`;
    this.caption.classList.remove('show');
    this.resize();

    const gl = this.setupGL();
    if (gl) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texFlag);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, getFlagCanvas(flag));
      gl.uniform1f(this.u.keyG, meta ? meta.keyG : 0.9);
    }

    const draw = () => {
      if (this.active !== a) return;
      a.raf = requestAnimationFrame(draw);
      if (video.readyState < 2) return;
      const ct = video.currentTime;
      while (a.cue < TYPE_CUES.length && ct >= TYPE_CUES[a.cue]) { sfx('ui_click', 0.9); a.cue++; }
      if (!a.revealed && ct >= REVEAL_AT) { a.revealed = true; const [n, v] = REVEAL_SFX[role] || ['vote', 1]; sfx(n, v); }
      if (ct > 1.6) this.caption.classList.add('show');
      this.matchEdges(video);
      if (gl) {
        let box = [0.18, 0.42, 0.62, 0.54];
        if (meta) {
          let i = Math.min(meta.boxes.length - 1, Math.floor(video.currentTime * meta.fps));
          while (i > 0 && !meta.boxes[i]) i--;
          if (meta.boxes[i]) box = meta.boxes[i];
        }
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texVid);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        gl.uniform4f(this.u.box, box[0], box[1], box[2], box[3]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else {
        this.ctx2d.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      }
      if (!a.shown) { a.shown = true; this.canvas.style.visibility = ''; }
    };
    a.raf = requestAnimationFrame(draw);

    video.addEventListener('ended', () => this.active === a && this.finish());
    video.addEventListener('error', () => this.active === a && this.finish());
    // Güvenlik: video hiç başlamazsa da oyun açılsın
    a.timer = setTimeout(() => this.active === a && this.finish(), ((meta && meta.duration) || 4) * 1000 + 4000);

    const p = video.play();
    if (p && p.catch) {
      p.catch(() => { // sesli oynatma engellendiyse sessiz dene
        video.muted = true;
        video.play().catch(() => this.active === a && this.finish());
      });
    }
  }

  // Animasyon bitti/atlandı: videoyu durdur ama son kare ekranda kalsın.
  // Oyun hazır olunca GameFlow fadeOut() çağırır (siyah ekran / donma görünmez).
  finish() {
    const a = this.active;
    if (!a) return;
    this.release(a);
    if (a.onDone) a.onDone();
  }

  fadeOut() {
    if (!this.root || this.active) return;
    this.root.classList.add('fade');
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => {
      if (!this.active) this.root.classList.add('hidden');
      this.root.classList.remove('fade');
    }, 320);
  }

  // Geri çağırmadan hemen kapat (ör. lobiye dönülürken)
  stop() {
    if (this.active) this.release(this.active);
    clearTimeout(this.fadeTimer);
    if (this.root) this.root.classList.add('hidden');
  }

  release(a) {
    if (this.active === a) this.active = null;
    cancelAnimationFrame(a.raf);
    clearTimeout(a.timer);
    a.video.pause();
    // Videoyu boşaltmak bazı telefonlarda anlık takılma yapar: bir sonraki turda yap
    setTimeout(() => { a.video.removeAttribute('src'); a.video.load(); }, 400);
  }
}

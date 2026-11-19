// ============================================================
// ReplaysPanel.js - Kayıtlı maç listesi + 2D harita üzerinden oynatma
// ============================================================
import { i18n } from '../systems/I18n.js';
import { listReplays, getReplay, deleteReplay } from '../systems/MatchRecorder.js';
import { getFlagThumb } from '../systems/Flags.js';
import { icon } from './Icons.js';

export class ReplaysPanel {
  constructor() {
    this.root = null;
    this.playing = null;
    this._raf = 0;
    this._t = 0;
    this._paused = false;
    this._speed = 1;
  }

  build() {
    const r = this.root = document.createElement('div');
    r.className = 'replays-panel hidden';
    r.innerHTML = `
      <div class="rp-card">
        <div class="rp-head">
          <h2 data-t="replays.title">Kayıtlar</h2>
          <button class="rp-x" type="button" aria-label="x">✕</button>
        </div>
        <div class="rp-list"></div>
        <div class="rp-player hidden">
          <canvas class="rp-canvas" width="640" height="480"></canvas>
          <div class="rp-bar">
            <button class="rp-play" type="button">▶</button>
            <input class="rp-seek" type="range" min="0" max="1000" value="0">
            <span class="rp-time">0:00</span>
            <select class="rp-speed"><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option></select>
            <button class="rp-stop" type="button" data-t="menu.back">Geri</button>
          </div>
          <div class="rp-log"></div>
        </div>
      </div>`;
    document.body.appendChild(r);
    r.querySelector('.rp-x').addEventListener('click', () => this.hide());
    r.addEventListener('pointerdown', (e) => { if (e.target === r) this.hide(); });
    r.querySelector('.rp-play').addEventListener('click', () => this.togglePause());
    r.querySelector('.rp-stop').addEventListener('click', () => this.stopPlay());
    r.querySelector('.rp-seek').addEventListener('input', (e) => {
      if (!this.playing) return;
      this._t = (Number(e.target.value) / 1000) * (this.playing.duration || 1);
      this.drawFrame();
    });
    r.querySelector('.rp-speed').addEventListener('change', (e) => { this._speed = Number(e.target.value) || 1; });
  }

  show() {
    if (!this.root) this.build();
    this.root.classList.remove('hidden');
    this.stopPlay();
    this.renderList();
  }

  hide() {
    if (!this.root) return;
    this.stopPlay();
    this.root.classList.add('hidden');
  }

  renderList() {
    const list = this.root.querySelector('.rp-list');
    const items = listReplays();
    if (!items.length) {
      list.innerHTML = `<p class="rp-empty">${i18n.tf('replays.empty', 'Henüz kayıt yok. Bir maç bitince otomatik kaydedilir.')}</p>`;
      return;
    }
    list.innerHTML = items.map((r) => {
      const d = new Date(r.at);
      const mins = Math.floor((r.duration || 0) / 60000);
      const secs = Math.floor(((r.duration || 0) % 60000) / 1000);
      const flags = (r.players || []).slice(0, 8).map((p) =>
        `<img alt="" src="${getFlagThumb(p.flag, 28, 18)}" title="${p.name || p.flag}">`
      ).join('');
      const win = r.winner === 'impostor' ? i18n.tf('result.impostorWin', 'Katiller') :
        r.winner === 'crew' ? i18n.tf('result.crewWin', 'Masumlar') : '—';
      return `<div class="rp-item" data-id="${r.id}">
        <div class="rp-meta">
          <b>${d.toLocaleString()}</b>
          <span>${i18n.t('maps.' + (r.map || 'ring'))} · ${mins}:${String(secs).padStart(2, '0')} · ${win}</span>
          <div class="rp-flags">${flags}</div>
        </div>
        <div class="rp-acts">
          <button type="button" class="rp-watch" data-id="${r.id}">${i18n.tf('replays.watch', 'İzle')}</button>
          <button type="button" class="rp-del" data-id="${r.id}">✕</button>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('.rp-watch').forEach((b) => b.addEventListener('click', () => this.play(b.dataset.id)));
    list.querySelectorAll('.rp-del').forEach((b) => b.addEventListener('click', () => {
      deleteReplay(b.dataset.id);
      this.renderList();
    }));
  }

  play(id) {
    const rec = getReplay(id);
    if (!rec) return;
    this.playing = rec;
    this._t = 0;
    this._paused = false;
    this._speed = 1;
    this.root.querySelector('.rp-list').classList.add('hidden');
    this.root.querySelector('.rp-player').classList.remove('hidden');
    this.root.querySelector('.rp-play').textContent = '⏸';
    this.root.querySelector('.rp-speed').value = '1';
    this.root.querySelector('.rp-seek').value = '0';
    this.loop();
  }

  stopPlay() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.playing = null;
    if (!this.root) return;
    this.root.querySelector('.rp-list')?.classList.remove('hidden');
    this.root.querySelector('.rp-player')?.classList.add('hidden');
  }

  togglePause() {
    this._paused = !this._paused;
    this.root.querySelector('.rp-play').textContent = this._paused ? '▶' : '⏸';
    if (!this._paused) this.loop();
  }

  loop() {
    cancelAnimationFrame(this._raf);
    if (!this.playing) return;
    let last = performance.now();
    const tick = (now) => {
      if (!this.playing) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!this._paused) {
        this._t += dt * 1000 * this._speed;
        if (this._t >= (this.playing.duration || 1)) {
          this._t = this.playing.duration || 1;
          this._paused = true;
          this.root.querySelector('.rp-play').textContent = '▶';
        }
        this.drawFrame();
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    this.drawFrame();
  }

  drawFrame() {
    const rec = this.playing;
    if (!rec) return;
    const canvas = this.root.querySelector('.rp-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#0b120e';
    ctx.fillRect(0, 0, W, H);

    // frame interpolate by time
    const frames = rec.frames || [];
    let fi = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i][0] <= this._t) fi = i;
      else break;
    }
    const fr = frames[fi] || [0];
    const n = (rec.players || []).length;
    // rough bounds from data
    let minX = 1e9, minY = 1e9, maxX = 0, maxY = 0;
    for (let i = 0; i < n; i++) {
      const x = fr[1 + i * 3], y = fr[2 + i * 3];
      if (x > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    if (minX > maxX) { minX = 0; maxX = 6000; minY = 0; maxY = 6000; }
    const pad = 200;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const sx = W / (maxX - minX || 1), sy = H / (maxY - minY || 1);
    const s = Math.min(sx, sy) * 0.92;

    // grid
    ctx.strokeStyle = 'rgba(125,255,154,0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 20; g++) {
      ctx.beginPath();
      ctx.moveTo((g / 20) * W, 0); ctx.lineTo((g / 20) * W, H);
      ctx.moveTo(0, (g / 20) * H); ctx.lineTo(W, (g / 20) * H);
      ctx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const p = rec.players[i];
      const x = fr[1 + i * 3], y = fr[2 + i * 3], alive = fr[3 + i * 3];
      if (!x && !y) continue;
      const px = (x - minX) * s + (W - (maxX - minX) * s) / 2;
      const py = (y - minY) * s + (H - (maxY - minY) * s) / 2;
      ctx.beginPath();
      ctx.fillStyle = alive ? (p.role === 'impostor' ? '#e74c3c' : p.role === 'sheriff' ? '#3498db' : '#7dff9a') : '#555';
      ctx.arc(px, py, alive ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px system-ui';
      ctx.fillText((p.name || p.flag || '').slice(0, 10), px + 10, py + 3);
    }

    // timeline UI
    const dur = rec.duration || 1;
    const seek = this.root.querySelector('.rp-seek');
    seek.value = String(Math.round((this._t / dur) * 1000));
    const m = Math.floor(this._t / 60000), sec = Math.floor((this._t % 60000) / 1000);
    this.root.querySelector('.rp-time').textContent = `${m}:${String(sec).padStart(2, '0')}`;

    // event log near current time
    const log = this.root.querySelector('.rp-log');
    const near = (rec.events || []).filter((e) => e.t <= this._t && e.t > this._t - 8000).slice(-6);
    log.innerHTML = near.map((e) => `<div>${(e.t / 1000).toFixed(1)}s · ${e.k}</div>`).join('') || '—';
  }
}

export const replaysPanel = new ReplaysPanel();

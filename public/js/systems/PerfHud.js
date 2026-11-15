// ============================================================
// PerfHud.js - Performans göstergesi: FPS + gecikme (ping) + grafik seviyesi
// ============================================================
// Ayarlar'dan "FPS göster" ile açılır (tercih saklanır). Sol altta küçük bir kutu.
// Kendi sayacı requestAnimationFrame ile ölçer: menüde de oyunda da çalışır, saniyede 2 kez yazar.
// Ping: 3 saniyede bir sunucuya {t:'ping'} yollar, 'pong' gelene kadar geçen süreyi gösterir.
import { net } from './Net.js';
import { getQuality } from './Resolution.js';

const KEY = 'cfs.showFps';
const QN = { high: 'HIGH', med: 'MED', low: 'LOW' };

class PerfHud {
  constructor() {
    this.enabled = false;
    try { this.enabled = localStorage.getItem(KEY) === '1'; } catch (e) { /* yoksay */ }
    this.el = null; this.raf = 0; this.ping = null;
    this.onPong = (m) => { if (m && m.at) this.ping = Math.max(0, Math.round(performance.now() - m.at)); };
    net.on('pong', this.onPong);
    if (this.enabled) this.start();
  }

  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem(KEY, this.enabled ? '1' : '0'); } catch (e) { /* yoksay */ }
    if (this.enabled) this.start(); else this.stop();
  }

  start() {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'perf-hud';
      document.body.appendChild(this.el);
    }
    this.el.classList.remove('hidden');
    if (this.raf) return;
    let frames = 0, t0 = performance.now(), worst = 0, prev = t0, lastPing = 0;
    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      frames++; worst = Math.max(worst, now - prev); prev = now;
      if (now - lastPing > 3000 && net.status === 'online') { lastPing = now; net.send({ t: 'ping', at: now }); }
      if (now - t0 < 500) return;
      const fps = Math.round((frames * 1000) / (now - t0));
      const cls = fps >= 50 ? 'good' : fps >= 28 ? 'ok' : 'bad';
      const p = this.ping == null || net.status !== 'online' ? '—' : this.ping + ' ms';
      this.el.innerHTML = `<b class="${cls}">${fps}</b><span>FPS</span><i>max ${Math.round(worst)} ms</i><i>ping ${p}</i><i>${QN[getQuality()] || ''}</i>`;
      frames = 0; t0 = now; worst = 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.el) this.el.classList.add('hidden');
  }
}

export const perfHud = new PerfHud();

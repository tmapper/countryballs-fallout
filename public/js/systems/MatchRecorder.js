// ============================================================
// MatchRecorder.js - Maç kaydı + yerel depolama + oynatma verisi
// ============================================================
const KEY = 'cfs.replays.v1';
const MAX_REPLAYS = 12;
const SAMPLE_MS = 100; // 10 Hz konum

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_REPLAYS))); } catch (e) { /* quota */ }
}

export class MatchRecorder {
  constructor() {
    this.active = false;
    this.t0 = 0;
    this.lastSample = 0;
    this.rec = null;
  }

  start(meta) {
    this.active = true;
    this.t0 = performance.now();
    this.lastSample = 0;
    this.rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      at: Date.now(),
      map: meta.map || 'ring',
      cfg: meta.cfg || {},
      mode: meta.mode || 'offline',
      players: (meta.players || []).map((p) => ({
        id: p.id, name: p.name || '', flag: p.flag || 'TR', role: p.role || 'crewmate', bot: !!p.isBot
      })),
      frames: [],   // [tMs, x0,y0,alive0, x1,y1,alive1, ...]
      events: []    // { t, k, ... }
    };
  }

  sample(balls) {
    if (!this.active || !this.rec) return;
    const now = performance.now() - this.t0;
    if (now - this.lastSample < SAMPLE_MS) return;
    this.lastSample = now;
    const row = [Math.round(now)];
    const order = this.rec.players;
    for (let i = 0; i < order.length; i++) {
      const id = order[i].id;
      const b = balls.find((x) => x.id === id);
      if (b) {
        row.push(Math.round(b.x), Math.round(b.y), b.alive ? 1 : 0);
      } else {
        row.push(0, 0, 0);
      }
    }
    this.rec.frames.push(row);
  }

  event(k, data = {}) {
    if (!this.active || !this.rec) return;
    const t = Math.round(performance.now() - this.t0);
    this.rec.events.push({ t, k, ...data });
  }

  finish(result = {}) {
    if (!this.active || !this.rec) return null;
    this.active = false;
    this.rec.duration = Math.round(performance.now() - this.t0);
    this.rec.winner = result.winner || null;
    // Sıkıştır: çok kısa maçları da sakla
    if (this.rec.frames.length < 5) { this.rec = null; return null; }
    const list = loadAll();
    list.unshift(this.rec);
    saveAll(list);
    const out = this.rec;
    this.rec = null;
    return out;
  }

  cancel() { this.active = false; this.rec = null; }
}

export const matchRecorder = new MatchRecorder();

export function listReplays() { return loadAll(); }

export function getReplay(id) { return loadAll().find((r) => r.id === id) || null; }

export function deleteReplay(id) {
  saveAll(loadAll().filter((r) => r.id !== id));
}

export function clearReplays() { saveAll([]); }

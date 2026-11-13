// ============================================================
// RemoteConfig.js - APK/EXE için uzaktan sunucu adresi (server.json)
// ============================================================
// CONFIG_URLS: server.json dosyasının bulunduğu adresler (GitHub Pages vb.)
// Biçim: { "servers": ["https://ana.onrender.com", "https://yedek.onrender.com"] }
// Ayarlar'daki elle yazılan adres (cfs.serverManual) her zaman önceliklidir.
// Tarayıcıdan (localhost:3000) açıyorsan bu dosya sadece stub; Net.js kendi host'unu kullanır.

const CONFIG_URLS = [
  // Örnek: 'https://kullanici.github.io/cfs/server.json',
];
const DEFAULT_SERVERS = [];   // CONFIG_URLS boşsa veya okunamazsa yedek
const CACHE_KEY = 'cfs.remoteServers';
const INDEX_KEY = 'cfs.remoteIdx';

let servers = [];
let idx = 0;
let readyPromise = null;

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) servers = arr.map(String);
    }
    const i = parseInt(localStorage.getItem(INDEX_KEY) || '0', 10);
    if (Number.isFinite(i) && i >= 0) idx = i % Math.max(1, servers.length);
  } catch (e) { /* yoksay */ }
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(servers));
    localStorage.setItem(INDEX_KEY, String(idx));
  } catch (e) { /* yoksay */ }
}

async function fetchServers() {
  loadCache();
  for (const url of CONFIG_URLS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data?.servers) ? data.servers : (Array.isArray(data) ? data : []);
      const cleaned = list.map((s) => String(s || '').trim()).filter(Boolean);
      if (cleaned.length) {
        servers = cleaned;
        idx = 0;
        saveCache();
        return servers;
      }
    } catch (e) { /* sonraki URL */ }
  }
  if (!servers.length && DEFAULT_SERVERS.length) {
    servers = [...DEFAULT_SERVERS];
    idx = 0;
    saveCache();
  }
  return servers;
}

export function currentServer() {
  if (!servers.length) loadCache();
  return servers[idx] || servers[0] || '';
}

export function nextServer() {
  if (!servers.length) return false;
  if (servers.length < 2) return false;
  idx = (idx + 1) % servers.length;
  saveCache();
  return true;
}

export function resetServer() {
  idx = 0;
  saveCache();
}

export function hasServers() {
  if (!servers.length) loadCache();
  return servers.length > 0;
}

export function refresh() {
  return fetchServers();
}

export function ready() {
  if (!readyPromise) {
    readyPromise = fetchServers().then(() => true).catch(() => true);
  }
  return readyPromise;
}

// İlk yüklemede önbelleği oku
loadCache();

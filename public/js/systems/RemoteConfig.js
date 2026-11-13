// ============================================================
// RemoteConfig.js - Sunucu adresini UZAKTAN güncellemek için (APK/EXE'yi yeniden indirtmeden)
// ============================================================
// Sorun: Render çökerse / sunucu değişirse APK içindeki adres eski kalıyor, herkes yeniden indirmek zorunda.
// Çözüm: Oyun açılırken küçük bir "server.json" dosyasını internetten okur:
//     { "servers": ["https://yeni-sunucu.onrender.com", "https://yedek.onrender.com"] }
// Bu dosya Render'da DEĞİL, Render'dan bağımsız bir yerde durur (GitHub Pages / siteniz).
// Sunucu değişince sadece bu dosyayı güncellersin; oyun bir sonraki açılışta yeni adrese bağlanır.
//
// Okunan adres telefona/PC'ye kaydedilir; internet/dosya o an yoksa son bilinen adres kullanılır.

// 1) server.json adresi — GitHub raw + jsDelivr yedek (biri engellenirse diğeri çalışır)
export const CONFIG_URLS = [
  'https://raw.githubusercontent.com/tmapper/countryballs-config/main/server.json',
  'https://cdn.jsdelivr.net/gh/tmapper/countryballs-config@main/server.json',
];

// 2) Hiçbir şey okunamazsa kullanılacak yedek (guncel tut)
export const DEFAULT_SERVERS = [
  'https://countryballs-fallout-cv96.onrender.com',
];

const CACHE_KEY = 'cfs.remoteServers';
const TIMEOUT_MS = 4000;

let servers = [];          // kullanılacak adres listesi (ilki esas, diğerleri yedek)
let index = 0;
let readyPromise = null;

function clean(list) {
  return (Array.isArray(list) ? list : [list]).map((s) => String(s || '').trim().replace(/\/+$/, '')).filter(Boolean);
}
function readCache() { try { return clean(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')); } catch (e) { return []; } }
function writeCache(list) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (e) { /* yoksay */ } }

async function fetchOne(url) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
  try {
    // ?t= önbelleği atlatır: güncellemeyi hemen görsün
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: ctl && ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const list = clean(j.servers || j.server);
    if (!list.length) throw new Error('boş liste');
    return list;
  } finally { if (timer) clearTimeout(timer); }
}

// server.json'u (yeniden) oku. Başarısız olursa eski listeyi bozmaz.
export async function refresh() {
  for (const u of CONFIG_URLS) {
    try {
      const list = await fetchOne(u);
      servers = list; index = 0; writeCache(list);
      return true;
    } catch (e) { /* sıradaki adresi dene */ }
  }
  return false;
}

// Açılışta bir kere çağrılır; bağlantı kurulmadan önce kısa süre beklenir.
export function ready() {
  if (!readyPromise) {
    servers = readCache();
    if (!servers.length) servers = clean(DEFAULT_SERVERS);
    readyPromise = CONFIG_URLS.length ? refresh().then(() => {}) : Promise.resolve();
  }
  return readyPromise;
}

export function currentServer() { return servers[index] || ''; }
// Bağlantı kurulamadıysa yedek adrese geç. Başka adres kalmadıysa false.
export function nextServer() { if (index + 1 < servers.length) { index++; return true; } return false; }
export function resetServer() { index = 0; }
export function hasServers() { return servers.length > 0; }

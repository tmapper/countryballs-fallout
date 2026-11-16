// ============================================================
// Keys.js - PC TUŞ ATAMA (Ayarlar > Tuş atama)
// ============================================================
// Her eylemin 2 tuşu olabilir (ana + yedek). KeyboardEvent.code kullanılır (klavye dilinden bağımsız: KeyW...).
// Oyun Phaser tuşları yerine buradan okur: isDown('up'), onAction('use', fn).
const KEY = 'cfs.keys';
export const ACTIONS = ['up', 'down', 'left', 'right', 'action', 'use', 'report', 'sabotage', 'map', 'chat'];
// Atanamayan tuşlar: Esc (pencere kapatır), 0-3 (toplantıda GEÇ, sabotaj menüsü seçimi)
export const RESERVED = ['Escape', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3'];
export const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  action: ['Space', 'KeyQ'], use: ['KeyE', 'Enter'], report: ['KeyR', ''], sabotage: ['KeyF', ''], map: ['Tab', 'KeyM'], chat: ['KeyT', '']
};

let binds = JSON.parse(JSON.stringify(DEFAULT_KEYS));
try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s) ACTIONS.forEach((a) => { if (Array.isArray(s[a])) binds[a] = [String(s[a][0] || ''), String(s[a][1] || '')]; });
  // Eski kayıtta "sohbet" yoktu: T başka eyleme atanmışsa sohbete boş başla
  if (!s || !Array.isArray(s.chat)) { const used = ACTIONS.some((a) => a !== 'chat' && binds[a].includes('KeyT')); binds.chat = used ? ['', ''] : ['KeyT', '']; }
} catch (e) { /* yoksay */ }

const down = new Set();
const listeners = [];
let capture = null;          // tuş atanırken bir sonraki tuş buraya gider (oyuna gitmez)

// Yazı kutusundayken oyun tuşları çalışmaz. Bir HTML düğmesine odaklıyken Space/Enter düğmeye basar (oyuna gitmez);
// yürüme tuşları ise çalışmaya devam eder (tıklanan düğme odakta kalsa da oyuncu yürüyebilsin).
const typing = (e) => { const t = e.target; if (!t) return false;
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return true;
  return (t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute && t.getAttribute('role') === 'button') && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter'); };
// Ekranda tam ekran bir HTML penceresi açık mı (ana menü, ayarlar, toplantı...)? O zaman Space/Tab'ı engelleme
const overlayOpen = () => !!document.querySelector('.mainmenu:not(.hidden), .gset:not(.hidden), .ctl-panel:not(.hidden), .meeting:not(.hidden), .credits-panel:not(.hidden), .mm-modal:not(.hidden)');
export const actionOf = (code) => ACTIONS.filter((a) => binds[a].includes(code));

window.addEventListener('keydown', (e) => {
  if (capture) { e.preventDefault(); e.stopPropagation(); const fn = capture; capture = null; fn(e.code); return; }
  if (typing(e)) return;
  const acts = actionOf(e.code);
  if (!acts.length) return;
  if ((e.code === 'Tab' || e.code === 'Space') && !overlayOpen()) e.preventDefault();   // oyundayken sayfa kaymasın / odak değişmesin
  if (down.has(e.code)) return;                                             // basılı tutma tekrarı
  down.add(e.code);
  acts.forEach((a) => listeners.forEach((l) => { if (l.action === a) { try { l.fn(e); } catch (err) { /* yoksay */ } } }));
}, true);
window.addEventListener('keyup', (e) => { down.delete(e.code); }, true);
window.addEventListener('blur', () => down.clear());

export const getBinds = () => binds;
export function isDown(action) { const b = binds[action]; return !!b && (down.has(b[0]) || down.has(b[1])); }
export function releaseAll() { down.clear(); }

// fn(e) eylemin tuşuna basılınca. Dönen fonksiyon dinlemeyi bırakır.
export function onAction(action, fn) {
  const l = { action, fn };
  listeners.push(l);
  return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
}

export function setBind(action, slot, code) {
  if (!binds[action] || RESERVED.includes(code)) return false;
  // Aynı tuş başka bir eyleme atanmışsa oradan kaldır (çakışma olmasın)
  if (code) ACTIONS.forEach((a) => { binds[a] = binds[a].map((c) => (c === code ? '' : c)); });
  binds[action][slot] = code || '';
  save();
  return true;
}
export function resetBinds() { binds = JSON.parse(JSON.stringify(DEFAULT_KEYS)); save(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch (e) { /* yoksay */ } }

// Bir sonraki tuşu yakala (tuş atama penceresi)
export function captureNext(fn) { capture = fn; }
export function cancelCapture() { capture = null; }

// Ekranda gösterilecek tuş adı
export function keyLabel(code) {
  if (!code) return '—';
  const map = { Space: 'Boşluk', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'Shift (Sağ)', ControlLeft: 'Ctrl', AltLeft: 'Alt', Backquote: '`', Escape: 'Esc' };
  if (map[code]) return map[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}

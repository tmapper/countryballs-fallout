// ============================================================
// FitScreen.js - Hiçbir ekranda kaydırma gerekmesin: pencereler ekrana tam sığar (mobil + PC)
// ============================================================
// Mantık: ekrandaki menü/pencere/panel, ekranı aşıyorsa CSS `zoom` ile en büyük sığan boyuta küçültülür.
// - Sayfa açılınca, içerik değişince (MutationObserver), ekran dönünce / boyut değişince kendiliğinden çalışır.
// - Yeni bir pencere eklemek için sadece aşağıdaki TARGETS listesine seçicisini yaz.
// - Sohbet listesi gibi bilerek kayan alanlar ALLOW ile hariç tutulur (data-scroll özniteliği de olur).
// - Dikey yatay fark etmez: önce 1x denenir, sığmazsa 0.04 adımlarla küçülür (en az MIN_Z).
// Seçenekler: fill = üst kapsayıcıyı tamamen doldurur (menü gibi), wide = küçülürken genişliği de açar (ızgaralar daha az satır tutar),
// maxW = wide iken ekranda görünen en fazla genişlik (piksel; varsayılan 1200).
import { isTyping, onTypingEnd } from './Typing.js';

const TARGETS = [
  ['.mm-ui', { fill: true }],
  ['.lobby', { fill: true }],
  ['.mm-card', {}],
  // .fp-card (bayrak/şapka seçme) ve .so-card (arkadaşlar/sıralama) kasıtlı olarak listede YOK:
  // bu ekranlarda grid/liste kaydırılabilir olsun. Diğer pencereler ekrana sığdırılır.
  ['.gs-card', {}],
  ['.sp-modal .sp-card', {}],
  ['.taskbox', {}],
  ['.mt-panel', { wide: true }],
  ['.br-panel', { wide: true }],
  ['.result-panel', { wide: true, maxW: 780 }],
  ['.sheet-panel', {}],
  ['.rh-flagcard', { wide: true }],
  ['.rh-panel', {}],
  ['.sab-panel', {}],
  ['.pass-card', { wide: true }],
  ['.market > .mk-card', { wide: true }],
  ['.sg-card', {}],
  ['.ach-card', {}]
];
const ALLOW = '.mt-chat-list, .lc-list, .pass-track, .fp-grid, .so-body, .mt-quick-panel, .mk-body, .sp-market-pane, [data-scroll]';
const MIN_Z = 0.42;
const STEP = 0.04;
const ALL_SEL = TARGETS.map((t) => t[0]).join(',');

const supported = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1');
const px = (v) => (typeof v === 'string' && v.endsWith('px') ? parseFloat(v) : NaN);

// Kayan alt alanların listesi pahalı (her alt eleman için getComputedStyle): eleman sayısı değişmedikçe önbellekten
const scrollCache = new WeakMap();
function scrollersOf(el) {
  const n = el.getElementsByTagName('*').length;
  const c = scrollCache.get(el);
  if (c && c.n === n) return c.list;
  const list = [el];
  el.querySelectorAll('*').forEach((nd) => {
    if (nd.matches(ALLOW) || nd.closest(ALLOW)) return;
    const cs = getComputedStyle(nd);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cs.display !== 'none') list.push(nd);
  });
  scrollCache.set(el, { n, list });
  return list;
}
const overflows = (list) => list.some((n) => n.clientHeight > 0 && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1));

// Son sığdırmanın anahtarı: ekran boyu + içerikteki eleman sayısı. Aynıysa ve şu anki hâl taşmıyorsa hiçbir şey yazma
// (eskiden saat/sayaç gibi her yazı değişiminde zoom sıfırlanıp 15 adım yeniden deneniyordu: saniyede ~24 zorunlu yerleşim)
const fitState = new WeakMap();
function zoomSteps() { const a = []; for (let z = 1; z >= MIN_Z - 0.001; z -= STEP) a.push(Math.max(MIN_Z, +z.toFixed(2))); return a; }
const STEPS = zoomSteps();

function fitOne(el, cfg) {
  if (!el.getClientRects().length) return;
  const parent = el.parentElement;
  if (!parent) return;
  const key = `${window.innerWidth}x${window.innerHeight}|${parent.clientWidth}x${parent.clientHeight}|${el.getElementsByTagName('*').length}`;
  const st = fitState.get(el);
  const scrollers = scrollersOf(el);
  // Aynı ekran + aynı içerik ve hâlâ sığıyor: dokunma (daha büyük zoom'u yeniden denemeye gerek yok, içerik aynı)
  if (st && st.key === key && !overflows(scrollers)) return;
  el.style.zoom = ''; el.style.maxHeight = ''; el.style.maxWidth = '';
  const pcs = getComputedStyle(parent);
  const cs = getComputedStyle(el);
  const padX = (parseFloat(pcs.paddingLeft) || 0) + (parseFloat(pcs.paddingRight) || 0);
  const padY = (parseFloat(pcs.paddingTop) || 0) + (parseFloat(pcs.paddingBottom) || 0);
  const availW = parent.clientWidth - (cfg.fill ? 0 : padX);
  let availH = parent.clientHeight - (cfg.fill ? 0 : padY);
  if (!cfg.fill) {
    const capPx = px(cs.maxHeight);
    if (!Number.isNaN(capPx)) availH = Math.min(availH, capPx);
    else if (typeof cs.maxHeight === 'string' && cs.maxHeight.endsWith('%')) availH = Math.min(availH, (parent.clientHeight * parseFloat(cs.maxHeight)) / 100);
  }
  if (availW <= 0 || availH <= 0) return;
  const apply = (zz) => {
    el.style.zoom = zz === 1 ? '' : String(zz);
    if (!cfg.fill) {
      el.style.maxHeight = (availH / zz) + 'px';
      el.style.maxWidth = cfg.wide && zz < 1 ? (Math.min(availW, cfg.maxW || 1200) / zz) + 'px' : '';
    }
    return !overflows(scrollers);
  };
  // Önce 1x (çoğu durumda yeter), sonra ikili arama: 15 adım yerine ~4 yerleşim
  let best = STEPS.length - 1;
  if (apply(1)) best = 0;
  else {
    let lo = 1, hi = STEPS.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (apply(STEPS[mid])) { best = mid; hi = mid - 1; } else lo = mid + 1;
    }
    apply(STEPS[best]);
  }
  fitState.set(el, { key, z: STEPS[best] });
}

let queued = false;
let lastRun = 0;
export function fitNow() {
  queued = false;
  // Klavye açıkken pencereleri küçültme (ekran geçici olarak kısa); klavye kapanınca yeniden sığdırılır
  if (isTyping()) return;
  lastRun = performance.now();
  document.querySelectorAll(ALL_SEL).forEach((el) => {
    const t = TARGETS.find(([s]) => el.matches(s));
    if (t) fitOne(el, t[1]);
  });
}
export function scheduleFit() {
  if (queued) return;
  queued = true;
  const wait = Math.max(0, 120 - (performance.now() - lastRun));
  setTimeout(() => requestAnimationFrame(fitNow), wait);
}

export function initFit() {
  if (!supported) return;
  window.addEventListener('resize', scheduleFit);
  onTypingEnd(scheduleFit);
  window.addEventListener('orientationchange', () => setTimeout(scheduleFit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit);
  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!t || !t.closest) continue;
      if (t.closest(ALLOW)) continue;   // sohbet mesajı gelmesi pencere boyunu değiştirmez
      // Sadece yazı değişti (saat, sayaç, süre): eleman eklenip çıkmadıysa pencere boyu pratikte değişmez
      if (m.type === 'childList' && ![...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1)) continue;
      // Hiçbir hedef pencereyi etkilemeyen değişiklik (oyun içi HUD, kanvas, toast...): yoksay
      const inTarget = t.closest(ALL_SEL);
      const hasTarget = m.type === 'attributes' ? (t.matches(ALL_SEL) || !!t.querySelector(ALL_SEL))
        : [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches(ALL_SEL) || n.querySelector(ALL_SEL)));
      if (!inTarget && !hasTarget) continue;
      scheduleFit();
      return;
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  scheduleFit();
}

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
const TARGETS = [
  ['.mm-ui', { fill: true }],
  ['.lobby', { fill: true }],
  ['.mm-card', {}],
  ['.fp-card', { wide: true }],
  ['.gs-card', {}],
  ['.so-card', { wide: true }],
  ['.sp-modal .sp-card', {}],
  ['.taskbox', {}],
  ['.mt-panel', { wide: true }],
  ['.br-panel', { wide: true }],
  ['.result-panel', { wide: true, maxW: 780 }],
  ['.sheet-panel', {}],
  ['.rh-flagcard', { wide: true }],
  ['.rh-panel', {}],
  ['.sab-panel', {}],
  ['.pass-card', { wide: true }]
];
const ALLOW = '.mt-chat-list, .lc-list, .pass-track, [data-scroll]';
const MIN_Z = 0.42;
const STEP = 0.04;
const ALL_SEL = TARGETS.map((t) => t[0]).join(',');

const supported = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1');
const px = (v) => (typeof v === 'string' && v.endsWith('px') ? parseFloat(v) : NaN);

function scrollersOf(el) {
  const list = [el];
  el.querySelectorAll('*').forEach((n) => {
    if (n.matches(ALLOW) || n.closest(ALLOW)) return;
    const cs = getComputedStyle(n);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cs.display !== 'none') list.push(n);
  });
  return list;
}
const overflows = (list) => list.some((n) => n.clientHeight > 0 && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1));

function fitOne(el, cfg) {
  el.style.zoom = ''; el.style.maxHeight = ''; el.style.maxWidth = '';
  if (!el.getClientRects().length) return;
  const parent = el.offsetParent && cfg.fill ? el.parentElement : el.parentElement;
  if (!parent) return;
  const pcs = getComputedStyle(parent);
  const cs = getComputedStyle(el);
  const padX = (parseFloat(pcs.paddingLeft) || 0) + (parseFloat(pcs.paddingRight) || 0);
  const padY = (parseFloat(pcs.paddingTop) || 0) + (parseFloat(pcs.paddingBottom) || 0);
  let availW = parent.clientWidth - (cfg.fill ? 0 : padX);
  let availH = parent.clientHeight - (cfg.fill ? 0 : padY);
  if (!cfg.fill) {
    const capPx = px(cs.maxHeight);
    if (!Number.isNaN(capPx)) availH = Math.min(availH, capPx);
    else if (typeof cs.maxHeight === 'string' && cs.maxHeight.endsWith('%')) availH = Math.min(availH, (parent.clientHeight * parseFloat(cs.maxHeight)) / 100);
  }
  if (availW <= 0 || availH <= 0) return;
  const scrollers = scrollersOf(el);
  for (let z = 1; z >= MIN_Z - 0.001; z -= STEP) {
    const zz = Math.max(MIN_Z, +z.toFixed(2));
    el.style.zoom = zz === 1 ? '' : String(zz);
    if (!cfg.fill) {
      el.style.maxHeight = (availH / zz) + 'px';
      if (cfg.wide && zz < 1) el.style.maxWidth = (Math.min(availW, cfg.maxW || 1200) / zz) + 'px';
    }
    if (!overflows(scrollers)) return;
  }
  // MIN_Z'de bile sığmadı: kayan alanlar kayar (nadir; çok kalabalık listeler)
}

let queued = false;
let lastRun = 0;
export function fitNow() {
  queued = false;
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
  window.addEventListener('orientationchange', () => setTimeout(scheduleFit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit);
  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (t && t.closest && t.closest(ALLOW)) continue;   // sohbet mesajı gelmesi pencere boyunu değiştirmez
      scheduleFit();
      return;
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  scheduleFit();
}

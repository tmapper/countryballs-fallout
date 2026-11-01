// ============================================================
// Resolution.js - 1080p iç çözünürlük
// ============================================================
// Oyun ekranın GERÇEK piksel çözünürlüğünde çizilir (yüksek DPI ekranlar dahil),
// ama en az 1080p (1920) en fazla 2K (2560) uzun kenar: hem net hem kasmaz.
//   PC 1920x1080 (dpr 1)     -> 1920x1080
//   Laptop 1536x864 (dpr 1.25) -> 1920x1080
//   PC 2560x1440 / 4K        -> 2560 uzun kenar
//   Telefon 844x390 (dpr 3)  -> 2532x1170'i 2560 ile sınırlar
// RES.cssW / RES.cssH : ekranın CSS boyutu (arayüz yerleşimi bununla yapılır)
// RES.k               : CSS pikseli başına çizilen piksel

export const MIN_LONG_SIDE = 1920;
export const MAX_LONG_SIDE = 1920;   // 1080p: net ve akıcı (2K çok kasıyordu)
export const MAX_K = 3;

export const RES = { k: 1, cssW: 800, cssH: 600 };

export function measure() {
  RES.cssW = Math.max(1, Math.round(window.innerWidth));
  RES.cssH = Math.max(1, Math.round(window.innerHeight));
  const long = Math.max(RES.cssW, RES.cssH);
  const phys = long * Math.min(3, window.devicePixelRatio || 1);
  // Telefon/tablette 1080p yeter (pil ve ısınma)
  const mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const target = Math.max(MIN_LONG_SIDE, Math.min(mobile ? MIN_LONG_SIDE : MAX_LONG_SIDE, phys));
  RES.k = Math.min(MAX_K, target / long);
  return RES;
}

export function gameSize() {
  return { width: Math.round(RES.cssW * RES.k), height: Math.round(RES.cssH * RES.k) };
}

// Pencere boyutu / telefon yönü değişince oyunu yeniden boyutlandır
export function attachResolution(game) {
  const apply = () => {
    measure();
    const { width, height } = gameSize();
    game.scale.setZoom(1 / RES.k);
    game.scale.resize(width, height);
  };
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
}

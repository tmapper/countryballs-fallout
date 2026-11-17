// ============================================================
// NetSmooth.js - UZAKTAKİ OYUNCULARIN AKICI OYNATILMASI
// ============================================================
// Her konum, gönderildiği andaki GÖNDERİCİ saatiyle (ts, ms) gelir. Burada:
//  * Son ~4 sn'deki "varış - gönderim" farklarından ağın en hızlı yolu (offMin) ve titremesi (offMax-offMin) ölçülür.
//  * Oynatma saati (play) gönderici zamanında yürür: hedef = şimdi - offMin - gecikme.
//    Saat ZIPLAMAZ; hedefe %12'ye kadar hızlanıp yavaşlayarak yaklaşır (gecikme değişince top hızlanıp durmaz).
//  * Gecikme = ölçülen titreme + pay (100-900 ms): ağ kötüleşince otomatik büyür, düzelince küçülür.
//  * Tampon biterse (paket gecikti) yürüyen top en çok 150 ms aynı yönde devam eder, sonra bekler.
// Eskiden: gecikme en çok 400 ms'ydi ve ağ yavaşlayınca uyum 2 dakika sürüyordu -> sürekli dur-kalk ("feci kasma").
// Tarayıcıya bağımlı değil: tests/netsmooth.test.mjs Node'da dener.

const WINDOW = 4000;      // ms: ağ ölçümü penceresi
const MIN_DELAY = 100, MAX_DELAY = 900, MARGIN = 70;
const EXTRA = 150;        // ms: tampon bitince en çok bu kadar tahmin
const TELEPORT = 600;     // px: bundan büyük sıçrama ışınlanma sayılır (tünel, toplantı başı)

export class NetSmoother {
  constructor() { this.reset(); }

  reset() { this.buf = []; this.offs = []; this.play = null; this.delay = 160; this.lastArr = 0; }

  // now: yerel ms (performance.now), ts: gönderici ms (yoksa varış anı kullanılır)
  push(now, ts, x, y, m) {
    if (!Number.isFinite(ts)) ts = now;
    const off = now - ts;
    // Saat tabanı değişti (kurucu değişti / sekme uyudu): her şeyi baştan kur
    const prev = this.buf[this.buf.length - 1];
    if (this.offs.length && (Math.abs(off - this.median()) > 1500 ||
        (prev && (ts < prev.ts - 500 || (ts - prev.ts) - (now - this.lastArr) > 500)))) {
      // gönderici saati sıçradı: konumu koru, zaman tabanını yeniden kur
      const keep = prev; this.reset();
      if (keep && Math.abs(x - keep.x) + Math.abs(y - keep.y) <= TELEPORT) { this.buf = [{ ts: ts - 100, x: keep.x, y: keep.y, m: keep.m }]; this.play = ts - 100 - this.delay * 0.5; }
    }
    this.lastArr = now;
    this.offs.push({ t: now, off });
    while (this.offs.length > 5 && now - this.offs[0].t > WINDOW) this.offs.shift();
    const buf = this.buf, last = buf[buf.length - 1];
    if (!last || Math.abs(x - last.x) + Math.abs(y - last.y) > TELEPORT) {
      this.buf = [{ ts, x, y, m }];
      this.play = ts - this.delay * 0.3;     // ışınlanma: hemen göster
      this.snap = true;
      return;
    }
    if (ts <= last.ts) return;                                        // eski / tekrar paket
    // Duran oyuncu yürümeye başladı: eski konum "az önce" sayılsın (uzun boşlukta yavaşça kaymasın)
    if (ts - last.ts > 250 && last.m === 0 && (x !== last.x || y !== last.y)) buf.push({ ts: ts - 100, x: last.x, y: last.y, m: 0 });
    buf.push({ ts, x, y, m });
    if (buf.length > 40) buf.splice(0, buf.length - 40);
  }

  median() { const a = this.offs.map((o) => o.off).sort((p, q) => p - q); return a[a.length >> 1]; }

  // Bu karede gösterilecek konum (null: henüz veri yok)
  sample(now, dt) {
    const buf = this.buf;
    if (!buf.length) return null;
    let lo = Infinity, hi = -Infinity;
    for (const o of this.offs) { if (o.off < lo) lo = o.off; if (o.off > hi) hi = o.off; }
    const want = Math.min(MAX_DELAY, Math.max(MIN_DELAY, hi - lo + MARGIN));
    // Gecikme büyümesi hızlı (kasma olmasın), küçülmesi yavaş
    this.delay += (want - this.delay) * Math.min(1, dt * (want > this.delay ? 3 : 0.3));
    const target = now - lo - this.delay;
    if (this.play == null || Math.abs(target - this.play) > 2000) this.play = target;
    else {
      const err = target - this.play;                                   // + : geride kaldık
      const rate = 1 + Math.max(-0.12, Math.min(0.12, err / 600));
      this.play += dt * 1000 * rate;
    }
    const T = this.play;
    while (buf.length > 2 && buf[1].ts <= T) buf.shift();
    const a = buf[0], b = buf[1];
    if (!b || T <= a.ts) return { x: a.x, y: a.y, m: a.m };
    if (T >= b.ts) {
      let x = b.x, y = b.y;
      if (b.m === 1 && b.ts > a.ts) { const e = Math.min(EXTRA, T - b.ts) / (b.ts - a.ts); x += (b.x - a.x) * e; y += (b.y - a.y) * e; }
      return { x, y, m: b.m };
    }
    const u = (T - a.ts) / (b.ts - a.ts);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, m: b.m };
  }
}

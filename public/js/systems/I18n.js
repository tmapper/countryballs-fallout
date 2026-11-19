// ============================================================
// I18n.js - Çoklu dil (Localization) sistemi
// ============================================================
// Mantık: Metinleri kodun içine yazmıyoruz. Kodda sadece "anahtar" var
// (örn. "ui.controlsPc"). Anahtarın karşılığı seçili dilin JSON dosyasından gelir.
// Dil değişince 'languageChanged' olayı yayınlanır, arayüz kendini yeniler.

const STORAGE_KEY = 'cfs_language';
// Desteklenen diller (sıra: ayarlardaki liste). Türk dilleri + diğerleri.
export const LANGS = [
  ['tr', 'Türkçe'], ['az', 'Azərbaycanca'], ['kk', 'Қазақша'], ['ky', 'Кыргызча'], ['uz', 'Oʻzbekcha'], ['tk', 'Türkmençe'],
  ['en', 'English'], ['ru', 'Русский'], ['zh', '简体中文'], ['ar', 'العربية']
];
const SUPPORTED = LANGS.map((l) => l[0]);
const RTL = new Set(['ar']);

class I18n {
  constructor() {
    this.data = {};          // { tr: {...}, en: {...} }
    this.lang = 'tr';
    this.listeners = [];
  }

  // Yüklenen JSON'ları kaydeder ve kayıtlı/tarayıcı dilini seçer.
  // Açılışta hangi dil? (kayıtlı > tarayıcı dili > Türkçe). BootScene bu dilin dosyasını da yükler.
  static wanted() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* özel modda olabilir */ }
    const browser = (typeof navigator !== 'undefined' && navigator.language || 'tr').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(saved) ? saved : (SUPPORTED.includes(browser) ? browser : 'tr');
  }

  // loader(lang) -> Promise<json>: diğer dillerin dosyası seçilince yüklenir (açılışı yavaşlatmasın)
  init(data, loader) {
    this.data = data;
    this.loader = loader || null;
    const w = I18n.wanted();
    this.lang = this.data[w] ? w : 'tr';
    this.applyDir();
  }

  // Arapça sağdan sola: sayfa düzeni aynı kalır, yazılar doğru yönde akar (CSS: html[dir=rtl])
  applyDir() {
    try {
      document.documentElement.lang = this.lang;
      document.documentElement.setAttribute('data-dir', RTL.has(this.lang) ? 'rtl' : 'ltr');
    } catch (e) { /* yoksay */ }
  }

  setLanguage(lang) {
    if (!SUPPORTED.includes(lang) || lang === this.lang) return Promise.resolve();
    if (!this.data[lang]) {
      if (!this.loader) return Promise.resolve();
      return this.loader(lang).then((d) => { this.data[lang] = d; return this.setLanguage(lang); }).catch(() => {});
    }
    this.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* yoksay */ }
    this.applyDir();
    this.listeners.forEach((fn) => fn(lang));
    return Promise.resolve();
  }

  get languages() { return LANGS; }

  // diller arasında sırayla geçiş yapar
  toggle() {
    const i = SUPPORTED.indexOf(this.lang);
    this.setLanguage(SUPPORTED[(i + 1) % SUPPORTED.length]);
  }

  onChange(fn) { this.listeners.push(fn); }
  offChange(fn) { this.listeners = this.listeners.filter((f) => f !== fn); }

  // "ui.position" gibi noktalı anahtarı çözer, {x} gibi yer tutucuları doldurur.
  t(key, params = {}) {
    const found = this._lookup(this.data[this.lang], key) ?? this._lookup(this.data.en, key) ?? key;
    return String(found).replace(/\{(\w+)\}/g, (_, name) => (name in params ? params[name] : `{${name}}`));
  }

  // Anahtar var mı? (t() eksik anahtarda anahtarın kendisini döndürür, bu yüzden "t(x) || 'yedek'" hiç çalışmaz)
  has(key) { return this._lookup(this.data[this.lang], key) !== undefined || this._lookup(this.data.en, key) !== undefined; }
  // Eksikse yedek metin
  tf(key, fallback, params) { return this.has(key) ? this.t(key, params) : fallback; }

  _lookup(obj, key) {
    return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }
}

// Tüm oyun aynı nesneyi kullansın diye tek bir örnek (singleton) dışa aktarıyoruz.
export const i18n = new I18n();
export { I18n };

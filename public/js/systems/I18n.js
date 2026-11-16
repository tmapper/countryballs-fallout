// ============================================================
// I18n.js - Çoklu dil (Localization) sistemi
// ============================================================
// Mantık: Metinleri kodun içine yazmıyoruz. Kodda sadece "anahtar" var
// (örn. "ui.controlsPc"). Anahtarın karşılığı seçili dilin JSON dosyasından gelir.
// Dil değişince 'languageChanged' olayı yayınlanır, arayüz kendini yeniler.

const STORAGE_KEY = 'cfs_language';
const SUPPORTED = ['tr', 'en'];

class I18n {
  constructor() {
    this.data = {};          // { tr: {...}, en: {...} }
    this.lang = 'tr';
    this.listeners = [];
  }

  // Yüklenen JSON'ları kaydeder ve kayıtlı/tarayıcı dilini seçer.
  init(data) {
    this.data = data;
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* özel modda olabilir */ }
    const browser = (typeof navigator !== 'undefined' && navigator.language || 'tr').slice(0, 2);
    this.lang = SUPPORTED.includes(saved) ? saved : (SUPPORTED.includes(browser) ? browser : 'tr');
  }

  setLanguage(lang) {
    if (!SUPPORTED.includes(lang) || lang === this.lang) return;
    this.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* yoksay */ }
    this.listeners.forEach((fn) => fn(lang));
  }

  // tr <-> en arasında geçiş yapar
  toggle() {
    this.setLanguage(this.lang === 'tr' ? 'en' : 'tr');
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

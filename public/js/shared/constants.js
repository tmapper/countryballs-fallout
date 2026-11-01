// ============================================================
// shared/constants.js - Sunucu VE istemcinin ortak kullandığı sabitler
// ============================================================
// Phaser'a bağımlı olmayan her şey burada durur ki Node.js sunucusu da
// aynı dosyayı import edip kuralları AYNI şekilde uygulasın (hile önleme).
export const SPEED = 240;              // oyuncu hızı (piksel/saniye)
export const MAX_PLAYERS_LIMIT = 10;   // lobi üst sınırı
export const MIN_PLAYERS_LIMIT = 4;
export const NAME_MAX = 14;
export const MOVE_SEND_HZ = 20;        // istemci konumunu saniyede kaç kez yollar
export const SNAP_HZ = 15;             // sunucu herkese saniyede kaç kez konum yayar
export const REVEAL_MS = 5000;         // oyun başında rol gösterim süresi (herkes donuk)
export const CODE_LENGTH = 4;

// Geçerli bayrak kodları (sunucu da doğrular). Bayrakların ÇİZİMİ istemcide (Flags.js).
export const FLAG_CODES = ['TR', 'DE', 'FR', 'IT', 'RU', 'UA', 'NL', 'JP', 'PL', 'SE', 'GB', 'US', 'ES'];

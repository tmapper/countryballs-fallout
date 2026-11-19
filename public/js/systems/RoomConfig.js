// ============================================================
// RoomConfig.js - Kurucu (oda sahibi) ayarları: varsayılanlar ve seçenekler
// ============================================================
// Sunucu (server/index.js defaultCfg/sanitizeCfg) aynı sınırları uygular; kurucu uç değer giremez.
//   map: harita, speed: oyuncu hızı (x), discuss/vote: toplantı süreleri (sn), killCd: öldürme bekleme (sn)
//   imps / sheriffs: 0 = otomatik (oyuncu sayısına göre)
export const DEFAULT_CFG = { map: 'ring', speed: 1, discuss: 15, vote: 25, killCd: 15, imps: 0, sheriffs: 0, botDiff: 'normal' };
export const CFG_RANGES = {
  speed:    { min: 0.5, max: 2,   step: 0.25 },
  discuss:  { min: 0,   max: 180, step: 5 },
  vote:     { min: 10,  max: 120, step: 5 },
  killCd:   { min: 10,  max: 90,  step: 5 },
  imps:     { min: 0,   max: 5,   step: 1 },
  sheriffs: { min: 0,   max: 5,   step: 1 },
  max:      { min: 4,   max: 25,  step: 1 }
};

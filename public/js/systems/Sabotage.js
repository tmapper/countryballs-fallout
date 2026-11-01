// ============================================================
// Sabotage.js - Katil'in sabotajları (veri + kurallar, Phaser'dan bağımsız)
// ============================================================
//   lights  : Işıklar kesilir, masumların görüşü daralır. Süre yok; tamir edilene kadar sürer.
//   reactor : Reaktör erir. REACTOR_TIME saniyede tamir edilmezse Katil kazanır.
//   o2      : Oksijen tükenir. O2_TIME saniyede tamir edilmezse Katil kazanır.
// Tamir: masum/şerif (yaşayan) tamir noktasına gidip E / TAMİR'e basar. Botlar da koşar.
// Toplantı başlayınca süreli sabotajlar iptal olur (Among Us gibi).
import { STATIONS } from './Tasks.js';

export const SABOTAGE_TYPES = ['lights', 'reactor', 'o2'];
export const SABOTAGE_COOLDOWN = 30;     // bir sabotaj bitince sonraki için bekleme
export const FIRST_SABOTAGE_DELAY = 20;  // maç başında ilk sabotaj için bekleme
export const FIX_RANGE = 120;            // tamir noktasına bu kadar yakın olunca tamir edilebilir
export const BOT_FIX_TIME = 1.6;         // bot tamir noktasında bu kadar durunca tamir eder

const station = (id) => { const s = STATIONS.find((x) => x.id === id); return { x: s.x, y: s.y, room: s.room }; };

export const SABOTAGES = {
  lights:  { time: 0,  fix: station('levers_electrical'), fixers: 1 },
  reactor: { time: 45, fix: station('valve_reactor'),     fixers: 2 },
  o2:      { time: 45, fix: station('valve_o2'),          fixers: 2 }
};

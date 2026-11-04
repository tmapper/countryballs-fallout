// ============================================================
// Combat.js - Rol kuralları: öldürme, vurma, tünel, kazanma
// ============================================================
// Tüm ayarlar burada; denge değiştirmek için sadece bu sayılarla oyna.
//   Katil  : yakındakini öldürür (bekleme süresi var), tünelleri kullanır
//   Şerif  : ateş eder. Katil'i vurursa Katil ölür; masumu vurursa ŞERİF ölür
//   Masum  : hayatta kalmaya çalışır (görevler ileride)
// Kazanma: Katil ölürse masumlar kazanır; Katil sayısı masumlara eşit/fazla olursa Katil kazanır.
import { hasLineOfSight } from './Vision.js';

export const KILL_RANGE = 150;         // dünya pikseli
export const SHOOT_RANGE = 300;
export const TUNNEL_RANGE = 80;
export const KILL_COOLDOWN = 15;       // saniye
export const FIRST_KILL_COOLDOWN = 10;
export const SHOOT_COOLDOWN = 12;
export const FIRST_SHOOT_COOLDOWN = 8;
export const WITNESS_RANGE = 450;      // botlar bu mesafede gördükleri öldürmeyi fark eder
// Botlar saldırsın mı? (false: sadece gezerler, rolleri oyuncu test eder)
export const BOT_AGGRESSIVE = false;

const EYE = 16; // görüş, ayak noktasının biraz üstünden

export function canSee(grid, a, b, range = Infinity) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return d <= range && hasLineOfSight(grid, a.x, a.y - EYE, b.x, b.y - EYE);
}

// Menzildeki, duvar arkasında olmayan en yakın canlı oyuncu
export function findTarget(grid, actor, balls, range) {
  let best = null, bestD = Infinity;
  balls.forEach((b) => {
    if (b === actor || !b.alive) return;
    if (actor.role === 'impostor' && b.role === 'impostor') return;   // katil ortağına dokunulmaz
    const d = Math.hypot(actor.x - b.x, actor.y - b.y);
    if (d < bestD && d <= range && canSee(grid, actor, b)) { best = b; bestD = d; }
  });
  return best;
}

// Öldürmeyi gören canlı tanıklar (öldüren ve ölen hariç)
export function witnesses(grid, killer, victim, balls) {
  return balls.filter((b) => b.alive && b !== killer && b !== victim && canSee(grid, b, killer, WITNESS_RANGE));
}

export function nearestTunnel(tunnels, x, y) {
  let best = null, bestD = Infinity;
  tunnels.forEach((t) => {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bestD) { best = t; bestD = d; }
  });
  return bestD <= TUNNEL_RANGE ? best : null;
}

// 'crew' | 'impostor' | null
export function checkWinner(balls) {
  const alive = balls.filter((b) => b.alive);
  const imps = alive.filter((b) => b.role === 'impostor').length;
  const others = alive.length - imps;
  if (imps === 0) return 'crew';
  if (imps >= others) return 'impostor';
  return null;
}

export const teamOf = (role) => (role === 'impostor' ? 'impostor' : 'crew');

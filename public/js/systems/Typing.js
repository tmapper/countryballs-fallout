// ============================================================
// Typing.js - Yazı yazılıyor mu? (telefonda klavye açık mı)
// ============================================================
// Telefonda bir yazı kutusuna (sohbet, hile komutu, kod...) dokununca klavye açılır ve tarayıcı
// ekranın yüksekliğini küçültür. Oyun bunu "ekran küçüldü" sanıp kendini yeniden boyutlandırıyordu:
// ekran kararıyor, pencereler ufalıyor, iPhone'da sayfa kaymış kalıyordu.
// Bu modül yazma süresince <html class="typing"> koyar; Resolution.js ve FitScreen.js bu sırada
// küçülmeyi yok sayar. Klavye kapanınca (odak çıkınca) kayıtlı fonksiyonlar bir kez çalışır.
const NON_TEXT = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image', 'hidden']);
const isTextField = (el) => !!el && ((el.tagName === 'INPUT' && !NON_TEXT.has(String(el.type).toLowerCase())) || el.tagName === 'TEXTAREA' || el.isContentEditable);

let typing = false;
const ends = [];
export const isTyping = () => typing;
export function onTypingEnd(fn) { ends.push(fn); }

function set(on) {
  if (on === typing) return;
  typing = on;
  document.documentElement.classList.toggle('typing', on);
  if (!on) {
    // iPhone: klavye kapanınca sayfa kaymış kalabiliyor -> başa al
    try { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch (e) { /* yoksay */ }
    // Klavyenin kapanma animasyonu bitsin, sonra bir kez düzgün boyutlandır
    [60, 350, 800].forEach((ms) => setTimeout(() => { if (!typing) ends.forEach((fn) => { try { fn(); } catch (e) { /* yoksay */ } }); }, ms));
  }
}

document.addEventListener('focusin', (e) => { if (isTextField(e.target)) set(true); });
document.addEventListener('focusout', () => {
  // Bir kutudan diğerine geçerken arada kapanmasın
  setTimeout(() => set(isTextField(document.activeElement)), 0);
});

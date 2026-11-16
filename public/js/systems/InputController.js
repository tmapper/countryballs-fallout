// ============================================================
// InputController.js - Klavye + Joystick'i tek bir "yön" haline getirir
// ============================================================
// Oyun karakteri girdinin nereden geldiğini bilmesin, sadece
// "şu yöne git" desin diye tüm girdileri burada birleştiriyoruz.
// Tuşlar Ayarlar > Tuş atama'dan değiştirilebilir (systems/Keys.js).
import { isDown, releaseAll } from './Keys.js';

export class InputController {
  constructor(scene, joystick) {
    this.joystick = joystick;
    this.vector = new Phaser.Math.Vector2(0, 0);
  }

  // Panel kapanınca: basılı kalmış tuşları ve joystick'i bırak
  reset(scene) {
    try { scene.input.keyboard.resetKeys(); } catch (e) { /* yoksay */ }
    releaseAll();
    if (this.joystick && this.joystick.reset) this.joystick.reset();
    this.vector.set(0, 0);
  }

  // Her karede çağrılır; (x, y) uzunluğu en fazla 1 olan bir vektör döndürür.
  update() {
    let x = 0;
    let y = 0;
    if (isDown('left')) x -= 1;
    if (isDown('right')) x += 1;
    if (isDown('up')) y -= 1;
    if (isDown('down')) y += 1;

    if (x !== 0 || y !== 0) {
      // Çapraz giderken hızlanmasın diye normalize (uzunluğu 1 yap)
      this.vector.set(x, y).normalize();
    } else if (this.joystick) {
      if (this.joystick.check) this.joystick.check();
      this.vector.copy(this.joystick.vector);
    } else {
      this.vector.set(0, 0);
    }
    return this.vector;
  }
}

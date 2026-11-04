// ============================================================
// InputController.js - Klavye + Joystick'i tek bir "yön" haline getirir
// ============================================================
// Oyun karakteri girdinin nereden geldiğini bilmesin, sadece
// "şu yöne git" desin diye tüm girdileri burada birleştiriyoruz.

export class InputController {
  constructor(scene, joystick) {
    this.joystick = joystick;
    const kb = scene.input.keyboard;
    this.keys = kb.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    this.cursors = kb.createCursorKeys(); // ok tuşları da çalışsın
    this.vector = new Phaser.Math.Vector2(0, 0);
  }

  // Panel kapanınca: basılı kalmış tuşları ve joystick'i bırak
  reset(scene) {
    try { scene.input.keyboard.resetKeys(); } catch (e) { /* yoksay */ }
    if (this.joystick && this.joystick.reset) this.joystick.reset();
    this.vector.set(0, 0);
  }

  // Her karede çağrılır; (x, y) uzunluğu en fazla 1 olan bir vektör döndürür.
  update() {
    const k = this.keys;
    const c = this.cursors;
    let x = 0;
    let y = 0;
    if (k.left.isDown || c.left.isDown) x -= 1;
    if (k.right.isDown || c.right.isDown) x += 1;
    if (k.up.isDown || c.up.isDown) y -= 1;
    if (k.down.isDown || c.down.isDown) y += 1;

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

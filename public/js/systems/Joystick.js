// ============================================================
// Joystick.js - Mobil için sanal joystick
// ============================================================
// Ekranın SOL yarısına parmakla dokunduğun yerde joystick belirir.
// Parmağı sürükledikçe (-1..1) aralığında bir yön vektörü (x, y) üretir.
// Çoklu dokunma desteği: joystick'i tutan parmağın id'sini saklarız,
// böylece sağ elle başka tuşa basmak joystick'i bozmaz.
// Koordinatlar UIScene kamerasının dünyasında = ekranın CSS pikseli (Resolution.js).
import { RES } from './Resolution.js';

export class Joystick {
  // camera: koordinatların okunacağı kamera (varsayılan: sahnenin ana kamerası)
  constructor(scene, { radius = 70, enabled = true, camera = null } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.radius = radius;
    this.enabled = enabled;
    this.vector = new Phaser.Math.Vector2(0, 0);
    this.pointerId = null;

    // Görseller: dış halka (base) ve oynayan topuz (thumb)
    this.base = scene.add.circle(0, 0, radius, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.5);
    this.thumb = scene.add.circle(0, 0, radius * 0.45, 0xffffff, 0.35);
    this.base.setVisible(false).setDepth(1000);
    this.thumb.setVisible(false).setDepth(1001);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  // Dokunuşun ekran (CSS piksel) konumu
  pos(pointer) {
    return pointer.positionToCamera(this.camera || this.scene.cameras.main);
  }

  onDown(pointer) {
    if (!this.enabled || this.pointerId !== null) return;
    const p = this.pos(pointer);
    // Sadece ekranın sol yarısı joystick alanı
    if (p.x > RES.cssW * 0.5) return;
    this.pointerId = pointer.id;
    this.origin = new Phaser.Math.Vector2(p.x, p.y);
    this.base.setPosition(p.x, p.y).setVisible(true);
    this.thumb.setPosition(p.x, p.y).setVisible(true);
  }

  onMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    const p = this.pos(pointer);
    const dx = p.x - this.origin.x;
    const dy = p.y - this.origin.y;
    const dist = Math.min(Math.hypot(dx, dy), this.radius); // topuz halkadan çıkmasın
    const angle = Math.atan2(dy, dx);
    this.thumb.setPosition(this.origin.x + Math.cos(angle) * dist, this.origin.y + Math.sin(angle) * dist);
    // Küçük titremeleri yoksay (ölü bölge %15)
    const power = dist / this.radius;
    if (power < 0.15) this.vector.set(0, 0);
    else this.vector.set(Math.cos(angle) * power, Math.sin(angle) * power);
  }

  onUp(pointer) {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.vector.set(0, 0);
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }
}

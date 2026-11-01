// ============================================================
// tools/roles.js - Rol animasyonu videolarını hazırlar (geliştirici aracı)
// ============================================================
// 1) Kaynak videoyu sıkıştırır (1080x1080, 30fps) -> public/assets/videos/role_<rol>.mp4
// 2) Her karede yeşil topun kutusunu (bbox) ölçer -> public/assets/videos/roles.json
//    Oyun bayrağı bu kutuya göre topun üstüne giydirir (WebGL shader ile).
// Gerekenler: ffmpeg/ffprobe.  Kullanım: node tools/roles.js
// Kaynaklar: tools/source/role_<rol>.mp4 (orijinal, büyük dosyalar)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'source');
const OUT = path.join(ROOT, 'public/assets/videos');
const ROLES = ['crewmate', 'impostor', 'sheriff'];
const SAMPLE_FPS = 15, N = 270; // ölçüm için küçük kareler

const result = {};
for (const role of ROLES) {
  const src = path.join(SRC, `role_${role}.mp4`);
  const dst = path.join(OUT, `role_${role}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'fps=30', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '23', '-preset', 'slow', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dst]);

  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', dst, '-vf', `fps=${SAMPLE_FPS},scale=${N}:${N}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  const frameBytes = N * N * 3;
  const boxes = [];
  let keyG = 0;
  for (let f = 0; f * frameBytes < raw.length; f++) {
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = f * frameBytes + (y * N + x) * 3;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (g > 60 && (g - Math.max(r, b)) / g > 0.45) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (g > keyG) keyG = g;
      }
    }
    // [x, y, w, h] 0..1 aralığında; kenar çizgisi için biraz pay
    boxes.push(x1 < 0 ? null : [x0 - 1, y0 - 1, x1 - x0 + 3, y1 - y0 + 3].map((v) => +(v / N).toFixed(4)));
  }
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).toString());
  result[role] = { fps: SAMPLE_FPS, duration: dur, keyG: keyG / 255, boxes };
  console.log(role, (fs.statSync(dst).size / 1024).toFixed(0) + ' KB', boxes.length, 'kutu');
}
fs.writeFileSync(path.join(OUT, 'roles.json'), JSON.stringify(result));

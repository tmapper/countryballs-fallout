# ============================================================
# tools/kills.py - Öldürme animasyonlarını iki bayraklı hale getirmek için hazırlar
# ============================================================
# Videolarda iki yeşil top var: ÖLDÜREN (kısık gözlü) ve ÖLEN (yuvarlak açık gözlü).
# Her karede iki topun gövdesini ayırırız; oyun her birine ayrı bayrak giydirir.
#
# Çıktı (public/assets/kills/):
#   <klip>_overlay.png : çerçeve, gözler, bıçak/tabanca (RGBA)
#   <klip>_data.png    : R = gölge, G = öldürenin gövde maskesi, B = ölenin gövde maskesi
#   kills.json         : kare konumları, her top için bayrak kutusu, fps
# Gerekenler: python3, numpy, opencv-python, ffmpeg.   Kullanım: python3 tools/kills.py

import json, os, subprocess, sys
import numpy as np
import cv2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'public/assets/videos')
OUT = os.path.join(ROOT, 'public/assets/kills')
CLIPS = ['kill1', 'kill2', 'sheriff_kill']
SIZE = 720          # kaynak 1080 -> 720 (2K ekranda kesik görünmesin)
FPS = 16
MAX_ATLAS = 4096
BALL_ASPECT = 0.83  # top yüksekliği / genişliği (arkadaki top kısmen gizliyse kutuyu tamamlamak için)


def frames(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={FPS},scale={SIZE}:{SIZE}',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    n = len(raw) // (SIZE * SIZE * 3)
    return np.frombuffer(raw, np.uint8)[: n * SIZE * SIZE * 3].reshape(n, SIZE, SIZE, 3)


def process(img, key):
    f = img.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    # 1) Arka plan: kenarlardan taşırma (ChromaKey.js ile aynı mantık)
    dist = np.abs(r - key[0]) + np.abs(g - key[1]) + np.abs(b - key[2])
    near = (dist < 60).astype(np.uint8)
    n, lab = cv2.connectedComponents(near, connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)) & (near > 0)
    fg = ~bg
    # 2) Gövde ağırlığı (yeşillik oranı)
    ratio = np.where(g > 0, (g - np.maximum(r, b)) / np.maximum(g, 1), 0)
    t = np.clip((ratio - 0.35) / 0.4, 0, 1)
    w = t * t * (3 - 2 * t) * fg
    shade = np.clip(g / key[1], 0, 1)
    # Parça bulmak için gövdeyi biraz incelt: iç içe geçen topların ince çerçevesi
    # üzerinden birbirine bağlanmasın (arkadan bıçaklama sahnesi)
    body = cv2.erode((w > 0.8).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2)
    # 3) Ölenin gözleri: büyük, yuvarlak beyaz lekeler
    white = ((r > 200) & (g > 200) & (b > 200) & fg).astype(np.uint8)
    ne, elab, st, _ = cv2.connectedComponentsWithStats(white, connectivity=8)
    eyes = []
    for i in range(1, ne):
        x, y, ww, hh, area = st[i]
        if area > 40 and hh / max(ww, 1) > 0.6:
            eyes.append((area, i))
    eyes.sort(reverse=True)
    victim_eyes = np.isin(elab, [i for _, i in eyes[:2]])
    # 4) Gövde parçaları: ölenin gözlerine değenler ölene, diğerleri öldürene
    nb, blab, bst, _ = cv2.connectedComponentsWithStats(body, connectivity=4)
    grown = cv2.dilate(victim_eyes.astype(np.uint8), np.ones((11, 11), np.uint8)) > 0
    victim_ids = set(np.unique(blab[grown & (body > 0)])) - {0}
    labels = np.zeros(body.shape, np.uint8)
    for i in range(1, nb):
        if bst[i][4] < 30:
            continue
        labels[blab == i] = 2 if i in victim_ids else 1
    # Yumuşak kenar pikselleri en yakın etikete
    if labels.any():
        dist_px, near_lab = cv2.distanceTransformWithLabels((labels == 0).astype(np.uint8), cv2.DIST_L2, 3,
                                                            labelType=cv2.DIST_LABEL_PIXEL)
        ys, xs = np.nonzero(labels)
        lut = np.zeros(near_lab.max() + 1, np.uint8)
        idx = near_lab[ys, xs]
        lut[idx] = labels[ys, xs]
        # Sadece gövdeye yakın pikseller (bıçak/tabanca arasında kalan yeşil zemin parçaları bayrak almasın)
        full = np.where(dist_px <= 5, lut[near_lab], 0)
    else:
        full = labels
    mA = w * (full == 1)
    mB = w * (full == 2)
    overlay_a = fg * (1 - w)
    # Görünmeyen piksellerin rengini sıfırla (PNG çok daha küçük olur)
    oa8 = (overlay_a * 255).astype(np.uint8)
    rgb = img.copy(); rgb[oa8 < 2] = 0
    shade = np.where((mA + mB) > 0.004, shade, 0)
    return {
        'overlay': np.dstack([rgb, oa8]),
        'data': np.dstack([(shade * 255).astype(np.uint8), (mA * 255).astype(np.uint8), (mB * 255).astype(np.uint8),
                           np.full(shade.shape, 255, np.uint8)]),
        'fg': fg, 'labels': full, 'w': w
    }


def ball_box(mask):
    ys, xs = np.nonzero(mask > 0.5)
    if len(xs) == 0:
        return None
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    wdt = x1 - x0
    h = max(y1 - y0, int(wdt * BALL_ASPECT))  # alt kısmı gizliyse tamamla
    return [int(x0), int(y0), int(wdt), int(h)]


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for clip in CLIPS:
        fr = frames(os.path.join(SRC, clip + '.mp4'))
        key = fr[0][[1, 1, -2, -2], [1, -2, 1, -2]].astype(np.float32).mean(0)
        res = [process(im, key) for im in fr]
        fg_any = np.any([r_['fg'] for r_ in res], axis=0)
        ys, xs = np.nonzero(fg_any)
        pad = 4
        x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
        x1, y1 = min(SIZE, xs.max() + 1 + pad), min(SIZE, ys.max() + 1 + pad)
        fw, fh = x1 - x0, y1 - y0
        count = len(res)
        cols = min(count, MAX_ATLAS // fw)
        rows = -(-count // cols)
        atlas = {k: np.zeros((rows * fh, cols * fw, 4), np.uint8) for k in ('overlay', 'data')}
        framesMeta, boxA, boxB = [], [], []
        for i, r_ in enumerate(res):
            dx, dy = (i % cols) * fw, (i // cols) * fh
            for k in atlas:
                atlas[k][dy:dy + fh, dx:dx + fw] = r_[k][y0:y1, x0:x1]
            framesMeta.append([int(dx), int(dy)])
            boxA.append(ball_box(r_['w'][y0:y1, x0:x1] * (r_['labels'][y0:y1, x0:x1] == 1)))
            boxB.append(ball_box(r_['w'][y0:y1, x0:x1] * (r_['labels'][y0:y1, x0:x1] == 2)))
        for k, a in atlas.items():
            cv2.imwrite(os.path.join(OUT, f'{clip}_{k}.png'), cv2.cvtColor(a, cv2.COLOR_RGBA2BGRA),
                        [cv2.IMWRITE_PNG_COMPRESSION, 9])
        meta[clip] = {'fps': FPS, 'count': count, 'fw': int(fw), 'fh': int(fh), 'cols': int(cols), 'rows': int(rows),
                      'frames': framesMeta, 'boxA': boxA, 'boxB': boxB}
        na = sum(b_ is None for b_ in boxA); nb = sum(b_ is None for b_ in boxB)
        print(f'{clip}: {count} kare, {fw}x{fh}, atlas {cols}x{rows}, kutusuz kare A={na} B={nb}')
    with open(os.path.join(OUT, 'kills.json'), 'w') as fp:
        json.dump(meta, fp)


if __name__ == '__main__':
    main()

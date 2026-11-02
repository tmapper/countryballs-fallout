# ============================================================
# tools/eyes.py - Pişmiş karakter karelerinden gözleri ayırır
# ============================================================
# Oyunda gözler artık ayrı çizilir (göz kırpma, şaşırma, kısık göz...). Bu araç:
#   - <klip>_overlay.png içindeki beyaz gözleri (ve ince çerçevelerini) siler
#   - her karede iki gözün merkezini/boyunu ve topun tepe noktasını baked.json'a yazar (eyes, tops)
# Bir kez çalıştırılır: python3 tools/eyes.py   (yedek: <klip>_overlay_orig.png)
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'baked')
meta = json.load(open(os.path.join(ROOT, 'baked.json')))
for clip, m in meta.items():
    src = os.path.join(ROOT, f'{clip}_overlay_orig.png')
    if not os.path.exists(src):
        os.rename(os.path.join(ROOT, f'{clip}_overlay.png'), src)
    ov = np.array(Image.open(src).convert('RGBA'))
    sil = np.array(Image.open(os.path.join(ROOT, f'{clip}_sil.png')).convert('RGBA'))
    eyes, tops = [], []
    for f in m['frames']:
        x, y, w, h = f['x'], f['y'], f['w'], f['h']
        cell = ov[y:y+h, x:x+w]
        white = (cell[..., 3] > 150) & (cell[..., :3].min(axis=2) > 200)
        lab, n = ndimage.label(white)
        sizes = ndimage.sum(white, lab, range(1, n + 1))
        idx = np.argsort(sizes)[::-1][:2] + 1
        pair = []
        for k in idx:
            ys, xs = np.nonzero(lab == k)
            pair.append([round(float(xs.mean()), 1), round(float(ys.mean()), 1), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)])
            # gözü + ince çerçevesini sil
            grown = ndimage.binary_dilation(lab == k, iterations=4)
            cell[grown] = 0
        pair.sort(key=lambda e: e[0])
        eyes.append(pair)
        a = sil[y:y+h, x:x+w, 3] if sil.shape[2] == 4 else sil[y:y+h, x:x+w, 0]
        rows = np.nonzero(a.max(axis=1) > 128)[0]
        cols = np.nonzero(a[rows[0]] > 128)[0] if len(rows) else [w // 2]
        tops.append([round(float(np.mean(cols)), 1), int(rows[0]) if len(rows) else 0])
        ov[y:y+h, x:x+w] = cell
    Image.fromarray(ov).save(os.path.join(ROOT, f'{clip}_overlay.png'), optimize=True)
    m['eyes'] = eyes
    m['tops'] = tops
    print(clip, 'eyes f0', eyes[0], 'top', tops[0])
json.dump(meta, open(os.path.join(ROOT, 'baked.json'), 'w'), separators=(',', ':'))

#!/usr/bin/env python3
"""Yeşil perdeli JPEG görselleri şeffaf PNG'ye çevirir (Chroma key + despill + kırpma).
Kullanım: python3 tools/keyprops.py <görseller_klasörü>   -> public/assets/props/*.png
Gerekli: pip install pillow numpy scipy

Nasıl çalışır (eşyanın İÇİNDEKİ yeşil renkler silinmesin diye):
  1) Belirgin yeşil pikseller "perde adayı" sayılır.
  2) Sadece resmin KENARINA bağlı adaylar gerçek perdedir (flood fill). Böylece otomatın
     içindeki yeşil paketler, ağaç yaprakları gibi iç kısımlar korunur.
  3) Perdenin hemen yanındaki birkaç piksellik kenar şeridinde yumuşak alfa hesaplanır,
     perde rengi çıkarılır (unmix) ve yeşil taşma bastırılır (despill).
  4) Kenardaki tek tük yeşil kırıntılar temizlenir, resim kırpılır ve küçültülür."""
import sys, os, glob, re
import numpy as np
from PIL import Image
from scipy import ndimage

NAMES = {1:'kablo_panosu',2:'sigorta_kutusu',3:'salter_paneli',4:'vana_paneli',5:'sandik',6:'varil',7:'jenerator',
 8:'masa',9:'reaktor',10:'oksijen',11:'monitor',12:'revir',13:'ranza',14:'dolap',15:'raf',16:'otomat',17:'agac',
 18:'kaya',19:'kum',20:'tunel'}
MAXSIDE = 512
EDGE = 4          # kenar şeridi kalınlığı (piksel, orijinal boyutta)
HOLE_DIST = 55    # iç bölge rengi perdeye bu kadar yakınsa boşluk sayılır


def key_image(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dom = g - np.maximum(r, b)                                   # yeşilin baskınlığı

    # 1-2) perde = kenara bağlı belirgin yeşil bölgeler
    cand = dom > 38
    lab, n = ndimage.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    bg = np.isin(lab, border)
    # İçeride kalan perde boşlukları (raf arası, yatak altı, kablo halkası): rengi perdeyle
    # neredeyse aynı olan kapalı yeşil bölgeler de perdedir. Farklı tondaki yeşiller
    # (otomattaki paketler, yapraklar) korunur.
    screen0 = np.array([np.median(r[bg]), np.median(g[bg]), np.median(b[bg])], np.float32) if bg.any() else np.array([0, 255, 0], np.float32)
    sizes = np.bincount(lab.ravel())
    bset = set(border.tolist())
    for i in np.nonzero(sizes >= 25)[0]:
        if i == 0 or i in bset:
            continue
        m = lab == i
        col = np.median(a[m], axis=0)
        if np.linalg.norm(col - screen0) < HOLE_DIST:
            bg |= m

    # 3) kenar şeridi: perdeye EDGE piksel yakın, perde olmayan pikseller
    near = ndimage.binary_dilation(bg, iterations=EDGE) & ~bg
    alpha = np.ones_like(dom)
    alpha[bg] = 0
    soft = np.clip(1 - (dom - 18) / 70, 0, 1)
    alpha[near] = soft[near]

    # unmix + despill sadece kenar şeridinde (iç renkler aynen kalır)
    screen = np.array([np.median(r[bg]) if bg.any() else 0,
                       np.median(g[bg]) if bg.any() else 255,
                       np.median(b[bg]) if bg.any() else 0], np.float32)
    aa = np.maximum(alpha, 0.05)[..., None]
    unmixed = np.clip((a - (1 - aa) * screen) / aa, 0, 255)
    out = a.copy()
    out[near] = unmixed[near]
    gcap = np.maximum(out[..., 0], out[..., 2]) + 6
    edge_g = np.minimum(out[..., 1], gcap)
    out[..., 1] = np.where(near, edge_g, out[..., 1])

    # 4) çok zayıf alfa kırıntılarını at, kenarı 1 px yumuşat
    alpha[alpha < 0.08] = 0
    alpha = ndimage.uniform_filter(alpha, 2) * (alpha > 0) + 0 * alpha
    rgba = np.dstack([out, np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    bbox = img.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    img = img.crop(bbox)
    s = MAXSIDE / max(img.size)
    if s < 1:
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    return img


def main():
    src = sys.argv[1]
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'props')
    os.makedirs(out, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src, '*'))):
        m = re.match(r'(\d+)\.', os.path.basename(f))
        if not m or int(m.group(1)) not in NAMES:
            continue
        name = NAMES[int(m.group(1))]
        img = key_image(f)
        img.save(os.path.join(out, name + '.png'), optimize=True)
        print(name, img.size)


if __name__ == '__main__':
    main()

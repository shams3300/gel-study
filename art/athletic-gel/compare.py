# Lays each proof's silhouette over the painted sheet's (painting red, model green, agreement yellow) and scores the overlap.
import numpy as np
from PIL import Image
ref = np.asarray(Image.open("/tmp/ag/mask.png").convert("L")) > 127
out = []
for name, p in (("front", 0), ("side", 2), ("back", 3)):
    r = ref[:, p * 512:(p + 1) * 512]; m = np.asarray(Image.open(f"/tmp/ag/proof/{name}.png"))[..., 3] > 127
    def fit(mask, top=None, bot=None):
        yy = np.where(mask.any(1))[0]; return yy.min(), yy.max()
    rt, rb = 19, 692; mt, mb = fit(m)
    s = (rb - rt) / (mb - mt); im = Image.fromarray((m * 255).astype("uint8")).resize((int(512 * s), int(768 * s)))
    mm = np.asarray(im) > 127; canvas = np.zeros_like(r)
    hy = np.where(mm.any(1))[0].min(); hx = np.where(mm[hy + 20:hy + 60].any(0))[0]; mcx = (hx.min() + hx.max()) / 2
    rx = np.where(r[39:79].any(0))[0]; rcx = (rx.min() + rx.max()) / 2
    dy, dx = int(rt - hy), int(round(rcx - mcx))
    for y in range(mm.shape[0]):
        Y = y + dy
        if 0 <= Y < 768:
            xs = np.where(mm[y])[0] + dx; xs = xs[(xs >= 0) & (xs < 512)]; canvas[Y, xs] = True
    rr = r.copy(); rr[700:] = False; cc = canvas.copy(); cc[700:] = False
    print(name, "IoU", round((rr & cc).sum() / (rr | cc).sum(), 3))
    img = np.zeros((768, 512, 3), "uint8"); img[..., 0] = r * 255; img[..., 1] = canvas * 255; out.append(img)
Image.fromarray(np.concatenate(out, 1)).save("/tmp/ag/proof/overlay.png")

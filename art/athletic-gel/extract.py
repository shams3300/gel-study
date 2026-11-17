# Measures the painted athletic sheet (the only reference): front panel runs and side panel profile, per pixel row, in metres.
import numpy as np, json
from PIL import Image, ImageFilter
im = Image.open("/tmp/ag/ref.png").convert("RGB")
a = np.asarray(im).astype(float) / 255
mx, mn = a.max(2), a.min(2)
mask = ((mx - mn) / (mx + 1e-6) > 0.3) & (a[..., 0] > a[..., 2] + 0.08) & (mx > 0.25)
m = Image.fromarray((mask * 255).astype("uint8")).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
mask = np.asarray(m) > 127
TOP, SOLE, H = 19, 692, 1.70
S = H / (SOLE - TOP)
def runs(row, gap=5):
    xs = np.where(row)[0]; out = []
    if not len(xs): return out
    s = p = xs[0]
    for x in xs[1:]:
        if x - p > gap: out.append((s, p)); s = x
        p = x
    out.append((s, p)); return [r for r in out if r[1] - r[0] >= 2]
front, side, back = mask[:, 0:512], mask[:, 1024:1536], mask[:, 1536:2048]
hr = [runs(front[y]) for y in range(30, 80)]
cx = np.mean([(r[0][0] + r[0][1]) / 2 for r in hr if r])
hrb = [runs(back[y]) for y in range(30, 80)]
cxb = np.mean([(r[0][0] + r[0][1]) / 2 for r in hrb if r])
F, B, Sd = [], [], []
for y in range(TOP, SOLE + 12):
    Y = (SOLE - y) * S
    F.append([round(Y, 4)] + [[round((r0 - cx) * S, 4), round((r1 - cx) * S, 4)] for r0, r1 in runs(front[y])])
    B.append([round(Y, 4)] + [[round((r0 - cxb) * S, 4), round((r1 - cxb) * S, 4)] for r0, r1 in runs(back[y])])
    rs = runs(side[y], gap=12)
    Sd.append([round(Y, 4)] + ([round(rs[0][0] * S, 4), round(rs[-1][1] * S, 4)] if rs else []))
json.dump({"front": F, "back": B, "side": Sd, "S": S}, open("/tmp/ag/measures.json", "w"))
for row in F[::20]: print("F", row)
for row in Sd[::20]: print("S", row)

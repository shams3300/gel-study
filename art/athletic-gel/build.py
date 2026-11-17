# Build 2, the athletic gel figure, from a blank file. Its only source is the painted four-view sheet
# (/cdn/value.adf45a7d…png) as measured by extract.py: front-panel widths and side-panel depths per row.
# Parts are lofted from those rows, fused by a voxel remesh, smoothed, detailed, exported. No other model is read.
# Space here: x right, y up, z front (metres). Blender gets (x, z, y) so the export faces glTF -Z like the studio's other figure.
import bpy, bmesh, json, math, sys
from mathutils import Vector
import numpy as np
M = json.load(open("/tmp/ag/measures.json"))
BUST = 1.0 if "--bust" not in sys.argv else float(sys.argv[sys.argv.index("--bust") + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
Z0 = 0.59  # side-panel x of the ankle axis
def sm(a, k=9):
    a = np.asarray(a, float); p = np.pad(a, k // 2, mode="edge"); return np.convolve(p, np.ones(k) / k, mode="valid")
ys = np.array([r[0] for r in M["front"]])
sf = np.array([(r[2] - Z0) if len(r) > 2 else np.nan for r in M["side"]]); sb = np.array([(r[1] - Z0) if len(r) > 2 else np.nan for r in M["side"]])
def rowruns(r): return [(a, b) for a, b in r[1:]]
CROTCH = next(r[0] for r in M["front"] if r[0] < 0.9 and not any(a < -0.004 and b > 0.004 for a, b in rowruns(r)))
tw = np.full(len(ys), np.nan); sh = np.full(len(ys), np.nan); armc = np.full(len(ys), np.nan); armr = np.full(len(ys), np.nan); legc = np.full(len(ys), np.nan); legw = np.full(len(ys), np.nan)
for i, r in enumerate(M["front"]):
    y, rs = r[0], rowruns(r)
    if not rs: continue
    if y > CROTCH:
        c = [(a, b) for a, b in rs if abs((a + b) / 2) < 0.14]
        if c:
            hw = (max(b for a, b in c) - min(a for a, b in c)) / 2
            if 1.2 < y < 1.415 and (hw > 0.17 or y > 1.38): sh[i] = hw      # arms and chest read as one shape here: the shoulder's outer edge
            elif not 1.2 < y < 1.415: tw[i] = hw
        if 0.88 < y < 1.225:
            R = [(a, b) for a, b in rs if (a + b) / 2 >= 0.14]; L = [(-b, -a) for a, b in rs if (a + b) / 2 <= -0.14]
            ex = [(min(a for a, b in s), max(b for a, b in s)) for s in (R, L) if s]
            if ex: armc[i] = np.mean([(a + b) / 2 for a, b in ex]); armr[i] = np.mean([(b - a) / 2 for a, b in ex])
    elif y > 0.085:
        R = [(a, b) for a, b in rs if a > -0.002 and (a + b) / 2 < 0.2]; L = [(-b, -a) for a, b in rs if b < 0.002 and (a + b) / 2 > -0.2]
        ex = [(min(a for a, b in s), max(b for a, b in s)) for s in (R, L) if s]
        if ex: legc[i] = np.mean([(a + b) / 2 for a, b in ex]); legw[i] = np.mean([(b - a) / 2 for a, b in ex])
def fn(arr, k=9):
    ok = ~np.isnan(arr); yy, vv = ys[ok][::-1], sm(arr[ok], k)[::-1]
    return lambda y: float(np.interp(y, yy, vv))
TWl, TWh, SH, SF, SB, AC, AR, LC, LW = fn(np.where(ys < 1.3, tw, np.nan), 11), fn(np.where(ys > 1.3, tw, np.nan), 13), fn(sh, 7), fn(sf, 9), fn(sb, 11), fn(armc), fn(armr), fn(legc, 11), fn(legw, 11)
TW = lambda y: TWl(y) if y < 1.3 else TWh(y)
# the face without its nose: the painted profile, bridged across the nose rows
_ok = ~np.isnan(sf); _yy, _vv = ys[_ok][::-1], sm(sf[_ok], 9)[::-1]
_hy = [y for y in _yy if 1.53 < y < 1.61]; NOSE_Y = max(_hy, key=lambda y: float(np.interp(y, _yy, _vv)))
_keep = (_yy < NOSE_Y - 0.014) | (_yy > NOSE_Y + 0.05)
FACE = lambda y: float(np.interp(y, _yy[_keep], _vv[_keep]))
NOSE_P = float(np.interp(NOSE_Y, _yy, _vv)) - FACE(NOSE_Y)
print("CROTCH", CROTCH, "NOSE", NOSE_Y, NOSE_P)
lerp = lambda a, b, t: a + (b - a) * max(0.0, min(1.0, t))
BUST_Y, GLUTE_Y = 1.255, 0.862
def core_front(y):
    if 1.15 < y < 1.385: return lerp(SF(1.15), SF(1.385), (y - 1.15) / 0.235) - 0.006 * math.sin(math.pi * (y - 1.15) / 0.235)
    if y > 1.42:
        t = max(0.0, min(1.0, (y - 1.492) / 0.034)); t = t * t * (3 - 2 * t)
        return lerp(min(SF(y), 0.064), FACE(y), t)
    return SF(y)
def core_back(y):
    if 0.745 < y < 0.995: return lerp(SB(0.745), SB(0.995), (y - 0.745) / 0.25) + 0.012 * math.sin(math.pi * (y - 0.745) / 0.25)
    return SB(y)
_cf, _cb = core_front, core_back; _g = np.arange(0.6, 1.72, 0.0025)
_f = np.array([_cf(y) for y in _g]); _b = np.array([_cb(y) for y in _g]); _fs, _bs, _fh = sm(_f, 17), sm(_b, 17), sm(_f, 7)
core_front = lambda y: float(np.interp(y, _g, _fs if y < 1.41 else _fh)); core_back = lambda y: float(np.interp(y, _g, _bs))
def torso_w(y):
    if y <= 1.19: w = TW(y)
    elif y < 1.37: w = lerp(TW(1.19), 0.150, (y - 1.19) / 0.18)
    elif y < 1.415: w = min(0.150 + (y - 1.37) * 0.1, SH(y))
    elif y < 1.44: w = lerp(min(0.155, SH(1.414)), TW(1.44), ((y - 1.415) / 0.025) ** 0.7)
    else: w = TW(y)
    if 1.56 < y < 1.635: w *= 0.95
    return w
parts = []
def loft(rings, name):
    bm = bmesh.new(); vr = [[bm.verts.new((p[0], p[2], p[1])) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vr, vr[1:]):
        for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(vr[0][::-1]); bm.faces.new(vr[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); parts.append(o); return o
def ring(cx, y, cz, rx, rz, n=40, e=2.0):
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n; c, s = math.cos(t), math.sin(t)
        out.append((cx + rx * math.copysign(abs(c) ** (2 / e), c), y, cz + rz * math.copysign(abs(s) ** (2 / e), s)))
    return out
def tube(pts, name, n=20):  # pts: (centre Vector, radius or (ra, rb), optional flat-axis Vector), round-capped
    rings = []; P = [(Vector(p[0]), p[1], p[2] if len(p) > 2 else None) for p in pts]
    ext = []
    for j, (c, r, ax) in enumerate(P):
        d = (P[min(j + 1, len(P) - 1)][0] - P[max(j - 1, 0)][0]).normalized()
        ext.append((c, r, ax, d))
    def mk(c, r, ax, d, k=1.0):
        ra, rb = (r, r) if not isinstance(r, tuple) else r
        u = (ax - d * ax.dot(d)).normalized() if ax else d.orthogonal().normalized(); v = d.cross(u)
        return [tuple(c + u * (ra * k * math.cos(2 * math.pi * i / n)) + v * (rb * k * math.sin(2 * math.pi * i / n))) for i in range(n)]
    c, r, ax, d = ext[0]; rm = r if not isinstance(r, tuple) else min(r)
    for a in (80, 55, 30): rings.append(mk(c - d * rm * math.sin(math.radians(a)), r, ax, d, math.cos(math.radians(a))))
    for c, r, ax, d in ext: rings.append(mk(c, r, ax, d))
    c, r, ax, d = ext[-1]; rm = r if not isinstance(r, tuple) else min(r)
    for a in (30, 55, 80): rings.append(mk(c + d * rm * math.sin(math.radians(a)), r, ax, d, math.cos(math.radians(a))))
    return loft(rings, name)
def blob(c, r, name, shape=None, nu=28, nv=18):
    rings = []
    for j in range(1, nv):
        ph = math.pi * j / nv; row = []
        for i in range(nu):
            th = 2 * math.pi * i / nu; s = Vector((math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)))
            p = Vector((c[0] + r[0] * s.x, c[1] + r[1] * s.y, c[2] + r[2] * s.z))
            if shape: p = shape(p, s)
            row.append(tuple(p))
        rings.append(row)
    return loft(rings[::-1], name)
# trunk, neck and head: one loft from the crotch to the crown; bust, seat, spine, navel and eye hollows are shaped into its rings
g = lambda v, c, s_: math.exp(-((v - c) / s_) ** 2)
band = lambda y, a, b, f: max(0.0, min(1.0, (y - a) / f)) * max(0.0, min(1.0, (b - y) / f))
BUST_P = max(SF(y) - core_front(y) for y in np.arange(1.2, 1.3, 0.005)) + 0.034   # the painted bust's reach past the chest wall, a touch fuller
def bust_h(x, y):  # a dome with a soft edge: long slope above, short full curve below
    ry = 0.115 if y > BUST_Y else 0.06
    u, v = (abs(x) - 0.084) / (0.076 if abs(x) < 0.084 else 0.07), (y - BUST_Y) / ry
    if abs(u) >= 1 or abs(v) >= 1: return 0.0
    V = math.cos(v * math.pi / 2) ** 1.6 if v > 0 else (1 - v * v) ** 0.85
    return BUST_P * BUST * (1 - u * u) ** (1.6 if u < 0 else 0.95) * V
def seat_p(y): return 1.12 * max(0.0, core_back(y) - SB(y)) if 0.745 < y < 0.995 else 0.0
EYE_Y = NOSE_Y + 0.042
def face_h(x, y):  # the painted profile's features, sculpted at the midline: nose, lips, chin, brow
    if y < 1.46: return 0.0
    h = 0.0
    if NOSE_Y - 0.008 < y < EYE_Y + 0.012:
        t = (EYE_Y + 0.012 - y) / (EYE_Y + 0.012 - NOSE_Y) if y > NOSE_Y else 1 - ((NOSE_Y - y) / 0.008) ** 2
        h += (0.003 + (NOSE_P + 0.002) * (t ** 1.3 if y > NOSE_Y else t)) * g(x, 0, 0.0085 + 0.006 * min(1.0, t))
    h -= 0.0025 * g(x, 0, 0.02) * g(y, NOSE_Y - 0.031, 0.003)
    return h
def trunk_ring(y, kw=1.0, kd=1.0, n=128):
    f, b = core_front(y), core_back(y); e = 2.15 if y < 1.38 else 2.0; w = torso_w(y) * kw; cz, rz = (f + b) / 2, (f - b) / 2 * kd
    sp = seat_p(y); out = []
    for i in range(n):
        t = 2 * math.pi * i / n; c, sn = math.cos(t), math.sin(t)
        x = w * math.copysign(abs(c) ** (2 / e), c); z = cz + rz * math.copysign(abs(sn) ** (2 / e), sn)
        if sn > 0:
            fw = sn ** 0.6
            z += bust_h(x, y) * fw + face_h(x, y)
            z -= 0.006 * g(x, 0, 0.008) * g(y, 1.035, 0.009) + 0.002 * g(x, 0, 0.014) * band(y, 1.05, 1.19, 0.04)
            z -= 0.005 * g(abs(x), 0.031, 0.013) * g(y, EYE_Y, 0.01)
        else:
            bw = (-sn) ** 0.6
            z -= sp * g(abs(x), 0.076, 0.066) * bw
            z += (0.007 * g(x, 0, 0.016) * band(y, 0.99, 1.41, 0.07) + 0.004 * g(x, 0, 0.04) * band(y, 0.99, 1.22, 0.07)) * bw
        out.append((x, y, z))
    return out
ylist = list(np.arange(CROTCH + 0.004, 1.676, 0.004)); y0, yt = ylist[0], ylist[-1]
rings = [[(x * math.cos(math.radians(a)), y0 - 0.05 * math.sin(math.radians(a)), z) for x, _, z in trunk_ring(y0, 1.0, math.cos(math.radians(a)) ** 0.5)] for a in (80, 60, 40, 20)]
rings += [trunk_ring(y) for y in ylist]
rings += [[(x * math.cos(math.radians(a)), yt + 0.028 * math.sin(math.radians(a)), (z - 0.036) * math.cos(math.radians(a)) + 0.036) for x, _, z in trunk_ring(yt)] for a in (18, 36, 54, 70, 83)]
loft(rings, "trunk")
for sx in (1, -1):
    # leg, hip to ankle
    rings = []
    for y in np.arange(0.06, 0.90, 0.005):
        yy = min(y, CROTCH - 0.004); t = max(0.0, (y - CROTCH - 0.02) / 0.16)
        c, w = LC(max(yy, 0.09)), LW(max(yy, 0.09)) * (1 - 0.45 * t); f, b = SF(max(y, 0.09)) if y < CROTCH else lerp(SF(CROTCH), core_front(y) - 0.07, t ** 0.6), SB(max(y, 0.09)) if y < CROTCH else lerp(SB(CROTCH), core_back(y) + 0.02, t)
        rings.append(ring(sx * c, y, (f + b) / 2, w, (f - b) / 2, 36, 2.1))
    loft(rings, "leg")
    # foot: heel to toes along z, sole on the floor
    c = LC(0.1); out = 0.012
    secs = [(-0.052, 0.018, 0.045, 0), (-0.04, 0.03, 0.075, 0), (-0.01, 0.034, 0.095, 0.1), (0.03, 0.035, 0.085, 0.3), (0.07, 0.04, 0.06, 0.6), (0.11, 0.045, 0.042, 0.85), (0.14, 0.046, 0.032, 1), (0.165, 0.04, 0.024, 1.1), (0.18, 0.028, 0.016, 1.15)]
    rings = [[(sx * (c + out * t + w * math.cos(2 * math.pi * i / 28)), max(0.0, h / 2 + h / 2 * math.sin(2 * math.pi * i / 28) * (1.0 if math.sin(2 * math.pi * i / 28) > 0 else 0.92)), z) for i in range(28)] for z, w, h, t in secs]
    loft(rings if sx == 1 else [r[::-1] for r in rings], "foot")
    for k, (dx, r, zt) in enumerate(((-0.026, 0.0125, 0.187), (-0.006, 0.0095, 0.186), (0.010, 0.009, 0.181), (0.024, 0.0085, 0.174), (0.037, 0.008, 0.165))):
        cx = c + out * 1.1 - dx  # big toe inside
        tube([((sx * cx, r * 0.95, zt - 0.03), r), ((sx * cx, r * 0.9, zt), r * 0.92)], "toe", 12)
    # arm: shoulder to wrist; the sheet's merged shoulder rows give the deltoid's outer edge
    def arm_r(y): return AR(y) if y < 1.17 else lerp(AR(1.17), 0.044, (y - 1.17) / 0.12) * (1.0 if y < 1.33 else lerp(1.0, 0.72, (y - 1.33) / 0.06))
    def arm_c(y): return AC(y) if y < 1.17 else lerp(AC(1.17) + AR(1.17), SH(max(1.24, min(y, 1.39))), (y - 1.17) / 0.07) - arm_r(y)
    def arm_z(y): return lerp(0.036, -0.004, (y - 0.88) / 0.22) if y < 1.1 else lerp(-0.004, 0.004, (y - 1.1) / 0.26)
    rings = []
    for y in np.arange(0.885, 1.392, 0.005):
        r = arm_r(y); dz = r * (1.08 if y > 1.1 else lerp(0.8, 1.08, (y - 0.9) / 0.2))
        rings.append(ring(sx * arm_c(y), y, arm_z(y), r, dz, 28))
    yt = 1.39; rings += [ring(sx * (arm_c(yt) - 0.004 * k), yt + 0.006 * k, arm_z(yt), arm_r(yt) * s, arm_r(yt) * 1.08 * s, 28) for k, s in ((1, 0.93), (2, 0.78), (3, 0.5), (3.6, 0.2))]
    loft(rings, "arm")
    # hand: palm facing the thigh, four fingers and a thumb, relaxed
    W = Vector((sx * arm_c(0.885), 0.885, arm_z(0.885))); E = Vector((sx * arm_c(1.0), 1.0, arm_z(1.0))); d = (W - E).normalized()
    d = (d + Vector((sx * -0.10, 0, 0.0))).normalized(); fw = Vector((0, 0, 1)); fw = (fw - d * fw.dot(d)).normalized(); nx = d.cross(fw) * 1.0
    tube([(W + d * -0.01, (0.021, 0.016), fw), (W + d * 0.03, (0.036, 0.013), fw), (W + d * 0.065, (0.04, 0.012), fw), (W + d * 0.088, (0.037, 0.0105), fw)], "palm", 20)
    for k, (off, ln, r) in enumerate(((0.0285, 0.068, 0.0078), (0.0095, 0.078, 0.008), (-0.0095, 0.072, 0.0077), (-0.0275, 0.056, 0.007))):
        base = W + d * 0.088 + fw * off; curl = nx * (-sx * 1.0) * 0  # straight, then a soft bend toward the palm side
        inw = Vector((-sx, 0, 0)) + fw * (off * 7); b1 = base + (d + inw * 0.10).normalized() * ln * 0.45; b2 = b1 + (d + inw * 0.32).normalized() * ln * 0.33; b3 = b2 + (d + inw * 0.55).normalized() * ln * 0.25
        tube([(base - d * 0.012, r * 1.05), (b1, r), (b2, r * 0.92), (b3, r * 0.8)], "finger", 12)
    tb = W + d * 0.032 + fw * 0.03; inw = Vector((-sx, 0, 0))
    t1 = tb + (d * 0.8 + fw * 0.6).normalized() * 0.034; t2 = t1 + (d * 0.95 + fw * 0.3).normalized() * 0.03
    tube([(tb - fw * 0.014 - d * 0.01, 0.013), (t1, 0.0105), (t2, 0.0088)], "thumb", 12)
    # collarbone, mostly buried
    tube([((sx * 0.018, 1.392, core_front(1.39) - 0.007), 0.007), ((sx * 0.075, 1.397, core_front(1.395) - 0.016), 0.007), ((sx * 0.13, 1.398, 0.012), 0.007)], "clav", 12)
    # ear
    ey = NOSE_Y + 0.02
    blob((sx * (torso_w(ey) + 0.002), ey, (core_front(ey) + core_back(ey)) / 2 - 0.012), (0.006, 0.026, 0.014), "ear", lambda p, s: Vector((p.x, p.y, p.z - 0.006 * s.y)))
# fuse
bpy.ops.object.select_all(action="DESELECT")
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); body = bpy.context.active_object; body.name = "athletic"
rm = body.modifiers.new("r", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.004; rm.adaptivity = 0
bpy.ops.object.modifier_apply(modifier="r")
me = body.data; print("VOXEL verts", len(me.vertices))
vg = body.vertex_groups.new(name="sm")
for v in me.vertices:
    x, z, y = v.co
    w = 0.4 + 0.6 * max(band(y, 0.6, 0.94, 0.08) * (1 if abs(x) < 0.2 else 0), band(y, 1.12, 1.46, 0.07) * min(1.0, max(0.0, (abs(x) - 0.07) / 0.05)), band(y, 0.02, 0.15, 0.03) * 0.8)
    if abs(x) > 0.27 and y < 0.9: w = 0.1        # hands keep their fingers
    elif y < 0.05: w = min(w, 0.45)
    elif y > 1.5: w = 0.9
    vg.add([v.index], w, "REPLACE")
s = body.modifiers.new("s", "SMOOTH"); s.factor = 0.5; s.iterations = 30; s.vertex_group = "sm"
bpy.ops.object.modifier_apply(modifier="s")
vg2 = body.vertex_groups.new(name="sm2")
for v in body.data.vertices:
    x, z, y = v.co; vg2.add([v.index], band(y, 1.2, 1.45, 0.05) * min(1.0, max(0.0, (abs(x) - 0.08) / 0.04)), "REPLACE")
s = body.modifiers.new("sh", "SMOOTH"); s.factor = 0.5; s.iterations = 45; s.vertex_group = "sm2"; bpy.ops.object.modifier_apply(modifier="sh")
vg3 = body.vertex_groups.new(name="sm3")
for v in body.data.vertices:
    x, z, y = v.co; vg3.add([v.index], band(y, 0.66, 0.96, 0.06) * (1 if abs(x) < 0.21 else 0), "REPLACE")
s = body.modifiers.new("hp", "SMOOTH"); s.factor = 0.5; s.iterations = 50; s.vertex_group = "sm3"; bpy.ops.object.modifier_apply(modifier="hp")
dc = body.modifiers.new("d", "DECIMATE"); dc.ratio = 46000 / (len(body.data.polygons) * 2); bpy.ops.object.modifier_apply(modifier="d")
bpy.ops.object.shade_smooth()
zs = [v.co.z for v in body.data.vertices]; print("HEIGHT", min(zs), max(zs))
for v in body.data.vertices: v.co.z -= min(zs)
mat = bpy.data.materials.new("gel"); mat.use_nodes = True; bs = mat.node_tree.nodes["Principled BSDF"]
bs.inputs["Base Color"].default_value = (0.78, 0.42, 0.08, 1); bs.inputs["Roughness"].default_value = 0.28
body.data.materials.append(mat)
body.data.calc_loop_triangles(); print("TRIS", len(body.data.loop_triangles))
bpy.ops.export_scene.gltf(filepath="/workspace/athletic-gel.glb", export_apply=True, export_materials="EXPORT")
# proofs: the sheet's four views, orthographic, each lit from its camera
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 12; sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = 512, 768
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); cam.data.type = "ORTHO"; cam.data.ortho_scale = 1.94; sc.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun); sun.data.energy = 3.2; sun.data.angle = 0.5
for name, ang, osc, cy in (("front", 0, 1.94, 0.855), ("tq", 35, 1.94, 0.855), ("side", -90, 1.94, 0.855), ("back", 180, 1.94, 0.855), ("head", 20, 0.5, 1.57), ("headside", -90, 0.5, 1.57), ("bust", 30, 0.8, 1.2), ("hand", 60, 0.5, 0.85)):
    cam.data.ortho_scale = osc
    a = math.radians(ang); p = Vector((-math.sin(a) * 4, math.cos(a) * 4, cy)); cam.location = p
    cam.rotation_euler = (Vector((0, 0, cy)) - p).to_track_quat("-Z", "Y").to_euler()
    lp = Vector((-math.sin(a - 0.6) * 4, math.cos(a - 0.6) * 4, 3.2)); sun.rotation_euler = (lp).to_track_quat("Z", "Y").to_euler()
    sc.render.filepath = f"/tmp/ag/proof/{name}.png"; bpy.ops.render.render(write_still=True)

# Tripo's athletic figure, refined: scaled to 1.68 m, suit lines smoothed off, fuller chest. Source: athletic-tripo.glb (Tripo task e11b6511).
import bpy, math, mathutils, sys, os
P = dict(height=1.68, smooth_fac=0.6, smooth_it=int(os.environ.get("SMOOTH_IT", "25")),
         bust=float(os.environ.get("BUST", "0.056")), bust_y=0.09, bust_r=0.11, bust_z_frac=0.718)
OUT = "/workspace/tripo"; PROOF = "/tmp/athl"; os.makedirs(PROOF, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f"{OUT}/src.glb")
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = ob.data
# metres, feet at 0, centred
zs = [v.co.z for v in me.vertices]; s = P["height"] / (max(zs) - min(zs)); z0 = min(zs)
for v in me.vertices: v.co = mathutils.Vector((v.co.x * s, v.co.y * s, (v.co.z - z0) * s))
H = P["height"]
# weld tripo's split verts so the smoothing and pushes move one skin
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.object.mode_set(mode="OBJECT")
def sstep(a, b, x):
    t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
if os.environ.get("BEFORE") != "1":
    # one closed skin: the suit's cuffs and seams were open borders; a voxel remesh welds them shut
    r = ob.modifiers.new("remesh", "REMESH"); r.mode = "VOXEL"; r.voxel_size = 0.0035; r.adaptivity = 0
    bpy.ops.object.modifier_apply(modifier="remesh")
    d = ob.modifiers.new("dec", "DECIMATE"); d.ratio = 80000 / max(1, 2 * len(ob.data.polygons))
    bpy.ops.object.modifier_apply(modifier="dec")
    me = ob.data
    pre = ob.modifiers.new("pre", "LAPLACIANSMOOTH"); pre.iterations = 4; pre.lambda_factor = 0.5; pre.use_volume_preserve = True; pre.use_normalized = True
    bpy.ops.object.modifier_apply(modifier="pre")
    me.update()
    # front profile of the torso per 1 cm band
    front = {}
    for v in me.vertices:
        if abs(v.co.y) < 0.15:
            k = int(v.co.z * 100); front[k] = max(front.get(k, -9), v.co.x)
    cz = H * P["bust_z_frac"]
    for side in (-1, 1):
        c = mathutils.Vector((0, side * P["bust_y"], cz))
        for v in me.vertices:
            dy = v.co.y - c.y; dz = (v.co.z - c.z) * (1.35 if v.co.z < c.z else 0.75)
            d = math.hypot(dy, dz) / P["bust_r"]
            if d >= 1: continue
            fr = front.get(int(v.co.z * 100), 0)
            w = (1 - d * d) ** 2 * sstep(-0.1, 0.45, v.normal.x) * sstep(fr - 0.10, fr - 0.05, v.co.x) * (1 - sstep(0.15, 0.19, abs(v.co.y)))
            v.co.x += P["bust"] * w; v.co.z -= P["bust"] * 0.3 * w; v.co.y += side * P["bust"] * 0.12 * w
    # match the sheet: narrower waist, flatter belly, more hip flare, smaller head on a longer neck
    def g(z, c, half): return max(0.0, 1 - ((z - c) / half) ** 2) ** 2
    for v in me.vertices:
        z = v.co.z; ay = abs(v.co.y); torso = 1 - sstep(0.13, 0.165, ay)
        if torso <= 0 and z < 1.3: continue
        gw = g(z, 1.03, 0.11) * torso
        v.co.y *= 1 - 0.09 * gw; v.co.x *= 1 - 0.05 * gw
        gb = g(z, 0.95, 0.08) * torso * sstep(0.0, 0.5, v.normal.x)
        v.co.x -= 0.014 * gb
        gh = g(z, 0.86, 0.09) * torso
        v.co.y *= 1 + 0.06 * gh
        # head and neck: lift everything above the neck base, shrink the head about its base
        hz = 0.87 * H; lift = 0.02 * sstep(0.83 * H, 0.86 * H, z)
        hs = sstep(0.855 * H, 0.885 * H, z)
        if hs > 0:
            k = 1 - 0.12 * hs
            v.co.x *= k; v.co.y *= k; v.co.z = hz + (z - hz) * k
        v.co.z += lift
    # slimmer neck: pull the neck band in toward its own centre line
    nb = [v.co for v in me.vertices if 0.835 * H < v.co.z < 0.865 * H]
    ncx = sum(c.x for c in nb) / max(1, len(nb))
    for v in me.vertices:
        gn = g(v.co.z, 0.85 * H, 0.03 * H)
        if gn > 0 and abs(v.co.y) < 0.08:
            k = 1 - float(os.environ.get("NECK", "0.13")) * gn
            v.co.x = ncx + (v.co.x - ncx) * k; v.co.y *= k
    # softer, narrower shoulders like the sheet: the trapezius drops, the deltoid caps come in
    for v in me.vertices:
        z = v.co.z; ay = abs(v.co.y)
        gt = g(z, 0.825 * H, 0.035 * H) * sstep(0.045, 0.08, ay) * (1 - sstep(0.17, 0.2, ay))
        v.co.z -= float(os.environ.get("TRAP", "0.018")) * gt
        gs = g(z, 0.79 * H, 0.06 * H) * sstep(0.1, 0.16, ay)
        v.co.y *= 1 - 0.05 * gs
    # A-pose like the sheet: flood each arm from the hand, beyond the torso's side wall, and swing it out about the shoulder
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    ANG = math.radians(float(os.environ.get("ARM", "20"))); pz = 0.80 * H
    for side in (-1, 1):
        cands = [v for v in bm.verts if 0.46 * H < v.co.z < 0.52 * H and side * v.co.y > 0.2]
        seed = max(cands, key=lambda v: side * v.co.y)
        ok = lambda v: side * v.co.y > 0.15 and v.co.z < 0.84 * H
        arm = {seed.index}; st = [seed]
        while st:
            a = st.pop()
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in arm and ok(b): arm.add(b.index); st.append(b)
        print("ARM", side, len(arm))
        py = side * 0.175
        for i in arm:
            co = me.vertices[i].co
            w = sstep(pz - 0.01, pz - 0.13, co.z)
            if w <= 0: continue
            a = ANG * w * side
            dy, dz = co.y - py, co.z - pz
            co.y = py + dy * math.cos(a) - dz * math.sin(a)
            co.z = pz + dy * math.sin(a) + dz * math.cos(a)
    bm.free(); me.update()
    # sand the suit off: a broad pass over torso and limbs, then hard passes on the cuffs and neckline
    def smooth_pass(name, fac, it, wfn):
        vg = ob.vertex_groups.new(name=name)
        for v in me.vertices: vg.add([v.index], wfn(v), "REPLACE")
        m = ob.modifiers.new(name, "SMOOTH"); m.factor = fac; m.iterations = it; m.vertex_group = name
        bpy.ops.object.modifier_apply(modifier=name)
    def body_w(v):
        zf = v.co.z / H; w = sstep(0.02, 0.05, zf) * (1 - sstep(0.85, 0.87, zf))
        return w * (0.4 if abs(v.co.y) > 0.19 and zf < 0.5 else 1.0)
    smooth_pass("broad", 0.8, 14, body_w)
    def band(z, half): return lambda v: max(0.0, 1 - abs(v.co.z / H - z) / half)
    smooth_pass("ankle", 1.0, 30, band(float(os.environ.get("ANK", "0.115")), 0.045))
    smooth_pass("wrist", 1.0, 30, lambda v: band(float(os.environ.get("WRI", "0.535")), 0.05)(v) * sstep(0.15, 0.18, abs(v.co.y)))
    smooth_pass("neck", 0.9, 20, band(0.822, 0.03))
    def bust_w(v):
        d = min(math.hypot(v.co.y - sd * P["bust_y"], v.co.z - cz) for sd in (-1, 1)) / (P["bust_r"] * 1.3)
        return max(0.0, 1 - d) * sstep(-0.2, 0.3, v.normal.x)
    smooth_pass("bust", 0.9, 10, bust_w)
    smooth_pass("pit", 0.8, 12, lambda v: max(0.0, 1 - math.hypot(abs(v.co.y) - 0.17, v.co.z - 0.75 * H) / 0.09))
bpy.ops.object.shade_smooth()
# one clean slot, no baked suit texture: the game paints it
mat = bpy.data.materials.new("skin"); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0.70, 0.40, 0.12, 1); b.inputs["Roughness"].default_value = 0.15
me.materials.clear(); me.materials.append(mat)
# proof: front, side, 3/4
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 16; sc.render.resolution_x = 560; sc.render.resolution_y = 900
sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True; sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.35, 0.37, 1)
tag = os.environ.get("TAG", "after")
for name, ang in (("front", 0), ("q", 40), ("side", 90), ("back", 180)):
    a = math.radians(ang); pos = mathutils.Vector((3.6 * math.cos(a), 3.6 * math.sin(a), 0.9))
    cam = bpy.data.objects.new("c" + name, bpy.data.cameras.new("c" + name)); sc.collection.objects.link(cam)
    cam.location = pos; cam.rotation_euler = (mathutils.Vector((0, 0, 0.88)) - pos).to_track_quat("-Z", "Y").to_euler(); cam.data.lens = 50
    L = bpy.data.objects.new("l" + name, bpy.data.lights.new("l" + name, "AREA")); sc.collection.objects.link(L)
    L.data.energy = 300; L.data.size = 2; L.location = pos + mathutils.Vector((0, 0, 1.2)); L.rotation_euler = (mathutils.Vector((0, 0, 1)) - L.location).to_track_quat("-Z", "Y").to_euler()
    for o in sc.objects:
        if o.type == "LIGHT": o.hide_render = (o is not L)
    sc.camera = cam; sc.render.filepath = f"{PROOF}/{tag}_{name}.png"; bpy.ops.render.render(write_still=True)
if tag == "after":
    # face the gel skin's frame: front to Blender +Y (glTF -Z, the engine's default front), lateral on X
    me.transform(mathutils.Matrix.Rotation(math.radians(90), 4, "Z")); me.update()
    # phone budget: collapse to ~30k tris (smooth gel skin, silhouette kept), then re-smooth
    tris = sum(len(p.vertices) - 2 for p in me.polygons); TARGET = int(os.environ.get("TRIS", "30000"))
    if tris > TARGET:
        bpy.context.view_layer.objects.active = ob
        d = ob.modifiers.new("lod", "DECIMATE"); d.ratio = TARGET / tris; bpy.ops.object.modifier_apply(modifier="lod")
        for poly in me.polygons: poly.use_smooth = True
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=f"{OUT}/athletic-tripo-v2.glb", use_selection=True, export_apply=True)
print("TRIS", sum(len(p.vertices) - 2 for p in me.polygons))

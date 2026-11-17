# Athletic gel figure, build #2, v2: a fresh female body from Blender's MPFB human builder, dialed to the painted sheet
# (/cdn/value.adf45a7d…png): slim, in shape, full natural chest, long legs, smooth bald mannequin head. Faces +Y here, so
# the export's front is glTF -Z, the side gel-material.js treats as her front.
import bpy, math, sys
from mathutils import Vector, Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module="bl_ext.blender_org.mpfb")
from bl_ext.blender_org.mpfb.services import TargetService, HumanService
M = TargetService.get_default_macro_info_dict()
M.update({"gender": 0.0, "age": 0.5, "muscle": 0.5, "weight": 0.42, "proportions": 1.0, "height": 0.62,
          "cupsize": 0.76, "firmness": 1.0, "race": {"caucasian": 1.0, "asian": 0.0, "african": 0.0}})
body = HumanService.create_human(macro_detail_dict=M)
DATA = "/home/workshop/.config/blender/5.1/extensions/.user/blender_org/mpfb/data"
# no eye asset: the painting's eyes are smooth gel, and loose eyeballs show through see-through skin
# the painting's arms hang about 25 degrees off the body: lower the builder's wide A-pose on a temporary rig, then bake it
rig = HumanService.add_builtin_rig(body, "mixamo")
bpy.context.view_layer.update()
rig = rig or next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode="POSE")
for name in ("LeftArm", "RightArm"):
    pb = next((b for b in rig.pose.bones if b.name.endswith(name)), None)
    if not pb: print("NOBONE", name); continue
    head = rig.matrix_world @ pb.head; side = 1 if head.x > 0 else -1
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(20) * side, 4, "Y") @ Matrix.Translation(-head)
    pb.matrix = rig.matrix_world.inverted() @ R @ rig.matrix_world @ pb.matrix
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT"); bpy.context.view_layer.update()
# bake everything to plain meshes: shape keys and modifiers applied, helpers masked away
for o in list(bpy.context.scene.objects):
    if o.type != "MESH": continue
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    if o.data.shape_keys: o.shape_key_add(name="mix", from_mix=True); [o.shape_key_remove(k) for k in list(o.data.shape_keys.key_blocks)[:-1]]; o.shape_key_clear()
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    o.select_set(False)
# keep her rig: the lowered arms become its rest pose, so the baked body and the bones agree
bpy.ops.object.select_all(action="DESELECT"); bpy.context.view_layer.objects.active = rig; rig.select_set(True)
bpy.ops.object.mode_set(mode="POSE"); bpy.ops.pose.select_all(action="SELECT"); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode="OBJECT")
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in list(bpy.context.scene.objects):
    if o.type != "MESH" and o != rig: bpy.data.objects.remove(o, do_unlink=True)
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.data.transform(mw); o.matrix_world = Matrix(); o.data.materials.clear()
rmw = rig.matrix_world.copy(); rig.parent = None; rig.data.transform(rmw); rig.matrix_world = Matrix()
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
# scale to 1.70 m, feet on 0, centred, turned to face +Y
zs = [v.co.z for v in body.data.vertices]; s = 1.70 / (max(zs) - min(zs))
xs = [v.co.x for v in body.data.vertices]; ys = [v.co.y for v in body.data.vertices]
cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
MT = Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -min(zs)))
body.data.transform(MT); rig.data.transform(MT)
# a mannequin's finish, as painted: nipples and the groin smoothed away into plain form
def apex(cond):
    pts = [v for v in body.data.vertices if cond(v.co)]; return max(pts, key=lambda v: v.co.y).co.copy()
nl = apex(lambda c: 0.04 < c.x < 0.16 and 1.15 < c.z < 1.32); nr = apex(lambda c: -0.16 < c.x < -0.04 and 1.15 < c.z < 1.32)
cr = min((v.co for v in body.data.vertices if abs(v.co.x) < 0.01 and 0.7 < v.co.z < 0.95 and v.co.y > 0), key=lambda c: c.z).copy()
print("NIPPLES", tuple(round(a, 3) for a in nl), tuple(round(a, 3) for a in nr), "CROTCH", tuple(round(a, 3) for a in cr))
vg = body.vertex_groups.new(name="smooth")
for v in body.data.vertices:
    c = v.co; w = 0.0
    for n in (nl, nr): w = max(w, max(0.0, 1 - (c - n).length / 0.042))
    gc = Vector((0, cr.y, cr.z + 0.035)); d = Vector((c.x / 0.07, (c.y - gc.y) / 0.08, (c.z - gc.z) / 0.075)).length
    if c.y > cr.y - 0.06: w = max(w, max(0.0, 1 - d))
    if w > 0: vg.add([v.index], min(1.0, w * 1.6), "REPLACE")
sm = body.modifiers.new("sm", "SMOOTH"); sm.factor = 0.8; sm.iterations = 40; sm.vertex_group = "smooth"
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier="sm")
# the creator's side silhouette (/cdn/grok-image-1794692498724-u8eg08znm.webp): a straight slope from the collarbone down to a
# low apex, a full round lower pole, and a soft peak at the tip that points a little up, not a dome with its point smoothed off
NX, NY, NZ = abs(nl.x), nl.y, nl.z; TOP = 0.15
def prof(z0):
    pts = [v.co.y for v in body.data.vertices if abs(abs(v.co.x) - NX) < 0.025 and abs(v.co.z - z0) < 0.012 and v.normal.y > 0.2]
    return max(pts) if pts else None
ytop = prof(NZ + TOP); prof_z = {i: prof(NZ + TOP * i / 30) for i in range(31)}
print("PROFILE", NY, ytop, [prof_z[i] for i in range(0, 31, 5)])
for v in body.data.vertices:
    c = v.co
    if v.normal.y <= 0.2: continue
    lat = (abs(c.x) - NX) / 0.1; w = max(0.0, 1 - lat * lat) ** 2   # soft to the sides: the outer curve keeps its roundness
    t = (c.z - NZ) / TOP
    if 0 < t < 1 and w > 0:
        yc = prof_z[min(30, max(0, round(t * 30)))]
        if yc is not None:
            yl = NY + (ytop - NY) * t                       # the straight slope
            taper = math.sin(math.pi * t) ** 1.6            # eases in from the apex and out at the collarbone, no fold at either
            c.y += w * taper * (yl - yc) * 0.9
    r = Vector((abs(c.x) - NX, 0, c.z - (NZ + 0.006))).length   # the soft peak, a touch above the old apex
    if r < 0.05 and c.y > NY - 0.04: c.y += 0.00525 * math.exp(-(r / 0.012) ** 2)   # peaks 25% smaller, the creator's ask
# ease the slope's edges into the side of the chest so no ridge shows where it meets the ribs
import bmesh as _bm
bm = _bm.new(); bm.from_mesh(body.data); bm.normal_update()
edge = [v for v in bm.verts if v.normal.y > 0.1 and NZ - 0.03 < v.co.z < NZ + TOP + 0.02 and abs(abs(v.co.x) - NX) < 0.13
        and Vector((abs(v.co.x) - NX, 0, v.co.z - NZ)).length > 0.035]
for _ in range(14): _bm.ops.smooth_vert(bm, verts=edge, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(body.data); bm.free()
# smooth gel eyes, as painted: the empty socket pockets (eyes at z 1.59, x +-0.033, lids at y 0.02) pushed out flush into a soft dome
EZ, EX = 1.59, 0.033
for v in body.data.vertices:
    c = v.co; u = (abs(c.x) - EX) / 0.022; t = (c.z - EZ) / 0.016
    if u * u + t * t < 1 and -0.03 < c.y < 0.016: c.y = 0.019 + 0.004 * (1 - u * u - t * t)
import bmesh
bm = bmesh.new(); bm.from_mesh(body.data)
def _in(c, k): u = (abs(c.x) - EX) / 0.022; t = (c.z - EZ) / 0.016; return u * u + t * t < k and c.y > -0.03
ring = [v for v in bm.verts if _in(v.co, 1.6)]
for _ in range(25): bmesh.ops.smooth_vert(bm, verts=ring, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(body.data); bm.free()
# smooth gel skin: one subdivision, weld, smooth shading
sub = body.modifiers.new("sub", "SUBSURF"); sub.levels = 1; bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier="sub")
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.object.mode_set(mode="OBJECT")
dec = body.modifiers.new("dec", "DECIMATE"); dec.ratio = 0.62; bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new("gel"); mat.use_nodes = True; bs = mat.node_tree.nodes["Principled BSDF"]
bs.inputs["Base Color"].default_value = (0.78, 0.42, 0.08, 1); bs.inputs["Roughness"].default_value = 0.28
body.data.materials.append(mat); body.name = "athletic"
body.data.calc_loop_triangles(); zs = [v.co.z for v in body.data.vertices]
print("TRIS", len(body.data.loop_triangles), "HEIGHT", round(max(zs) - min(zs), 3))
# landmarks the gel skin reads (bust, seat, thigh, belly heights)
def front_at(z0, band=0.01):
    pts = [v.co for v in body.data.vertices if abs(v.co.z - z0) < band]; return max(p.y for p in pts) if pts else 0
best = max((front_at(z / 1000), z / 1000) for z in range(1100, 1400, 5)); print("BUST_Y", best[1])
# skin her to the rig: the builder's weights rode through the join, subdivision and decimate
body.vertex_groups.remove(body.vertex_groups["smooth"])
bones = {b.name for b in rig.data.bones}; print("BONES", len(bones), sorted(bones)[:8], "GROUPS", sum(g.name in bones for g in body.vertex_groups))
am = body.modifiers.new("rig", "ARMATURE"); am.object = rig; body.parent = rig
bpy.ops.object.select_all(action="DESELECT"); body.select_set(True); rig.select_set(True)
bpy.ops.export_scene.gltf(filepath="/workspace/athletic-gel-v2.glb", export_apply=True, export_materials="EXPORT", export_skins=True, export_animations=False)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 16; sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = 512, 768
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); cam.data.type = "ORTHO"; sc.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun); sun.data.energy = 3.2; sun.data.angle = 0.5
for name, ang, osc, cy in (("front", 0, 1.94, 0.855), ("tq", 35, 1.94, 0.855), ("side", -90, 1.94, 0.855), ("back", 180, 1.94, 0.855), ("head", 20, 0.5, 1.57), ("headside", -90, 0.5, 1.57), ("bust", 30, 0.8, 1.2), ("hand", 60, 0.5, 0.85)):
    cam.data.ortho_scale = osc
    a = math.radians(ang); p = Vector((-math.sin(a) * 4, math.cos(a) * 4, cy)); cam.location = p
    cam.rotation_euler = (Vector((0, 0, cy)) - p).to_track_quat("-Z", "Y").to_euler()
    lp = Vector((-math.sin(a - 0.6) * 4, math.cos(a - 0.6) * 4, 3.2)); sun.rotation_euler = (lp).to_track_quat("Z", "Y").to_euler()
    sc.render.filepath = f"/tmp/ag2/{name}.png"; bpy.ops.render.render(write_still=True)

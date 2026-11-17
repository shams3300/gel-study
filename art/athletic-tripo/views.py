# Four orthographic views of our reshaped gel figure (athletic-tripo-v2.glb) for a Tripo four-view pass.
import bpy, math, mathutils, os
OUT = "/tmp/views"; os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspace/tripo/athletic-tripo-v2.glb")
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
bpy.ops.object.shade_smooth()
m = bpy.data.materials.new("gel"); m.use_nodes = True
b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0.85, 0.82, 0.78, 1); b.inputs["Roughness"].default_value = 0.45
ob.data.materials.clear(); ob.data.materials.append(m)
zs = [(ob.matrix_world @ v.co).z for v in ob.data.vertices]; top = max(zs); mid = top / 2
print("HEIGHT", top - min(zs))
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 24
sc.render.resolution_x = 640; sc.render.resolution_y = 1024
sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1); sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.view_settings.view_transform = "Standard"
# front +Y; its left -X
for name, d in (("front", (0, 1)), ("back", (0, -1)), ("left", (-1, 0)), ("right", (1, 0))):
    pos = mathutils.Vector((d[0] * 6, d[1] * 6, mid))
    cam = bpy.data.objects.new(name, bpy.data.cameras.new(name)); sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"; cam.data.ortho_scale = (top - min(zs)) * 1.12
    cam.location = pos; cam.rotation_euler = (mathutils.Vector((0, 0, mid)) - pos).to_track_quat("-Z", "Y").to_euler()
    L = bpy.data.objects.new("L" + name, bpy.data.lights.new("L" + name, "AREA")); sc.collection.objects.link(L)
    L.data.energy = 500; L.data.size = 3; L.location = pos * 0.6 + mathutils.Vector((d[1] * 1.5, -d[0] * 1.5, 1.5))
    L.rotation_euler = (mathutils.Vector((0, 0, mid)) - L.location).to_track_quat("-Z", "Y").to_euler()
    for o in sc.objects:
        if o.type == "LIGHT": o.hide_render = o is not L
    sc.camera = cam; sc.render.filepath = f"{OUT}/{name}.png"; bpy.ops.render.render(write_still=True)

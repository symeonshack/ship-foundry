import bpy
import os

blend_path = r"assets/uploads_files_6077862_spacestation2.blend"
out_path = r"assets/space_station.glb"

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=blend_path)

obj = bpy.data.objects.get('Space station')
if not obj:
    raise RuntimeError('Space station object not found')

bpy.context.view_layer.objects.active = obj
for other in bpy.data.objects:
    other.select_set(False)
obj.select_set(True)

# Force the procedural geometry nodes to evaluate and bake into real mesh data.
for mod in obj.modifiers:
    if mod.type == 'NODES':
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name, report=True)

bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_apply=False,
    export_materials='EXPORT',
)

print('exported', os.path.exists(out_path))

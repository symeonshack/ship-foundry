import bpy
import bmesh
import os

blend_path = r"assets/uploads_files_6077862_spacestation2.blend"
out_path = r"assets/space_station.glb"

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=blend_path)

obj = bpy.data.objects.get('Space station')
if not obj:
    raise RuntimeError('Space station object not found')

# Make sure the object uses a mesh and rebuild it from the evaluated geometry.
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

for mod in obj.modifiers:
    if mod.type == 'NODES':
        bpy.context.view_layer.objects.active = obj
        # Make the modifier evaluate first.
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated_obj = obj.evaluated_get(depsgraph)
        mesh = evaluated_obj.to_mesh()
        if mesh:
            new_obj = bpy.data.objects.new(name='Space station baked', object_data=mesh)
            bpy.context.collection.objects.link(new_obj)
            bpy.context.view_layer.objects.active = new_obj
            new_obj.select_set(True)
            bpy.ops.object.convert(target='MESH')
            bpy.data.objects.remove(obj, do_unlink=True)
            obj = new_obj
            break

bpy.context.view_layer.objects.active = obj
obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_apply=False,
    export_materials='EXPORT',
)

print('exported', os.path.exists(out_path))

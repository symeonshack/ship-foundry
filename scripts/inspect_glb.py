import bpy

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"assets/space_station.glb")
obj = bpy.context.selected_objects[0] if bpy.context.selected_objects else None
print('imported', len(bpy.context.selected_objects))
if obj:
    print('name', obj.name)
    print('bounds', obj.dimensions)
    print('location', obj.location)
    print('rotation', obj.rotation_euler)

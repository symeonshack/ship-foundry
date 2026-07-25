import bpy

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r'assets/uploads_files_6077862_spacestation2.blend')
obj = bpy.data.objects.get('Space station')
print('before', len(obj.data.vertices), len(obj.data.polygons))
for other in bpy.data.objects:
    other.select_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.convert(target='MESH')
print('after convert', len(obj.data.vertices), len(obj.data.polygons))
print('object data', obj.data.name)

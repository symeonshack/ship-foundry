import bpy

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r'assets/uploads_files_6077862_spacestation2.blend')
obj = bpy.data.objects.get('Space station')
print('name', obj.name)
print('type', obj.type)
print('data', type(obj.data).__name__)
print('modifiers', [(m.name, m.type) for m in obj.modifiers])

depsgraph = bpy.context.evaluated_depsgraph_get()
eval_obj = obj.evaluated_get(depsgraph)
print('eval type', eval_obj.type)
mesh = eval_obj.to_mesh()
print('mesh created', mesh is not None)
if mesh:
    print('verts', len(mesh.vertices))
    print('edges', len(mesh.edges))
    print('polys', len(mesh.polygons))
    mesh_copy = mesh.copy()
    print('mesh_copy created', mesh_copy is not None)
    print('copy verts', len(mesh_copy.vertices))
    print('copy polys', len(mesh_copy.polygons))
    bpy.data.meshes.remove(mesh)

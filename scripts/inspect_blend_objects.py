import bpy

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r'assets/uploads_files_6077862_spacestation2.blend')

for i, obj in enumerate(bpy.data.objects):
    print(i, obj.name, 'type=', obj.type, 'data=', getattr(obj.data, 'name', None))
    if obj.type == 'MESH':
        print('  verts', len(obj.data.vertices), 'polys', len(obj.data.polygons))
        for mod in obj.modifiers:
            print('  mod', mod.name, mod.type)
            if mod.type == 'NODES' and mod.node_group:
                print('   node_group', mod.node_group.name)
                print('   nodes', [n.name for n in mod.node_group.nodes][:20])
    print('')

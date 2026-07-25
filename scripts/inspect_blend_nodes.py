import bpy

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"assets/uploads_files_6077862_spacestation2.blend")
print('objects', [o.name for o in bpy.data.objects])
for obj in bpy.data.objects:
    print(obj.name, 'type', obj.type, 'modifiers', [m.name for m in obj.modifiers])
    for mod in obj.modifiers:
        print('  modifier', mod.name, type(mod).__name__, getattr(mod, 'type', None))
        if hasattr(mod, 'node_group') and mod.node_group:
            print('  node_group', mod.node_group.name)
            print('  node_group nodes', [n.label or n.name for n in mod.node_group.nodes])
            for node in mod.node_group.nodes:
                if node.type == 'GROUP_INPUT':
                    print('   group input', [(i.name, i.identifier) for i in node.outputs])
                elif node.type == 'GROUP_OUTPUT':
                    print('   group output', [(i.name, i.identifier) for i in node.inputs])

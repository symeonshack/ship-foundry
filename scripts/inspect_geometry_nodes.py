import bpy

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r'assets/uploads_files_6077862_spacestation2.blend')
obj = bpy.data.objects.get('Space station')
mod = next((m for m in obj.modifiers if m.type == 'NODES'), None)
print('modifier', mod.name if mod else None)
if mod and mod.node_group:
    ng = mod.node_group
    print('group name', ng.name)
    print('inputs', [(i.name, i.identifier, i.type, i.default_value) for i in ng.inputs])
    print('outputs', [(o.name, o.identifier, o.type) for o in ng.outputs])
    print('nodes:')
    for node in ng.nodes:
        print('-', node.name, node.type, 'label=', node.label)
        print('  inputs:')
        for socket in node.inputs:
            print('   ', socket.name, 'type=', socket.type, 'links=', len(socket.links), 'default=', socket.default_value if hasattr(socket, 'default_value') else None)
        print('  outputs:')
        for socket in node.outputs:
            print('   ', socket.name, 'type=', socket.type, 'links=', len(socket.links), 'default=', socket.default_value if hasattr(socket, 'default_value') else None)
    print('group output node inputs:')
    for n in ng.nodes:
        if n.type == 'GROUP_OUTPUT':
            for s in n.inputs:
                print(' ', s.name, 'links=', len(s.links), 'default=', getattr(s, 'default_value', None))
                for l in s.links:
                    print('   link', l.from_node.name, l.from_socket.name, '->', l.to_node.name, l.to_socket.name)

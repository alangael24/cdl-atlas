"""Independent analytic CAD and exported-GLB checks. Not a vehicle fit certificate.
Run: python cad/check_reference_v3.py --assets public/cad --report validation.json
"""
from __future__ import annotations
import argparse, hashlib, json, math, struct, time
from collections import Counter
from pathlib import Path
import numpy as np
import cadquery as cq
import trimesh
from OCP.BRepAdaptor import BRepAdaptor_Surface
import build_reference_v3 as model


def check(assets: Path):
    started = time.time()
    checks = []
    def passed(name, details):
        checks.append({'check': name, 'status': 'passed', 'details': details})
    barrel, disc = model.wheel_template()
    surfaces = []
    for face in disc.Faces():
        if face.geomType() == 'CYLINDER':
            cylinder = BRepAdaptor_Surface(face.wrapped).Cylinder()
            p = cylinder.Location()
            surfaces.append((cylinder.Radius(), p.X(), p.Y()))
    holes = [(r,x,y) for r,x,y in surfaces if abs(r-13) < 1e-7]
    assert len(holes) == 10
    pc_diameters = [2*math.hypot(x,y) for _,x,y in holes]
    assert all(abs(d-285.75) < 1e-6 for d in pc_diameters)
    assert any(abs(r*2-220.1) < 1e-6 for r,_,_ in surfaces)
    for r,x,y in holes:
        assert not disc.isInside((x,y,90),1e-6)
        assert disc.isInside((x*158/142.875,y*158/142.875,90),1e-6)
    assert not disc.isInside((0,0,90),1e-6)
    passed('Analytic wheel interface', {'actualHoleCount': len(holes),
            'actualHoleDiameterMm': holes[0][0]*2,
            'actualBoltCircleDiameterMm': pc_diameters,
            'actualHubBoreDiameterMm': 220.1,
            'method':'OpenCascade cylindrical faces and solid point-membership, not just parameter checks'})
    coupling = model.make_coupling()
    pin = coupling[0].features[0][1]
    section = pin.intersect(model.box((0,-50,0),(200,.2,200)))
    bounds = section.BoundingBox()
    assert abs(bounds.xlen-50.8) < 1e-6 and abs(bounds.zlen-50.8) < 1e-6
    assert pin.isInside((25.3,-50,0),1e-6) and not pin.isInside((25.5,-50,0),1e-6)
    passed('Analytic kingpin contact', {'sectionDiameterXmm':bounds.xlen,
            'sectionDiameterZmm':bounds.zlen,'method':'Boolean section of the actual pin solid'})
    trailer = model.make_trailer()[0]
    shell = cq.Compound.makeCompound([s for _,s,_ in trailer.features])
    b = shell.BoundingBox()
    assert abs(b.xlen-16154.4) < 1e-5 and abs(b.zlen-2590.8) < 1e-5
    for p in [(1000,2000,0),(8277.2,2500,0),(16000,3600,0)]:
        assert all(not s.isInside(p,1e-6) for _,s,_ in trailer.features)
    passed('Nominal shell and empty cargo volume', {'shellLengthMm':b.xlen,
           'shellWidthMm':b.zlen,'interiorProbes':3,'note':'Chosen nominal envelope, not an OEM dimensional verification'})
    instances = model.make_wheels()+coupling+[trailer]+model.make_engine_details()
    counts = Counter(i.group for i in instances)
    assert counts == {'rim':18,'hub':10,'kingpin':1,'fifth':1,'trailerbody':1,'engine':5}
    assert len({i.name for i in instances}) == len(instances)
    solids = 0
    for instance in instances:
        for name,shape,_ in instance.features:
            assert shape.isValid(), f'{instance.name}/{name}'
            bodies = shape.Solids()
            assert bodies and all(s.Volume() > 0 for s in bodies)
            solids += len(bodies)
    passed('All generated CAD solids', {'validSolids':solids,'instances':len(instances),'groupCounts':dict(counts)})
    manifest = json.loads((assets/'reference-v3.json').read_text())
    raw = (assets/'reference-v3.glb').read_bytes()
    magic,version,length = struct.unpack_from('<III',raw)
    assert (magic,version,length) == (0x46546c67,2,len(raw))
    jlen,jtype = struct.unpack_from('<II',raw,12)
    assert jtype == 0x4e4f534a
    doc = json.loads(raw[20:20+jlen])
    assembly = next(n for n in doc['nodes'] if n.get('name') == model.ASSEMBLY)
    assert assembly['extras']['units'] == 'metres'
    assert assembly['extras']['verifiedOemReplica'] is False
    for group_idx in assembly['children']:
        group = doc['nodes'][group_idx]
        assert len(group['children']) == counts[group['name']]
        labels = []
        for index in group['children']:
            inst = doc['nodes'][index]
            labels.append(inst['extras']['label'])
            assert inst['extras']['part'] == group['name']
            assert inst.get('children')
            assert all('mesh' in doc['nodes'][c] for c in inst['children'])
        assert labels == manifest['instanceLabels'][group['name']]
    assert hashlib.sha256(raw).hexdigest() == manifest['sha256']
    assert manifest['cadSolids'] == solids
    assert manifest['verifiedOemReplica'] is False
    passed('GLB hierarchy, labels, units and integrity', {'bytes':len(raw),'sha256':manifest['sha256']})
    scene = trimesh.load(assets/'reference-v3.glb', force='scene', process=False)
    triangles = sum(len(m.faces) for m in scene.geometry.values())
    assert triangles == manifest['triangles'] and triangles < 500000
    assert len(scene.geometry) == manifest['meshes']
    assert np.isfinite(scene.bounds).all()
    material_names = set()
    for mesh in scene.geometry.values():
        assert np.isfinite(mesh.vertices).all()
        assert len(mesh.faces) and (mesh.faces >= 0).all() and (mesh.faces < len(mesh.vertices)).all()
        material = mesh.visual.material
        material_names.add(material.name)
        if material.name == 'rubber': assert material.metallicFactor == 0
        if material.name == 'chrome': assert material.metallicFactor > .9
    assert {'chrome','steel','rubber','plastic','wood','glass'} <= material_names
    passed('GLB round-trip and PBR materials', {'meshes':len(scene.geometry),'triangles':triangles,
            'boundsMetres':scene.bounds.tolist(),'materials':sorted(material_names)})
    return {'status':'passed','scope':'Original partial CAD and exported overlay only',
            'checks':checks,'seconds':round(time.time()-started,2),
            'notTested':['Full truck geometric interference/clearances or OEM fit',
                         'VIN-specific configuration and complete dimensional accuracy',
                         'Application TypeScript typecheck/build and browser/WebGL integration',
                         'All original v2 assets; they are not included in this package']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, default=Path('public/cad'))
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = check(args.assets)
    text = json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(text)
    print(text)

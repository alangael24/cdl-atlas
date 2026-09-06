"""Original reference-detail overlay for CDL Atlas (NOT a complete OEM replica).

CAD: millimetres, X longitudinal (front negative), Y up, Z vehicle left.
GLB: metres, same axes. Replaces rim/hub/kingpin/trailerbody; appends engine/fifth.
Published dimensions are isolated in SPECS. Other dimensions are estimates.
No downloaded third-party CAD, photographs, branding textures or font files.

python cad/build_reference_v3.py --out public/cad --step /path/reference-v3.step
Requires cadquery==2.8.0, trimesh==4.11.1, numpy.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict
import argparse, hashlib, json, math, struct, time
import cadquery as cq
import numpy as np
import trimesh as tm

REVISION = 'reference-v3'
ASSEMBLY = 'CDL_Cascadia_DD15_53ft'
MODES = {'rim': 'replace', 'hub': 'replace', 'kingpin': 'replace',
         'trailerbody': 'replace', 'engine': 'append', 'fifth': 'append'}
SPECS = {
    'wheelBeadSeatDiameterMm': 22.5 * 25.4,
    'wheelBeadSeatWidthMm': 8.25 * 25.4,
    'wheelBoltCircleMm': 285.75,
    'wheelBoltHoleDiameterMm': 26.0,
    'wheelBoltCount': 10,
    'wheelHubBoreMm': 220.1,
    'kingpinContactDiameterMm': 2 * 25.4,
    # Nominal chosen design envelope, NOT a measured complete trailer.
    'trailerShellLengthMm': 53 * 12 * 25.4,
    'trailerShellWidthMm': 102 * 25.4,
}
SOURCES = [
    {'id': 'dd15-gen5-operator', 'publisher': 'Detroit / DTNA',
     'url': 'https://dtnacontent-dtna.prd.freightliner.com/content/dam/public/dtna-servicelit/ddc/pdfs/OperatorsManual/DDPlatform/DDC-SVC-MAN-0217_2026.pdf',
     'locator': 'Section 4.03, printed pages 22-23, figures 3-4',
     'supports': 'Identity and general side/layout of DD15 Gen 5 components; no measured component geometry.'},
    {'id': 'alcoa-88067x', 'publisher': 'Alcoa Wheels / Howmet',
     'url': 'https://www.alcoawheels.com/north-america/en/products/88067x/',
     'locator': 'Specifications table',
     'supports': '22.5 x 8.25 in, 10 holes, 285.75 mm PCD, 26 mm bolt holes, 220.1 mm hub bore. Dish, vents, hub and installed offset NOT verified.'},
    {'id': 'holland-2in', 'publisher': 'SAF-HOLLAND',
     'url': 'https://safholland.com/us/en/products/category/2-king-pins',
     'supports': 'Nominal two-inch coupling class only. Other pin/profile/jaw dimensions NOT verified.'},
    {'id': 'cascadia-fourth-gen', 'publisher': 'Freightliner',
     'url': 'https://www.freightliner.com/trucks/cascadia/specifications/fourth-generation/',
     'supports': '126-inch BBC day cab and Detroit DD15 option families; no VIN-specific build.'},
    {'id': 'great-dane-champion', 'publisher': 'Great Dane',
     'url': 'https://greatdane.com/champion-dry-vans/',
     'supports': '53-foot dry-van product family. Width, floor level and structural spacing in this overlay are chosen nominal/estimated parameters, not a certified Champion build.'},
]
FINISH = {
    'chrome': ('#b7c0c5', .92, .22), 'steel': ('#879099', .8, .39),
    'cast': ('#323637', .55, .67), 'rubber': ('#202223', 0., .85),
    'plastic': ('#171d20', .05, .53), 'white': ('#d6d6d0', .35, .4),
    'brass': ('#ba9252', .78, .32), 'glass': ('#506f7d', .35, .18),
    'wood': ('#9b7952', 0., .78),
}

@dataclass
class Instance:
    group: str
    name: str
    origin: tuple[float, float, float]
    evidence: str
    features: list[tuple[str, cq.Shape, str]] = field(default_factory=list)
    def add(self, name: str, shape: cq.Shape, finish: str = 'steel') -> cq.Shape:
        if not shape.isValid() or not shape.Solids():
            raise ValueError(f'Invalid solid: {self.name}/{name}')
        self.features.append((name, shape, finish))
        return shape


def box(p, size, radius=0):
    w = cq.Workplane('XY').box(*size)
    if radius:
        w = w.edges().fillet(min(radius, min(size) * .45))
    return w.val().translate(p)


def cylinder(p, radius, length, axis='z'):
    direction = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis]
    start = tuple(p[i] - direction[i]*length/2 for i in range(3))
    return cq.Solid.makeCylinder(radius, length, start, direction)


def tube(a, b, radius):
    v = cq.Vector(*b).sub(cq.Vector(*a))
    return cq.Solid.makeCylinder(radius, v.Length, a, v.normalized())


def ring(p, radius, thickness, axis='z'):
    direction = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis]
    return cq.Solid.makeTorus(radius, thickness, p, direction)


def hose(points, radius):
    edge = cq.Edge.makeSpline([cq.Vector(*p) for p in points])
    wire = cq.Wire.makeCircle(radius, points[0], edge.tangentAt(0))
    return cq.Solid.sweep(wire, [], edge, isFrenet=True)


def turn(profile, axis='z'):
    s = cq.Workplane('XZ').polyline(profile).close().revolve(360, (0, 0), (0, 1)).val()
    if axis == 'y': s = s.rotate((0, 0, 0), (1, 0, 0), -90)
    if axis == 'x': s = s.rotate((0, 0, 0), (0, 1, 0), 90)
    return s


def bolt(inst, name, p, radius=8, axis='z', finish='steel'):
    washer = cylinder(p, radius*1.35, 3.2, axis)
    # Hexagon is real geometry, not a painted texture.
    hexagon = cq.Workplane('XY').polygon(6, radius*2).extrude(radius*.85, both=True).val()
    if axis == 'x': hexagon = hexagon.rotate((0, 0, 0), (0, 1, 0), 90)
    if axis == 'y': hexagon = hexagon.rotate((0, 0, 0), (1, 0, 0), -90)
    inst.add(name+'-washer', washer, finish)
    inst.add(name+'-head', hexagon.translate(p), finish)


def wheel_template():
    # Nominal bead-seat datum at +/- W/2. The intervening well/dish is estimated.
    r = SPECS['wheelBeadSeatDiameterMm']/2
    h = SPECS['wheelBeadSeatWidthMm']/2
    barrel = turn([(r,-h),(300,-h-11),(303,-h-7),(303,-h+2),(r+7,-h+7),
                   (r-5,-h+25),(270,-58),(265,-38),(265,38),(270,58),
                   (r-5,h-25),(r+7,h-7),(303,h-2),(303,h+7),(300,h+11),(r,h),
                   (r-9,h-6),(r-13,h-26),(257,38),(257,-38),(r-13,-h+26),(r-9,-h+6)])
    bore = SPECS['wheelHubBoreMm']/2
    # Installation offset kept representative for the existing chassis. It is not
    # claimed to reproduce the 88067x forged dish or offset.
    disc = turn([(bore,81),(164,81),(219,35),(266,30),(269,43),(225,49),(170,100),(bore,100)])
    cutters = []
    for n in range(10):
        a = n*math.tau/10
        x,y = (SPECS['wheelBoltCircleMm']/2*v for v in (math.cos(a),math.sin(a)))
        cutters.append(cylinder((x,y,90),13,100))
        # Real oval ventilation apertures, rotated around the hub.
        vent = cq.Workplane('XY').center(211,0).ellipse(34,27).extrude(180,both=True).val()
        cutters.append(vent.rotate((0,0,0),(0,0,1),n*36+18))
    disc = disc.cut(cq.Compound.makeCompound(cutters))
    assert disc.isValid()
    return barrel, disc


def make_wheels():
    result = []
    barrel, disc = wheel_template()
    for axle,x in enumerate([-4030, 0, 1310, 13434.4, 14764.4]):
        axle_name = 'Dirección' if axle==0 else f'Motriz {axle}' if axle<3 else f'Remolque {axle-2}'
        for side in [1,-1]:
            label = axle_name + (' izquierdo' if side==1 else ' derecho')
            for z in ([1060] if axle==0 else [1090,750]):
                inner = z==750
                # Preserve old chassis datums: orientation is documented as
                # representative, not a fit-certified paired wheel installation.
                inst = Instance('rim', label+(' interior' if inner else ' exterior'),
                                (x,560,side*z),'alcoa-88067x')
                def orient(s):
                    return s if side>0 else s.rotate((0,0,0),(0,1,0),180)
                inst.add('barrel-bead-seat', orient(barrel), 'chrome')
                inst.add('disc-bore-and-20-openings', orient(disc), 'chrome')
                for n in range(10):
                    a=n*math.tau/10; r=SPECS['wheelBoltCircleMm']/2
                    p=(r*math.cos(a),r*math.sin(a),side*113)
                    bolt(inst,f'lug-{n+1}',p,16,'z','chrome')
                stem = hose([(250,-28,side*75),(270,-45,side*118),(283,-55,side*137)],5.5)
                inst.add('valve-stem',stem,'brass')
                inst.add('valve-cap',cylinder((283,-55,side*141),7.5,14),'plastic')
                result.append(inst)
            # One hub per axle end, not one hub per tire of a dual pair.
            hub=Instance('hub',label+' · cubo',(x,560,side*(1060 if axle==0 else 1090)),
                         'representative-topology')
            s = turn([(0,110),(106,110),(108,123),(89,135),(77,183),(60,207),(0,207)])
            if side<0:s=s.rotate((0,0,0),(0,1,0),180)
            hub.add('hub-cap',s,'steel')
            for n in range(6):
                a=n*math.tau/6
                bolt(hub,f'cap-bolt-{n+1}',(91*math.cos(a),91*math.sin(a),side*129),7,'z')
            if axle==0 or axle>2:
                hub.add('oil-sight-window',cylinder((0,0,side*210),38,5),'glass')
                hub.add('rubber-fill-plug',cylinder((0,0,side*215),11,9),'rubber')
                hub.add('window-seal',ring((0,0,side*210),40,3),'rubber')
            result.append(hub)
    return result


def make_coupling():
    pin=Instance('kingpin','Perno rey · contacto nominal de 2 pulgadas',(760,1410,0),'holland-2in')
    r=SPECS['kingpinContactDiameterMm']/2
    pin.add('two-inch-contact-neck',turn([(0,-100),(36.5,-100),(36.5,-87),(r,-83),
        (r,-18),(36.5,-14),(36.5,0),(47,0),(47,11),(0,11)],'y'))
    pin.add('trailer-upper-coupler-plate',box((0,25.5,0),(1350,45,1450)))
    jaws=Instance('fifth','Cierre de quinta rueda · mordazas y palanca',(760,1410,0),
                  'representative-topology')
    # Two separated contact jaws: a small clearance is an illustration choice.
    for side in [-1,1]:
        s=box((0,-49,side*43),(125,32,68),4)
        s=s.cut(cylinder((0,-49,0),r+1.5,70,'y'))
        jaws.add('jaw-'+str(side),s,'cast')
        bolt(jaws,'jaw-pivot-'+str(side),(45,-48,side*67),10,'y')
    jaws.add('latch-crossbar',box((89,-48,0),(24,30,190)),'cast')
    jaws.add('release-rod',hose([(86,-48,63),(173,-48,145),(188,-48,730),(290,-48,810),(420,-48,738)],12))
    jaws.add('handle-grip',tube((315,-48,795),(402,-48,747),16),'rubber')
    return [pin,jaws]


def make_trailer():
    length,width = SPECS['trailerShellLengthMm'],SPECS['trailerShellWidthMm']
    front=200;rear=front+length;cx=(front+rear)/2;half=width/2
    # Keep original floor and roof datums so existing doors and lights still fit.
    floor=1580;roof=4115
    inst=Instance('trailerbody','Caja seca hueca · paneles, piso, postes y techo',(0,0,0),
                  'nominal-envelope-and-estimated-construction')
    inst.add('front-wall',box((front+16,(floor+roof)/2,0),(32,roof-floor,width)),'white')
    inst.add('roof-skin',box((cx,roof-1.5,0),(length,3,width)),'white')
    # Longitudinal hardwood boards with actual seams; thickness/spacing estimated.
    boards=16;board_width=(width-48)/boards
    for n in range(boards):
        inst.add(f'floor-board-{n+1}',box((cx,floor+17.5,-half+24+board_width*(n+.5)),
                (length-48,35,board_width-1.5)),'wood')
    for side in [-1,1]:
        inst.add(f'side-skin-{side}',box((cx,(floor+roof)/2,side*(half-1.5)),
                                      (length,roof-floor,3)),'white')
        for y in [floor+28,roof-28]:
            inst.add(f'rail-{side}-{y}',box((cx,y,side*(half-11)),(length,56,22)),'chrome')
        # Estimated construction spacing, not claimed as an OEM drawing.
        for n,x in enumerate(np.arange(front+60,rear-20,609.6)):
            inst.add(f'post-{side}-{n}',box((float(x),(floor+roof)/2,side*(half-26)),
                                         (35,roof-floor-90,28)),'steel')
            for y in [floor+83,roof-83]:
                inst.add(f'post-fastener-{side}-{n}-{y}',cylinder((float(x),y,side*(half-42)),4,5),'steel')
        inst.add(f'scuff-band-{side}',box((cx,floor+155,side*(half-34)),(length-80,240,4)),'steel')
        for n,x in enumerate(np.arange(front+35,rear-10,150)):
            for y in [floor+28,roof-28]:
                # Rivet heads sit inside the chosen nominal envelope.
                inst.add(f'rivet-{side}-{n}-{y}',cylinder((float(x),y,side*(half-1)),3,2),'steel')
    for n,x in enumerate(np.arange(front+60,rear-20,609.6)):
        inst.add(f'roof-bow-{n}',box((float(x),roof-36,0),(35,34,width-64)),'steel')
    for side in [-1,1]:
        inst.add(f'rear-jamb-{side}',box((rear-23,(floor+roof)/2,side*(half-23)),
                                      (46,roof-floor,46)),'chrome')
    inst.add('rear-header',box((rear-23,roof-30,0),(46,60,width)),'chrome')
    inst.add('rear-threshold',box((rear-30,floor+12,0),(60,24,width)),'steel')
    return [inst]


def make_engine_details():
    result=[]
    cooler=Instance('engine','DD15 · enfriador EGR y juntas',( -3950,1820,-408),'dd15-gen5-operator')
    cooler.add('cooler-body',box((0,0,0),(720,110,130),28))
    for n in range(18):
        cooler.add(f'cooler-rib-{n}',box((-326+n*38,0,0),(5,117,137),2),'steel')
    for x in [-371,371]:
        cooler.add('end-flange-'+str(x),box((x,0,0),(18,143,151),12))
        cooler.add('gasket-'+str(x),box((x-(11 if x<0 else -11),0,0),(2,126,142),7),'rubber')
        for y in [-49,49]:
            for z in [-53,53]:bolt(cooler,f'flange-{x}-{y}-{z}',(x,y,z),6,'x')
    cooler.add('outlet-elbow',hose([(-377,0,0),(-441,-7,0),(-468,-52,18),(-461,-95,36)],28))
    cooler.add('outlet-band',ring((-377,0,0),31,3,'x'),'chrome')
    for x in [-200,235]:
        cooler.add(f'bracket-{x}',box((x,-74,35),(65,38,34),5))
        bolt(cooler,f'mount-{x}',(x,-89,52),7,'z')
    result.append(cooler)

    valve=Instance('engine','DD15 · actuador y válvula EGR',(-3730,1654,-535),'dd15-gen5-operator')
    valve.add('valve-housing',cylinder((0,0,0),49,104,'x'),'cast')
    valve.add('actuator-drive',box((-4,66,-13),(91,82,93),13),'steel')
    valve.add('actuator-cover',box((-4,111,-13),(94,12,96),8),'plastic')
    valve.add('electrical-connector',box((45,81,-15),(38,34,37),4),'plastic')
    for x in [-52,52]:
        valve.add('flange-'+str(x),cylinder((x,0,0),63,9,'x'))
        for n in range(4):
            a=n*math.tau/4+math.pi/4
            bolt(valve,f'valve-{x}-{n}',(x,49*math.cos(a),49*math.sin(a)),6,'x')
    valve.add('egr-link-pipe',hose([(-57,0,0),(-116,9,0),(-163,66,51),(-173,133,94)],28))
    valve.add('actuator-harness',hose([(64,84,-14),(78,131,-16),(14,152,-12),(-75,158,18)],7),'plastic')
    result.append(valve)

    breather=Instance('engine','DD15 · separador de ventilación del cárter',(-3900,1070,-492),'dd15-gen5-operator')
    breather.add('separator-body',turn([(0,-87),(53,-87),(61,-68),(61,65),(49,83),(0,83)],'y'),'cast')
    for n in range(9):
        breather.add(f'cooling-fin-{n}',cylinder((0,-62+n*15,0),65,4,'y'))
    breather.add('upper-cover',cylinder((0,87,0),59,13,'y'),'steel')
    breather.add('cover-gasket',ring((0,81,0),56,2,'y'),'rubber')
    for n in range(6):
        a=n*math.tau/6
        bolt(breather,f'cover-bolt-{n}',(49*math.cos(a),98,49*math.sin(a)),5,'y')
    breather.add('inlet',hose([(0,102,0),(7,157,0),(46,203,30),(74,235,67)],16),'rubber')
    breather.add('oil-return',hose([(0,-92,0),(-11,-140,16),(-52,-157,70)],9),'rubber')
    for y in [-48,52]:
        breather.add(f'mount-{y}',box((0,y,66),(98,24,33),4))
        bolt(breather,f'mount-bolt-{y}',(35,y,85),6,'z')
    result.append(breather)

    doser=Instance('engine','DD15 · dosificador de combustible de escape',(-3450,1450,-574),'dd15-gen5-operator')
    doser.add('doser-block',box((0,0,0),(57,69,43),7),'steel')
    doser.add('injector',cylinder((0,-47,0),15,39,'y'),'brass')
    doser.add('electrical-plug',box((30,13,0),(31,29,25),4),'plastic')
    doser.add('supply-line',hose([(-28,12,0),(-70,24,-4),(-98,68,8),(-135,120,60)],4),'steel')
    for y in [-22,22]:bolt(doser,f'doser-mount-{y}',(0,y,-27),5,'z')
    result.append(doser)

    loom=Instance('engine','DD15 · arnés derecho y grapas',(-3980,1400,0),'estimated-routing')
    loom.add('right-side-loom',hose([(-480,382,-367),(-285,371,-379),(-52,375,-381),
                                   (215,364,-370),(488,312,-374),(537,70,-380)],9),'plastic')
    for n,x in enumerate([-370,-185,0,185,370]):
        loom.add(f'clip-{n}',box((x,376,-384),(22,25,23),3),'plastic')
        loom.add(f'branch-{n}',hose([(x,369,-379),(x+19,321,-406),(x+23,269,-414)],4),'plastic')
        loom.add(f'plug-{n}',box((x+23,253,-414),(27,32,22),4),'plastic')
    result.append(loom)
    return result


def rgba(hex_color):
    return [int(hex_color[i:i+2],16) for i in (1,3,5)]+[255]


def build(out: Path, step: Path | None = None):
    started=time.time()
    instances=make_wheels()+make_coupling()+make_trailer()+make_engine_details()
    out.mkdir(parents=True,exist_ok=True)
    scene=tm.Scene(base_frame='world')
    scene.graph.update(frame_to=ASSEMBLY,frame_from='world',matrix=np.eye(4))
    materials={n:tm.visual.material.PBRMaterial(name=n,baseColorFactor=rgba(v[0]),
                   metallicFactor=v[1],roughnessFactor=v[2],doubleSided=False)
               for n,v in FINISH.items()}
    cad=cq.Assembly(name=ASSEMBLY)
    cad_groups={g:cq.Assembly(name=g) for g in MODES}
    by_group=defaultdict(list);records=[];total_solids=0
    for group in MODES:
        scene.graph.update(frame_to=group,frame_from=ASSEMBLY,matrix=np.eye(4))
    for ordinal,inst in enumerate(instances):
        by_group[inst.group].append(inst.name)
        matrix=np.eye(4);matrix[:3,3]=np.asarray(inst.origin)/1000
        # Human-readable instance name remains the glTF node name.
        scene.graph.update(frame_to=inst.name,frame_from=inst.group,matrix=matrix)
        buckets=defaultdict(list)
        cad_inst=cq.Assembly(name=f'i_{ordinal:03}')
        for n,(name,shape,finish) in enumerate(inst.features):
            solids=len(shape.Solids());total_solids+=solids
            verts,faces=shape.tessellate(.6,.28)
            mesh=tm.Trimesh(vertices=np.asarray([v.toTuple() for v in verts])/1000,
                            faces=np.asarray(faces),process=False)
            if not np.isfinite(mesh.vertices).all() or not len(mesh.faces):
                raise ValueError(f'Bad tessellation: {inst.name}/{name}')
            buckets[finish].append(mesh)
            cad_inst.add(shape,name=f'f_{n:04}',color=cq.Color(*[c/255 for c in rgba(FINISH[finish][0])[:3]]))
        cad_groups[inst.group].add(cad_inst,loc=cq.Location(cq.Vector(*inst.origin)))
        count=0
        for finish,meshes in buckets.items():
            merged=tm.util.concatenate(meshes)
            merged.visual=tm.visual.TextureVisuals(material=materials[finish])
            merged.metadata={'part':inst.group,'revision':REVISION,'evidence':inst.evidence}
            scene.add_geometry(merged,node_name=f'{inst.name}__{finish}',geom_name=f'{ordinal}_{finish}',
                               parent_node_name=inst.name)
            count+=len(merged.faces)
        records.append({'group':inst.group,'name':inst.name,'originMm':inst.origin,
                        'evidence':inst.evidence,'features':len(inst.features),'triangles':count})
    for g in cad_groups.values():cad.add(g)
    raw=scene.export(file_type='glb')
    # Explicit extras are easier to validate than relying on importer heuristics.
    jlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jlen])
    for node in doc['nodes']:
        if node.get('name')==ASSEMBLY:
            node['extras']={'revision':REVISION,'units':'metres','verifiedOemReplica':False,
                            'role':'partial-replacement-overlay'}
        for rec in records:
            if node.get('name')==rec['name']:
                node['extras']={'label':rec['name'],'part':rec['group'],'evidence':rec['evidence']}
    j=json.dumps(doc,separators=(',',':'),ensure_ascii=True).encode();j+=b' '*((-len(j))%4)
    remainder=raw[20+jlen:]
    raw=struct.pack('<III',0x46546c67,2,20+len(j)+len(remainder))+struct.pack('<II',len(j),0x4e4f534a)+j+remainder
    glb=out/'reference-v3.glb';glb.write_bytes(raw)
    if step:
        step.parent.mkdir(parents=True,exist_ok=True)
        cad.export(str(step))
    report={'revision':REVISION,'verifiedOemReplica':False,'role':'partial-replacement-overlay',
            'units':'metres','cadUnits':'millimetres','axisConvention':'X longitudinal, Y up, Z left',
            'baseCommit':'45ab50fa58e32eb7c238bd6e81ae939e1cabcc9e',
            'requiresBaseAsset':'/cad/cascadia-dd15-v2.glb',
            'groupModes':MODES,'instanceLabels':dict(by_group),'specifications':SPECS,'sources':SOURCES,
            'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
            'cadSolids':total_solids,'instances':len(instances),'meshes':len(scene.geometry),
            'triangles':sum(len(m.faces) for m in scene.geometry.values()),'records':records,
            'limitations':['Not a complete truck asset; requires the original v2 assembly.',
                           'Not OEM CAD, not VIN-specific, not manufacturing-ready.',
                           'Only listed wheel-interface dimensions and nominal pin contact diameter are sourced dimensions.',
                           'Engine geometry, cable routes, hubs, wheel dish/offset and trailer construction details remain estimates.',
                           'Existing cabin, hood, tires, chassis, brakes and other unmodified components remain v2 estimates.',
                           'Whole-vehicle clearances, interference, physical fastener fit and browser integration are not certified.'],
            'buildSeconds':round(time.time()-started,2)}
    (out/'reference-v3.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return instances,scene,report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,default=Path('public/cad'))
    parser.add_argument('--step',type=Path)
    args=parser.parse_args()
    _,_,report=build(args.out,args.step)
    print(json.dumps({k:report[k] for k in ['cadSolids','instances','meshes','triangles','bytes','buildSeconds']},indent=2))

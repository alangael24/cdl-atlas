"""CDL Atlas editable solid CAD generator, CadQuery 2.8 / OpenCascade.

Reconstructs analytic CAD from dimensioned construction profiles, not mesh facets.
Input geometry.json lengths are metres; all generated CAD coordinates are mm.
CAD axes: X longitudinal (front negative), Y right, Z up; ground Z=0.
These are reference dimensions, not an OEM scan or a manufacturing drawing.

Run: python build_cad.py [--group engine] [--out PATH] [--no-step]
"""
from pathlib import Path
import argparse, collections, json, math, re, time, struct
import cadquery as cq

ROOT=Path(__file__).resolve().parent
MM=1000.0
Y=cq.Vector(0,1,0)
Z=cq.Vector(0,0,1)

def vec(p): return cq.Vector(*(v*MM for v in p))
def clean_points(points):
    result=[]
    for p in points:
        if not result or sum((a-b)**2 for a,b in zip(p,result[-1]))>1e-16: result.append(p)
    if len(result)>2 and sum((a-b)**2 for a,b in zip(result[0],result[-1]))<1e-16:result.pop()
    return result

def wire(points,curves=None):
    points=clean_points(points)
    # Circular sketch holes remain true analytic circles, not polygonal approximations.
    if curves and len(curves)==1 and curves[0]['type']=='EllipseCurve':
        c=curves[0]
        if abs(c['xRadius']-c['yRadius'])<1e-10:
            return cq.Wire.makeCircle(c['xRadius']*MM,(c['aX']*MM,c['aY']*MM,0),Z)
    # Circular profiles originally authored as point patterns become exact circles.
    if len(points)>=32:
        cx=sum(p[0] for p in points)/len(points);cy=sum(p[1] for p in points)/len(points)
        radii=[math.hypot(p[0]-cx,p[1]-cy) for p in points]
        if max(radii)-min(radii)<1e-7:return cq.Wire.makeCircle(sum(radii)/len(radii)*MM,(cx*MM,cy*MM,0),Z)
    if curves and all(c['type'] in ('LineCurve','EllipseCurve') for c in curves):
        edges=[]
        for c in curves:
            if c['type']=='LineCurve':
                a,b=c['v1'],c['v2']
                if math.dist(a,b)>1e-9:edges.append(cq.Edge.makeLine((a[0]*MM,a[1]*MM,0),(b[0]*MM,b[1]*MM,0)))
            else:
                # Three-point arcs preserve the exact circular sketch geometry and its direction.
                a=c['aStartAngle'];b=c['aEndAngle'];delta=b-a
                if c['aClockwise'] and delta>0:delta-=math.tau
                if not c['aClockwise'] and delta<0:delta+=math.tau
                def point(t):return cq.Vector((c['aX']+c['xRadius']*math.cos(t))*MM,(c['aY']+c['yRadius']*math.sin(t))*MM,0)
                edges.append(cq.Edge.makeThreePointArc(point(a),point(a+delta/2),point(a+delta)))
        return cq.Wire.assembleEdges(edges)
    return cq.Wire.makePolygon([cq.Vector(p[0]*MM,p[1]*MM,0) for p in points],close=True)

def primitive(f,notes):
    p=f['parameters'];t=f['type']
    if t in ('BoxGeometry','RoundedBoxGeometry'):
        w,h,d=[p[k]*MM for k in ('width','height','depth')]
        result=cq.Workplane('XY').box(w,h,d)
        if t=='RoundedBoxGeometry' and p.get('radius',0)>0:
            radius=min(p['radius']*MM,min(w,h,d)*.49)
            try:result=result.edges().fillet(radius)
            except Exception:notes.append({'feature':f['id'],'note':'Edge fillet omitted; base solid retained.'})
        return result.val()
    if t=='CylinderGeometry':
        r=p['radiusTop']*MM;h=p['height']*MM;angle=math.degrees(p.get('thetaLength',math.tau))
        if p.get('openEnded'):
            # Web-only zero-thickness brake lining surfaces become 10 mm thick CAD sectors.
            outer=cq.Solid.makeCylinder(r,h,(0,-h/2,0),Y,angle)
            inner=cq.Solid.makeCylinder(r-10,h+2,(0,-h/2-1,0),Y,angle)
            return outer.cut(inner).rotate((0,0,0),(0,1,0),math.degrees(p.get('thetaStart',0)))
        if p.get('radialSegments') in (4,6,8):
            s=cq.Workplane('XZ').polygon(p['radialSegments'],r*2).extrude(h/2,both=True).val()
            return s
        return cq.Solid.makeCylinder(r,h,(0,-h/2,0),Y,angle)
    if t=='SphereGeometry':return cq.Solid.makeSphere(p['radius']*MM,angleDegrees1=-90,angleDegrees2=90)
    if t=='LatheGeometry':
        points=clean_points(p['points'])
        return cq.Workplane('XY').polyline([(a*MM,b*MM) for a,b in points]).close().revolve(math.degrees(p.get('phiLength',math.tau)),(0,0),(0,1)).val()
    if t=='TorusGeometry':
        r=p['radius']*MM;tube=p['tube']*MM;arc=math.degrees(p.get('arc',math.tau))
        if abs(arc-360)<1e-5:return cq.Solid.makeTorus(r,tube)
        path=cq.Edge.makeCircle(r,(0,0,0),Z,0,arc)
        profile=cq.Wire.makeCircle(tube,(r,0,0),(0,1,0))
        return cq.Solid.sweep(profile,[],path,isFrenet=True)
    if t=='ExtrudeGeometry':
        shapes=[]
        for profile in p['profiles']:
            outer=wire(profile['outer'],profile.get('curves'))
            holes=[wire(h,profile.get('holeCurves',[None]*len(profile['holes']))[i]) for i,h in enumerate(profile['holes'])]
            shapes.append(cq.Solid.extrudeLinear(outer,holes,(0,0,p['depth']*MM)))
        return shapes[0] if len(shapes)==1 else cq.Compound.makeCompound(shapes)
    if t=='TubeGeometry':
        points=[vec(v) for v in clean_points(p['points'])]
        closed=math.dist(p['points'][0],p['points'][-1])<1e-10
        edge=cq.Edge.makeSpline(points,periodic=closed)
        profile=cq.Wire.makeCircle(p['radius']*MM,points[0],edge.tangentAt(0))
        s=cq.Solid.sweep(profile,[],edge,isFrenet=True)
        if not s.isValid():raise ValueError('Invalid swept solid')
        return s
    raise ValueError(t)

def placed(shape,f):
    m=f['transform']
    matrix=cq.Matrix([[m[0],m[4],m[8],m[12]*MM],[-m[2],-m[6],-m[10],-m[14]*MM],[m[1],m[5],m[9],m[13]*MM],[0,0,0,1]])
    try:return shape.transformShape(matrix)
    except Exception:return shape.transformGeometry(matrix)

def safe(s):return re.sub(r'[^a-zA-Z0-9_]+','_',s).strip('_')

def standardize_glb(path):
    """STEP stays in mm; glTF scene follows the format's metre convention."""
    path=Path(path);raw=path.read_bytes();chunks=[];offset=12
    while offset<len(raw):
        length,kind=struct.unpack_from('<II',raw,offset);offset+=8
        chunks.append((kind,raw[offset:offset+length]));offset+=length
    model=json.loads(chunks[0][1]);extras=model.setdefault('asset',{}).setdefault('extras',{})
    if extras.get('cad_units_converted_to_meters'):return
    for idx in {n for scene in model['scenes'] for n in scene.get('nodes',[])}:
        node=model['nodes'][idx]
        if 'matrix' in node:
            node['matrix']=[v*.001 if i<15 else v for i,v in enumerate(node['matrix'])]
        else:
            node['scale']=[v*.001 for v in node.get('scale',[1,1,1])]
            if 'translation' in node:node['translation']=[v*.001 for v in node['translation']]
    extras['cad_units_converted_to_meters']=True
    text=json.dumps(model,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
    chunks[0]=(chunks[0][0],text)
    body=b''.join(struct.pack('<II',len(data),kind)+data for kind,data in chunks)
    path.write_bytes(struct.pack('<III',0x46546c67,2,len(body)+12)+body)

def build(group=None,out=ROOT,no_step=False):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    data=json.loads((ROOT/'geometry.json').read_text())
    features=[f for f in data['features'] if not group or f['group']==group]
    cache={};instances=collections.OrderedDict();notes=[];errors=[];records=[]
    started=time.time()
    for idx,f in enumerate(features):
        key=json.dumps((f['type'],f['parameters']),sort_keys=True)
        try:
            if key not in cache:
                shape=primitive(f,notes)
                if not shape.isValid() or not shape.Solids() or shape.Volume()<=0:raise ValueError('Invalid or non-solid CAD primitive')
                cache[key]=shape
            shape=placed(cache[key],f)
            if not shape.isValid():raise ValueError('Invalid transformed shape')
            k=(f['group'],f['instance'],f['finish'])
            instances.setdefault(k,[]).append(shape)
            bb=shape.BoundingBox()
            records.append({'feature':f['id'],'group':f['group'],'instance':f['instance'],'solids':len(shape.Solids()),'bounds_mm':[bb.xmin,bb.ymin,bb.zmin,bb.xmax,bb.ymax,bb.zmax]})
        except Exception as e:
            errors.append({'feature':f['id'],'group':f['group'],'type':f['type'],'error':str(e)})
        if idx%500==0:print(json.dumps({'processed':idx,'total':len(features),'errors':len(errors),'seconds':round(time.time()-started)}),flush=True)
    report={'units':'mm','features_requested':len(features),'features_built':len(records),'unique_shapes':len(cache),'solid_count':sum(r['solids'] for r in records),'groups':sorted(set(r['group'] for r in records)),'errors':errors,'notes':notes,'features':records,'engineering_status':'Reference reconstruction. Component dimensions and installation are not OEM-verified. Overlapping detail bodies are retained as separate assembly solids.'}
    (out/'validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
    if errors:raise RuntimeError(f'{len(errors)} CAD features failed; see validation.json')
    assembly=cq.Assembly(name='CDL_Cascadia_DD15_53ft')
    groups={};instance_nodes={}
    color_lookup={(f['group'],f['instance'],f['finish']):f['color'] for f in features}
    group_shapes=collections.defaultdict(list)
    for (gid,label,finish),shapes in instances.items():
        if gid not in groups:groups[gid]=cq.Assembly(name=gid)
        ik=(gid,label)
        if ik not in instance_nodes:instance_nodes[ik]=cq.Assembly(name=safe(label))
        # Input RGB is linear; convert to sRGB for assembly color exchange.
        rgb=[12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055 for c in color_lookup[(gid,label,finish)]]
        compound=cq.Compound.makeCompound(shapes)
        instance_nodes[ik].add(compound,name=finish,color=cq.Color(*rgb))
        group_shapes[gid].extend(shapes)
    for (gid,label),node in instance_nodes.items():groups[gid].add(node)
    for node in groups.values():assembly.add(node)
    print('CAD validation passed. Exporting assembly...',flush=True)
    stem='CDL_Cascadia_DD15_53ft' if not group else group
    if not no_step:assembly.export(str(out/(stem+'.step')),unit='MM')
    assembly.export(str(out/(stem+'.glb')),tolerance=2,angularTolerance=.2)
    standardize_glb(out/(stem+'.glb'))
    # Native OpenCascade assembly document retains named hierarchy and appearance.
    assembly.export(str(out/(stem+'.xbf')))
    if not group:
        components=out/'components';components.mkdir(exist_ok=True)
        for gid in ('engine','fifth','kingpin','steering','alternator','compressor','waterpump','airbags','rim','slack','chamber'):
            if gid in groups:groups[gid].export(str(components/(gid+'.step')))
    bb=cq.Compound.makeCompound([s for a in instances.values() for s in a]).BoundingBox()
    report['assembly_bounds_mm']=[bb.xmin,bb.ymin,bb.zmin,bb.xmax,bb.ymax,bb.zmax]
    report['elapsed_seconds']=round(time.time()-started,2)
    (out/'validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
    print(json.dumps({k:report[k] for k in ('features_built','solid_count','unique_shapes','elapsed_seconds','assembly_bounds_mm')}),flush=True)
    return assembly

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--group');parser.add_argument('--out',default=str(ROOT));parser.add_argument('--no-step',action='store_true');args=parser.parse_args()
    assembly=build(args.group,Path(args.out),args.no_step)

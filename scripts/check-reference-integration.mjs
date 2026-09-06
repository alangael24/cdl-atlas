// Compile app/reference-revision.ts to work/reference-revision.mjs with esbuild
// (bundle, platform=node, packages=external, format=esm), then pass a decoded v2 GLB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadReferenceRevision,mergeReferenceScenes} from '../work/reference-revision.mjs';
import {parts} from '../app/data.ts';
import {frameBounds} from '../app/model-camera.ts';
import {disposeCadObject} from '../app/cad-model.ts';

const base=fs.readFileSync(process.argv[2]);
const revision=fs.readFileSync(process.argv[3]||'public/cad/reference-v3.glb');
async function parse(bytes){return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const progress=[];
const cad=await loadReferenceRevision({loadAsync:async(path,onProgress)=>{
 const bytes=path.includes('/reference-v3')?revision:base;
 onProgress({lengthComputable:true,loaded:bytes.length,total:bytes.length});
 return parse(bytes);
}},p=>progress.push(p));
assert.equal(Object.keys(cad.groups).length,57);
assert.equal(cad.groups.rim.children.length,18);
assert.equal(cad.groups.hub.children.length,10);
assert.equal(cad.groups.engine.children.length,7);
assert.equal(cad.groups.fifth.children.length,2);
assert.equal(progress.at(-1),100);
assert.equal(cad.root.userData.verifiedOemReplica,false);
let triangles=0,instances=0,frames=0;
for(const part of parts){
 const group=cad.groups[part.id];assert.ok(group,part.id);
 for(const inst of group.children){
  instances++;
  assert.equal(inst.userData.part,part.id);
  assert.ok(inst.userData.base instanceof T.Vector3);
  assert.ok(inst.userData.label.trim());
  const bounds=new T.Box3().setFromObject(inst);assert.ok(!bounds.isEmpty());
  for(const aspect of [.55,1.6]){
   const camera=new T.PerspectiveCamera(36,aspect,.001,200);
   frameBounds(camera,bounds,new T.Vector3(-.8,.45,1.4),1.25);
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const v=new T.Vector3(x,y,z).project(camera);
    assert.ok(Math.abs(v.x)<.94&&Math.abs(v.y)<.94&&v.z<1,`${part.id} camera fit`);
   }
   frames++;
  }
  inst.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.parent,inst);assert.equal(mesh.userData.part,part.id)}});
 }
}
cad.root.traverse(mesh=>{if(mesh.isMesh)triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3});
assert.ok(triangles<2200000,`Combined mesh budget: ${triangles}`);
for(const id of ['rim','hub','kingpin']){
 const inst=cad.groups[id].children[0],mesh=inst.children.find(c=>c.isMesh);
 const position=mesh.geometry.attributes.position;
 const point=new T.Vector3().fromBufferAttribute(position,0).applyMatrix4(mesh.matrixWorld);
 const direction=new T.Box3().setFromObject(inst).getCenter(new T.Vector3()).sub(point).normalize();
 const ray=new T.Raycaster(point.clone().addScaledVector(direction,-1),direction);
 assert.ok(ray.intersectObject(inst,true).some(hit=>hit.object.userData.part===id),`${id} picking`);
}
// Failed second download must reject rather than displaying the old truck.
await assert.rejects(loadReferenceRevision({loadAsync:async path=>{
 if(path.includes('/reference-v3'))throw new Error('overlay unavailable');return parse(base);
}}),/failed to load/);
const b=await parse(base),r=await parse(revision);
r.scene.getObjectByName('CDL_Cascadia_DD15_53ft').userData.units='millimetres';
assert.throws(()=>mergeReferenceScenes(b.scene,r.scene),/units/);
console.log({status:'passed',studyParts:parts.length,instances,triangles,frames,downloadFailure:'passed',invalidUnits:'passed'});
disposeCadObject(cad.root);

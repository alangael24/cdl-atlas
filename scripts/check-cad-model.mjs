import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildCadGroups,disposeCadObject} from '../app/cad-model.ts';
import {parts} from '../app/data.ts';
import {frameBounds} from '../app/model-camera.ts';
const raw=fs.readFileSync(process.argv[2]);
const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const {root,groups}=buildCadGroups(gltf.scene);root.updateMatrixWorld(true);
assert.equal(Object.keys(groups).length,57);
let meshCount=0,triangles=0,instances=0,fits=0;
for(const p of parts){
 assert.ok(groups[p.id]?.children.length,`${p.id} is present`);
 for(const inst of groups[p.id].children){
  instances++;
  assert.ok(inst.userData.base instanceof T.Vector3);
  const b=new T.Box3().setFromObject(inst);assert.ok(!b.isEmpty()&&b.min.toArray().every(Number.isFinite)&&b.max.toArray().every(Number.isFinite));
  inst.traverse(o=>{if(o.isMesh){assert.equal(o.userData.part,p.id);assert.equal(o.parent,inst);}});
 }
}
root.traverse(o=>{if(o.isMesh){meshCount++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
// CAD appearance must survive STEP -> glTF -> compression -> viewer import.
const finishes=new Map();
root.traverse(o=>{if(o.isMesh)finishes.set(o.material.name,o.material)});
assert.ok(finishes.get('rubber')?.metalness===0,'Rubber is not exported as a metal');
assert.ok(finishes.get('chrome')?.metalness>.9,'Machined metal retains its reflections');
assert.ok(finishes.get('rubber')?.roughness>finishes.get('chrome')?.roughness);
assert.ok(finishes.has('copper'),'Alternator windings survived CAD export and simplification');
assert.ok(triangles<2000000,`CAD web mesh budget: ${triangles}`);
const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());
assert.ok(size.x>21&&size.x<22&&size.y>4&&size.y<4.3&&size.z>3&&size.z<3.3,'CAD import keeps metres and Y-up');
for(const object of [root,...parts.map(p=>groups[p.id].children[0])])for(const aspect of [.7,1.3,2]){
 const camera=new T.PerspectiveCamera(36,aspect,.001,200),b=new T.Box3().setFromObject(object);
 frameBounds(camera,b,new T.Vector3(-.8,.45,1.4),1.25);
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(v.x)<.94&&Math.abs(v.y)<.94&&v.z<1);}
 fits++;
}
// Each axle end stays on its own side when the viewer applies an exploded offset.
assert.ok(groups.tire.children.some(i=>i.userData.base.z<0)&&groups.tire.children.some(i=>i.userData.base.z>0));
const tire=groups.tire.children[0],c=new T.Box3().setFromObject(tire).getCenter(new T.Vector3());
const ray=new T.Raycaster(c.clone().add(new T.Vector3(0,0,2)),new T.Vector3(0,0,-1));
assert.equal(ray.intersectObject(tire,true).length,0,'Native CAD tire retains its open bore');
console.log({cards:parts.length,groups:Object.keys(groups).length,instances,meshCount,triangles,fits,metres:size.toArray(),status:'passed'});
disposeCadObject(root);

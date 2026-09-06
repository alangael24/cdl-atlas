import assert from 'node:assert/strict';
import {makeTruck} from '../app/truck-model.ts';
import {frameBounds} from '../app/model-camera.ts';
import {parts} from '../app/data.ts';
import {allInspectionItems} from '../app/inspection-catalog.ts';
import * as T from 'three';
const {root,groups}=makeTruck();let draws=0,triangles=0;
assert.equal(allInspectionItems.length,102);
for(const item of allInspectionItems){
 if(item.kind==='part')assert.ok(item.assembly,item.id+' has a 3D reference');
 if(item.assembly)assert.ok(parts.some(p=>p.id===item.assembly),item.id+' maps to a study card');
}
assert.equal(new Set(parts.map(p=>p.id)).size,parts.length);
for(const p of parts){
 assert.ok(groups[p.id]?.children.length,p.id+' has physical instances');
 for(const inst of groups[p.id].children){
  const bounds=new T.Box3().setFromObject(inst);
  assert.ok(!bounds.isEmpty()&&bounds.min.toArray().every(Number.isFinite)&&bounds.max.toArray().every(Number.isFinite),p.id+' has finite geometry');
 }
}
root.traverse(o=>{if(o.isMesh){draws++;triangles+=o.geometry.attributes.position.count/3;}});
assert.ok(draws<650,'Detailed parts are batched to fewer than 650 draws');
assert.ok(triangles<900000,'Mobile geometry budget');
// The wheel aperture must remain open, not be filled by a cylinder cap.
const tire=groups.tire.children[0];root.updateMatrixWorld(true);
const center=new T.Vector3();tire.getWorldPosition(center);
let ray=new T.Raycaster(center.clone().add(new T.Vector3(0,0,2)),new T.Vector3(0,0,-1));
assert.equal(ray.intersectObject(tire,true).length,0,'Tire bead has an open bore');
ray=new T.Raycaster(center.clone().add(new T.Vector3(.45,0,2)),new T.Vector3(0,0,-1));
assert.ok(ray.intersectObject(tire,true).length>0,'Tire sidewall is pickable');
const chamber0=new T.Box3().setFromObject(groups.chamber.children[0]).getSize(new T.Vector3());
const chamber2=new T.Box3().setFromObject(groups.chamber.children[2]).getSize(new T.Vector3());
assert.ok(chamber2.x>chamber0.x*1.2,'Spring brake chamber differs from steer service chamber');
// Structural regression: rear axles use air bags; front leaf springs remain distinct.
assert.equal(groups.spring.children.length,2);
assert.equal(groups.airbags.children.length,8);
const trailerSize=new T.Box3().setFromObject(groups.trailerbody).getSize(new T.Vector3());
assert.ok(Math.abs(trailerSize.x-16.1544)<.001,'53-foot trailer body');
// The assembled apron contacts the fifth-wheel plate at an unobstructed bearing point.
const apronRay=new T.Raycaster(new T.Vector3(.66,1.42,.3),new T.Vector3(0,1,0));
const plateRay=new T.Raycaster(new T.Vector3(.66,1.42,.3),new T.Vector3(0,-1,0));
const bearing=plateRay.intersectObject(groups.fifth,true)[0];
// Start the apron ray below its underside, independently from the plate ray.
apronRay.ray.origin.y=1.405;
const lowerFace=apronRay.intersectObject(groups.kingpin,true)[0];
assert.ok(lowerFace&&bearing,'Both coupling bearing faces exist');
assert.ok(Math.abs(lowerFace.point.y-bearing.point.y)<.001,'No assembled coupling gap');
// Left-side liquid tanks must not occupy the same physical space.
const defBounds=new T.Box3().setFromObject(groups.def);
const fuelBounds=new T.Box3().setFromObject(groups.fuel.children[0]);
assert.ok(!defBounds.intersectsBox(fuelBounds),'DEF and diesel tanks do not overlap');
// Every close-up and full truck must fit at phone and desktop aspect ratios.
let fits=0;
for(const object of [root,...parts.map(p=>groups[p.id].children[0])])for(const aspect of [.7,1.3,2])for(const direction of [new T.Vector3(-.8,.45,1.4),new T.Vector3(0,.05,1),new T.Vector3(-1,.05,0)]){
 const camera=new T.PerspectiveCamera(36,aspect,.001,200),bounds=new T.Box3().setFromObject(object);
 frameBounds(camera,bounds,direction,1.25);
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const projected=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(projected.x)<.94&&Math.abs(projected.y)<.94&&projected.z<1,'Camera includes all corners');
 }
 fits++;
}
console.log(JSON.stringify({components:parts.length,instances:Object.values(groups).reduce((n,g)=>n+g.children.length,0),draws,triangles,cameraFramings:fits,status:'passed'}));

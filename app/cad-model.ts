import * as T from 'three';
import labels from './cad-labels.json' with {type:'json'};
const cadLabels:Record<string,string[]>=labels;

/** Build picking/isolation groups from the named, metre-scale CAD tessellation. */
export function buildCadGroups(source:T.Group){
 source.updateMatrixWorld(true);
 const assembly=source.getObjectByName('CDL_Cascadia_DD15_53ft');
 if(!assembly)throw new Error('Missing CAD assembly');
 const root=new T.Group(),groups:Record<string,T.Group>={};
 for(const sourceGroup of assembly.children){
  const id=sourceGroup.name;
  const group=new T.Group();group.name=id;groups[id]=group;root.add(group);
  const materialCopies=new Map<T.Material,T.Material>();
  for(const [index,sourceInstance] of sourceGroup.children.entries()){
   const center=new T.Box3().setFromObject(sourceInstance).getCenter(new T.Vector3());
   if(!center.toArray().every(Number.isFinite))throw new Error(`Invalid CAD instance: ${id}`);
   const instance=new T.Group();instance.name=sourceInstance.name;
   instance.position.copy(center);instance.userData={part:id,base:center.clone(),label:cadLabels[id]?.[index]||sourceInstance.name.replaceAll('_',' ')};
   group.add(instance);
   sourceInstance.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    if(Array.isArray(object.material))throw new Error('CAD material layout unsupported');
    if(!materialCopies.has(object.material))materialCopies.set(object.material,object.material.clone());
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld).translate(-center.x,-center.y,-center.z);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,materialCopies.get(object.material));
    mesh.castShadow=mesh.receiveShadow=true;mesh.userData.part=id;instance.add(mesh);
   });
   if(!instance.children.length)throw new Error(`Empty CAD instance: ${id}`);
  }
 }
 // Source resources are no longer needed after baking the assembly transforms.
 disposeCadObject(source);
 return {root,groups};
}
export function disposeCadObject(object:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 object.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

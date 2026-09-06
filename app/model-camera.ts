import * as T from 'three';
/** Fit the projected corners, rather than a sphere around a very long vehicle. */
export function frameBounds(camera:T.PerspectiveCamera,bounds:T.Box3,direction:T.Vector3,margin=1.22){
 const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 const outward=direction.clone().normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),outward).normalize(),up=new T.Vector3().crossVectors(outward,right).normalize();
 const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
 let distance=.25;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const v=new T.Vector3(x,y,z).sub(center);
  distance=Math.max(distance,v.dot(outward)+margin*Math.max(Math.abs(v.dot(right))/tanX,Math.abs(v.dot(up))/tanY));
 }
 camera.position.copy(center).addScaledVector(outward,distance);
 camera.near=Math.max(.001,distance/1000);camera.far=Math.max(100,distance*5);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 return {center,distance,radius:size.length()/2};
}

/** Button zoom shares the orbit target and limits with wheel and pinch controls. */
export function zoomCamera(camera:T.PerspectiveCamera,target:T.Vector3,steps:number,minDistance=.015,maxDistance=65){
 const offset=camera.position.clone().sub(target),distance=offset.length();
 if(!distance)return;
 const next=T.MathUtils.clamp(distance*Math.pow(.75,steps),minDistance,maxDistance);
 camera.position.copy(target).addScaledVector(offset,next/distance);
 camera.updateMatrixWorld(true);
 return next;
}

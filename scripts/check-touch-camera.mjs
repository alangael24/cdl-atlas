import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {configureTouchControls} from '../app/touch-controls.ts';
const document=new EventTarget();
const element=new EventTarget();
Object.assign(element,{style:{},clientWidth:390,clientHeight:700,ownerDocument:document,getRootNode:()=>document,setPointerCapture(){},releasePointerCapture(){}});
const camera=new PerspectiveCamera(36,390/700,.001,200);
const controls=new OrbitControls(camera,element);
configureTouchControls(controls);
controls.rotateSpeed=.2;controls.zoomSpeed=.6;
function pointer(type,id,x,y){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,pointerType:'touch',pageX:x,pageY:y,clientX:x,clientY:y,button:0});(type==='pointerdown'?element:document).dispatchEvent(e);}
function screen(point){camera.updateMatrixWorld();const p=point.clone().project(camera);return [(p.x+1)*195,(1-p.y)*350];}
// Isolate pan from the temporary pinch produced by sequential synthetic pointer events.
controls.enableZoom=false;
for(const distance of [.5,4,20]){
 camera.position.set(0,2,distance);controls.target.set(0,2,0);controls.update();
 const point=controls.target.clone(),before=screen(point),offset=camera.position.clone().sub(controls.target);
 pointer('pointerdown',1,100,300);pointer('pointerdown',2,200,300);
 pointer('pointermove',1,220,340);pointer('pointermove',2,320,340);
 const after=screen(point);
 assert.ok(Math.abs(after[0]-before[0]-120)<.001,'Two-finger pan tracks horizontal movement at every zoom');
 assert.ok(Math.abs(after[1]-before[1]-40)<.001,'Two-finger pan tracks vertical movement');
 assert.ok(camera.position.clone().sub(controls.target).distanceTo(offset)<1e-8,'Two fingers must not rotate');
 pointer('pointerup',2,320,340);pointer('pointerup',1,220,340);
 const stopped=camera.position.clone();for(let i=0;i<30;i++)controls.update();
 assert.ok(camera.position.distanceTo(stopped)<1e-8,'No drift after release');
 pointer('pointerdown',1,220,340);pointer('pointerdown',2,320,340);
 pointer('pointermove',1,100,300);pointer('pointermove',2,200,300);
 pointer('pointerup',2,200,300);pointer('pointerup',1,100,300);
 const restored=screen(point);assert.ok(Math.hypot(restored[0]-before[0],restored[1]-before[1])<.001,'Reverse pan restores the original view');
}
controls.enableZoom=true;
const distance=camera.position.distanceTo(controls.target);
pointer('pointerdown',1,120,300);pointer('pointerdown',2,220,300);
pointer('pointermove',1,90,300);pointer('pointermove',2,250,300);
assert.ok(camera.position.distanceTo(controls.target)<distance,'Spreading two fingers zooms in');
pointer('pointerup',2,250,300);
const direction=camera.position.clone().sub(controls.target).normalize(),target=controls.target.clone();
pointer('pointermove',1,130,330);pointer('pointerup',1,130,330);
assert.ok(camera.position.clone().sub(controls.target).normalize().distanceTo(direction)>.01,'One finger rotates after releasing second finger');
assert.ok(controls.target.distanceTo(target)<1e-8,'One-finger rotation does not pan');
const stopped=camera.position.clone();for(let i=0;i<30;i++)controls.update();
assert.ok(camera.position.distanceTo(stopped)<1e-8,'Rotation stops immediately on release');
assert.ok(camera.position.toArray().every(Number.isFinite),'Two-to-one finger transition stays valid');
controls.dispose();
console.log('Touch camera passed: direct tracking at 3 zoom levels, reverse drag, no drift, pinch zoom, one-finger rotation, finger transition.');

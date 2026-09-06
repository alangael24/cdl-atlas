'use client';
import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {disposeCadObject} from './cad-model';
import {loadReferenceRevision} from './reference-revision';
import {frameBounds,zoomCamera} from './model-camera';
import {parts} from './data';
import {PointerGesture} from './pointer-gesture';
import {configureTouchControls} from './touch-controls';
type Props={selected:string;zone:string;xray:boolean;exploded:boolean;isolated:boolean;view:string;reset:number;zoom:number;focus:number;instanceStep:number;engineHome:number;onInstance:(label:string,index:number,count:number)=>void;onSelect:(id:string)=>void};
export default function TruckView(props:Props){
 const host=useRef<HTMLDivElement>(null),api=useRef<{update:(p:Props)=>void}|null>(null),latest=useRef(props);
 latest.current=props;
 const [error,setError]=useState(false),[loading,setLoading]=useState(true),[loadProgress,setLoadProgress]=useState(0);
 useEffect(()=>{
  const el=host.current!;let renderer:T.WebGLRenderer,disposed=false;
  setError(false);setLoading(true);setLoadProgress(0);
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.setClearColor('#e8ebeb',0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Camión y componentes 3D detallados. Un dedo gira el camión; dos dedos mueven y pellizcan para acercar. Usa la lista para seleccionar piezas con teclado.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.005,200);
  const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.035);scene.environment=environment.texture;scene.environmentIntensity=.9;studio.dispose();pmrem.dispose();
  const controls=new OrbitControls(camera,renderer.domElement);configureTouchControls(controls);controls.enableZoom=true;controls.zoomToCursor=false;controls.zoomSpeed=.6;controls.rotateSpeed=.32;controls.minDistance=.015;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.95;
  scene.add(new T.HemisphereLight('#e8efff','#77736b',.75));
  const sun=new T.DirectionalLight('#fff8ef',2.5);sun.position.set(-9,16,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:.1,far:65});sun.shadow.bias=-.0002;sun.shadow.normalBias=.012;scene.add(sun);
  const fill=new T.DirectionalLight('#e5eeff',1.5);fill.position.set(9,7,-12);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.ShadowMaterial({opacity:.2}));ground.rotation.x=-Math.PI/2;ground.position.y=.001;ground.receiveShadow=true;scene.add(ground);
  const grid=new T.GridHelper(60,60,'#b7c2bd','#d0d8d1');grid.position.y=-.008;grid.material.transparent=true;grid.material.opacity=.24;scene.add(grid);
  const root=new T.Group(),groups:Record<string,T.Group>={};scene.add(root);
  let ready=false;
  const draco=new DRACOLoader().setDecoderPath('/cad/draco/').setWorkerLimit(2);
  const loader=new GLTFLoader().setDRACOLoader(draco);
  let dirty=60,lastSelected='',lastView='',lastReset=-1,lastFocus=0,lastZoom=0,lastStep=-1,lastIsolated=false,lastExploded=false,lastEngineHome=0,currentInstance=0,pendingPick:{id:string;index:number}|null=null;
  const defaultInstance:Record<string,number>={chamber:2,brakehose:2,slack:2,drum:2};
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),gesture=new PointerGesture();
  const pointerDown=(e:PointerEvent)=>{gesture.down(e.pointerId,e.clientX,e.clientY)};
  const pointerMove=(e:PointerEvent)=>{gesture.move(e.pointerId,e.clientX,e.clientY)};
  const pointerUp=(e:PointerEvent)=>{
   const tap=gesture.up(e.pointerId,e.clientX,e.clientY);if(e.button!==0||!tap)return;
   const r=el.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
   const pickable:T.Object3D[]=[];root.traverseVisible(o=>{if(o instanceof T.Mesh&&(o.material as T.Material).opacity>.2)pickable.push(o)});
   const hit=raycaster.intersectObjects(pickable,false)[0];if(hit&&parts.some(p=>p.id===hit.object.userData.part)){
    const id=hit.object.userData.part,inst=hit.object.parent!;pendingPick={id,index:groups[id].children.indexOf(inst)};
    latest.current.onSelect(id);if(latest.current.selected===id)update(latest.current);
   }
  };
  const pointerCancel=()=>{gesture.cancel()};
  renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('lostpointercapture',pointerCancel);renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerCancel);
  const directions:Record<string,V>={perspective:[-1,.52,1.25],left:[0,.08,1],front:[-1,.06,0],rear:[1,.08,0],top:[0,1,.001]};
  type V=[number,number,number];
  function fit(p:Props,focusPiece=p.isolated){
   if(!ready)return;
   root.updateMatrixWorld(true);
   const object=focusPiece?groups[p.selected]?.children[currentInstance]:root;if(!object)return;
   const bounds=new T.Box3().setFromObject(object);
   const direction=new T.Vector3(...(directions[p.view]||directions.perspective)).normalize();
   if(focusPiece&&p.view==='perspective')direction.set(-.8,.45,1.4).normalize();
   controls.update();
   const {center,distance}=frameBounds(camera,bounds,direction,focusPiece?1.7:1.2);
   controls.target.copy(center);controls.maxDistance=Math.max(15,distance*2);controls.minDistance=.015;controls.update();
  }
  function update(p:Props){
   if(!ready)return;
   if(p.selected!==lastSelected)currentInstance=Math.min(defaultInstance[p.selected]||0,(groups[p.selected]?.children.length||1)-1);
   if(p.instanceStep!==lastStep&&p.selected===lastSelected)currentInstance=(currentInstance+1)%groups[p.selected].children.length;
   const picked=pendingPick?.id===p.selected;
   if(pendingPick?.id===p.selected){currentInstance=Math.max(0,pendingPick.index);pendingPick=null;}
   const returnToEngine=p.engineHome!==lastEngineHome;
   if(returnToEngine)currentInstance=0;
   for(const [id,g] of Object.entries(groups)){
    const part=parts.find(v=>v.id===id),selected=id===p.selected,body=['body','hood','trailerbody'].includes(id);
    g.visible=!p.isolated||selected;g.position.set(0,0,0);
    let opacity=1;if(body&&p.xray)opacity=.045;if(p.zone!=='all'&&!body&&part?.zone!==p.zone&&id!=='engine')opacity=.14;if(selected)opacity=1;
    for(const [index,inst] of g.children.entries()){
     inst.visible=!p.isolated||index===currentInstance;
     inst.position.copy(inst.userData.base);
     if(p.exploded&&!p.isolated){
      if(['trailerbody','doors','reflectors','kingpin'].includes(id))inst.position.y+=2.5;
      if(['body','hood','mirrors','lights'].includes(id))inst.position.y+=3.4;
      if(['engine','oil','coolant','alternator'].includes(id)){inst.position.y+=.7;if(id==='alternator')inst.position.z+=.6;}
      if(['tire','rim','hub'].includes(id)){const sign=inst.userData.base.z>=0?1:-1;inst.position.z+=sign*(id==='tire'?1.25:id==='rim'?.75:1.7);}
      if(['chamber','slack','brakehose','drum'].includes(id))inst.position.z+=(inst.userData.base.z>=0?1:-1)*.45;
     }
    }
    g.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshStandardMaterial;if(m.userData.baseTransparent===undefined)m.userData.baseTransparent=m.transparent;m.transparent=opacity<1||m.userData.baseTransparent;m.opacity=opacity;m.depthWrite=opacity>.5&&!o.userData.keep;if(m.emissive){m.emissive.set(selected&&!p.isolated?'#75664a':'#000000');m.emissiveIntensity=selected&&!p.isolated?.075:0;}o.castShadow=opacity>.5;}});
   }
   ground.visible=grid.visible=!p.isolated;
   const selectionChanged=lastSelected!==''&&p.selected!==lastSelected;
   if(returnToEngine||picked||p.focus!==lastFocus||selectionChanged||p.instanceStep!==lastStep&&lastStep!==-1)fit(p,true);
   else if(p.view!==lastView||p.reset!==lastReset||p.isolated!==lastIsolated||p.exploded!==lastExploded)fit(p);
   if(p.zoom!==lastZoom){zoomCamera(camera,controls.target,p.zoom-lastZoom,controls.minDistance,controls.maxDistance);controls.update();}
   lastFocus=p.focus;lastZoom=p.zoom;lastEngineHome=p.engineHome;
   const inst=groups[p.selected]?.children[currentInstance];latest.current.onInstance(inst?.userData.label||p.selected,currentInstance,groups[p.selected]?.children.length||1);
   lastSelected=p.selected;lastView=p.view;lastReset=p.reset;lastIsolated=p.isolated;lastStep=p.instanceStep;lastExploded=p.exploded;dirty=15;
  }
  api.current={update};
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=10;};
  const observer=new ResizeObserver(resize);observer.observe(el);resize();update(latest.current);
  controls.addEventListener('change',()=>{dirty=5});let frame=0;
  function animate(){frame=requestAnimationFrame(animate);const distance=camera.position.distanceTo(controls.target);controls.rotateSpeed=T.MathUtils.lerp(.16,.32,T.MathUtils.smoothstep(distance,.4,12));const near=Math.max(.001,Math.min(.05,distance/1000));if(Math.abs(camera.near-near)>.0001){camera.near=near;camera.updateProjectionMatrix();}controls.update();if(dirty>0){renderer.render(scene,camera);dirty--;}}animate();
  loadReferenceRevision(loader,percent=>{
   if(!disposed)setLoadProgress(Math.min(99,percent));
  }).then(cad=>{
   if(disposed){disposeCadObject(cad.root);return;}
   for(const p of parts)if(!cad.groups[p.id]){
    disposeCadObject(cad.root);throw new Error(`Missing component ${p.id}`);
   }
   Object.assign(groups,cad.groups);root.add(...cad.root.children);
   ready=true;setLoading(false);resize();update(latest.current);
  }).catch(error=>{
   console.error('CAD reference revision load failed',error);
   if(!disposed){setLoading(false);setError(true);}
  }).finally(()=>{draco.dispose();});
  const lost=(e:Event)=>{e.preventDefault();setError(true)};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{disposed=true;draco.dispose();api.current=null;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('lostpointercapture',pointerCancel);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',pointerCancel);renderer.domElement.removeEventListener('webglcontextlost',lost);const mats=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});mats.forEach(m=>{for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose()});textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 useEffect(()=>{api.current?.update(props)},[props.selected,props.zone,props.xray,props.exploded,props.isolated,props.view,props.reset,props.instanceStep,props.zoom,props.focus,props.engineHome]);
 return <div ref={host} className="three-host">{loading&&!error&&<div className="cad-loading" role="status"><span className="cad-spinner"/><strong>Cargando el ensamblaje CAD</strong><span>{loadProgress<99?`${loadProgress}% · Preparando piezas y materiales`:'Preparando la vista 3D…'}</span></div>}{error&&<div className="viewer-error"><strong>No se pudo cargar el modelo CAD.</strong><p>Puedes estudiar las piezas con la lista. Recarga la página para volver a intentar.</p></div>}</div>;
}

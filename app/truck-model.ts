import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type V=[number,number,number];
type Finish='paint'|'white'|'chrome'|'steel'|'cast'|'rubber'|'red'|'brass'|'glass'|'amber'|'redlens'|'lens'|'plastic'|'fluid'|'blue'|'copper';
const FINISH:Record<Finish,T.MeshPhysicalMaterialParameters>={
 copper:{color:'#a96236',metalness:.8,roughness:.36},
 paint:{color:'#25404e',metalness:.55,roughness:.24,clearcoat:1,clearcoatRoughness:.16},
 white:{color:'#d6d6d0',metalness:.35,roughness:.4,clearcoat:.25},
 chrome:{color:'#b7c0c5',metalness:.92,roughness:.22},steel:{color:'#879099',metalness:.8,roughness:.39},
 cast:{color:'#323637',metalness:.55,roughness:.67},rubber:{color:'#202223',metalness:0,roughness:.85},
 red:{color:'#ae2722',metalness:.25,roughness:.44},brass:{color:'#ba9252',metalness:.78,roughness:.32},
 glass:{color:'#253c47',metalness:.6,roughness:.13,clearcoat:1},amber:{color:'#e19b28',roughness:.27,metalness:.2},
 redlens:{color:'#a31918',roughness:.23,metalness:.2},lens:{color:'#dce8ed',roughness:.16,metalness:.5},
 blue:{color:'#1664a9',roughness:.5,metalness:.05},plastic:{color:'#171d20',roughness:.53,metalness:.05},fluid:{color:'#b8b79c',roughness:.5,metalness:0},
};

/** Dimensions in metres. Original reference reconstruction, not OEM CAD. */
export function makeTruck(){
 const root=new T.Group();const groups:Record<string,T.Group>={};const active:Record<string,T.Group>={};
 const materials=new Map<string,T.MeshPhysicalMaterial>();
 const noise=new Uint8Array(64*64*4);let seed=811;
 for(let i=0;i<noise.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const v=120+(seed%110);noise[i]=noise[i+1]=noise[i+2]=v;noise[i+3]=255;}
 const grain=new T.DataTexture(noise,64,64,T.RGBAFormat);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(12,12);grain.needsUpdate=true;
 function group(id:string){if(!groups[id]){groups[id]=new T.Group();groups[id].name=id;root.add(groups[id]);}return groups[id];}
 function instance(id:string,name:string,pos:V=[0,0,0]){const g=new T.Group();g.name=name;g.position.set(...pos);g.userData.part=id;g.userData.label=name;g.userData.base=g.position.clone();group(id).add(g);active[id]=g;return g;}
 function mat(id:string,finish:Finish){const key=id+finish;if(!materials.has(key)){const m=new T.MeshPhysicalMaterial(FINISH[finish]);if(['cast','rubber','steel','red'].includes(finish)){m.bumpMap=grain;m.bumpScale=finish==='cast'?.0018:.0004;}m.userData.finish=finish;materials.set(key,m);}return materials.get(key)!;}
 function mesh(id:string,geo:T.BufferGeometry,pos:V,finish:Finish,rot?:V){if(!active[id])instance(id,id);const m=new T.Mesh(geo,mat(id,finish));m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;m.userData.part=id;active[id].add(m);return m;}
 function box(id:string,p:V,s:V,f:Finish='steel',r=.008){return mesh(id,(r<=.004?new T.BoxGeometry(...s):new RoundedBoxGeometry(...s,2,Math.min(r,...s.map(v=>v/3)))),p,f);}
 function cyl(id:string,p:V,r:number,length:number,f:Finish='steel',axis='y',segments=32){return mesh(id,new T.CylinderGeometry(r,r,length,segments),p,f,axis==='x'?[0,0,-Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:undefined);}
 function lathe(id:string,p:V,profile:number[][],f:Finish,axis='y',segments=48){return mesh(id,new T.LatheGeometry(profile.map(v=>new T.Vector2(v[0],v[1])),segments),p,f,axis==='x'?[0,0,-Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:undefined);}
 function ring(id:string,p:V,r:number,t:number,f:Finish='steel',axis='z',arc=Math.PI*2){return mesh(id,new T.TorusGeometry(r,t,8,Math.max(16,Math.round(64*arc/(2*Math.PI))),arc),p,f,axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:undefined);}
 function rod(id:string,a:V,b:V,r:number,f:Finish='steel',segments=12){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),m=mesh(id,new T.CylinderGeometry(r,r,v.length(),segments),new T.Vector3(...a).addScaledVector(v,.5).toArray() as V,f);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;}
 function hose(id:string,pts:V[],r:number,f:Finish='rubber'){const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));return mesh(id,new T.TubeGeometry(curve,Math.max(20,pts.length*5),r,8,false),[0,0,0],f);}
 function bolt(id:string,p:V,r=.015,axis='z',f:Finish='steel'){cyl(id,p,r*1.28,.008,f,axis,24);const m=cyl(id,p,r,.025,f,axis,6);return m;}
 function plate(id:string,points:number[][],p:V,depth:number,f:Finish,holes:{x:number;y:number;r:number}[]=[],rot?:V){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();for(const h of holes){const hole=new T.Path();hole.absarc(h.x,h.y,h.r,0,Math.PI*2,true);shape.holes.push(hole);}return mesh(id,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.004,bevelThickness:.003,curveSegments:16}),p,f,rot);}
 function decal(id:string,text:string,p:V,size:[number,number],rot:V=[0,0,0],color='#bac0c3',bg='transparent'){
  if(typeof document==='undefined')return;
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;
  if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}ctx.fillStyle=color;ctx.font='bold 76px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,128,990);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  const m=mesh(id,new T.PlaneGeometry(...size),p,'steel',rot);m.material=new T.MeshPhysicalMaterial({map:texture,transparent:true,roughness:.65,metalness:.05,polygonOffset:true,polygonOffsetFactor:-1,depthWrite:false});m.userData.keep=true;
 }
 // 22.5-inch wheel: open tire carcass, profiled bead, recessed alloy disc and lug hardware.
 function wheel(x:number,z:number,steer:boolean,label:string){
  instance('tire',label,[x,.56,z]);
  lathe('tire',[0,0,0],[[.285,-.142],[.34,-.165],[.45,-.176],[.506,-.155],[.54,-.125],[.55,-.095],[.55,.095],[.54,.125],[.506,.155],[.45,.176],[.34,.165],[.285,.142],[.285,-.142]],'rubber','z',96);
  for(const zz of [-.165,.165]){ring('tire',[0,0,zz],.333,.004,'rubber');ring('tire',[0,0,zz*.98],.485,.003,'rubber');}
  // Tread blocks separated by longitudinal drainage grooves and transverse sipes.
  for(let row=0;row<5;row++)for(let n=0;n<56;n++){
   const a=(n+(row%2)*.5)*Math.PI/28,zr=(row-2)*.052;
   const b=box('tire',[Math.cos(a)*.552,Math.sin(a)*.552,zr],[.055,.011,.044],'rubber',.002);b.rotation.z=a-Math.PI/2;
  }
  const out=z>0?1:-1;
  decal('tire',steer?'295 / 75 R22.5   STEER':'295 / 75 R22.5',[0,.408,out*.171],[.48,.085],out>0?[0,0,0]:[0,Math.PI,0],'#53585b');
  instance('rim',label,[x,.56,z]);
  lathe('rim',[0,0,0],[[.272,-.155],[.285,-.16],[.298,-.15],[.298,-.125],[.277,-.112],[.265,-.075],[.265,.075],[.277,.112],[.298,.125],[.298,.15],[.285,.16],[.272,.155],[.258,.115],[.254,-.115],[.272,-.155]],'chrome','z',64);
  const outline:number[][]=[];for(let n=0;n<64;n++){const a=n*Math.PI/32;outline.push([Math.cos(a)*.266,Math.sin(a)*.266]);}
  const holes=[{x:0,y:0,r:.101}];for(let n=0;n<10;n++){const a=n*Math.PI/5;holes.push({x:Math.cos(a)*.209,y:Math.sin(a)*.209,r:.037});}
  plate('rim',outline,[0,0,out*.094],.015,'chrome',holes);
  for(let n=0;n<10;n++){const a=n*Math.PI/5;bolt('rim',[Math.cos(a)*.142,Math.sin(a)*.142,out*.127],.022,'z','chrome');}
  rod('rim',[.244,-.026,out*.13],[.272,-.055,out*.172],.008,'brass');cyl('rim',[.272,-.055,out*.175],.01,.02,'plastic','z');
  instance('hub',label,[x,.56,z]);
  lathe('hub',[0,0,.13],[[0,-.015],[.112,-.015],[.115,.01],[.082,.034],[.078,.079],[.06,.098],[0,.098]],'steel','z');
  if(out<0)active.hub.rotation.y=Math.PI;
  for(let n=0;n<6;n++){const a=n*Math.PI/3;bolt('hub',[Math.cos(a)*.089,Math.sin(a)*.089,.033],.008);}
  if(steer){cyl('hub',[0,0,.234],.041,.009,'glass','z');cyl('hub',[0,0,.241],.011,.01,'rubber','z');}
 }
 function suspension(x:number,z:number,label:string){
  instance('spring',label,[x,0,z]);
  for(let n=0;n<6;n++){
   const len=1.53-n*.13;const points:V[]=[];for(let j=0;j<=14;j++){const u=(j/14-.5)*len;points.push([u,.85+n*.014+u*u*.23,0]);}
   // Flat curved steel leaves rather than cylindrical rods.
   for(let j=0;j<points.length-1;j++){const a=points[j],b=points[j+1],dx=b[0]-a[0],dy=b[1]-a[1];const m=box('spring',[(a[0]+b[0])/2,(a[1]+b[1])/2,0],[Math.hypot(dx,dy)+.002,.012,.092],'cast',.002);m.rotation.z=Math.atan2(dy,dx);}
  }
  for(const xx of [-.755,.755]){ring('spring',[xx,.987,0],.039,.017,'cast');rod('spring',[xx,.987,-.087],[xx,.987,.087],.016);for(const side of [-1,1]){plate('spring',[[-.07,0],[.07,0],[.07,-.13],[-.04,-.16],[-.07,-.1]],[xx,1.12,side*.079],.016,'cast');bolt('spring',[xx,.988,side*.096],.025);}}
  for(const xx of [-.12,.12]){hose('spring',[[xx,.98,-.073],[xx,1.01,-.073],[xx,1.02,0],[xx,1.01,.073],[xx,.68,.073]],.012,'steel');rod('spring',[xx,.98,-.073],[xx,.68,-.073],.012);for(const zz of [-.073,.073])bolt('spring',[xx,.7,zz],.02,'y');}
  box('spring',[0,.7,0],[.36,.035,.23],'cast');
  instance('shock',label,[x+.37,.86,z+.055]);
  const s=active.shock;s.rotation.z=-.24;
  lathe('shock',[0,0,0],[[0,-.18],[.045,-.18],[.045,.09],[.05,.09],[.05,.115],[.036,.12],[.036,.14],[.014,.14],[.014,.33],[0,.33]],'steel');
  for(const y of [-.21,.36]){ring('shock',[0,y,0],.036,.013,'cast');cyl('shock',[0,y,0],.022,.075,'rubber','z');bolt('shock',[0,y,.05],.021);}
 }
 function airSuspension(x:number,z:number,label:string){
  instance('airbags',label,[x+.39,.91,z]);
  lathe('airbags',[0,0,0],[[0,-.14],[.135,-.14],[.157,-.12],[.171,-.06],[.17,.055],[.149,.12],[.132,.14],[0,.14]],'rubber','y',40);
  for(const y of [-.146,.146])cyl('airbags',[0,y,0],.143,.023,'steel');
  cyl('airbags',[0,.179,0],.015,.044,'brass');
  hose('airbags',[[0,.197,0],[.045,.23,0],[.16,.235,-z*.22]],.008);
  for(const zz of [-.09,.09])bolt('airbags',[0,.166,zz],.015,'y');
  instance('torquerod',label,[x,0,z]);
  plate('torquerod',[[-.56,.88],[-.54,.98],[.56,.8],[.58,.65],[.04,.59],[-.15,.67]], [0,0,-.072],.144,'cast');
  for(const xx of [-.51,.4]){cyl('torquerod',[xx,xx<0?.92:.75,0],.052,.19,'rubber','z');bolt('torquerod',[xx,xx<0?.92:.75,.105],.027);}
  rod('torquerod',[-.55,1.02,0],[.14,.79,-z*.4],.027,'steel');
  instance('shock',label,[x-.2,.86,z+.055]);
  lathe('shock',[0,0,0],[[0,-.18],[.037,-.18],[.037,.08],[.012,.08],[.012,.29],[0,.29]],'steel');
  for(const y of [-.21,.32]){ring('shock',[0,y,0],.027,.013,'cast');cyl('shock',[0,y,0],.016,.07,'rubber','z');}
 }
 function brakes(x:number,z:number,springBrake:boolean,label:string){
  // The service chamber axis and pushrod align with the clevis at the slack arm tip.
  const side=z>0?1:-1;
  instance('chamber',label,[x+.34,.87,z]);
  lathe('chamber',[0,0,0],[[0,-.12],[.085,-.12],[.128,-.1],[.151,-.065],[.158,-.025],[.16,.035],[.151,.085],[.12,.11],[.08,.12],[0,.12]],'cast','x');
  ring('chamber',[0,0,0],.16,.009,'steel','x');
  for(const yy of [-.16,.16]){box('chamber',[0,yy,0],[.035,.042,.048],'cast');bolt('chamber',[0,yy,.038],.014);}
  if(springBrake){lathe('chamber',[.2,0,0],[[0,-.1],[.115,-.1],[.149,-.075],[.153,.095],[.144,.14],[.095,.17],[0,.175]],'steel','x');ring('chamber',[.115,0,0],.152,.011,'chrome','x');cyl('chamber',[.385,0,0],.028,.014,'rubber','x');}
  rod('chamber',[-.3,0,0],[-.115,0,0],.012,'steel');
  for(const zz of [-.027,.027])box('chamber',[-.325,0,zz],[.09,.052,.018],'steel');
  for(const zz of [-.087,.087]){rod('chamber',[-.115,0,zz],[-.2,0,zz],.013);bolt('chamber',[-.18,0,zz],.024,'x');}
  box('chamber',[-.18,0,0],[.032,.29,.24],'cast');
  for(const xx of springBrake?[.065,.18]:[.065]){cyl('chamber',[xx,.12,side*.075],.027,.054,'steel','y',6);cyl('chamber',[xx,.153,side*.075],.015,.013,'brass');}
  decal('chamber',springBrake?'SPRING BRAKE   30 / 30':'SERVICE BRAKE',[.12,0,side*.155],[.23,.065],side>0?[0,0,0]:[0,Math.PI,0]);
  instance('slack',label,[x,.56,z]);
  rod('slack',[.04,.31,0],[.19,.31,0],.012,'steel');
  // Forged fork with visible cross-pin, not a disconnected rectangular bar.
  for(const zz of [-.027,.027])box('slack',[.015,.31,zz],[.09,.052,.018],'steel');
  rod('slack',[-.012,.31,-.05],[-.012,.31,.05],.012,'steel');
  ring('slack',[-.012,.31,.05],.02,.004,'steel');
  const shape=[[-.105,-.048],[-.12,.025],[-.092,.101],[-.063,.147],[-.046,.317],[.033,.338],[.065,.29],[.061,.161],[.11,.068],[.106,-.055],[.04,-.098],[-.049,-.096]];
  plate('slack',shape,[0,0,-.036],.072,'cast',[{x:0,y:0,r:.048},{x:0,y:.303,r:.013}]);
  ring('slack',[0,0,.041],.066,.011,'steel');ring('slack',[0,0,-.044],.066,.01,'steel');
  for(let n=0;n<6;n++){const a=n*Math.PI/3;bolt('slack',[Math.cos(a)*.089,Math.sin(a)*.089,.044],.007);}
  for(let n=0;n<20;n++){const a=n*Math.PI/10;box('slack',[Math.cos(a)*.049,Math.sin(a)*.049,0],[.006,.006,.065],'steel',.001);}
  cyl('slack',[.1,.04,0],.025,.058,'steel','x',6);
  rod('slack',[0,0,0],[0,0,side*.18],.037,'steel');
  instance('drum',label,[x,.56,z+side*.19]);
  lathe('drum',[0,0,0],[[.16,-.12],[.245,-.12],[.257,-.098],[.26,.125],[.244,.14],[.23,.14],[.23,-.09],[.16,-.09],[.16,-.12]],'cast','z',64);
  ring('drum',[0,0,.115],.259,.006,'steel');
  // Curved shoes and friction lining are visible through the open inboard side.
  for(const a of [.17,Math.PI+.17]){const shoe=mesh('drum',new T.TorusGeometry(.214,.016,6,36,Math.PI-.34),[0,0,-.009],'steel');shoe.rotation.z=a;const lining=mesh('drum',new T.CylinderGeometry(.232,.232,.17,40,1,true,a,Math.PI-.34),[0,0,0],'rubber',[Math.PI/2,0,0]);lining.material.side=T.DoubleSide;}
  instance('brakehose',label,[x,.56,z]);
  const pts:V[]=[[.405,.463,side*.075],[.49,.58,side*.08],[.57,.62,-side*.07],[.71,.55,-side*.17],[.79,.63,-side*.21]];
  hose('brakehose',pts,.017,'rubber');
  for(const p of [pts[0],pts[pts.length-1]]){cyl('brakehose',p,.025,.04,'brass','y',6);ring('brakehose',p,.019,.004,'chrome','y');}
  if(springBrake)hose('brakehose',[[.52,.463,side*.075],[.62,.51,side*.12],[.83,.53,0],[.91,.62,-side*.23]],.017);
 }
 // Channel frame rails, gussets, crossmembers and real axle spacing.
 instance('frame','Largueros del tractor');
 for(const z of [-.47,.47]){box('frame',[-1.47,1.055,z],[6.7,.26,.018],'cast');for(const y of [.924,1.186])box('frame',[-1.47,y,z],[6.7,.018,.1],'cast');}
 for(const x of [-4.4,-3.05,-1.95,-.55,.72,1.72]){box('frame',[x,1.052,0],[.14,.2,.91],'cast');for(const z of [-.49,.49])for(const y of [.99,1.12])bolt('frame',[x,y,z],.016);}
 const axleXs=[-4.03,0,1.31,13.4344,14.7644];
 for(const [i,x] of axleXs.entries()){
  instance('frame',`Eje ${i+1}`,[x,.56,0]);rod('frame',[0,0,-1.13],[0,0,1.13],i===0?.055:.085,'cast');
  if(i>0&&i<3){const d=mesh('frame',new T.SphereGeometry(.22,24,16),[0,0,0],'cast');d.scale.set(1,.86,1);lathe('frame',[-.23,0,0],[[.055,0],[.1,.08],[.15,.18]],'cast','x');}
  for(const side of [1,-1]){
   const label=`${i===0?'Eje de dirección':i<3?'Eje motriz '+i:'Eje de remolque '+(i-2)} · ${side===1?'lado izquierdo':'lado derecho'}`;
   if(i===0)wheel(x,side*1.06,true,label);else for(const zz of [1.09,.75])wheel(x,side*zz,false,label+(zz===1.09?' exterior':' interior'));
   if(i===0)suspension(x,side*.48,label);else airSuspension(x,side*.48,label);brakes(x,side*.59,i>0,label);
  }
 }
 instance('frame','Árbol de transmisión');rod('frame',[-2.1,.73,0],[1.31,.56,0],.062,'steel');for(const x of [-2.05,-.12,1.16]){cyl('frame',[x,.63,0],.096,.09,'cast','x');bolt('frame',[x,.74,0],.015,'y');}
 // Detroit DD15 Gen 5 visual reconstruction from the manufacturer's left-side profile.
 // Silver cast block, black composite cover, front sump, ribbed intake and rigid fuel pipes.
 // Photo-derived shapes and positions remain estimates, not production tolerances.
 instance('engine','DD15 · bloque y culata',[-3.98,1.4,0]);
 box('engine',[0,0,0],[1.24,.65,.59],'steel',.065);
 box('engine',[0,.39,0],[1.31,.18,.64],'steel',.027);
 box('engine',[0,.535,0],[1.32,.14,.57],'plastic',.024);
 box('engine',[-.08,.614,0],[.5,.03,.39],'plastic');
 box('engine',[-.02,-.374,0],[1.32,.075,.63],'plastic');
 box('engine',[-.37,-.535,0],[.58,.27,.58],'plastic',.045);
 for(let n=0;n<10;n++)box('engine',[-.635+n*.058,-.535,0],[.009,.19,.594],'plastic',.002);
 for(let n=0;n<6;n++){
  const x=-.51+n*.205;
  for(const z of [-.32,.32]){
   cyl('engine',[x,.02,z],.069,.021,'steel','z');ring('engine',[x,.02,z*1.035],.066,.007,'steel');
   box('engine',[x,-.14,z],[.024,.28,.034],'steel');bolt('engine',[x,.362,z],.014);
   for(const y of [-.29,.26])bolt('engine',[x,y,z],.012);
  }
  for(const z of [-.23,.23])bolt('engine',[x,.606,z],.012,'y');
 }
 decal('engine','DETROIT  DD15',[.04,.534,.291],[.48,.073],[0,0,0],'#dedfda');
 // Ribbed composite charge-air manifold on the left side; silver fuel rail above it.
 box('engine',[-.29,.205,.397],[.72,.19,.17],'plastic',.043);
 for(let n=0;n<10;n++)box('engine',[-.61+n*.069,.205,.408],[.018,.214,.19],'plastic',.007);
 hose('engine',[[-.57,.26,.39],[-.71,.32,.42],[-.73,.4,.35],[-.64,.46,.33]],.057,'steel');
 rod('engine',[-.52,.37,.359],[.58,.37,.359],.022,'steel');
 for(let n=0;n<6;n++){
  const x=-.51+n*.205;
  hose('engine',[[x,.37,.359],[x+.03,.435,.38],[x+.065,.435,.335],[x+.07,.407,.327]],.007,'steel');
  cyl('engine',[x,.37,.381],.016,.021,'steel','z',6);
  hose('engine',[[x,.23,-.31],[x,.12,-.41],[x,.03,-.43]],.03,'cast');
 }
 rod('engine',[-.52,.03,-.43],[.54,.03,-.43],.061,'cast');
 // Turbocharger compressor volute on the exhaust side, with connected charge piping.
 const volute:V[]=[];for(let n=0;n<=30;n++){const a=n/30*Math.PI*1.8;volute.push([.18+Math.cos(a)*.135,.15+Math.sin(a)*.135,-.49]);}
 hose('engine',volute,.061,'steel');cyl('engine',[.18,.15,-.54],.107,.07,'steel','z');
 lathe('engine',[.18,.15,-.595],[[.049,-.024],[.071,-.024],[.071,.024],[.049,.024],[.049,-.024]],'steel','z');
 hose('engine',[[.23,.025,-.48],[.53,-.12,-.51],[.75,-.2,-.52]],.068,'cast');
 hose('engine',[[-.44,-.23,.385],[-.48,-.33,.47],[-.43,-.52,.45]],.017);
 box('engine',[.06,-.19,.334],[.23,.32,.065],'steel',.022);
 for(const x of [-.05,.17])for(const y of [-.33,-.05])bolt('engine',[x,y,.376],.008);
 // Tall cartridge housings, caps and cast filter manifold (DD15 profile reference).
 for(const [x,y,r] of [[.1,.05,.078],[.44,.04,.074]]){
  lathe('engine',[x,y,.411],[[0,-.14],[r,-.14],[r,.11],[r*.92,.17],[0,.17]],'steel');
  lathe('engine',[x,y+.2,.411],[[0,-.03],[r*1.04,-.03],[r*1.04,0],[r*.66,.024],[0,.024]],'plastic');
  for(const yy of [-.095,.09])ring('engine',[x,y+yy,.411],r+.002,.005,'steel','y');
 }
 hose('engine',[[.18,.05,.43],[.24,.13,.49],[.35,.13,.49],[.42,.08,.43]],.014);
 // Cast rear flywheel bell housing, starter and fasteners.
 lathe('engine',[.71,-.015,0],[[.18,-.09],[.34,-.08],[.37,-.03],[.37,.055],[.28,.1],[.18,.1]],'steel','x');
 for(let n=0;n<12;n++){const a=n*Math.PI/6;bolt('engine',[.8,Math.cos(a)*.33,Math.sin(a)*.33],.013,'x');}
 cyl('engine',[.43,-.225,-.365],.085,.27,'cast','x');
 instance('engine','Radiador',[-4.74,1.63,0]);box('engine',[0,0,0],[.085,.91,1.03],'cast');
 for(let n=0;n<34;n++)box('engine',[-.046,-.42+n*.025,0],[.014,.009,.97],'steel',.002);
 for(const z of [-.54,.54])box('engine',[0,0,z],[.12,1.0,.065],'plastic');
 ring('engine',[.102,0,0],.405,.027,'plastic','x');cyl('engine',[.125,0,0],.075,.06,'plastic','x');
 for(let n=0;n<8;n++){const a=n*Math.PI/4;const blade=box('engine',[.11,Math.cos(a)*.245,Math.sin(a)*.245],[.045,.29,.115],'plastic',.012);blade.rotation.x=a;blade.rotation.z=.2;}
 instance('oil','Varilla y tubo de llenado',[-4.12,1.18,.45]);
 hose('oil',[[0,-.28,0],[.04,-.09,.025],[.03,.21,.14],[0,.58,.18]],.012,'steel');
 ring('oil',[0,.65,.18],.05,.015,'amber');rod('oil',[0,.59,.18],[0,.615,.18],.013,'amber');
 hose('oil',[[-.45,-.18,.07],[-.48,.14,.08],[-.49,.4,.08]],.038,'plastic');cyl('oil',[-.49,.42,.08],.053,.035,'amber');
 instance('coolant','Depósito de expansión',[-4.49,2.26,-.4]);
 lathe('coolant',[0,0,0],[[0,-.16],[.11,-.16],[.17,-.12],[.17,.1],[.13,.16],[.052,.18],[.052,.22],[0,.22]],'fluid');
 ring('coolant',[0,-.03,0],.171,.006,'plastic','y');cyl('coolant',[0,.235,0],.067,.036,'plastic', 'y');
 for(let n=0;n<12;n++){const a=n*Math.PI/6;box('coolant',[Math.cos(a)*.065,.235,Math.sin(a)*.065],[.018,.026,.01],'plastic',.002);}
 for(const y of [-.1,.075])box('coolant',[.1,y,.143],[.075,.006,.004],'plastic',.001);
 decal('coolant','MAX  /  MIN',[0,0,.172],[.2,.055],[0,0,0],'#4a4e48');
 hose('coolant',[[0,-.14,0],[-.04,-.38,.02],[-.09,-.71,.15],[-.1,-.88,.35]],.035,'rubber');
 hose('coolant',[[.13,-.05,0],[.23,-.09,0],[.58,-.26,.06],[.66,-.58,.06]],.021,'rubber');
 for(const y of [-.19,-.27])ring('coolant',[0,y,0],.036,.004,'chrome','y');
 // Vented aluminium alternator housing with stator, through-bolts, pulley and mounting ears.
 instance('alternator','Alternador',[-4.24,1.62,.52]);
 lathe('alternator',[0,0,0],[[.051,-.135],[.109,-.135],[.133,-.11],[.143,-.082],[.125,-.082],[.104,-.117],[.051,-.117],[.051,-.135]],'steel','x');
  lathe('alternator',[0,0,0],[[.125,.077],[.143,.077],[.134,.108],[.095,.132],[.041,.132],[.041,.116],[.09,.116],[.12,.094],[.125,.077]],'steel','x');
 cyl('alternator',[0,0,0],.122,.13,'cast','x');
 for(let n=0;n<18;n++){const a=n*Math.PI/9;rod('alternator',[-.102,Math.cos(a)*.139,Math.sin(a)*.139],[.101,Math.cos(a)*.139,Math.sin(a)*.139],.007,'chrome',6);}
 for(const xx of [-.14,.133]){
  ring('alternator',[xx,0,0],.127,.009,'chrome','x');ring('alternator',[xx,0,0],.06,.009,'chrome','x');
  for(let n=0;n<12;n++){const a=n*Math.PI/6;rod('alternator',[xx,Math.cos(a)*.063,Math.sin(a)*.063],[xx,Math.cos(a)*.119,Math.sin(a)*.119],.008,'steel',6);}
 }
 for(const a of [.5,2.59,4.68]){const y=Math.cos(a)*.15,z=Math.sin(a)*.15;rod('alternator',[-.155,y,z],[.14,y,z],.011,'steel');bolt('alternator',[-.16,y,z],.016,'x');}
 for(const p of [[0,-.17,0],[.06,.15,.045]] as V[]){box('alternator',p,[.13,.095,.069],'steel');cyl('alternator',[p[0],p[1]-.018,p[2]],.018,.084,'cast','z');}
 cyl('alternator',[-.193,0,0],.078,.078,'cast','x');
 for(let n=0;n<6;n++)ring('alternator',[-.225+n*.012,0,0],.079,.0025,'steel','x');bolt('alternator',[-.239,0,0],.023,'x');
 cyl('alternator',[.15,.045,0],.016,.06,'brass','x');hose('alternator',[[.18,.045,0],[.23,.055,.09],[.31,.14,.12],[.35,.17,.05]],.009,'red');
 // Belt belongs to engine context, so isolated alternator exposes its pulley clearly.
 instance('belts','Correa y poleas',[-4.44,1.42,.43]);
 cyl('belts',[0,-.16,-.27],.145,.06,'cast','x');cyl('belts',[0,.17,-.12],.083,.06,'steel','x');
 const belt:V[]=[[0,.268,.09],[0,.23,.159],[0,.17,.17],[0,-.2,-.13],[0,-.3,-.27],[0,-.27,-.38],[0,-.16,-.415],[0,.2,-.19],[0,.268,.09]];hose('belts',belt,.012,'rubber');
 // Each steering component has a separate selection group; joints remain in assembly position.
 instance('steering','Caja de dirección',[-3.77,1.13,.58]);
 box('steering',[0,0,0],[.25,.29,.2],'cast',.028);cyl('steering',[0,-.08,.13],.082,.06,'steel','z');
 for(const x of [-.092,.092])for(const y of [-.095,.095])bolt('steering',[x,y,.116],.016);
 instance('pitman','Brazo Pitman',[-3.77,1.13,.58]);
 plate('pitman',[[-.057,.025],[.051,.025],[.035,-.25],[-.052,-.285],[-.078,-.24]],[0,-.08,.16],.035,'cast',[{x:-.01,y:-.23,r:.018}]);
 bolt('pitman',[0,-.08,.208],.042);
 instance('draglink','Barra de arrastre',[-3.77,1.13,.58]);
 rod('draglink',[-.01,-.31,.18],[-.31,-.32,.33],.024,'steel');
 for(const p of [[-.01,-.31,.18],[-.31,-.32,.33]] as V[]){mesh('draglink',new T.SphereGeometry(.039,16,12),p,'cast');bolt('draglink',[p[0],p[1]+.036,p[2]],.024,'y');}
 instance('tierod','Barra transversal',[-4.01,.68,0]);
 rod('tierod',[0,0,-.9],[0,0,.9],.024,'steel');
 for(const z of [-.9,.9]){cyl('tierod',[0,0,z],.041,.074,'cast');bolt('tierod',[0,.049,z],.021,'y');ring('tierod',[0,0,z*.92],.025,.005,'steel');}
 instance('steeringshaft','Eje y juntas universales',[-3.77,1.13,.58]);
 rod('steeringshaft',[.03,.15,-.02],[.45,.8,-.03],.026,'steel');
 for(const p of [[.04,.17,-.02],[.38,.68,-.03]] as V[]){cyl('steeringshaft',p,.038,.055,'cast','x');rod('steeringshaft',[p[0],p[1]-.043,p[2]],[p[0],p[1]+.043,p[2]],.014,'chrome');}
 instance('steeringhoses','Líneas hidráulicas',[-3.77,1.13,.58]);
 hose('steeringhoses',[[.09,.1,-.09],[.22,.33,-.14],[.3,.44,-.24],[.36,.55,-.29]],.014,'rubber');
 hose('steeringhoses',[[.09,-.03,-.09],[.28,.14,-.21],[.35,.52,-.3],[.28,.7,-.22]],.018,'rubber');
 for(const side of [-1,1]){
  instance('knuckle',side>0?'Mangueta izquierda':'Mangueta derecha',[-4.03,.56,side*.86]);
  plate('knuckle',[[-.09,-.2],[.1,-.2],[.135,-.11],[.135,.12],[.07,.21],[-.09,.2],[-.13,.1],[-.13,-.11]],[0,0,-.035],.07,'cast');
  cyl('knuckle',[0,0,0],.037,.44,'steel');for(const y of [-.22,.22])bolt('knuckle',[0,y,0],.029,'y');
  instance('spindle',side>0?'Espiga izquierda':'Espiga derecha',[-4.03,.56,side*.86]);
  lathe('spindle',[0,0,.1],[[0,-.08],[.077,-.08],[.077,-.05],[.063,-.05],[.063,.03],[.05,.04],[.05,.15],[.04,.17],[0,.17]],'steel','z');
  if(side<0)active.spindle.rotation.y=Math.PI;
  instance('steeringarm',side>0?'Brazo de dirección izquierdo':'Brazo de dirección derecho',[-4.03,.56,side*.86]);
  plate('steeringarm',[[-.04,0],[.055,0],[.11,.15],[.055,.27],[-.025,.24],[.025,.13]],[0,0,side*.024],.036,'cast',[{x:.04,y:.22,r:.016}]);
 }
 // Polished cylindrical fuel tanks, band straps, cast caps and saddles.
 for(const side of [1,-1]){
  instance('fuel',side===1?'Tanque izquierdo':'Tanque derecho',[-1.18,.87,side*.93]);
  lathe('fuel',[0,0,0],[[0,-.61],[.19,-.61],[.29,-.575],[.318,-.51],[.318,.51],[.29,.575],[.19,.61],[0,.61]],'chrome','x',64);
  for(const x of [-.39,.39]){cyl('fuel',[x,0,0],.324,.06,'steel','x');ring('fuel',[x-.029,0,0],.325,.003,'chrome','x');ring('fuel',[x+.029,0,0],.325,.003,'chrome','x');}
  cyl('fuel',[-.14,.323,0],.061,.039,'steel');for(const x of [-.18,-.1])box('fuel',[x,.35,0],[.016,.025,.067],'steel');
  hose('fuel',[[.33,.23,-side*.2],[.34,.28,-side*.28],[.35,.28,-side*.45]],.012,'rubber');
  decal('fuel','DIESEL FUEL ONLY',[0,.115,side*.304],[.48,.084],side>0?[0,0,0]:[0,Math.PI,0],'#314049');
 }
 instance('battery','Banco de baterías',[-2.52,.88,-.84]);
 box('battery',[0,-.21,0],[.65,.035,.49],'steel');for(const z of [-.24,.24])box('battery',[0,-.07,z],[.65,.29,.022],'steel');
 for(const x of [-.205,0,.205]){box('battery',[x,0,0],[.189,.32,.39],'plastic',.012);box('battery',[x,.17,0],[.199,.022,.41],'cast');for(const z of [-.1,.1]){cyl('battery',[x,.2,z],.023,.038,z>0?'red':'steel');bolt('battery',[x,.221,z],.02,'y');}}
 hose('battery',[[-.2,.23,.1],[0,.25,.1],[.2,.23,.1]],.013,'red');hose('battery',[[-.2,.23,-.1],[0,.25,-.1],[.2,.23,-.1]],.013,'rubber');
 for(const x of [-.29,.29])rod('battery',[x,-.18,-.17],[x,.21,-.17],.009);box('battery',[0,.223,-.17],[.62,.014,.028],'steel');
 decal('battery','12 V   HEAVY DUTY',[0,-.02,.253],[.4,.085],[0,0,0]);
 instance('exhaust','Tratamiento de gases y escape',[-1.35,.92,-.9]);
 box('exhaust',[0,0,0],[1.03,.54,.58],'steel',.08);
 for(const x of [-.36,.36]){box('exhaust',[x,0,0],[.048,.57,.62],'chrome');for(const z of [-.3,.3])bolt('exhaust',[x,.18,z],.017);}
 hose('exhaust',[[-.44,.17,.05],[-.72,.23,.05],[-1.02,.26,.24],[-1.73,.27,.36]],.068,'steel');
 hose('exhaust',[[.47,0,0],[.7,0,0],[.83,-.15,0]],.068,'steel');
 for(let n=0;n<13;n++)box('exhaust',[-.43+n*.07,.14,-.303],[.009,.13,.006],'cast',.002);
 // U-shaped fifth-wheel top plate with an actual throat and grease channels.
 instance('fifth','Quinta rueda',[.76,1.39,0]);
 const fifthShape=[[-.55,-.52],[-.62,-.36],[-.64,.21],[-.52,.53],[-.27,.65],[.23,.65],[.5,.55],[.64,.31],[.64,-.34],[.55,-.59],[.32,-.62],[.065,-.025],[-.065,-.025],[-.31,-.62]];
 plate('fifth',fifthShape,[0,.02,0],.095,'cast',[],[Math.PI/2,0,Math.PI/2]);
 for(const side of [-1,1]){
  box('fifth',[0,-.19,side*.45],[.88,.1,.19],'cast');cyl('fifth',[0,-.108,side*.47],.065,.14,'steel','z');
  for(const x of [-.31,.31])bolt('fifth',[x,-.128,side*.45],.023,'y');
  const pts:V[]=[[-.38,.025,side*.17],[-.37,.025,side*.39],[-.1,.025,side*.48],[.17,.025,side*.42]];hose('fifth',pts,.008,'plastic');
 }
 for(const z of [-.32,.32])box('fifth',[.035,-.295,z],[1.5,.075,.18],'steel');
 instance('kingpin','Perno rey, mordaza y palanca',[.76,1.41,0]);
 lathe('kingpin',[0,0,0],[[0,-.14],[.058,-.14],[.068,-.12],[.068,-.085],[.035,-.078],[.035,-.012],[.06,.005],[.06,.08],[0,.08]],'steel');
 box('kingpin',[0,.0255,0],[1.35,.045,1.45],'steel');
 ring('kingpin',[0,-.028,0],.049,.013,'cast','y',Math.PI*2);
 hose('kingpin',[[.065,-.072,.035],[.22,-.11,.17],[.23,-.11,.76],[.35,-.11,.83],[.47,-.11,.76]],.015,'steel');
 // Air connections include coiled lines, gladhand castings, gaskets and a separate electric plug.
 for(const [i,f] of (['red','paint','plastic'] as Finish[]).entries()){
  instance('connections',['Línea de suministro','Línea de servicio','Conector eléctrico'][i]);
  const zz=(i-1)*.23;const pts:V[]=[[-.64,1.82,zz],[-.52,1.98,zz]];
  for(let n=0;n<=220;n++){const t=n/220;pts.push([-.5+t*.67,2.02+Math.sin(t*Math.PI)*.16+Math.sin(t*Math.PI*28)*.051,zz+Math.cos(t*Math.PI*28)*.051]);}pts.push([.23,1.98,zz],[.235,1.91,zz]);hose('connections',pts,.015,f);
  if(i<2){box('connections',[.235,1.91,zz],[.075,.1,.065],'steel');cyl('connections',[.22,1.91,zz],.031,.085,'steel','x');ring('connections',[.174,1.91,zz],.024,.007,'rubber','x');box('connections',[.18,1.966,zz],[.07,.015,.071],'steel');}
  else{cyl('connections',[.22,1.91,zz],.035,.105,'plastic','x');ring('connections',[.174,1.91,zz],.036,.005,'steel','x');}
 }
 // Raised landing gear with nested square tubes, gearbox, crank and diagonal braces.
 for(const side of [1,-1]){
  instance('landing',side===1?'Pata izquierda':'Pata derecha',[2.38,1.01,side*.86]);
  box('landing',[0,.2,0],[.155,.68,.155],'cast');box('landing',[0,-.12,0],[.118,.26,.118],'steel');box('landing',[0,-.28,0],[.37,.045,.33],'steel');
  box('landing',[0,.54,0],[.24,.035,.22],'cast');for(const x of [-.09,.09])bolt('landing',[x,.564,0],.015,'y');
  rod('landing',[0,.5,0],[.9,.45,-side*.34],.025,'cast');rod('landing',[0,.3,0],[1.0,.5,0],.027,'cast');
  box('landing',[-.1,.23,0],[.14,.19,.15],'cast');
 }
 instance('landing','Manivela y eje');rod('landing',[2.27,1.23,-.9],[2.27,1.23,1.11],.017,'steel');
 hose('landing',[[2.27,1.23,1.11],[2.27,1.07,1.13],[2.54,1.07,1.13]],.016,'steel');cyl('landing',[2.54,1.07,1.13],.026,.13,'plastic','x');
 // Full-length 53 ft trailer: corrugations, riveted rails and rear locking hardware.
 const front=.2,length=16.1544,rear=front+length,center=front+length/2;
 instance('trailerbody','Carrocería del semirremolque');
 box('trailerbody',[center,2.83,0],[length,2.5,2.56],'white',.018);
 for(const side of [1,-1]){
  for(let n=0;n<64;n++){const x=front+.12+n*.25;box('trailerbody',[x,2.85,side*1.285],[.027,2.32,.014],'chrome',.002);}
  for(const y of [1.58,4.08])box('trailerbody',[center,y,side*1.29],[length,.074,.045],'chrome');
  for(let n=0;n<110;n++)for(const y of [1.58,4.08])cyl('trailerbody',[front+.08+n*.145,y,side*1.316],.006,.004,'steel','z',6);
  instance('reflectors',side===1?'Luces y cinta del lateral izquierdo':'Luces y cinta del lateral derecho');
  for(let n=0;n<53;n++)box('reflectors',[front+.15+n*.301,1.67,side*1.305],[.294,.047,.006],n%2?'white':'redlens',.001);
  for(const x of [front+.12,center,rear-.15]){box('reflectors',[x,1.82,side*1.315],[.105,.045,.022],'amber');box('reflectors',[x,1.82,side*1.3],[.13,.062,.017],'rubber');}
 }
 instance('frame','Largueros del remolque');for(const z of [-.46,.46]){box('frame',[center,1.45,z],[length,.22,.016],'cast');for(const y of [1.335,1.565])box('frame',[center,y,z],[length,.018,.12],'steel');}
 for(let x=.4;x<rear;x+=.55)box('frame',[x,1.5,0],[.057,.075,2.43],'steel');
 for(const side of [1,-1]){
  instance('doors',side===1?'Puerta trasera izquierda':'Puerta trasera derecha',[rear+.015,2.84,side*.639]);
  box('doors',[0,0,0],[.051,2.39,1.24],'white');
  for(const z of [-.6,.6])box('doors',[.03,0,z],[.04,2.39,.043],'chrome');for(const y of [-1.18,1.18])box('doors',[.03,y,0],[.04,.043,1.24],'chrome');
  for(const z of [-.27,.27]){rod('doors',[.07,-1.1,z],[.07,1.1,z],.016,'steel');for(const y of [-.84,0,.84]){box('doors',[.075,y,z],[.035,.065,.09],'steel');bolt('doors',[.1,y,z+.035],.009,'x');}box('doors',[.095,-.29,z+.09],[.021,.034,.2],'steel');}
  for(const y of [-.86,-.3,.3,.86]){box('doors',[.05,y,side*.58],[.045,.08,.18],'steel');cyl('doors',[.06,y,side*.642],.025,.15,'chrome','y');}
 }
 instance('reflectors','Luces posteriores');
 for(const side of [1,-1])for(const z of [.72,.97]){cyl('reflectors',[rear+.073,1.48,side*z],.051,.025,'rubber','x');cyl('reflectors',[rear+.09,1.48,side*z],.044,.014,'redlens','x');}
 for(const z of [-.17,0,.17])box('reflectors',[rear+.035,4.01,z],[.02,.037,.063],'redlens');
 instance('frame','Defensa y guardafangos');box('frame',[rear-.13,.59,0],[.1,.15,2.45],'steel');for(const z of [-.96,.96])box('frame',[rear-.13,1.0,z],[.1,.69,.1],'steel');
 for(const x of [2.03,15.4344])for(const z of [-1,1])box('frame',[x,.48,z],[.032,.71,.57],'rubber');
 // Conventional tractor body assembled from shaped panels, with a tapered hood and wheel arches.
 instance('body','Cabina');
 plate('body',[[-3.35,1.29],[-1.99,1.29],[-1.99,3.01],[-2.02,3.18],[-2.95,3.18],[-3.37,2.56]], [0,0,-1.04],2.08,'paint');
 // Day cab rear panel: bumper-to-back-of-cab = 126 in (3.2004 m).
 box('body',[-1.99,2.27,0],[.0508,1.95,2.1],'paint',.016);
 plate('body',[[-2.92,3.13],[-1.98,3.13],[-1.98,3.79],[-2.2,3.79],[-2.64,3.48]],[0,0,-1.04],2.08,'paint');
 for(const side of [1,-1]){
  // Actual door outline and separate window trim.
  const outline:V[]=[[-3.17,1.52,side*1.05],[-1.97,1.52,side*1.05],[-1.97,3.02,side*1.05],[-2.91,3.02,side*1.05],[-3.17,2.58,side*1.05],[-3.17,1.52,side*1.05]];hose('body',outline,.007,'rubber');
  box('body',[-2.12,2.17,side*1.066],[.2,.037,.018],'chrome');
  for(const y of [.63,.91]){box('body',[-2.64,y,side*1.075],[1.02,.048,.38],'steel');for(let n=0;n<12;n++)box('body',[-3.08+n*.077,y+.025,side*1.085],[.022,.003,.3],'cast',.001);}

  decal('body','CDL  ATLAS',[-2.54,1.89,side*1.065],[.72,.12],side>0?[0,0,0]:[0,Math.PI,0],'#c7d0d2');
  instance('mirrors',side===1?'Ventana y espejo izquierdo':'Ventana y espejo derecho');
  plate('mirrors',[[-3.12,2.6],[-2.84,3.0],[-2.06,3.0],[-2.06,2.51],[-3.12,2.51]],[0,0,side*1.057],.008,'glass');
  hose('mirrors',[[-3.08,2.43,side*1.065],[-3.22,2.43,side*1.43],[-3.22,2.95,side*1.43],[-2.9,2.98,side*1.08]],.014,'chrome');
  box('mirrors',[-3.225,2.7,side*1.445],[.11,.48,.24],'plastic',.04);box('mirrors',[-3.155,2.7,side*1.445],[.014,.423,.197],'chrome',.025);
  box('mirrors',[-3.215,2.38,side*1.445],[.11,.16,.22],'plastic',.035);
 }
 instance('mirrors','Parabrisas');
 const wind=box('mirrors',[-3.182,2.844,0],[.025,.642,1.85],'glass',.025);wind.rotation.z=-.56;
 rod('mirrors',[-3.348,2.58,0],[-3.012,3.118,0],.019,'paint');
 for(const z of [-.48,.48]){rod('mirrors',[-3.358,2.61,z-.16],[-3.287,2.72,z+.12],.007,'plastic');rod('mirrors',[-3.296,2.702,z-.07],[-3.296,2.702,z+.33],.012,'plastic');}
 instance('hood','Capó');
 plate('hood',[[-4.97,1.21],[-3.38,1.3],[-3.36,2.49],[-4.85,2.17],[-4.97,1.91]],[0,0,-.76],1.52,'paint');
 const grille=[[-.63,.41],[.63,.41],[.56,-.39],[-.56,-.39]];
 plate('hood',grille,[-4.999,1.71,0],.028,'chrome',[],[0,Math.PI/2,0]);
 plate('hood',[[-.58,.36],[.58,.36],[.51,-.35],[-.51,-.35]],[-5.03,1.71,0],.012,'plastic',[],[0,Math.PI/2,0]);
 for(let n=0;n<7;n++){const y=1.4+n*.095;box('hood',[-5.047,y,0],[.019,.027,1.01+(y-1.4)*.2],'chrome',.009);}
 box('body',[-5.08,.99,0],[.17,.38,2.45],'paint',.058);
 box('body',[-5.169,1.025,0],[.016,.18,.93],'plastic',.035);
 for(const side of [1,-1]){
  const arch=new T.Shape();arch.absarc(-4.03,.56,.72,0,Math.PI,false);arch.lineTo(-4.78,.56);arch.lineTo(-4.78,1.64);arch.lineTo(-3.28,1.64);arch.lineTo(-3.28,.56);arch.lineTo(-3.31,.56);arch.closePath();
  mesh('hood',new T.ExtrudeGeometry(arch,{depth:.42,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:3,curveSegments:32}),[0,0,side>0?.82:-1.24],'paint');
  instance('lights',side===1?'Faro izquierdo':'Faro derecho');
  const headlight=plate('lights',[[-.24,.135],[.22,.045],[.18,-.1],[-.19,-.095]],[-4.92,1.47,side*.99],.018,'plastic',[],[0,Math.PI/2,0]);
  headlight.scale.x=side;
  const lens=plate('lights',[[-.207,.1],[.19,.025],[.15,-.069],[-.17,-.065]],[-4.944,1.47,side*.99],.009,'lens',[],[0,Math.PI/2,0]);lens.scale.x=side;
  cyl('lights',[-4.969,1.46,side*1.025],.058,.014,'chrome','x');cyl('lights',[-4.981,1.46,side*1.025],.046,.009,'glass','x');
  hose('lights',[[-4.961,1.57,side*.82],[-4.961,1.52,side*1.12],[-4.96,1.43,side*1.16]],.009,'lens');
  box('lights',[-4.968,1.51,side*1.167],[.018,.057,.043],'amber');
  box('lights',[-3.9,1.66,side*1.251],[.12,.06,.012],'amber');
 }
 instance('lights','Luces de gálibo');for(const z of [-.8,-.4,0,.4,.8]){box('lights',[-2.84,3.214,z],[.19,.051,.077],'chrome');box('lights',[-2.855,3.249,z],[.143,.036,.064],'amber');}
 instance('safety','Extintor',[-2.15,1.63,.55]);
 lathe('safety',[0,0,0],[[0,-.24],[.071,-.24],[.089,-.205],[.089,.14],[.07,.195],[.025,.218],[.025,.258],[0,.258]],'red');
 box('safety',[0,.259,0],[.11,.023,.037],'steel');cyl('safety',[.05,.218,0],.027,.017,'chrome','x');ring('safety',[-.032,.26,.015],.027,.004,'steel');hose('safety',[[0,.22,-.03],[.12,.16,-.04],[.13,-.12,-.04],[.08,-.18,-.03]],.012,'rubber');
 for(const y of [-.12,.09])ring('safety',[0,y,0],.092,.007,'steel','y');decal('safety','ABC  DRY CHEMICAL',[0,0,.089],[.145,.15],[0,0,0],'#212528','#e2dfce');
 instance('steeringpump','Bomba y engranaje de dirección',[-3.22,1.13,-.31]);
 cyl('steeringpump',[0,0,0],.07,.14,'steel','x');box('steeringpump',[-.08,0,0],[.035,.2,.2],'steel');
 for(const y of [-.07,.07])for(const z of [-.07,.07])bolt('steeringpump',[-.102,y,z],.012,'x');
 cyl('steeringpump',[-.13,0,0],.071,.026,'cast','x');
 for(let n=0;n<18;n++){const a=n*Math.PI/9;const tooth=box('steeringpump',[-.13,Math.cos(a)*.073,Math.sin(a)*.073],[.026,.019,.016],'steel',.002);tooth.rotation.x=a;}
 for(const z of [-.04,.04])cyl('steeringpump',[.025,.077,z],.019,.042,'brass','y',6);
 // Shackle plates articulate the rear eye of each front spring.
 for(const side of [-1,1]){
  instance('shackle',side>0?'Gemela izquierda':'Gemela derecha',[-3.275,1.015,side*.48]);
  for(const z of [-.092,.076])plate('shackle',[[-.037,-.07],[.037,-.07],[.037,.07],[-.037,.07]],[0,0,z],.016,'steel',[{x:0,y:-.043,r:.016},{x:0,y:.043,r:.016}]);
  for(const y of [-.043,.043]){rod('shackle',[0,y,-.115],[0,y,.115],.015,'steel');bolt('shackle',[0,y,.122],.022);}
 }
 // Additional inspection components. Visible shapes follow component construction;
 // installation dimensions are representative until verified against a specific chassis.
 instance('powerreservoir','Depósito de dirección',[-3.48,1.94,.69]);
 lathe('powerreservoir',[0,0,0],[[0,-.18],[.075,-.18],[.09,-.14],[.09,.1],[.07,.15],[.035,.15],[.035,.18],[0,.18]],'plastic');
 cyl('powerreservoir',[0,.195,0],.05,.036,'plastic');box('powerreservoir',[0,-.03,.088],[.021,.19,.009],'fluid');
 for(const y of [-.09,.06])box('powerreservoir',[.02,y,.092],[.033,.006,.005],'white');
 for(const y of [-.1,.08])ring('powerreservoir',[0,y,0],.094,.008,'steel','y');
 hose('powerreservoir',[[0,-.17,0],[.02,-.34,0],[.09,-.52,-.05]],.021);
 decal('powerreservoir','POWER STEERING',[0,.02,.093],[.16,.045]);
 instance('waterpump','Bomba de agua',[-4.49,1.4,.18]);
 lathe('waterpump',[0,0,0],[[0,-.05],[.1,-.05],[.125,-.02],[.11,.04],[.07,.075],[.04,.12],[0,.12]],'steel','x');
 cyl('waterpump',[-.086,0,0],.12,.035,'cast','x');
 for(let n=0;n<6;n++){const a=n*Math.PI/3;bolt('waterpump',[.052,Math.cos(a)*.097,Math.sin(a)*.097],.012,'x');}
 hose('waterpump',[[.03,-.06,0],[.02,-.15,.04],[-.04,-.17,.17]],.042,'steel');
 ring('waterpump',[-.04,-.17,.17],.043,.006,'chrome','z');
 instance('compressor','Compresor de aire · accionamiento por engranajes',[-3.26,1.24,.41]);
 box('compressor',[0,0,0],[.22,.23,.22],'steel',.028);
 for(const x of [-.058,.058]){cyl('compressor',[x,.15,0],.063,.16,'steel');for(let n=0;n<6;n++)cyl('compressor',[x,.085+n*.024,0],.073,.007,'steel');}
 box('compressor',[0,.254,0],[.24,.055,.16],'cast');
 for(const x of [-.09,.09])for(const z of [-.06,.06])bolt('compressor',[x,.29,z],.011,'y');
 cyl('compressor',[.137,-.01,0],.095,.056,'steel','x');
 hose('compressor',[[0,.29,.04],[.06,.34,.11],[.13,.31,.2],[.22,.28,.2]],.012,'steel');
 cyl('compressor',[0,.29,.04],.022,.028,'brass','y',6);
 instance('def','Tanque DEF y tapón azul',[-2.05,.91,1.0]);
 box('def',[0,0,0],[.39,.49,.43],'plastic',.051);
 for(const x of [-.135,.135])box('def',[x,0,0],[.027,.5,.45],'steel');
 cyl('def',[0,.269,0],.068,.041,'blue');
 for(let n=0;n<12;n++){const a=n*Math.PI/6;box('def',[Math.cos(a)*.067,.27,Math.sin(a)*.067],[.014,.034,.014],'blue');}
 decal('def','DEF ONLY',[0,0,.218],[.24,.06],[0,0,0],'#e4e7e8');
 // Three foldable warning triangles stored in a case, one displayed upright for recognition.
 instance('triangles','Triángulos reflectantes',[-2.31,1.51,-.56]);
 box('triangles',[0,0,0],[.49,.083,.12],'plastic');
 for(const z of [-.025,.025])box('triangles',[0,.053,z],[.43,.018,.025],'redlens');
 const tri=new T.Shape();tri.moveTo(-.23,0);tri.lineTo(.23,0);tri.lineTo(0,.4);tri.closePath();
 const hole=new T.Path();hole.moveTo(-.145,.05);hole.lineTo(0,.3);hole.lineTo(.145,.05);hole.closePath();tri.holes.push(hole);
 mesh('triangles',new T.ExtrudeGeometry(tri,{depth:.012,bevelEnabled:false}),[0,.086,0],'redlens');
 box('triangles',[0,.077,0],[.31,.013,.19],'steel');
 instance('fuses','Panel de fusibles · ejemplo',[-2.8,1.74,-.7]);
 box('fuses',[0,0,0],[.31,.24,.045],'plastic');
 for(let r=0;r<3;r++)for(let c=0;c<6;c++){
  const x=-.118+c*.047,y=-.072+r*.069;
  box('fuses',[x,y,.033],[.027,.044,.022],(['red','blue','amber'] as Finish[])[r],.003);
  for(const xx of [-.007,.007])box('fuses',[x+xx,y,.049],[.004,.018,.003],'steel',.001);
 }
 instance('washer','Depósito lavaparabrisas',[-3.27,1.41,-.74]);
 box('washer',[0,0,0],[.24,.32,.19],'fluid',.04);
 hose('washer',[[0,.13,0],[0,.24,0],[.04,.28,0]],.035,'fluid');cyl('washer',[.04,.32,0],.052,.027,'blue');
 cyl('washer',[.09,-.125,.1],.025,.085,'plastic');hose('washer',[[.09,-.09,.1],[.14,.09,.12],[.18,.26,.11]],.004);
 instance('climate','Mandos de calefacción y desempañado',[-3.055,2.12,-.12]);
 box('climate',[0,0,0],[.08,.17,.34],'plastic');
 for(const z of [-.11,0,.11]){cyl('climate',[.05,0,z],.042,.027,'plastic','x');rod('climate',[.068,.006,z],[.068,.029,z],.003,'white');}
 decal('climate','TEMP   FAN   DEFROST',[.071,.065,0],[.29,.025],[0,Math.PI/2,0],'#bec9ca');
 instance('dashboard','Tablero y controles de freno · ejemplo',[-3.16,2.21,.55]);
 box('dashboard',[0,0,0],[.11,.3,.64],'plastic',.027);
 for(const z of [-.17,.17]){
  cyl('dashboard',[.062,0,z],.104,.018,'chrome','x');cyl('dashboard',[.074,0,z],.092,.005,'plastic','x');
  for(let n=0;n<13;n++){const a=(n/12*1.5+.25)*Math.PI;rod('dashboard',[.08,Math.cos(a)*.075,z+Math.sin(a)*.075],[.08,Math.cos(a)*.086,z+Math.sin(a)*.086],.002,'white');}
  rod('dashboard',[.081,0,z],[.081,.028,z-.06],.004,'red');
 }
 box('dashboard',[.073,.109,0],[.008,.035,.1],'glass');
 for(const [z,f] of [[-.32,'red'],[-.4,'amber']] as const){cyl('dashboard',[.15,-.13,z],.018,.12,'steel','x');cyl('dashboard',[.22,-.13,z],.04,.025,f,'x',f==='red'?8:4);}
 instance('horn','Bocina y volante',[-2.76,2.18,.59]);
 ring('horn',[0,0,0],.217,.018,'plastic','x');
 for(const a of [0,2.2,4.08])rod('horn',[0,0,0],[0,Math.cos(a)*.205,Math.sin(a)*.205],.025,'plastic');
 box('horn',[.013,0,0],[.067,.137,.15],'plastic',.03);
 // Slide rails, locking wedges and secondary latch represented as individual inspectable mechanisms.
 instance('slidepins','Bloqueo de quinta rueda deslizante',[.76,1.14,0]);
 for(const side of [-1,1]){
  box('slidepins',[0,0,side*.37],[1.46,.1,.065],'cast');
  for(let n=0;n<12;n++)box('slidepins',[-.64+n*.115,.064,side*.37],[.045,.035,.055],'steel');
  cyl('slidepins',[.07,.035,side*.38],.031,.19,'steel','z');
  rod('slidepins',[.07,.035,side*.47],[.24,.035,side*.57],.012,'steel');
 }
 instance('safetylatch','Seguro de la palanca',[1.005,1.3,.745]);
 plate('safetylatch',[[-.065,0],[.06,0],[.06,.09],[.018,.09],[.018,.044],[-.065,.044]],[0,0,0],.019,'steel');bolt('safetylatch',[-.04,.023,.029],.012);
 // Rear conspicuity tape, plus tractor-side reflectors.
 instance('reartape','Cinta reflectante trasera',[rear+.115,1.265,0]);
 for(let n=0;n<8;n++)box('reartape',[0,0,-1.09+n*.31],[.006,.052,.303],n%2?'white':'redlens',.001);
 for(const side of [-1,1]){box('reartape',[0,2.57,side*1.09],[.006,.035,.3],'white');box('reartape',[0,2.44,side*1.22],[.006,.3,.035],'white');}
 instance('sidereflectors','Reflectores del tractor');
 for(const side of [-1,1])box('sidereflectors',[-2.0,1.02,side*1.24],[.11,.05,.012],'amber');
 // Inspection detail pass: retain the chassis datums and physical picking instances.
 // Exterior construction details are reference estimates, not OEM measurements.
 const editInstance=(id:string,index=0)=>{active[id]=groups[id].children[index] as T.Group;};
 editInstance('engine');
 // Cast side access covers, gasket seams, recessed bosses and flange fasteners.
 for(const side of [-1,1]){
  for(const [x,w] of [[-.43,.31],[.03,.28],[.43,.23]]){
   box('engine',[x,-.16,side*.306],[w,.32,.025],'cast',.027);
   box('engine',[x,-.16,side*.324],[w-.014,.306,.027],'steel',.029);
   for(const xx of [x-w*.38,x+w*.38])for(const yy of [-.277,-.043]){
    cyl('engine',[xx,yy,side*.346],.021,.016,'steel','z');
    bolt('engine',[xx,yy,side*.357],.009,'z');
   }
  }
  for(let n=0;n<12;n++){
   const x=-.59+n*.106;
   bolt('engine',[x,-.382,side*.306],.009,'y');
  }
  box('engine',[0,.47,side*.292],[1.28,.009,.014],'rubber',.002);
 }
 // Moulded cover ribs and a shallow identification-plate surround.
 for(let n=0;n<7;n++)box('engine',[-.54+n*.175,.607,0],[.026,.016,.5],'plastic',.004);
 box('engine',[.08,.548,.291],[.34,.056,.009],'steel',.003);
 box('engine',[.08,.548,.297],[.315,.038,.006],'plastic',.002);
 for(const x of [-.074,.234])bolt('engine',[x,.548,.304],.004,'z');
 // Fuel-line unions and hold-downs along the six-cylinder head.
 for(let n=0;n<6;n++){
  const x=-.51+n*.205;
  cyl('engine',[x,.37,.407],.013,.024,'steel','z',6);
  ring('engine',[x,.37,.418],.01,.002,'steel','z');
  box('engine',[x+.063,.416,.347],[.035,.024,.025],'cast',.004);
  bolt('engine',[x+.063,.43,.36],.005,'y');
 }
 // Sensor harness follows the visible side of the casting, with sealed plugs.
 const loom:V[]=[[-.59,.3,.345],[-.3,.305,.36],[.02,.29,.35],[.3,.3,.34],[.56,.25,.34],[.61,-.19,.33]];
 hose('engine',loom,.012,'plastic');
 for(const x of [-.46,-.23,.02,.27,.5]){
  box('engine',[x,.299,.357],[.032,.04,.025],'plastic',.004);
  hose('engine',[[x,.29,.36],[x+.03,.19,.35],[x+.035,.12,.35]],.005,'plastic');
  box('engine',[x+.035,.11,.35],[.039,.047,.031],'plastic',.007);
  box('engine',[x+.035,.105,.369],[.018,.012,.008],'red',.002);
 }
 // Finned control-module enclosure and connectors at its lower edge.
 box('engine',[-.09,-.19,.388],[.21,.32,.058],'steel',.013);
 for(let n=0;n<8;n++)box('engine',[-.175+n*.024,-.19,.421],[.009,.248,.012],'steel',.002);
 for(const x of [-.15,-.03]){
  box('engine',[x,-.365,.392],[.072,.055,.057],'plastic',.007);
  hose('engine',[[x,-.386,.393],[x-.014,-.43,.42],[x-.12,-.4,.46],[x-.15,-.26,.45]],.011);
 }
 // Filter-cap drive hexes, radial grip ribs, manifold unions and mounting ears.
 for(const [x,y,r] of [[.1,.05,.078],[.44,.04,.074]]){
  cyl('engine',[x,y+.228,.411],.026,.02,'plastic','y',6);
  for(let n=0;n<12;n++){
   const a=n*Math.PI/6;
   box('engine',[x+Math.cos(a)*r,y+.185,.411+Math.sin(a)*r],[.009,.024,.009],'plastic',.002);
  }
  for(const dx of [-r,r]){
   box('engine',[x+dx,y-.11,.354],[.041,.071,.052],'steel',.006);
   bolt('engine',[x+dx,y-.11,.388],.008,'z');
  }
 }
 // Exhaust shield, turbo outlet clamp and starter solenoid assembly.
 box('engine',[.04,.13,-.395],[.91,.22,.025],'steel',.015);
 for(const x of [-.33,.36])bolt('engine',[x,.15,-.414],.011,'z');
 ring('engine',[.18,.15,-.584],.075,.007,'chrome','z');
 bolt('engine',[.248,.14,-.585],.007,'z');
 cyl('engine',[.43,-.135,-.414],.032,.15,'steel','x');
 for(const x of [.34,.52])ring('engine',[x,-.225,-.365],.086,.005,'steel','x');
 cyl('engine',[.53,-.13,-.415],.008,.025,'brass','x');
 hose('engine',[[.548,-.13,-.415],[.6,-.11,-.45],[.64,-.02,-.4]],.008,'red');
 // Cooling pack support brackets and header seams.
 editInstance('engine',1);
 for(const z of [-.52,.52])for(const y of [-.36,.36]){
  box('engine',[.025,y,z],[.18,.07,.045],'steel',.006);
  bolt('engine',[-.07,y,z],.011,'x');
 }
 for(const y of [-.465,.465])box('engine',[0,y,0],[.09,.031,1.04],'steel',.008);
 editInstance('alternator');
 // Copper end-turns remain visible through the existing open housing.
 for(let n=0;n<18;n++){
  const a=n*Math.PI/9;
  for(const xx of [-.098,.094]){
   const p:V[]=[];
   for(let j=0;j<=5;j++){
    const t=a-.1+j*.04;
    p.push([xx,Math.cos(t)*.104,Math.sin(t)*.104]);
   }
   hose('alternator',p,.005,'copper');
  }
 }
 box('alternator',[.147,-.047,-.047],[.038,.072,.075],'plastic',.01);
 box('alternator',[.173,-.044,-.047],[.026,.033,.047],'plastic',.003);
 cyl('alternator',[.173,.045,0],.019,.017,'red','x');
 editInstance('coolant');
 // Mounting cradle, pressure-cap warning insert and return-line support.
 for(const z of [-.13,.13]){
  box('coolant',[.03,-.151,z],[.27,.022,.049],'steel',.004);
  bolt('coolant',[.12,-.133,z],.009,'y');
 }
 cyl('coolant',[0,.255,0],.042,.003,'amber','y');
 editInstance('oil');
 for(const y of [-.1,.21]){
  box('oil',[.045,y,.08],[.08,.026,.034],'steel',.004);
  bolt('oil',[.071,y,.105],.007,'z');
 }
 // Clamp bands and screw housings on actual hose endpoints (not arbitrary points).
 for(const id of ['coolant','brakehose','steeringhoses','powerreservoir','waterpump']){
  for(const inst of groups[id].children as T.Group[]){
   active[id]=inst;
   for(const child of [...inst.children]){
    if(!(child instanceof T.Mesh)||!(child.geometry instanceof T.TubeGeometry))continue;
    if(child.material!==mat(id,'rubber'))continue;
    const p=child.geometry.parameters;
    for(const end of [0,1]){
     const point=p.path.getPoint(end),direction=p.path.getTangent(end).normalize();
     const band=ring(id,point.toArray() as V,p.radius+.002,.003,'chrome','z');
     band.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);
     const offset=new T.Vector3(1,0,0);
     if(Math.abs(direction.x)>.85)offset.set(0,0,1);
     offset.addScaledVector(direction,-offset.dot(direction)).normalize().multiplyScalar(p.radius+.006);
     const screw=box(id,point.clone().add(offset).toArray() as V,[.019,.011,.011],'steel',.003);
     screw.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),direction);
    }
   }
  }
 }
 // Close-up fasteners and joint details on every axle end.
 for(const inst of groups.slack.children as T.Group[]){
  active.slack=inst;
  cyl('slack',[-.055,.1,.045],.009,.022,'brass','z',6);
  cyl('slack',[-.055,.1,.06],.005,.013,'brass','z');
  hose('slack',[[-.012,.315,.066],[.001,.33,.066],[.011,.315,.066],[-.012,.307,.066]],.002,'steel');
 }
 for(const inst of groups.chamber.children as T.Group[]){
  active.chamber=inst;
  for(const y of [-.16,.16]){
   rod('chamber',[-.025,y,.028],[.035,y,.028],.006,'steel');
   bolt('chamber',[.035,y,.028],.009,'x');
  }
  ring('chamber',[-.116,0,0],.027,.006,'rubber','x');
 }
 for(const inst of groups.airbags.children as T.Group[]){
  active.airbags=inst;
  for(const y of [-.108,.105])ring('airbags',[0,y,0],.156,.003,'rubber','y');
 }
 for(const inst of groups.fuel.children as T.Group[]){
  active.fuel=inst;
  for(const x of [-.39,.39]){
   box('fuel',[x,-.17,0],[.1,.06,.55],'cast',.007);
   for(const z of [-.24,.24])bolt('fuel',[x,-.125,z],.012,'y');
  }
  ring('fuel',[-.14,.342,0],.059,.004,'rubber','y');
 }
 for(const inst of groups.landing.children.slice(0,2) as T.Group[]){
  active.landing=inst;
  for(const y of [.05,.12,.19,.26])cyl('landing',[0,y,.08],.007,.005,'steel','z');
  for(const x of [-.055,.055])for(const y of [.175,.29])bolt('landing',[x-.1,y,.084],.008,'z');
  rod('landing',[0,-.25,-.19],[0,-.25,.19],.019,'steel');
  for(const z of [-.2,.2])bolt('landing',[0,-.25,z],.017,'z');
 }
 // Batch by material per physical instance: preserves picking and close-ups at low draw-call cost.
 const disposable=new Set<T.BufferGeometry>();
 for(const g of Object.values(groups))for(const object of g.children){
  const inst=object as T.Group;const buckets=new Map<T.Material,T.BufferGeometry[]>();
  for(const child of [...inst.children])if(child instanceof T.Mesh&&!child.userData.keep){child.updateMatrix();const geo=child.geometry.clone().applyMatrix4(child.matrix);disposable.add(child.geometry);const normalized=geo.index?geo.toNonIndexed():geo;if(geo!==normalized)geo.dispose();const list=buckets.get(child.material as T.Material)||[];list.push(normalized);buckets.set(child.material as T.Material,list);inst.remove(child);}
  for(const [material,geometries] of buckets){const geometry=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());geometry.computeBoundingSphere();const m=new T.Mesh(geometry,material);m.userData.part=g.name;m.castShadow=true;m.receiveShadow=true;inst.add(m);}
 }
 disposable.forEach(g=>g.dispose());
 return {root,groups};
}

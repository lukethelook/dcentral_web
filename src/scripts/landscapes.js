// Final hero: per-filament entrance on the first visit in a browser session.
import * as THREE from './vendor/three.module.min.js';
import {INTRO_SECONDS,createThreadTimings,threadProgress} from './intro-threads.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
const instances=[];
let introSpeed=1;
const INTRO_SESSION_KEY='dcentral:hero-entry:v1';
function hasSeenIntro(){try{return sessionStorage.getItem(INTRO_SESSION_KEY)==='seen';}catch{return false;}}
function rememberIntro(){try{sessionStorage.setItem(INTRO_SESSION_KEY,'seen');}catch{/* Storage restrictions must never block the scene. */}}
let globalPaused=reduced.matches;
// Digitised WSW skyline from C.Stadler/Bwag, CC BY-SA 4.0. Extruded depth is illustrative.
const ridge=[[-5, 0.03], [-3.0868, 0.9317], [-2.5962, 0.8496], [-2.2189, 0.7963], [-2.1057, 0.9399], [-1.9358, 1.0384], [-1.7849, 1.0959], [-1.6038, 1.2149], [-1.4566, 1.3257], [-1.2943, 1.4653], [-1.1811, 1.4858], [-1.0415, 1.5679], [-0.917, 1.5884], [-0.766, 1.6295], [-0.5962, 1.6623], [-0.4755, 1.8019], [-0.4151, 1.9414], [-0.2943, 1.9948], [-0.2151, 2.0933], [-0.1887, 2.2616], [-0.1094, 2.3313], [-0.0189, 2.3519], [0.0377, 2.4586], [0.0906, 2.4463], [0.1434, 2.5489], [0.2264, 2.6392], [0.3094, 2.6884], [0.3962, 2.6925], [0.4453, 2.75], [0.5019, 2.7418], [0.566, 2.7213], [0.6264, 2.7007], [0.7094, 2.6351], [0.7623, 2.553], [0.8113, 2.5735], [0.8491, 2.4257], [0.9132, 2.4504], [0.9887, 2.3806], [1.0566, 2.2534], [1.166, 2.2451], [1.2792, 2.1631], [1.4491, 2.0276], [1.5849, 1.9743], [1.7283, 1.9784], [1.8415, 1.8881], [1.9585, 1.9004], [2.0264, 1.8347], [2.0755, 1.7075], [2.1698, 1.6049], [2.2566, 1.494], [2.3925, 1.3791], [2.4755, 1.3668], [2.6113, 1.2806], [2.7434, 1.3052], [2.8377, 1.1985], [2.9811, 1.141], [3.1321, 1.0672], [3.2302, 1.0507], [3.366, 1.1369], [3.6679, 1.1985], [3.9698, 1.4119], [4.2717, 1.5474], [4.6415, 1.6993]];
function profile(x){
// Continue the final measured tangent into a gently rolling shoulder.
// This outer continuation is illustrative; the traced central skyline stays unchanged.
const end=ridge[ridge.length-1],before=ridge[ridge.length-2];
if(x>end[0]){const d=x-end[0],slope=(end[1]-before[1])/(end[0]-before[0]);return end[1]+slope*d*Math.exp(-d/1.3)-.65*(1-Math.exp(-d*d/12))+.12*Math.pow(Math.sin(d*1.3),2);}
for(let i=1;i<ridge.length;i++){if(x<=ridge[i][0]){const a=ridge[i-1],b=ridge[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}}return .02}
function height(x,z){const along=profile(Math.max(-5,x));const mass=Math.exp(-Math.pow((z+.85)/1.05,2));const folds=(Math.sin(x*13+z*5)+.5*Math.sin(x*23-z*9))*.033*mass*(1-Math.exp(-Math.pow((z+.85)/.16,2)));const foothills=.19*(Math.sin(x*2+z*1.2)+1)*Math.exp(-Math.pow((z-.35)/.7,2));const lake=.025*Math.sin(x*2+z*4);return Math.max(.008,along*mass+folds+foothills+lake)}

function buildLandscape(host){
 const hero=host.dataset.landscape==='hero',variant=hero?0:Number(host.dataset.landscape)+1;
 const demo=host.hasAttribute('data-intro-demo');
 const entryPending=hero&&!globalPaused&&(demo||!hasSeenIntro());
 const canvas=host.querySelector('canvas'),dark=hero?document.documentElement.dataset.heroTheme!=='light':variant===2||variant===4;
 const bg=new THREE.Color(dark?'#102f28':hero?'#f3f4ec':'#e6ebdf'),ink=new THREE.Color(dark?'#b9d0bf':'#236b5e'),accent=new THREE.Color(dark?'#d4ff3f':'#789f16');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(hero?37:33,1,.1,100);
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});}catch{host.style.backgroundImage='url(/assets/project-lines-2.svg)';return null;}
 renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));renderer.setClearColor(bg);
 if(hero)document.addEventListener('hero-theme',e=>{const dark=e.detail.dark;bg.set(dark?'#102f28':'#f3f4ec');ink.set(dark?'#b9d0bf':'#236b5e');accent.set(dark?'#d4ff3f':'#789f16');renderer.setClearColor(bg);wake();});
 const rowCount=hero?146:171;
 const threadData=new Float32Array(rowCount*4);
 const threadTexture=new THREE.DataTexture(threadData,rowCount,1,THREE.RGBAFormat,THREE.FloatType);
 threadTexture.minFilter=threadTexture.magFilter=THREE.NearestFilter;
 threadTexture.generateMipmaps=false;threadTexture.needsUpdate=true;
 let threadTimings=createThreadTimings(rowCount);
 const uniforms={uThreads:{value:threadTexture},uRowCount:{value:rowCount},uIntro:{value:entryPending?0:1},uRowStep:{value:1},uViewport:{value:new THREE.Vector2(1,1)},uTime:{value:0},uVariant:{value:variant},uInk:{value:ink},uAccent:{value:accent},uBG:{value:bg},uDark:{value:dark?1:0},uHover:{value:new THREE.Vector4()},uPulses:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,-100,0))},uShapes:{value:Array.from({length:4},()=>new THREE.Vector4())}};
const deform=`uniform float uTime;uniform vec4 uPulses[4];uniform vec4 uShapes[4];uniform float uVariant;uniform vec4 uHover;varying float vWave;varying float vFlag;varying float vElevation;varying float vDepth;varying vec2 vXZ;
vec3 landscape(vec3 p){float displacement=0.;vWave=0.;vFlag=0.;vElevation=p.y;for(int i=0;i<4;i++){vec4 s=uPulses[i];float age=uTime-s.z;vec2 offset=p.xz-s.xy;float d=length(offset);float a=atan(offset.y,offset.x)+uShapes[i].z;
if(uShapes[i].x>.5&&uShapes[i].x<1.5)d*=1.+.25*cos(a*4.);
if(uShapes[i].x>1.5)d*=1.+.18*cos(a*5.);
float band=(d-age*2.0);float envelope=exp(-band*band*5.)*exp(-age*.48)*smoothstep(0.,.22,age);displacement+=sin(band*7.)*envelope*.25*s.w;vWave+=envelope*s.w;vFlag+=envelope*uShapes[i].y*.7;}
float hd=distance(p.xz,uHover.xy);float focus=exp(-hd*hd*2.8)*uHover.z;
float rim=exp(-pow((hd-.55)*5.,2.))*uHover.z;
float flexible=1.-.35*smoothstep(.8,2.15,p.y);p.y+=(focus*.17+sin(hd*9.-uTime*1.8)*focus*.018)*flexible;
vWave+=focus*.32+rim*.23;
p.y+=(displacement+sin(p.x*1.9+p.z*1.3+uTime*.55)*.012+sin(p.z*2.6-uTime*.4)*.012)*flexible;if(uVariant>3.5){float bend=sin(p.x*2.+p.z*3.+uTime*.3)*.018;p.x+=bend*(.3+p.y);}
if(uVariant>.5&&uVariant<1.5){float focusBand=exp(-pow((p.x-sin(uTime*.19)*1.5)*3.,2.));vWave+=focusBand*.09;}
vDepth=p.z;vXZ=p.xz;return p;}`;
const vertex=deform+`void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(landscape(position),1.);}`;
const surfaceMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`uniform vec3 uBG;void main(){gl_FragColor=vec4(uBG,1.);
#include <colorspace_fragment>
}`,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2});
const lineMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:deform+`attribute float aRow;varying float vRow;attribute vec3 aStart;attribute vec3 aEnd;uniform vec2 uViewport;varying float vSide;attribute vec2 aArc;uniform sampler2D uThreads;uniform float uRowCount;varying float vArc;varying vec3 vThread;
void main(){vec4 a=projectionMatrix*modelViewMatrix*vec4(landscape(aStart),1.);vec4 b=projectionMatrix*modelViewMatrix*vec4(landscape(aEnd),1.);vec3 selected=mix(aStart,aEnd,position.x);vec3 displaced=landscape(selected);vec4 clip=projectionMatrix*modelViewMatrix*vec4(displaced,1.);vec2 delta=(b.xy/b.w-a.xy/a.w)*uViewport;vec2 direction=delta/max(length(delta),.0001);vec2 normal=vec2(-direction.y,direction.x);clip.xy+=normal*position.y*1.25/uViewport*clip.w;vSide=position.y;vRow=aRow;vArc=mix(aArc.x,aArc.y,position.x);vThread=texture2D(uThreads,vec2((aRow+.5)/uRowCount,.5)).xyz;gl_Position=clip;}`,transparent:true,depthWrite:false,fragmentShader:`uniform float uIntro;varying float vArc;varying vec3 vThread;uniform float uRowStep;varying float vRow;varying float vSide;uniform vec3 uInk,uAccent,uBG;uniform float uDark;varying float vWave,vDepth,vFlag,vElevation;varying vec2 vXZ;void main(){if(uRowStep>1.5&&mod(vRow,2.)>.5)discard;// Real cumulative distance along this exact filament, with independent growing ends.
float feather=.025;
float fromLeft=1.-smoothstep(vThread.x-feather,vThread.x+feather,vArc);
float fromRight=smoothstep(vThread.y-feather,vThread.y+feather,vArc);
float reveal=max(fromLeft,fromRight);
if(uIntro>.999)reveal=1.;
float tip=max(exp(-pow((vArc-vThread.x)*30.,2.)),exp(-pow((vArc-vThread.y)*30.,2.)))*vThread.z*(1.-uIntro);
float fade=mix(.20,.76,smoothstep(-2.,2.,vDepth));vec3 c=mix(uInk,uAccent,clamp(vWave*1.8,0.,1.));float stripe=step(.92,vElevation)* (1.-step(1.84,vElevation));
vec3 national=mix(vec3(.50,.045,.035),vec3(.91,.93,.87),stripe);
c=mix(c,national,clamp(vFlag,0.,.6));c=mix(c,uAccent,tip*.24);gl_FragColor=vec4(mix(uBG,c,fade*(1.-smoothstep(2.5,4.,vDepth))*smoothstep(-3.,-2.6,vDepth)),(1.-smoothstep(.35,1.,abs(vSide)))*reveal);
#include <colorspace_fragment>
}`});

 const nx=hero?1560:300,nz=hero?145:170,verts=[],indices=[],lineVerts=[];
 const worldX=i=>hero?(i<520?-24+i/520*19:i>1040?5+(i-1040)/520*19:-5+(i-520)/520*10):-5+i/nx*10;
 const worldZ=j=>-3+Math.pow(j/nz,1.65)*7;
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=worldX(i),z=worldZ(j);verts.push(x,height(x,z),z);}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b,a+1,b,b+1,a+1);}
 for(let j=0;j<=nz;j++)for(let i=0;i<nx;i++)for(const k of [i,i+1]){const x=worldX(k),z=worldZ(j);lineVerts.push(x,height(x,z)+.003,z);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);scene.add(new THREE.Mesh(geo,surfaceMaterial));
 const lines=new THREE.InstancedBufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0,1,-1,0,0,1,0,1,1,0],3));lines.setIndex([0,1,2,2,1,3]);const starts=[],ends=[],rows=[];for(let i=0;i<lineVerts.length;i+=6){rows.push(Math.floor(i/(nx*6)));starts.push(...lineVerts.slice(i,i+3));ends.push(...lineVerts.slice(i+3,i+6));}lines.setAttribute('aStart',new THREE.InstancedBufferAttribute(new Float32Array(starts),3));lines.setAttribute('aEnd',new THREE.InstancedBufferAttribute(new Float32Array(ends),3));lines.setAttribute('aRow',new THREE.InstancedBufferAttribute(new Float32Array(rows),1));lines.instanceCount=starts.length/3;const lineMesh=new THREE.Mesh(lines,lineMaterial);lineMesh.frustumCulled=false;scene.add(lineMesh);
 // Store actual 3D arc length at each segment endpoint. No screen-space wipe.
 const rowArcs=[],arcEnds=new Float32Array((nz+1)*nx*2);
 for(let j=0;j<=nz;j++){
  const arcs=new Float32Array(nx+1),base=j*(nx+1)*3;
  for(let i=1;i<=nx;i++){
   const k=base+i*3;
   arcs[i]=arcs[i-1]+Math.hypot(verts[k]-verts[k-3],verts[k+1]-verts[k-2],verts[k+2]-verts[k-1]);
   const segment=(j*nx+i-1)*2;arcEnds[segment]=arcs[i-1];arcEnds[segment+1]=arcs[i];
  }
  rowArcs.push(arcs);
 }
 lines.setAttribute('aArc',new THREE.InstancedBufferAttribute(arcEnds,2));
 const threadBounds=Array.from({length:rowCount},()=>({left:0,right:48,join:24}));
 const projected=new THREE.Vector3(),screenXs=new Float32Array(nx+1);
 function measureThreadBounds(){
  // Camera is used only to locate visible endpoints. Growth follows arc length.
  for(let j=0;j<=nz;j++){
   const base=j*(nx+1)*3,arcs=rowArcs[j];
   for(let i=0;i<=nx;i++){const k=base+i*3;projected.set(verts[k],verts[k+1],verts[k+2]).project(camera);screenXs[i]=projected.x*.5+.5;}
   function arcAtScreen(target){
    for(let i=1;i<=nx;i++)if(screenXs[i]>=target){
     const d=screenXs[i]-screenXs[i-1],f=d>0?THREE.MathUtils.clamp((target-screenXs[i-1])/d,0,1):0;
     return arcs[i-1]+(arcs[i]-arcs[i-1])*f;
    }
    return arcs[nx];
   }
   threadBounds[j]={left:arcAtScreen(-.005),right:arcAtScreen(1.005),join:arcAtScreen(threadTimings[j].join)};
  }
  updateThreads(introElapsed);
 }
 function updateThreads(elapsed){
  for(let row=0;row<rowCount;row++){
   const bounds=threadBounds[row],progress=threadProgress(threadTimings[row],elapsed),i=row*4;
   threadData[i]=THREE.MathUtils.lerp(bounds.left-.04,bounds.join+.03,progress[0]);
   threadData[i+1]=THREE.MathUtils.lerp(bounds.right+.04,bounds.join-.03,progress[1]);
   // The highlight disappears as the two thread ends join, without a central flash.
   threadData[i+2]=Math.min(1,Math.max(0,(threadData[i+1]-threadData[i])/.32));
  }
  threadTexture.needsUpdate=true;
 }
 let time=hero?0:variant*1.7,last=0,raf=0,visible=false,nextPulse=hero?3:2,pulseIndex=0,lastFlag=-60,mountainNext=true,previous=null,drag=null,angle=0,targetAngle=0;
 let introStartedAt=null;
 let introElapsed=entryPending?0:INTRO_SECONDS;
 let introFinished=!entryPending;
 const notifyIntro=()=>{host.dataset.introState=introFinished?'complete':'drawing';document.dispatchEvent(new CustomEvent('intro-state',{detail:{playing:!introFinished,reduced:reduced.matches,duration:INTRO_SECONDS/introSpeed}}));};
 function finishIntro(){introElapsed=INTRO_SECONDS;introFinished=true;uniforms.uIntro.value=1;if(hero&&!demo)rememberIntro();notifyIntro();}
 function replayIntro(){
  if(reduced.matches||globalPaused){finishIntro();wake();return;}
  if(!introFinished)return;
  introElapsed=0;introStartedAt=null;introFinished=false;uniforms.uIntro.value=0;last=0;
  threadTimings=createThreadTimings(rowCount);positionCamera();measureThreadBounds();
  // Give this entrance its own quiet second, without a competing pulse.
  uniforms.uPulses.value.forEach(p=>p.z=-100);nextPulse=time+3;
  hover.a=hover.target=0;uniforms.uHover.value.z=0;
  notifyIntro();wake();
 }
 if(hero){
  if(demo)document.addEventListener('intro-replay',e=>{introSpeed=e.detail?.slow?1/3:1;replayIntro();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!introFinished)finishIntro();});
  document.addEventListener('motion-state',e=>{if(e.detail.paused&&!introFinished)finishIntro();});
  notifyIntro();
 }
 const hover={x:0,z:0,tx:0,tz:0,a:0,target:0};const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function positionCamera(){const mobile=innerWidth<760;
  // Desktop rests slightly turned (approved framing: lower left flank, room under the CTA); drag stays relative to it.
  if(hero){const dist=mobile?12.8:10,center=mobile?.45:-.8,a=angle+(mobile?0:-.25);camera.position.set(center+Math.sin(a)*dist,mobile?4.8:4.1,Math.cos(a)*dist);camera.lookAt(center,mobile?1.55:1.15,0);}
  else {const presets=[[.8,3.0,3.2,.5,1.65,-.3],[-.4,3.6,4.0,.5,1.4,-.3],[1.0,6.5,3.6,.4,1.25,-.2],[1.7,3.0,3.6,.55,1.65,-.6]],p=presets[variant-1];const drift=0;camera.position.set(p[0]+drift,p[1],p[2]);camera.lookAt(p[3],p[4],p[5]);}
  camera.updateMatrixWorld();
 }
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);uniforms.uViewport.value.set(w,h);uniforms.uRowStep.value=innerWidth<760?2:1;camera.aspect=w/h;positionCamera();camera.updateProjectionMatrix();measureThreadBounds();wake();}
 function pulse(x,z,strength=.65,shape=0,flag=false){const i=pulseIndex++%4;uniforms.uPulses.value[i].set(x,z,time,strength);uniforms.uShapes.value[i].set(shape,flag?1:0,Math.random()*Math.PI,0);}
 function autoPulse(){let x,z;do{x=mountainNext?-.9+Math.random()*2.6:-3+Math.random()*6;z=mountainNext?-1.35+Math.random():.5+Math.random()*1.9;}while(previous&&Math.hypot(x-previous.x,z-previous.z)<1.1);previous={x,z};mountainNext=!mountainNext;
 const flag=hero&&time-lastFlag>45&&Math.random()<.14;if(flag)lastFlag=time;
 pulse(x,z,(hero?.45:.28)+Math.random()*(hero?.35:.2),Math.floor(Math.random()*3),flag);nextPulse=time+9+Math.random()*6;
 }
 function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const o=ray.ray.origin,d=ray.ray.direction;for(let t=.1;t<35;t+=.1){const x=o.x+d.x*t,z=o.z+d.z*t;if(x< -24||x>24||z< -3||z>4)continue;if(o.y+d.y*t<=height(x,z))return {x,z};}return null;}
 canvas.addEventListener('pointermove',e=>{if(hero&&drag&&Math.abs(e.clientX-drag.x)>5){drag.moved=true;targetAngle=THREE.MathUtils.clamp(drag.angle+(e.clientX-drag.x)*.0018,-.42,.42);if(globalPaused){angle=targetAngle;positionCamera();}wake();return;}if(!fine.matches||globalPaused)return;const p=hit(e);hover.target=p?1:0;if(p){hover.tx=p.x;hover.tz=p.z;}wake();});
 canvas.addEventListener('pointerleave',()=>{hover.target=0;wake();});
 if(hero){canvas.addEventListener('pointerdown',e=>{if(drag)return;drag={x:e.clientX,y:e.clientY,angle:targetAngle,moved:false};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointercancel',()=>{drag=null;hover.target=0;});canvas.addEventListener('pointerup',e=>{const start=drag;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(start&&!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<12&&!globalPaused){const p=hit(e);if(p)pulse(p.x,p.z,.6,Math.floor(Math.random()*3));}wake();});}
 function draw(now){raf=0;if(!visible||document.hidden)return;const dt=last?Math.min((now-last)/1000,.04):0;last=now;
 if(!introFinished){
  if(globalPaused)finishIntro();
  else {if(introStartedAt===null)introStartedAt=now;introElapsed=Math.min(INTRO_SECONDS,(now-introStartedAt)/1000*introSpeed);updateThreads(introElapsed);if(introElapsed>=INTRO_SECONDS)finishIntro();}
 }
 if(!globalPaused){time+=dt;uniforms.uTime.value=time;angle+=(targetAngle-angle)*(1-Math.exp(-7*dt));const f=1-Math.exp(-12*dt);hover.x+=(hover.tx-hover.x)*f;hover.z+=(hover.tz-hover.z)*f;hover.a+=(hover.target-hover.a)*(1-Math.exp(-7*dt));uniforms.uHover.value.set(hover.x,hover.z,hover.a*.7,0);if(time>nextPulse)autoPulse();}
 positionCamera();renderer.render(scene,camera);if(!globalPaused)wake();else last=0;
 }
 function wake(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
 const ro=new ResizeObserver(resize);ro.observe(host);
 const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;last=0;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'70px'});observer.observe(host);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;cancelAnimationFrame(raf);});
 const api={wake,reset(){last=0;if(globalPaused){hover.a=hover.target=0;uniforms.uHover.value.z=0;}wake();},dispose(){cancelAnimationFrame(raf);ro.disconnect();observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});threadTexture.dispose();renderer.dispose();}};
 resize();return api;
}
const lazy=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){lazy.unobserve(e.target);const scene=buildLandscape(e.target);if(scene)instances.push(scene);}},{rootMargin:'300px'});
document.querySelectorAll('[data-landscape]').forEach(el=>lazy.observe(el));
function sync(){document.documentElement.classList.toggle('motion-paused',globalPaused);const b=document.querySelector('#motion-toggle');b.setAttribute('aria-pressed',String(globalPaused));b.setAttribute('aria-label',globalPaused?'Animationen starten':'Animationen pausieren');b.querySelector('span').textContent=globalPaused?'Bewegung starten':'Bewegung pausieren';instances.forEach(i=>i.reset());document.dispatchEvent(new CustomEvent('motion-state',{detail:{paused:globalPaused}}));}
document.querySelector('#motion-toggle').onclick=()=>{globalPaused=!globalPaused;sync();};reduced.addEventListener('change',()=>{globalPaused=reduced.matches;sync();});document.addEventListener('visibilitychange',()=>{instances.forEach(i=>i.reset());});addEventListener('pagehide',e=>{if(e.persisted)return;lazy.disconnect();instances.forEach(i=>i.dispose());});sync();

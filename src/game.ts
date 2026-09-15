import './game.css';
import './game-video-layout.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {KINDS,initialState,collect,canTakeKey as ruleCanTakeKey,spawnKinds} from './rules';
import type {Kind,State} from './rules';
import {GameAudio} from './audio';
import {Effects,VideoDirector,ChatDirector} from './presentation';
import {countdown,LIKE_MILESTONES,sizeBoost} from './commission-rules';
import {BASKET_KINDS,BASKET_TOTAL,BASKET_GRAVITY,BASKET_STEP,BASKET_SETTLE_STEPS,createBasketPlan,validBasketPlan,normalizeBasket,basketBoundaries,spawnBasketItem,createBasketBody,nudgeBasketNeighbours,recoverBasketOutliers} from './basket-preset';
import type {BasketSpec} from './basket-preset';
const assetBase=import.meta.env?.BASE_URL??'/';
const basketMode=new URLSearchParams(location.search).get('items')!=='original';
const activeKinds:readonly Kind[]=basketMode?BASKET_KINDS:KINDS;
const totalItems=basketMode?BASKET_TOTAL:72;
const qaMode=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('qa')==='1';
const SAVE_KEY=(basketMode?'finding-case-basket-v1':'finding-case-v1')+(qaMode?'-qa':'');
const PROFILE_KEY='finding-profile'+(qaMode?'-qa':'');
const canTakeKey=(s:State,busy=false)=>ruleCanTakeKey(s,busy,totalItems);
let basketPlan:BasketSpec[]=[];
if(basketMode){try{const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(validBasketPlan(saved?.basketPlan))basketPlan=saved.basketPlan;}catch{}if(!basketPlan.length)basketPlan=createBasketPlan();}
import {itemCollider,releaseNeighbours,VacancySettler,findCentralVacancy} from './pile-physics';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const game=$('game'),shell=$('shell'),pile=$('pile'),speech=$('speech'),dialog=$<HTMLDialogElement>('dialog');
const labels:Record<Kind,string>={camera:'相机',car:'小汽车',cup:'保温杯',glass:'放大镜',glove:'白手套',plush:'玩偶',milk:'牛奶',carrot:'胡萝卜',burger:'汉堡'};
const sizes:Record<Kind,number>={camera:1.4,car:1.48,cup:1.48,glass:1.12,glove:1.18,plush:1.36,milk:1.08,carrot:1.08,burger:1.08};
const LAYOUT_REVISION=basketMode?2:8;
type Template={root:THREE.Group;size:THREE.Vector3;hull?:Float32Array;half?:THREE.Vector3};
type Item={id:number;kind:Kind;root:THREE.Group;body:RAPIER.RigidBody;removed:boolean};
let state:State=initialState(),world:RAPIER.World,ready=false,paused=false,busy=false,ended=false,restarting=false;
let scale=1,lastInput=performance.now(),speechUntil=0,firstTriple=false,cameraSpoken=false,keySpoken=false,riskSpoken=false;
let elapsed=0,last=performance.now(),accumulator=0,idleHint:Item|undefined,hintUntil=0,undoState:State|null=null,undoItem:Item|null=null;
const audio=new GameAudio(),items:Item[]=[],templates=new Map<Kind,Template>(),thumbs=new Map<string,string>();
const effects=new Effects(),video=new VideoDirector($<HTMLButtonElement>('video-retry')),chat=new ChatDirector($('chat-stream'),effects);
let resumed=false,introTime=2,praiseSpoken=false;
let playSeconds=0;const likeMilestones=new Set<number>();
function updateClock(){const text=countdown(playSeconds);if($('timer').textContent!==text)$('timer').textContent=text;}
function progressLikes(){for(const threshold of LIKE_MILESTONES){if(state.cleared/totalItems>=threshold&&!likeMilestones.has(threshold)){likeMilestones.add(threshold);void effects.likes($('like-stream'));audio.play('hint');}}}
const introPos=new Map<number,{p:THREE.Vector3;q:THREE.Quaternion;s:THREE.Vector3;delay:number;dx:number;dz:number;spin:THREE.Quaternion}>();
function prepareIntro(){introTime=0;busy=true;audio.play('drop');for(const i of items){introPos.set(i.id,{p:i.root.position.clone(),q:i.root.quaternion.clone(),s:i.root.scale.clone(),delay:Math.random()*.42,dx:(Math.random()-.5)*.6,dz:(Math.random()-.5)*.4,spin:new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random()-.5)*.5,0,(Math.random()-.5)*.4))});}}
function drawIntro(dt:number){introTime+=dt;for(const i of items){const t=introPos.get(i.id);if(!t)continue;const f=Math.min(1,Math.max(0,(introTime-t.delay)/.76)),ease=1-Math.pow(1-f,3),lift=(1-ease)*2.6;i.root.visible=f>0;i.root.position.copy(t.p).add(new THREE.Vector3(t.dx*(1-ease),lift,t.dz*(1-ease)));i.root.scale.copy(t.s).multiplyScalar(1+.28*(1-ease));i.root.quaternion.copy(t.q).multiply(new THREE.Quaternion().slerp(t.spin,1-ease));}if(introTime>=1.2){for(const i of items){const t=introPos.get(i.id)!;i.root.scale.copy(t.s);i.root.quaternion.copy(t.q);i.root.position.copy(t.p);i.root.visible=true;}introPos.clear();introTime=2;busy=false;save();}}
if(basketMode){labels.cup='杯子';$('hint').textContent='点选 3 件相同物品，整理旅行箱。';$('progress').innerHTML='已归好 <b>0 / 32</b> 组';game.dataset.preset='basket';}
const vacancySettler=new VacancySettler();
let nextGapCheck=1,gapCooldown=0,gapPasses=0,lastGapRemoved=-1,gapAssist=false;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2.5));renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;
if(basketMode){renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;}
pile.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.95,3.95,3.95,-3.95,.1,60);
// Square canvas requires square frustum: unequal spans stretch every model horizontally.
if(basketMode){const verticalOffset=30*8.3/750;camera.left=-4.15;camera.right=4.15;camera.top=4.15+verticalOffset;camera.bottom=-4.15+verticalOffset;camera.position.set(0,22,4);camera.lookAt(0,1.5,0);camera.updateProjectionMatrix();}else{camera.position.set(0,25,5);camera.lookAt(0,0,-.5);}camera.updateMatrixWorld();
const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(new RoomEnvironment(),.025).texture;scene.environment=env;scene.environmentIntensity=basketMode?.15:.65;pmrem.dispose();
scene.add(basketMode?new THREE.HemisphereLight(0xfffcf5,0xc4b8a6,.75):new THREE.HemisphereLight(0xffffff,0xd7d3cb,.8));
const fill=new THREE.DirectionalLight(0xf4f8ff,basketMode?.35:.4);fill.position.set(4,5,6);scene.add(fill);
const sun=new THREE.DirectionalLight(0xfffaf1,1.8);sun.position.set(-5,9,3.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5.5,right:5.5,top:5.5,bottom:-5.5,near:.1,far:28});sun.shadow.bias=-.00012;sun.shadow.normalBias=.008;sun.shadow.radius=4;sun.shadow.blurSamples=8;
if(basketMode){sun.color.setHex(0xfff8ed);sun.intensity=2;sun.position.set(-3.5,11,5);sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5.5,right:5.5,top:5.5,bottom:-5.5});sun.shadow.bias=-.00012;sun.shadow.normalBias=.018;sun.shadow.radius=2.2;sun.shadow.intensity=.6;}
scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(basketMode?7.2:7.25,basketMode?7.4:5.15),new THREE.ShadowMaterial({color:0x66584b,opacity:.27}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.set(0,.015,basketMode?0:-.075);scene.add(floor);
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
const gapRay=new THREE.Raycaster(),gapDirection=new THREE.Vector3(0,-1,-.22).normalize();
let detectedGap:{x:number;y:number;z:number}|null=null;
function visibleGap(){
 scene.updateMatrixWorld(true);const roots=items.filter(i=>!i.removed).map(i=>i.root);
 return findCentralVacancy(world,(x,z)=>{gapRay.set(new THREE.Vector3(x,15,z+3.3),gapDirection);return gapRay.intersectObjects(roots,true).length>0;});
}
function fit(){scale=Math.min(innerWidth/750,innerHeight/1650,1);shell.style.width=750*scale+'px';shell.style.height=1650*scale+'px';game.style.transform='scale('+scale+')';dialog.style.setProperty('--scale',String(scale));renderer.setSize(750*scale,750*scale,false);}
fit();addEventListener('resize',fit);
function decorate(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.5;for(const texture of [m.map,m.normalMap,m.roughnessMap,m.metalnessMap])if(texture){texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}}});}});}
function tuneBasketSurface(root:THREE.Group){
 decorate(root);root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!(m instanceof THREE.MeshStandardMaterial))continue;
  // These are painted / textile toys, not metal. Keep the supplied color and relief maps.
  m.metalness=0;m.envMapIntensity=.55;m.normalScale.setScalar(.9);
  if(m instanceof THREE.MeshPhysicalMaterial){m.specularColor.setRGB(1,1,1);m.specularIntensity=.8;}
  m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.54);');};m.customProgramCacheKey=()=> 'basket-soft-toy-v2';m.needsUpdate=true;
 }});
}
function tuneSurface(root:THREE.Object3D,kind:string){root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
 const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!(m instanceof THREE.MeshStandardMaterial))continue;
 m.envMapIntensity=.7;m.aoMapIntensity=.55;
 const textile=['bear','plush','glove'].includes(kind);
 if(textile){m.metalness=0;m.normalScale.setScalar(.65);m.roughness=1;
  m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.82);');};
  m.customProgramCacheKey=()=> 'soft-textile-v1';m.needsUpdate=true;
 }else if(kind==='car'||kind==='cup'){m.metalness=.25;m.normalScale.setScalar(.8);}
 }});}
function normalize(source:THREE.Group,length:number):Template{
 const box=new THREE.Box3().setFromObject(source),s=box.getSize(new THREE.Vector3());source.scale.multiplyScalar(length/Math.max(s.x,s.y,s.z));source.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(source),center=b.getCenter(new THREE.Vector3());source.position.sub(center);const root=new THREE.Group();root.add(source);decorate(root);return{root,size:b.getSize(new THREE.Vector3())};
}
// Keep the outer silhouette, not the empty corners of a bounding box.
// A small support-point hull is shared by every instance of each model.
function contactHull(root:THREE.Group){
 root.updateMatrixWorld(true);const geometry=new THREE.IcosahedronGeometry(1,1),directions:THREE.Vector3[]=[];
 const vertices=geometry.getAttribute('position');
 for(let n=0;n<vertices.count;n++){const v=new THREE.Vector3().fromBufferAttribute(vertices,n).normalize();if(!directions.some(d=>d.distanceToSquared(v)<.0001))directions.push(v);}
 geometry.dispose();const best=directions.map(()=>-Infinity),points=directions.map(()=>new THREE.Vector3()),point=new THREE.Vector3();
 root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const position=o.geometry.getAttribute('position');if(!position)return;
 for(let n=0;n<position.count;n++){point.fromBufferAttribute(position,n).applyMatrix4(o.matrixWorld);directions.forEach((d,j)=>{const score=point.dot(d);if(score>best[j]){best[j]=score;points[j].copy(point);}});}});
 return new Float32Array(points.flatMap(p=>[p.x,p.y,p.z]));
}
function fixed(x:number,y:number,z:number,hx:number,hy:number,hz:number){const b=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z));world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setFriction(.85),b);}
function boundaries(){if(basketMode){basketBoundaries(world,3.6,10);return;}fixed(0,-.15,-.075,3.8,.15,2.7);fixed(-3.65,3,-.075,.1,3,2.7);fixed(3.65,3,-.075,.1,3,2.7);fixed(0,3,-2.65,3.8,3,.1);fixed(0,3,2.5,3.8,3,.1);}
async function spawn(){
 if(basketMode){
  basketPlan.forEach((spec,id)=>{const t=templates.get(spec.kind)!;const item=spawnBasketItem(world,{...t,half:t.half!},{...spec,sizeFactor:spec.sizeFactor*sizeBoost(id)},id,1.65,1.25,1.2);item.body.enableCcd(true);item.root.userData.item=item;scene.add(item.root);items.push(item);});
  for(let i=0;i<BASKET_SETTLE_STEPS;i++){world.step();if(i%30===29)await new Promise<void>(resolve=>setTimeout(resolve,0));}
  syncBodies();return;
 }
 spawnKinds().forEach((kind,id)=>{
 const t=templates.get(kind)!,root=t.root.clone(true);const layer=Math.floor(id/16),cell=id%16,col=cell%4,row=Math.floor(cell/4);
 const sizeFactor=1.15*(kind==='car'?1.1:1.15+((id*37)%101)/1000);root.scale.setScalar(sizeFactor);
 let x=(col-1.5)*1.66,z=(row-1.5)*1.22-.075,y=.95+layer*1.12;
 if(id>=69){x=(id-70)*2.1;z=1.4;y=5.6;}
 // Lay most objects on their backs so their identifying faces remain readable.
 const pitch=kind==='car'?(id%3-1)*.07:-1.28+(id%3-1)*.1;
 root.position.set(x,y,z);root.rotation.set(pitch,(id*2.39)%6.28,(id%3-1)*.08,'YXZ');scene.add(root);
 const b=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setRotation(root.quaternion).setLinearDamping(.58).setAngularDamping(.8).setCanSleep(true));
 world.createCollider(itemCollider(t.size,sizeFactor,t.hull),b);
 const item={id,kind,root,body:b,removed:false};root.userData.item=item;items.push(item);
 });
 for(let i=0;i<300;i++)world.step();
 syncBodies();
}
function syncBodies(){if(basketMode)recoverBasketOutliers(items);for(const i of items){if(i.removed)continue;i.root.position.copy(i.body.translation());i.root.quaternion.copy(i.body.rotation());}}
function makeThumb(name:string,template:THREE.Group){
 const s=new THREE.Scene();s.environment=basketMode?null:env;s.environmentIntensity=.4;s.add(basketMode?new THREE.HemisphereLight(0xfff4e2,0x65748c,2.5):new THREE.HemisphereLight(0xffffff,0x967c55,.6));const l=new THREE.DirectionalLight(0xfff1db,2.3);l.position.set(-2,4,5);s.add(l);
 if(basketMode){s.environment=env;s.environmentIntensity=.15;const hemi=s.children.find(o=>o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;hemi.color.setHex(0xfffcf5);hemi.groundColor.setHex(0xc4b8a6);hemi.intensity=.75;l.color.setHex(0xfff8ed);l.intensity=2;l.position.set(-3,5,4);const thumbFill=new THREE.DirectionalLight(0xf4f8ff,.35);thumbFill.position.set(4,5,6);s.add(thumbFill);}
 const m=template.clone(true);s.add(m);const c=new THREE.OrthographicCamera(-.96,.96,.96,-.96,.1,20);c.position.set(1.1,1.2,3);if(basketMode){c.left=-.78;c.right=.78;c.top=.78;c.bottom=-.78;c.updateProjectionMatrix();c.position.set(1.5,1.1,3);}c.lookAt(0,0,0);
 const ratio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(180,180,false);renderer.render(s,c);thumbs.set(name,renderer.domElement.toDataURL('image/png'));renderer.setPixelRatio(ratio);fit();
}
function renderTray(matched:number[]=[]){
 $('slots').replaceChildren();for(let j=0;j<7;j++){const node=document.createElement('div');node.className='slot';const token=state.tray[j];if(token){const img=document.createElement('img');img.src=thumbs.get(token.kind)!;img.alt=labels[token.kind];node.append(img);node.dataset.token=String(token.id);if(matched.includes(token.id))node.classList.add('matched');}if(state.tray.length>=5)node.classList.add('danger');$('slots').append(node);}
 $('progress').innerHTML='已归好 <b>'+state.cleared/3+' / '+totalItems/3+'</b> 组';
}
let toastHandle=0;
function toast(text:string){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastHandle);toastHandle=window.setTimeout(()=>$('toast').classList.remove('show'),2300);}
function say(text:string,force=false){if(!force&&performance.now()<speechUntil)return false;if(chat.storyMode)chat.message(text);else{const reply=text.includes('槽')?'好，先凑齐手上的。':text.includes('归好了')?'找到啦！让我看看。':text.includes('回来')?'嗯，我们继续！':text.includes('收好')?'明白，都是要好好收着的。':'交给我，我们慢慢找。';chat.pair(text,reply,true);}speechUntil=performance.now()+Math.max(3300,text.length*120);return true;}
function showHint(text:string){$('hint').textContent=text;$('hint').classList.remove('hidden');}
function hideHint(){$('hint').classList.add('hidden');}
function setPause(p:boolean){paused=p;audio.setPaused(p);video.setPaused(p);effects.setPaused(p);last=performance.now();accumulator=0;$<HTMLImageElement>('pause').querySelector('img')!.src=assetBase+'art/'+(p?'resume.png':'pause.png');}
function modal(title:string,copy:string,actions:{text:string;fn:()=>void;primary?:boolean;subtle?:boolean}[]){
 setPause(true);const body=$('dialog-body');body.replaceChildren();const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=copy;body.append(h,p);
 for(const a of actions){const b=document.createElement('button');b.textContent=a.text;b.className=a.primary?'primary':a.subtle?'subtle':'';b.onclick=()=>{audio.play('tap');a.fn();};body.append(b);}if(!dialog.open)dialog.showModal();
}
function closeModal(){dialog.close();setPause(false);lastInput=performance.now();}
function pauseMenu(){if(!ready||busy)return;
 modal('歇一小会儿','委托书不会跑。准备好了，我们继续找。',[{text:'继续寻找',primary:true,fn:closeModal},{text:'重新整理',fn:confirmRestart},{text:'暂时离开',subtle:true,fn:()=>{const saved=save();modal('下次接着找',saved?'进度保留在这台设备上。你可以关闭页面，也可以继续寻找。':'浏览器未允许保存进度。关闭页面可能需要重新整理。',[{text:'继续寻找',primary:true,fn:closeModal}]);}}]);
 if(state.tray.length){const back=document.createElement('button');back.textContent='退回上一步';back.onclick=undo;$('dialog-body').insertBefore(back,$('dialog-body').querySelectorAll('button')[1]);}
 const row=document.createElement('div');row.className='audio-options';(['music','sfx'] as const).forEach(k=>{const b=document.createElement('button');const update=()=>{b.textContent=(k==='music'?'音乐':'音效')+' · '+(audio[k]?'开':'关');b.setAttribute('aria-pressed',String(audio[k]));};update();b.onclick=()=>{audio[k]=!audio[k];audio.save();update();};row.append(b);});$('dialog-body').append(row);
}
function confirmRestart(){modal('重新整理？','本次尚未完成的整理进度会重置。',[{text:'继续当前委托',primary:true,fn:closeModal},{text:'重新开始',fn:restart}]);}
function restart(){restarting=true;try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();}
function fullTray(){modal('暂存格满了','退回上一步，已经归好的物品会保留。',[{text:'退回一步',primary:true,fn:undo},{text:'重新整理',subtle:true,fn:confirmRestart}]);}
function undo(){
 const id=[...state.removed].reverse().find(id=>state.tray.some(t=>t.id===id));const i=items.find(i=>i.id===id);if(!i)return;
 state={...state,tray:state.tray.filter(t=>t.id!==id),removed:state.removed.filter(n=>n!==id)};
 i.removed=false;i.root.visible=true;if(basketMode)i.body=createBasketBody(world,templates.get(i.kind)!.half!,i.root);else i.body.setEnabled(true);const p=i.root.position.clone();p.y=Math.min(p.y+.7,3.3);i.body.setTranslation(p,true);i.body.setLinvel({x:0,y:0,z:0},true);i.body.setAngvel({x:0,y:0,z:0},true);undoState=null;undoItem=null;renderTray();save();
 if(state.tray.length>=5)modal('退回了一步','已经归好的物品都还在。需要的话，可以再腾出一格。',[{text:'继续整理',primary:true,fn:closeModal},{text:'再退一步',fn:undo}]);else closeModal();
}
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function pickableFromEvent(event:PointerEvent){const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(items.filter(i=>!i.removed).map(i=>i.root),true)[0];}
function parentItem(object:THREE.Object3D){let o:THREE.Object3D|null=object;while(o){if(o.userData.item)return o.userData.item as Item;o=o.parent;}return null;}
async function pickup(item:Item){
 if(busy||paused||ended||item.removed)return;busy=true;chat.picked();lastInput=performance.now();idleHint=undefined;
 undoState=structuredClone(state);undoItem=item;
 const before=state;const result=collect(state,{id:item.id,kind:item.kind});
 const removedAt=item.body.translation();item.removed=true;item.root.visible=false;if(basketMode)world.removeRigidBody(item.body);else item.body.setEnabled(false);if(basketMode){nudgeBasketNeighbours(items,removedAt);}else{releaseNeighbours(items,removedAt);vacancySettler.begin(items,removedAt);gapAssist=false;}audio.play('pick');hideHint();
 const point=item.root.position.clone().project(camera);const fly=document.createElement('img');fly.className='flying';fly.src=thumbs.get(item.kind)!;fly.alt='';const sx=(point.x+1)*375-60,sy=490+(1-point.y)*375-60;fly.style.left=sx+'px';fly.style.top=sy+'px';game.append(fly);
 const expanded=[...before.tray];const index=expanded.map(t=>t.kind).lastIndexOf(item.kind)+1;const slotIndex=index||expanded.length;
 const slotRect=$('slots').children[slotIndex].getBoundingClientRect(),gameRect=game.getBoundingClientRect();const destX=(slotRect.left-gameRect.left+slotRect.width/2)/scale-60,destY=(slotRect.top-gameRect.top+slotRect.height/2)/scale-60;
 const dx=destX-sx,dy=destY-sy;
 await effects.animate(fly,[{transform:'translate(0,0) scale(1)'},{offset:.18,transform:`translate(${dx*.1}px,-18px) rotate(-8deg) scale(1.08,.92)`},{offset:.65,transform:`translate(${dx*.72}px,${dy*.5-35}px) rotate(7deg) scale(.84,1.04)`},{transform:`translate(${dx}px,${dy}px) scale(.68,.68)`}],320,'cubic-bezier(.25,.55,.35,1)');fly.remove();audio.play('slot');
 expanded.splice(slotIndex,0,{id:item.id,kind:item.kind});state={...before,tray:expanded};renderTray();
 const landed=$('slots').children[slotIndex].querySelector('img')!;
 await effects.animate(landed,[{transform:'scale(1.12,.78)'},{offset:.55,transform:'scale(.94,1.08)'},{transform:'scale(1)'}],130);
 if(result.matched.length){const matched=result.matched.map(t=>t.id),nodes=[...$('slots').children].filter(n=>matched.includes(Number((n as HTMLElement).dataset.token)));const centers=nodes.map(n=>{const r=n.getBoundingClientRect();return (r.left-gameRect.left+r.width/2)/scale;});const center=centers.reduce((a,b)=>a+b,0)/centers.length;
  audio.play('match');void effects.stars(game,center,1262+80);
  await Promise.all(nodes.map((n,j)=>effects.animate(n.querySelector('img')!,[{transform:'translateX(0) scale(1)',opacity:1},{offset:.35,transform:`translateX(${(center-centers[j])*.45}px) scale(1.18)`,opacity:1},{transform:`translateX(${center-centers[j]}px) scale(.12)`,opacity:0}],220)));
 }
 state=result.state;renderTray();busy=false;
 if(result.matched.length){progressLikes();const remaining=(totalItems-state.cleared)/3;chat.match(remaining,totalItems/3);if(remaining<=6&&!praiseSpoken){praiseSpoken=true;video.requestPraise();}}
 if(state.cleared>0&&!firstTriple){firstTriple=true;say('对，就这样。是收好，可不是扔掉。');}
 if(!basketMode&&!cameraSpoken&&items.filter(i=>i.kind==='camera'&&!state.removed.includes(i.id)).length===0&&!state.tray.some(t=>t.kind==='camera')){cameraSpoken=true;chat.pair('这些相机，记下过不少故事。','照片里还有故事呀。',true);video.requestPraise();}
 if(state.tray.length>=5&&!riskSpoken){riskSpoken=true;say('先找槽里已有的，别急着拿新的。');}
 if(canTakeKey(state)){showHint('整理完成！点击右侧的委托书。');say('都归好了。这份委托书，原来就在这里！',true);$('target').classList.add('found');$('target-status').textContent='查看委托';audio.play('key');void effects.stars(game,680,1342,10);void effects.animate($('commission-thumb'),[{transform:'scale(.6)'},{offset:.55,transform:'scale(1.2)'},{transform:'scale(1)'}],460);}
 if(result.full)fullTray();save();
}
function save(){if(!ready||busy||restarting)return false;try{localStorage.setItem(SAVE_KEY,JSON.stringify({presentation:3,playSeconds,likes:[...likeMilestones],chat:chat.snapshot(),praiseSpoken,layoutRevision:LAYOUT_REVISION,basketPlan:basketMode?basketPlan:undefined,state,undoState,undoId:undoItem?.id,positions:items.map(i=>({p:basketMode&&i.removed?i.root.position:i.body.translation(),q:basketMode&&i.removed?{x:i.root.quaternion.x,y:i.root.quaternion.y,z:i.root.quaternion.z,w:i.root.quaternion.w}:i.body.rotation()})),firstTriple,cameraSpoken,keySpoken,riskSpoken,ended}));return true;}catch{return false;}}
function restore(){try{
 const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;const saved=JSON.parse(raw);const s=saved.state as State;
 if(!s||!Array.isArray(s.removed)||s.removed.length>totalItems||s.cleared%3!==0||s.cleared+s.tray.length!==s.removed.length)return;
 resumed=true;praiseSpoken=!!saved.praiseSpoken;if(saved.presentation>=3)chat.restore(saved.chat);
 playSeconds=Number.isFinite(saved.playSeconds)?Math.max(0,saved.playSeconds):0;updateClock();for(const p of LIKE_MILESTONES)if(s.cleared/totalItems>=p)likeMilestones.add(p);
 state=s;undoState=saved.undoState;undoItem=items.find(i=>i.id===saved.undoId)??null;firstTriple=saved.firstTriple;cameraSpoken=saved.cameraSpoken;keySpoken=saved.keySpoken;riskSpoken=saved.riskSpoken;
 items.forEach(i=>{const pos=saved.layoutRevision===LAYOUT_REVISION?saved.positions?.[i.id]:null;if(pos){i.body.setTranslation(pos.p,false);i.body.setRotation(pos.q,false);}if(s.removed.includes(i.id)){i.removed=true;i.root.visible=false;if(basketMode){i.root.position.copy(i.body.translation());i.root.quaternion.copy(i.body.rotation());world.removeRigidBody(i.body);}else i.body.setEnabled(false);}else if(saved.layoutRevision!==LAYOUT_REVISION&&s.removed.length)i.body.wakeUp();});
 if(saved.layoutRevision!==LAYOUT_REVISION&&s.removed.length){if(!basketMode)vacancySettler.begin(items,{x:0,y:.5,z:-.075});for(let n=0;n<180;n++){if(!basketMode)vacancySettler.step(1/60);world.step();}}syncBodies();
 hideHint();say('回来了？我们接着找那份委托书。',true);if(state.tray.length===7)fullTray();if(canTakeKey(state))showHint('点击右侧的委托书。');
 }catch{/* Incompatible snapshots start a fresh case. */}}
function choices(text:string,options:{label:string;run:()=>void}[]){game.classList.add('story-active');chat.enterStory();say(text,true);speechUntil=Infinity;$('choices').replaceChildren();for(const option of options){const b=document.createElement('button');b.textContent=option.label;b.onclick=()=>{chat.message(option.label,true);$('choices').replaceChildren();option.run();};$('choices').append(b);}}
function takeKey(){
 if(!canTakeKey(state,busy)){toast('先把物品归好，就能找到委托书。');return;}if(ended)return;ended=true;hideHint();audio.play('key');$('target').classList.add('found');$('target-status').textContent='已找到';choices('就是这份委托书！先交给我，咱们进去吧。',[{label:'好，先交给你',run:()=>choices('咱们虽然一起来，可你还没看委托内容呢。',[{label:'先核对委托内容',run:()=>passed(true)}])},{label:'先看看委托内容',run:()=>passed(false)}]);save();
}
function passed(corrected:boolean){choices(corrected?'这就对了。委托人、内容和落款都确认，再做决定。':'不错，先核对委托人、内容和落款，再做决定。',[{label:'这份委托是给我的？',run:()=>choices('其实，我是假装找不到。幕后店主想看看，你会怎么处理。',[{label:'原来是对我的考验呀！',run:()=>choices('是的。这份委托邀请你做新主理人。一起进店看看？',[{label:'一起进去看看',run:openDoor}])}])}]);}
async function openDoor(){audio.play('key');game.classList.add('door-open');await wait(950);let already=false;try{
 const profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{"coins":0,"archives":[],"firstReward":false}');already=profile.firstReward===true;
 if(!already){profile.coins=(Number(profile.coins)||0)+100;profile.archives=[...new Set([...(profile.archives||[]),'神秘老板的见面礼？'])];profile.firstReward=true;profile.isOwner=true;localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}
 }catch{}
 modal('欢迎来到寻物事务所','从今天起，这里就交给你了。',[{text:'再体验一次',primary:true,fn:restart}]);const reward=document.createElement('div');reward.className='reward';reward.innerHTML='事务所主理权 · '+(already?'已领取':'获得')+'<br>金币 +100'+(already?'（已领取）':'')+'<small>新档案《神秘老板的见面礼？》</small>';$('dialog-body').insertBefore(reward,$('dialog-body').querySelector('button'));game.classList.remove('door-open');
}
function visibleCandidate(kind?:Kind){scene.updateMatrixWorld(true);for(const i of [...items].sort(()=>Math.random()-.5)){if(i.removed||(kind&&i.kind!==kind))continue;const p=i.root.position.clone().project(camera);if(Math.abs(p.x)>.93||Math.abs(p.y)>.85)continue;ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const hit=ray.intersectObjects(items.filter(i=>!i.removed).map(i=>i.root),true)[0];if(hit&&parentItem(hit.object)===i)return i;}return undefined;}
let pressed:{x:number;y:number}|null=null;
document.addEventListener('pointerdown',()=>{void audio.unlock();},{once:true});
renderer.domElement.addEventListener('pointerdown',e=>{pressed={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointercancel',()=>{pressed=null;});
renderer.domElement.addEventListener('pointerup',e=>{const start=pressed;pressed=null;if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>12||!ready||paused||busy||ended)return;void audio.unlock();lastInput=performance.now();const hit=pickableFromEvent(e);if(!hit){chat.invalid();return;}const item=parentItem(hit.object);if(item){if(!basketMode&&!firstTriple&&item.kind!=='camera'){chat.invalid();toast('先试着找到 3 台相机。');return;}void pickup(item);}});
$('pause').onclick=pauseMenu;$('target').onclick=()=>{if(!ready||paused)return;if(canTakeKey(state,busy))takeKey();else toast('整理完全部 '+totalItems/3+' 组，就能找到委托书。');};
document.querySelectorAll('.prop').forEach(b=>b.addEventListener('click',()=>{audio.play('tap');toast('这件工具会在后续委托中开放。');}));
dialog.addEventListener('cancel',e=>{e.preventDefault();if(state.tray.length<7&&!ended)closeModal();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();if(ready&&!dialog.open)modal('稍等你回来','动画和整理进度已暂停。',[{text:'继续整理',primary:true,fn:closeModal}]);video.setPaused(true);effects.setPaused(true);audio.setPaused(true);}else{last=performance.now();if(!paused){video.setPaused(false);effects.setPaused(false);audio.setPaused(false);}}});
addEventListener('pagehide',save);
function boneByName(root:THREE.Object3D,name:string){let found:THREE.Object3D|undefined;root.traverse(o=>{if(o.name===name)found=o;});return found;}
function visibleItems(){scene.updateMatrixWorld(true);return items.filter(i=>{if(i.removed)return false;const p=i.root.position.clone().project(camera);if(Math.abs(p.x)>.96||Math.abs(p.y)>.96)return false;ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const h=ray.intersectObjects(items.filter(j=>!j.removed).map(j=>j.root),true)[0];return !!h&&parentItem(h.object)===i;});}
function caseReport(){return{preset:basketMode?'basket-four':'original-six',target:'commission',countdown:countdown(playSeconds),likeMilestones:[...likeMilestones],sizeBoost:basketMode?{min:Math.min(...items.map(i=>sizeBoost(i.id))),max:Math.max(...items.map(i=>sizeBoost(i.id)))}:null,video:video.report(),chat:chat.snapshot(),intro:introTime<2,total:totalItems,inventory:activeKinds.map(kind=>({kind,total:items.filter(i=>i.kind===kind).length})),ready,paused,busy,groups:state.cleared/3,tray:state.tray.map(t=>({id:t.id,kind:t.kind})),remaining:items.filter(i=>!i.removed).length,goalAvailable:canTakeKey(state,busy),visible:visibleItems().map(i=>({id:i.id,kind:i.kind})),tutorial:!basketMode&&!firstTriple,ended,settling:{active:vacancySettler.running,passes:gapPasses,hole:detectedGap}};}
function registerTools(){
 const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>void}}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
 const register=(name:string,description:string,schema:object,execute:(input:unknown)=>unknown,readOnlyHint=false)=>{try{context.registerTool({name,description,inputSchema:schema,annotations:{readOnlyHint},execute},{signal:lifecycle.signal});}catch(e){console.warn('Optional game controls unavailable',e);}};
 register('read_case_state','Read the current sorting progress and the items visible at the top of the suitcase.',{type:'object',properties:{},additionalProperties:false},caseReport,true);
 register('collect_matching_groups','Sort up to four groups by selecting currently visible matching objects. Every pickup uses normal physics, tray capacity and animations; stops when no matching visible item is available.',{type:'object',properties:{groups:{type:'integer',minimum:1,maximum:4}},required:['groups'],additionalProperties:false},async input=>{
  const count=(input as {groups:number}).groups;if(!Number.isInteger(count)||count<1||count>4||!ready||paused||busy||ended)throw new Error('Cannot sort in this state');const goal=state.cleared+count*3;let steps=0;
  while(state.cleared<goal&&steps++<count*3+6&&!paused&&!ended){const visible=visibleItems().reverse();const existing=state.tray.find(t=>visible.some(i=>i.kind===t.kind));const kind=existing?.kind??activeKinds.find(k=>visible.filter(i=>i.kind===k).length>=3)??visible[0]?.kind;const item=visible.find(i=>i.kind===kind);if(!item)break;await pickup(item);}return caseReport();
 });
 register('collect_visible_item','Pick up one visible item, using the same sorting and animation rules as a tap. Items covered by others cannot be picked.',{type:'object',properties:{id:{type:'integer'}},required:['id'],additionalProperties:false},async input=>{
  const id=(input as {id?:unknown})?.id;if(!Number.isInteger(id)||!ready||paused||busy||ended)throw new Error('Cannot collect in this state');
  const item=visibleItems().find(i=>i.id===id);if(!item)throw new Error('Item is not visible');if(!basketMode&&!firstTriple&&item.kind!=='camera')throw new Error('First collect three cameras');await pickup(item);return caseReport();
 });
 register('collect_visible_items','Collect a small selection of currently visible items in sequence. Uses the normal animations and matching rules; stops if the next item becomes covered or the tray fills.',{type:'object',properties:{ids:{type:'array',items:{type:'integer'},minItems:1,maxItems:6}},required:['ids'],additionalProperties:false},async input=>{
  const ids=(input as {ids?:unknown})?.ids;if(!Array.isArray(ids)||!ids.length||ids.length>6||ids.some(id=>!Number.isInteger(id))||new Set(ids).size!==ids.length)throw new Error('Invalid item selection');
  if(!ready||paused||busy||ended)throw new Error('Cannot collect in this state');
  const available=visibleItems();if(ids.some(id=>!available.some(i=>i.id===id)))throw new Error('Selection contains a covered item');
  const collected:number[]=[];for(const id of ids){const item=visibleItems().find(i=>i.id===id);if(!item||paused||ended||(!basketMode&&!firstTriple&&item.kind!=='camera'))break;await pickup(item);collected.push(id);}
  return{collected,state:caseReport()};
 });
 addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
async function init(){
 await RAPIER.init();world=new RAPIER.World({x:0,y:basketMode?BASKET_GRAVITY:-9.81,z:0});world.timestep=BASKET_STEP;boundaries();let loaded=0;
 await Promise.all(activeKinds.map(async kind=>{const gltf=await loader.loadAsync(assetBase+'models/'+(basketMode?'basket-':'')+kind+'.glb');const template:Template=basketMode?normalizeBasket(gltf.scene):normalize(gltf.scene,sizes[kind]);if(basketMode)tuneBasketSurface(template.root);else{tuneSurface(template.root,kind);template.hull=contactHull(template.root);}templates.set(kind,template);$('load-fill').style.width=(++loaded/(activeKinds.length+3)*85)+'%';}));
 activeKinds.forEach(k=>makeThumb(k,templates.get(k)!.root));await spawn();
 $('load-fill').style.width='100%';ready=true;restore();renderTray();if(canTakeKey(state)){$('target').classList.add('found');$('target-status').textContent='查看委托';}
 await wait(120);$('loading').style.opacity='0';await wait(350);$('loading').remove();if(!resumed){prepareIntro();chat.pair('咱们来看看这家店。咦，我的委托书放哪儿了？','别急，我帮你一起找！',true);}video.start(resumed);video.setPaused(paused||document.hidden);
 registerTools();
 function frame(now:number){requestAnimationFrame(frame);const activeDt=Math.max(0,(now-last)/1000),dt=Math.min(activeDt,basketMode?.08:.05);last=now;if(!paused&&!document.hidden){elapsed+=dt;
  video.tick(dt);chat.tick(dt);if(!ended&&introTime>=2){playSeconds+=activeDt;updateClock();}
  if(introTime<2){drawIntro(dt);renderer.render(scene,camera);return;}
  if(basketMode){if(items.some(i=>!i.removed&&!i.body.isSleeping())){accumulator+=dt;let n=0;while(accumulator>=BASKET_STEP&&n++<5){world.step();accumulator-=BASKET_STEP;}}else accumulator=0;}
  else{accumulator+=dt;let n=0;while(accumulator>=1/60&&n++<3){vacancySettler.step(1/60);world.step();accumulator-=1/60;}}
  syncBodies();
  if(!basketMode&&elapsed>nextGapCheck&&!busy&&!ended){
   nextGapCheck=elapsed+1;
   if(lastGapRemoved!==state.removed.length){lastGapRemoved=state.removed.length;gapPasses=0;}
   if(state.removed.length>0&&72-state.removed.length>=12){
    const hole=detectedGap=visibleGap();
    if(gapAssist&&!hole){vacancySettler.stop();gapAssist=false;gapCooldown=elapsed+2;}
    else if(hole&&!vacancySettler.running&&elapsed>gapCooldown&&gapPasses<3){
     vacancySettler.begin(items,hole,true);gapAssist=true;gapPasses++;gapCooldown=elapsed+4;
    }
   }
  }
  if(performance.now()>speechUntil)speech.classList.add('quiet');
  if(now-lastInput>8000&&!busy&&!ended&&now>speechUntil){idleHint=visibleCandidate(basketMode||firstTriple?undefined:'camera');hintUntil=now+950;lastInput=now;audio.play('hint');}
  if(idleHint&&now<hintUntil&&!idleHint.removed){idleHint.root.rotateY(Math.sin((now-hintUntil)/90)*.035);}else idleHint=undefined;
  audio.update();
 }if(!paused&&!document.hidden)renderer.render(scene,camera);}
 requestAnimationFrame(frame);
}
init().catch(error=>{console.error(error);$('loading-copy').textContent='旅行箱没能装好，请刷新重试。';const b=document.createElement('button');b.textContent='重新加载';b.onclick=()=>location.reload();$('loading').querySelector('.loading-card')!.append(b);});

// Exact four-item preset from 口袋儿第二关提案Demo/src/shoppingBasketPhysics.ts.
// Defaults preserve the old Demo; the suitcase can opt into roomier bounds and spawning.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
export const BASKET_KINDS = ['milk','cup','carrot','burger'] as const;
export type BasketKind = typeof BASKET_KINDS[number];
export type BasketSpec = {kind:BasketKind;sizeFactor:number};
export const BASKET_TOTAL = 96;
export const BASKET_INVENTORY = {carrot:30,cup:18,burger:18,milk:30} as const;
export const BASKET_GRAVITY = -17.5;
export const BASKET_STEP = 1/60;
export const BASKET_SETTLE_STEPS = 240;
export function createBasketPlan(random:()=>number=Math.random):BasketSpec[]{
 const plan:BasketSpec[]=[];
 for(const [kind,total] of Object.entries(BASKET_INVENTORY)){
  for(const sizeFactor of [1.3,1.4,1.5])for(let n=0;n<total/3;n++)plan.push({kind:kind as BasketKind,sizeFactor});
 }
 for(let i=plan.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[plan[i],plan[j]]=[plan[j],plan[i]];}
 return plan;
}
export function validBasketPlan(value:unknown):value is BasketSpec[]{
 if(!Array.isArray(value)||value.length!==BASKET_TOTAL||value.some(s=>!s||!BASKET_KINDS.includes(s.kind)||![1.3,1.4,1.5].includes(s.sizeFactor)))return false;
 return Object.entries(BASKET_INVENTORY).every(([kind,total])=>[1.3,1.4,1.5].every(size=>value.filter(s=>s.kind===kind&&s.sizeFactor===size).length===total/3));
}
export function normalizeBasket(source:THREE.Group){
 source.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 const initial=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
 source.scale.setScalar(1.08/Math.max(initial.x,initial.y,initial.z,.01));source.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(source),size=box.getSize(new THREE.Vector3());
 source.position.sub(box.getCenter(new THREE.Vector3()));
 const root=new THREE.Group();root.add(source);
 return {root,size,half:size.clone().multiplyScalar(.34).clampScalar(.24,.43)};
}
export function basketBoundaries(world:RAPIER.World,halfWidth=3.05,wallHeight=5.6){
 const boxes=[
  [0,-.26,0,3.8,.26,3.75],
  [0,wallHeight/2,-3.7,3.86,wallHeight/2,.14],[0,wallHeight/2,3.7,3.86,wallHeight/2,.14],
  [-halfWidth,wallHeight/2,0,.14,wallHeight/2,3.86],[halfWidth,wallHeight/2,0,.14,wallHeight/2,3.86]
 ];
 for(const [x,y,z,hx,hy,hz] of boxes){
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setFriction(1.15).setRestitution(.015),body);
 }
}
export function spawnBasketItem(world:RAPIER.World,template:ReturnType<typeof normalizeBasket>,spec:BasketSpec,index:number,spacing=1.35,layerSpacing=.7,baseY=.7){
 const layer=Math.floor(index/16),slot=index%16,col=slot%4,row=Math.floor(slot/4);
 const x=(col-1.5)*spacing+(Math.random()-.5)*.3,z=(row-1.5)*spacing+(Math.random()-.5)*.3,y=baseY+layer*layerSpacing+Math.random()*.18;
 const root=template.root.clone(true);root.scale.setScalar(spec.sizeFactor);root.position.set(x,y,z);
 root.rotation.set((Math.random()-.5)*1,Math.random()*Math.PI*2,(Math.random()-.5)*1);
 const body=createBasketBody(world,template.half,root);
 return {root,body,kind:spec.kind,id:index,removed:false};
}
export function createBasketBody(world:RAPIER.World,templateHalf:THREE.Vector3,root:THREE.Group){
 const {x,y,z}=root.position;
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setRotation(root.quaternion).setLinearDamping(.58).setAngularDamping(.8).setCanSleep(true));
 const half=templateHalf.clone().multiplyScalar(root.scale.x);
 world.createCollider(RAPIER.ColliderDesc.cuboid(half.x,half.y,half.z).setDensity(.76).setFriction(.94).setRestitution(.018),body);
 return body;
}
export function nudgeBasketNeighbours(items:{body:RAPIER.RigidBody;removed:boolean}[],origin:{x:number;y:number;z:number}){
 for(const item of items){
  if(item.removed)continue;
  const p=item.body.translation(),dx=p.x-origin.x,dz=p.z-origin.z,distance=Math.hypot(dx,dz);
  if(distance>2.35||Math.abs(p.y-origin.y)>2)continue;
  item.body.wakeUp();
  if(distance>.08){const strength=(1-distance/2.35)*.035;item.body.applyImpulse({x:-dx/distance*strength,y:0,z:-dz/distance*strength},true);}
 }
}

/** Recover the same body only if an old snapshot or a solver failure left the box. */
export function recoverBasketOutliers(items:{id:number;body:RAPIER.RigidBody;removed:boolean}[]){
 const active=items.filter(i=>!i.removed),outside=(p:{x:number;y:number;z:number})=>![p.x,p.y,p.z].every(Number.isFinite)||p.y<-.6||Math.abs(p.x)>4||Math.abs(p.z)>4.2;
 const bad=active.filter(i=>outside(i.body.translation()));if(!bad.length)return 0;
 const top=Math.max(1.5,...active.filter(i=>!bad.includes(i)).map(i=>i.body.translation().y));
 bad.forEach((i,n)=>{i.body.setTranslation({x:((i.id%3)-1)*1.1,y:Math.min(8,top+1.2+n*.3),z:((Math.floor(i.id/3)%3)-1)*1.1},true);i.body.setLinvel({x:0,y:0,z:0},true);i.body.setAngvel({x:0,y:0,z:0},true);i.body.enableCcd(true);});return bad.length;
}

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
type Item={id:number;root:THREE.Group;body:RAPIER.RigidBody;removed:boolean};
type Lift={item:Item;from:THREE.Vector3;to:THREE.Vector3;halfY:number};

/** Bounded physical jostling plus a small, controlled surface refill for a safe next match. */
export class PileShake {
 active=false;count=0;targets:number[]=[];
 private time=0;private pulse=-1;private items:Item[]=[];private lift:Lift[]=[];private lifted=false;private released=false;
 private properties=new Map<number,{friction:number;ccd:boolean}>();private direction={x:1,z:0};private strength=1;
 begin(items:Item[],targets:number[],direction:{x:number;y:number;strength:number}){
  if(this.active||!items.some(i=>!i.removed))return false;
  this.active=true;this.count++;this.targets=[...targets];this.items=items.filter(i=>!i.removed);this.time=0;this.pulse=-1;this.lift=[];this.lifted=false;this.released=false;
  const length=Math.hypot(direction.x,direction.y)||1;this.direction={x:direction.x/length,z:-direction.y/length};this.strength=Math.min(1.15,Math.max(.8,direction.strength));
  for(const i of this.items){this.properties.set(i.id,{friction:i.body.collider(0).friction(),ccd:i.body.isCcdEnabled()});i.body.collider(0).setFriction(.24);i.body.enableCcd(true);i.body.wakeUp();}
  return true;
 }
 private beginLift(){
  this.lifted=true;
  const chosen=this.targets.map(id=>this.items.find(i=>i.id===id)!).filter(Boolean),other=this.items.filter(i=>!this.targets.includes(i.id));
  const box=new THREE.Box3();let top=.1;
  for(const i of other){i.root.updateMatrixWorld(true);top=Math.max(top,box.setFromObject(i.root).max.y);}
  const slots=[-1.95,0,1.95].sort(()=>Math.random()-.5);
  this.lift=chosen.map((item,index)=>{item.root.updateMatrixWorld(true);const halfY=box.setFromObject(item.root).getSize(new THREE.Vector3()).y/2;
   const from=new THREE.Vector3().copy(item.body.translation()),to=new THREE.Vector3(slots[index],top+halfY+.22,.7+(Math.random()-.5)*.25);
   item.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);item.body.collider(0).setEnabled(false);
   return{item,from,to,halfY};
  });
 }
 step(dt:number){
  if(!this.active)return false;this.time+=Math.min(.08,Math.max(0,dt));
  const pulse=Math.floor(this.time/.18);
  if(this.time<.85&&pulse!==this.pulse){this.pulse=pulse;const sign=pulse%2?-1:1,fade=1-this.time/.95;
   for(const i of this.items){if(i.removed||this.lift.some(l=>l.item===i))continue;const m=i.body.mass(),jitter=(Math.random()-.5)*.6;
    i.body.applyImpulse({x:(this.direction.x*sign*1.95+jitter)*m*fade*this.strength,y:m*(pulse===0?.95:.23)*fade,z:(this.direction.z*sign*1.95-jitter)*m*fade*this.strength},true);
    i.body.setAngvel({x:(Math.random()-.5)*1.8,y:(Math.random()-.5)*2.2,z:(Math.random()-.5)*1.8},true);
   }
  }
  if(this.time>=.26&&!this.lifted)this.beginLift();
  if(this.lifted&&!this.released){
   const t=Math.min(1,(this.time-.26)/.9),horizontal=Math.max(0,(t-.38)/.62),ease=1-Math.pow(1-horizontal,3);
   for(const l of this.lift){const y=t<.38?THREE.MathUtils.lerp(l.from.y,l.to.y+.15,1-Math.pow(1-t/.38,3)):l.to.y+Math.sin(Math.PI*horizontal)*.15;
    l.item.body.setNextKinematicTranslation({x:THREE.MathUtils.lerp(l.from.x,l.to.x,ease),y,z:THREE.MathUtils.lerp(l.from.z,l.to.z,ease)});
   }
   if(t===1){this.released=true;for(const l of this.lift){l.item.body.setTranslation(l.to,true);l.item.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);l.item.body.collider(0).setEnabled(true);l.item.body.setLinvel({x:0,y:-.15,z:0},true);l.item.body.setAngvel({x:0,y:0,z:0},true);}}
  }
  // Dense contacts can amplify a small pulse. Bound only the transient shake
  // velocity so the larger side-to-side motion never becomes an upward launch.
  for(const i of this.items){if(i.removed||!i.body.isDynamic())continue;
   const v=i.body.linvel(),horizontal=Math.hypot(v.x,v.z),factor=horizontal>4?4/horizontal:1,y=Math.min(v.y,2.4);
   if(factor<1||y!==v.y)i.body.setLinvel({x:v.x*factor,y,z:v.z*factor},true);
  }
  if(this.time>=2.35){this.stop();return true;}return false;
 }
 stop(){
  if(!this.active)return;
  for(const i of this.items){if(i.removed)continue;const p=this.properties.get(i.id)!;i.body.collider(0).setFriction(p.friction);i.body.enableCcd(p.ccd);if(i.body.isKinematic()){i.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);i.body.collider(0).setEnabled(true);i.body.setLinvel({x:0,y:0,z:0},true);}}
  this.properties.clear();this.lift=[];this.active=false;
 }
 report(){return{active:this.active,count:this.count,targets:[...this.targets]};}
}

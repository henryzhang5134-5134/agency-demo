import RAPIER from '@dimforge/rapier3d-compat';

type Point={x:number;y:number;z:number};
type PhysicalItem={body:RAPIER.RigidBody;removed:boolean};

// Brief local settling assistance, not a permanent attraction to the centre.
// Contacts still determine the path and gravity alone controls vertical motion.
export class VacancySettler {
 private active:{origin:Point;items:PhysicalItem[];left:number;duration:number;frictions:number[];combineRules:RAPIER.CoefficientCombineRule[]}|null=null;
 get running(){return this.active!==null;}
 stop(){if(this.active)this.active.items.forEach((i,n)=>{i.body.collider(0).setFriction(this.active!.frictions[n]);i.body.collider(0).setFrictionCombineRule(this.active!.combineRules[n]);});this.active=null;}
 begin(items:PhysicalItem[],origin:Point,largeGap=false){
  this.stop();
  const nearby=items.filter(i=>!i.removed&&Math.hypot(i.body.translation().x-origin.x,i.body.translation().z-origin.z)<(largeGap?4.8:2.7))
   .sort((a,b)=>Math.hypot(a.body.translation().x-origin.x,a.body.translation().z-origin.z)-Math.hypot(b.body.translation().x-origin.x,b.body.translation().z-origin.z)).slice(0,largeGap?72:5);
  const frictions=nearby.map(i=>i.body.collider(0).friction()),combineRules=nearby.map(i=>i.body.collider(0).frictionCombineRule()),duration=largeGap?2.6:.85;
  if(largeGap)nearby.forEach(i=>{i.body.collider(0).setFriction(.12);i.body.collider(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);i.body.wakeUp();});
  this.active={origin:{...origin},items:nearby,left:duration,duration,frictions,combineRules};
 }
 step(dt:number){
  const active=this.active;if(!active)return;
  active.left-=dt;if(active.left<=0){this.stop();return;}
  for(const item of active.items){
   if(item.removed)continue;const p=item.body.translation(),dx=active.origin.x-p.x,dz=active.origin.z-p.z,d=Math.hypot(dx,dz);
   if(d<.5||d>(active.duration>1?4.8:2.7))continue;
   const ramp=Math.min(1,(active.duration-active.left)/.3,active.left/.4);
   const speed=Math.min(.9,(d-.5)*1.1)*ramp,v=item.body.linvel();
   let vx=dx/d*speed-v.x,vz=dz/d*speed-v.z;const change=Math.hypot(vx,vz),limit=12*dt;
   if(change>limit){vx*=limit/change;vz*=limit/change;}
   item.body.applyImpulse({x:vx*item.body.mass(),y:0,z:vz*item.body.mass()},true);
  }
 }
}

// Sample only the central floor footprint. Ignore fixed floor and side walls.
// Follow the gameplay camera angle so detection matches visible gaps.
// Four adjacent empty samples distinguish a visible hole from a tiny seam.
export function findCentralVacancy(world:RAPIER.World,visibleAt?:(x:number,z:number)=>boolean):Point|null{
 const empty=new Set<number>();
 for(let row=0;row<7;row++)for(let col=0;col<7;col++){
  const x=(col-3)*.48,z=(row-3)*.38-.075;
  const occupied=visibleAt?visibleAt(x,z):!!world.castRay(new RAPIER.Ray({x,y:15,z:z+3.3},{x:0,y:-1,z:-.22}),15,true,RAPIER.QueryFilterFlags.EXCLUDE_FIXED);
  if(!occupied)empty.add(row*7+col);
 }
 let largest:number[]=[];
 while(empty.size){const start=empty.values().next().value!;empty.delete(start);const component=[start];
  for(let n=0;n<component.length;n++){const id=component[n],row=Math.floor(id/7),col=id%7;
   for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const r=row+dr,c=col+dc,k=r*7+c;if(r>=0&&r<7&&c>=0&&c<7&&empty.delete(k))component.push(k);}}
  if(component.length>largest.length)largest=component;
 }
 if(largest.length<4)return null;
 const centre=largest.reduce((p,id)=>({x:p.x+(id%7-3)*.48,z:p.z+(Math.floor(id/7)-3)*.38-.075}),{x:0,z:0});
 const x=centre.x/largest.length,z=centre.z/largest.length;
 largest.sort((a,b)=>Math.hypot((a%7-3)*.48-x,(Math.floor(a/7)-3)*.38-.075-z)-Math.hypot((b%7-3)*.48-x,(Math.floor(b/7)-3)*.38-.075-z));
 return{x:(largest[0]%7-3)*.48,y:.5,z:(Math.floor(largest[0]/7)-3)*.38-.075};
}

// Rounded, slightly inset contact volumes avoid the invisible square corners
// that made irregular models bridge gaps like rigid shelving.
export function itemCollider(size:Point,scale:number,hull?:Float32Array){
 if(hull){const points=Float32Array.from(hull,n=>n*scale*.94);const fitted=RAPIER.ColliderDesc.roundConvexHull(points,.025);if(fitted)return fitted.setDensity(.9).setFriction(.5).setRestitution(.015);}
 const half={x:Math.max(.1,size.x*scale*.4),y:Math.max(.09,size.y*scale*.4),z:Math.max(.09,size.z*scale*.4)};
 const radius=Math.min(.075,half.x*.3,half.y*.3,half.z*.3);
 return RAPIER.ColliderDesc.roundCuboid(half.x-radius,half.y-radius,half.z-radius,radius)
  .setDensity(.9).setFriction(.62).setRestitution(.015);
}

// One small, mass-independent inward nudge on removal, as in the earlier demo.
// Gravity handles the fall; no perpetual attraction, teleporting, or upward kick.
export function releaseNeighbours(items:PhysicalItem[],origin:Point){
 let affected=0;
 for(const item of items){
  if(item.removed)continue;
  const p=item.body.translation(),dx=p.x-origin.x,dz=p.z-origin.z,d=Math.hypot(dx,dz);
  item.body.wakeUp();
  if(d<.06||d>2.7||Math.abs(p.y-origin.y)>2.6)continue;
  const impulse=item.body.mass()*.65*(1-d/2.7);
  item.body.applyImpulse({x:-dx/d*impulse,y:0,z:-dz/d*impulse},true);
  affected++;
 }
 return affected;
}

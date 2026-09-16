import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {itemCollider,releaseNeighbours,VacancySettler,findCentralVacancy} from '../src/pile-physics.ts';
await RAPIER.init();
const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=1/60;
const ground=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.1,0));
world.createCollider(RAPIER.ColliderDesc.cuboid(5,.1,5),ground);
function make(x,y,z){const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(.58).setAngularDamping(.8));world.createCollider(itemCollider({x:1,y:1,z:1},1),body);return{body,removed:false};}
const support=make(0,.42,0),top=make(0,1.25,0),near=make(1.8,.42,0),far=make(4,.42,0);
for(let n=0;n<240;n++)world.step();
const before=top.body.translation().y;
support.removed=true;support.body.setEnabled(false);
releaseNeighbours([support,top,near,far],support.body.translation());
assert.ok(!top.body.isSleeping(),'unsupported upper item must wake');
assert.ok(near.body.linvel().x<0,'nearby object must be nudged toward the hole');
assert.ok(Math.abs(near.body.linvel().y)<.01,'nudge must not launch the object upwards');
assert.ok(Math.abs(far.body.linvel().x)<.01,'distant object must not be pulled across the suitcase');
for(let n=0;n<180;n++)world.step();
const after=top.body.translation().y;
assert.ok(before-after>.55,'removing support must make upper item fall to the floor');
assert.ok(after<.43,'upper item must not remain suspended');
console.log('PASS: support removal drops upper item',before.toFixed(3),'→',after.toFixed(3),'; inward-only local nudge; no distant attraction.');
const settle=new VacancySettler(),startX=near.body.translation().x;
settle.begin([near,far],{x:0,y:0,z:0});
for(let n=0;n<90;n++){settle.step(1/60);world.step();}
assert.ok(near.body.translation().x<startX-.15,'local assistance must visibly reduce the vacancy');
near.body.setLinvel({x:0,y:0,z:0},true);settle.step(1/60);
assert.equal(near.body.linvel().x,0,'assistance must stop instead of continuously attracting items');
console.log('PASS: temporary vacancy settling moves neighbour inward and expires.');
world.free();
const ringWorld=new RAPIER.World({x:0,y:-9.81,z:0});ringWorld.timestep=1/60;
const ringFloor=ringWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.1,0));
ringWorld.createCollider(RAPIER.ColliderDesc.cuboid(4,.1,4).setFriction(.85),ringFloor);
const ring=[];
for(let n=0;n<12;n++){const a=n/12*Math.PI*2,body=ringWorld.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(Math.cos(a)*2,.5,Math.sin(a)*2).setLinearDamping(.58).setAngularDamping(.8));
ringWorld.createCollider(itemCollider({x:1,y:1,z:1},1),body);ring.push({body,removed:false});}
for(let n=0;n<180;n++)ringWorld.step();
assert.ok(findCentralVacancy(ringWorld),'an empty ring centre must trigger detection');
const averageRadius=()=>ring.reduce((s,i)=>s+Math.hypot(i.body.translation().x,i.body.translation().z),0)/ring.length;
const initialRadius=averageRadius(),ringSettle=new VacancySettler();
for(let pass=0;pass<3;pass++){const hole=findCentralVacancy(ringWorld);if(!hole)break;ringSettle.begin(ring,hole,true);for(let n=0;n<200;n++){ringSettle.step(1/60);ringWorld.step();}}
assert.ok(averageRadius()<initialRadius-.3,'ring objects must slide inward, not just wake up');
assert.ok(ring.every(i=>Math.abs(i.body.collider(0).friction()-.62)<.001),'temporary friction must restore');
console.log('PASS: ring-centre detection and inward slide',initialRadius.toFixed(2),'→',averageRadius().toFixed(2));
ringWorld.free();

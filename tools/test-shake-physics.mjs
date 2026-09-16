import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {normalizeBasket,basketBoundaries,spawnBasketItem,createBasketPlan,recoverBasketOutliers} from '../src/basket-preset.ts';
import {sizeBoost} from '../src/commission-rules.ts';
import {PileShake} from '../src/pile-shake.ts';
import {shakeTargets} from '../src/shake-rules.ts';
import {collect,initialState} from '../src/rules.ts';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),templates=new Map();
for(const kind of ['milk','carrot','cup','burger']){
 const input=readFileSync(new URL('../public/models/basket-'+kind+'.glb',import.meta.url)),oldLength=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+oldLength).toString());
 delete json.images;delete json.textures;delete json.materials;json.meshes.forEach(m=>m.primitives.forEach(p=>delete p.material));
 const bytes=Buffer.from(JSON.stringify(json)),length=Math.ceil(bytes.length/4)*4,tail=input.subarray(20+oldLength),out=Buffer.alloc(20+length+tail.length,0x20);input.copy(out,0,0,20);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);bytes.copy(out,20);tail.copy(out,20+length);
 templates.set(kind,normalizeBasket((await loader.parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'')).scene));
}
await RAPIER.init();const oldRandom=Math.random;
try{
 for(const initialSeed of [80413,80414]){
  let seed=initialSeed;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const world=new RAPIER.World({x:0,y:-17.5,z:0});world.timestep=1/60;basketBoundaries(world,3.6,10);const scene=new THREE.Scene();
  const items=createBasketPlan().map((s,id)=>{const i=spawnBasketItem(world,templates.get(s.kind),{...s,sizeFactor:s.sizeFactor*sizeBoost(id)},id,1.65,1.25,1.2);i.body.enableCcd(true);i.root.userData.id=id;scene.add(i.root);return i;});
  const update=()=>{for(const i of items)if(!i.removed){i.root.position.copy(i.body.translation());i.root.quaternion.copy(i.body.rotation());}scene.updateMatrixWorld(true);};
  for(let n=0;n<300;n++)world.step();update();
  const camera=new THREE.OrthographicCamera(-4.15,4.15,4.15+30*8.3/750,-4.15+30*8.3/750,.1,60);camera.position.set(0,22,4);camera.lookAt(0,1.5,0);camera.updateMatrixWorld();const ray=new THREE.Raycaster();
  const visible=id=>{const i=items[id],p=i.root.position.clone().project(camera);if(Math.abs(p.x)>.96||Math.abs(p.y)>.96)return false;ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);let o=ray.intersectObjects(items.filter(j=>!j.removed).map(j=>j.root),true)[0]?.object;while(o&&o.userData.id===undefined)o=o.parent;return o?.userData.id===id;};
  let state=initialState();const shake=new PileShake();
  // Begin with five occupied slots: two pairs and a singleton, as in real play.
  for(const kind of ['milk','milk','cup','cup','burger']){const i=items.find(i=>i.kind===kind&&!i.removed);state=collect(state,{id:i.id,kind:i.kind}).state;i.removed=true;scene.remove(i.root);world.removeRigidBody(i.body);}
  while(state.cleared<96){
   const remaining=items.filter(i=>!i.removed).sort((a,b)=>b.body.translation().y-a.body.translation().y),targets=shakeTargets(state.tray,remaining),before=JSON.stringify(state),ids=remaining.map(i=>i.id).sort();assert.ok(targets.length);
   assert.ok(shake.begin(items,targets,{x:.8,y:.3,strength:1}));assert.equal(shake.begin(items,targets,{x:1,y:0,strength:1}),false);
   for(let n=0;n<150;n++){shake.step(1/60);world.step();update();}
   assert.equal(shake.active,false);assert.equal(JSON.stringify(state),before);assert.deepEqual(items.filter(i=>!i.removed).map(i=>i.id).sort(),ids);
   const positions=items.filter(i=>!i.removed).map(i=>({id:i.id,p:i.body.translation()}));
   assert.equal(recoverBasketOutliers(items),0,`Shake must not fling anything out: seed ${initialSeed}, round ${shake.count}, ${JSON.stringify(positions.filter(({p})=>p.y<-.6||Math.abs(p.x)>4||Math.abs(p.z)>4.2))}`);
   for(const id of targets){assert.ok(visible(id),`Seed ${initialSeed}, round ${shake.count}: target ${id} ${items[id].kind} not visible`);const i=items[id];state=collect(state,{id:i.id,kind:i.kind}).state;i.removed=true;scene.remove(i.root);world.removeRigidBody(i.body);for(let n=0;n<30;n++)world.step();update();}
   assert.ok(state.tray.length<7);
  }
  assert.equal(state.cleared,96);assert.equal(state.tray.length,0);world.free();console.log('PASS physical shake / 32 groups completed',initialSeed);
 }
}finally{Math.random=oldRandom;}

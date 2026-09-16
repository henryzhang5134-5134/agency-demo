import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {normalizeBasket,basketBoundaries,spawnBasketItem,createBasketPlan,nudgeBasketNeighbours,recoverBasketOutliers} from '../src/basket-preset.ts';
import {sizeBoost} from '../src/commission-rules.ts';

// Load real model geometry without raster materials; dimensions and transforms stay intact.
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),templates=new Map();
for(const kind of ['milk','carrot','cup','burger']){
 const input=readFileSync(new URL('../public/models/basket-'+kind+'.glb',import.meta.url));
 const oldLength=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+oldLength).toString());
 delete json.images;delete json.textures;delete json.materials;
 json.meshes.forEach(m=>m.primitives.forEach(p=>delete p.material));
 const jsonBytes=Buffer.from(JSON.stringify(json)),length=Math.ceil(jsonBytes.length/4)*4;
 const tail=input.subarray(20+oldLength),output=Buffer.alloc(20+length+tail.length,0x20);
 input.copy(output,0,0,20);output.writeUInt32LE(output.length,8);output.writeUInt32LE(length,12);jsonBytes.copy(output,20);tail.copy(output,20+length);
 const gltf=await loader.parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
 templates.set(kind,normalizeBasket(gltf.scene));
}
await RAPIER.init();const oldRandom=Math.random;
try{
 for(const startingSeed of [94321,94322,94323]){
  let seed=startingSeed;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const world=new RAPIER.World({x:0,y:-17.5,z:0});world.timestep=1/60;basketBoundaries(world,3.6,10);
  const items=createBasketPlan().map((spec,id)=>{const item=spawnBasketItem(world,templates.get(spec.kind),{...spec,sizeFactor:spec.sizeFactor*sizeBoost(id)},id,1.65,1.25,1.2);item.body.enableCcd(true);return item;});
  const check=()=>{for(const i of items.filter(i=>!i.removed)){const p=i.body.translation();assert.ok([p.x,p.y,p.z].every(Number.isFinite));assert.ok(Math.abs(p.x)<3.6&&Math.abs(p.z)<3.7&&p.y>0&&p.y<9,`Body ${i.id} left box: ${JSON.stringify(p)}`);}};
  for(let n=0;n<600;n++){world.step();if(n%60===59)check();}
  assert.equal(recoverBasketOutliers(items),0,'Normal spawning must not depend on recovery');
  for(const item of items.filter((_,i)=>i%4===0)){const p=item.body.translation();item.removed=true;world.removeRigidBody(item.body);nudgeBasketNeighbours(items,p);}
  for(let n=0;n<240;n++)world.step();check();assert.equal(recoverBasketOutliers(items),0);
  const original=items.find(i=>!i.removed),body=original.body,id=original.id;
  body.setTranslation({x:8,y:-500,z:6},true);assert.equal(recoverBasketOutliers(items),1);assert.equal(original.body,body);assert.equal(original.id,id);
  for(let n=0;n<240;n++)world.step();check();assert.equal(items.length,96);world.free();
 }
 console.log('PASS: real four-model bounds, 3 seeds × 96 enlarged objects, settle and removal containment, old outlier recovered without changing identity or count.');
}finally{Math.random=oldRandom;}

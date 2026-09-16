import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {BASKET_TOTAL,BASKET_GRAVITY,BASKET_STEP,BASKET_SETTLE_STEPS,createBasketPlan,validBasketPlan,normalizeBasket,basketBoundaries,spawnBasketItem,nudgeBasketNeighbours} from '../src/basket-preset.ts';
import {initialState,collect,canTakeKey} from '../src/rules.ts';

// Differential check against the existing Demo source, not a second transcription.
const legacy=readFileSync(new URL('../../口袋儿第二关提案Demo/src/shoppingBasketPhysics.ts',import.meta.url),'utf8');
const functions=legacy.slice(legacy.indexOf('function addFixedBox('),legacy.indexOf('function showModelGallery('))
 +legacy.slice(legacy.indexOf('function nudgeNeighbours('),legacy.indexOf('function renderTray('));
const compiled=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const legacyFactory=new Function('rapier','THREE','world','scene','items',compiled+';return {createBoundaries,createSpawnPlan,createStackItem,nudgeNeighbours};');
let seed=94107;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const originalRandom=Math.random;
await RAPIER.init();
const a=new RAPIER.World({x:0,y:BASKET_GRAVITY,z:0}),b=new RAPIER.World({x:0,y:BASKET_GRAVITY,z:0});
a.timestep=b.timestep=BASKET_STEP;
const originalItems=[],replacementItems=[],old=legacyFactory(RAPIER,THREE,a,new THREE.Scene(),originalItems);
try{
 Math.random=random;seed=94107;const oldPlan=old.createSpawnPlan();
 seed=94107;const plan=createBasketPlan();
 assert.deepEqual(plan,oldPlan.map(({kind,sizeFactor})=>({kind,sizeFactor})));
 assert.equal(validBasketPlan(plan),true);assert.equal(plan.length,96);
 assert.equal(validBasketPlan(plan.slice(1)),false);
 old.createBoundaries();basketBoundaries(b);
 const template=normalizeBasket(new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1,.8,.9),new THREE.MeshStandardMaterial())));
 assert.ok(Math.abs(template.size.x-1.08)<1e-6);
 seed=3456;oldPlan.forEach((spec,i)=>old.createStackItem(template,i,spec.kind,spec.sizeFactor));
 seed=3456;plan.forEach((spec,i)=>replacementItems.push(spawnBasketItem(b,template,spec,i)));
 const compare=()=>{originalItems.forEach((item,i)=>{if(item.removed)return;
  const p=item.body.translation(),q=replacementItems[i].body.translation();
  assert.ok(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<1e-6,'Legacy and migrated body positions must match');
 });};
 for(let i=0;i<BASKET_SETTLE_STEPS;i++){a.step();b.step();}
 compare();
 const removedIndex=90,origin=originalItems[removedIndex].body.translation();
 originalItems[removedIndex].removed=replacementItems[removedIndex].removed=true;
 a.removeRigidBody(originalItems[removedIndex].body);b.removeRigidBody(replacementItems[removedIndex].body);
 old.nudgeNeighbours(origin);nudgeBasketNeighbours(replacementItems,origin);
 for(let i=0;i<180;i++){a.step();b.step();}
 compare();
 let state=initialState(),id=0;
 for(const kind of ['milk','carrot','cup','burger']){
  const total=plan.filter(s=>s.kind===kind).length;
  for(let i=0;i<total;i++){assert.equal(canTakeKey(state,false,BASKET_TOTAL),false);state=collect(state,{id:id++,kind}).state;}
 }
 assert.equal(state.cleared,96);assert.equal(state.tray.length,0);assert.equal(canTakeKey(state,false,96),true);assert.equal(canTakeKey(state,true,96),false);
 for(const [i,kind] of ['milk','cup','carrot','burger'].entries()){
  const from=readFileSync(new URL('../../口袋儿第二关提案Demo/public/assets/item-0'+(i+1)+'-game.glb',import.meta.url));
  const to=readFileSync(new URL('../public/models/basket-'+kind+'.glb',import.meta.url));assert.equal(Buffer.compare(from,to),0);
 }
 console.log('PASS: exact old inventory/size distribution, identical 240-step settling and 180-step post-pickup physics, four byte-identical models, 32 matches and key lock.');
}finally{Math.random=originalRandom;a.free();b.free();}

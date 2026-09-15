import assert from 'node:assert/strict';
import {KINDS,initialState,spawnKinds,collect,canTakeKey} from '../src/rules.ts';
const plan=spawnKinds();assert.equal(plan.length,72);KINDS.forEach(k=>assert.equal(plan.filter(x=>x===k).length,12));assert.deepEqual(plan.slice(-3),['camera','camera','camera']);
let s=initialState(),id=0;
for(const k of KINDS)for(let group=0;group<4;group++)for(let n=0;n<3;n++){s=collect(s,{id:id++,kind:k}).state;}
assert.equal(s.cleared,72);assert.equal(s.tray.length,0);assert.equal(canTakeKey(s),true);assert.equal(canTakeKey(s,true),false);
assert.throws(()=>collect(s,{id:0,kind:'camera'}));
let t=initialState();['camera','car','cup','glass','glove','camera'].forEach((kind,id)=>t=collect(t,{id,kind}).state);
const seventh=collect(t,{id:6,kind:'camera'});assert.equal(seventh.full,false);assert.equal(seventh.state.tray.length,4);assert.equal(seventh.state.cleared,3);
let full=initialState();['car','cup','glass','glove','plush','camera','car'].forEach((kind,id)=>full=collect(full,{id,kind}).state);
assert.equal(full.tray.length,7);assert.throws(()=>collect(full,{id:8,kind:'cup'}));assert.equal(canTakeKey(full),false);
console.log('PASS: 72 items / 12 per kind, tutorial cameras, 24 triples, key lock, duplicate protection, seventh-slot matching before failure, full-slot protection.');

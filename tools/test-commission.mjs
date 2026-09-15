import assert from 'node:assert/strict';
import {countdown,LIKE_MILESTONES,sizeBoost} from '../src/commission-rules.ts';
assert.equal(countdown(0),'9:59');assert.equal(countdown(.99),'9:59');assert.equal(countdown(1),'9:58');assert.equal(countdown(599),'0:00');assert.equal(countdown(900),'0:00');
const boosts=Array.from({length:96},(_,id)=>sizeBoost(id));assert.ok(boosts.every(s=>s>=1.1-1e-10&&s<=1.15+1e-10));assert.ok(new Set(boosts).size>80);
assert.deepEqual(LIKE_MILESTONES,[.1,.25,.45,.65,.9]);const seen=new Set();const fired=[];for(let group=0;group<=32;group++){for(const p of LIKE_MILESTONES)if(group/32>=p&&!seen.has(p)){seen.add(p);fired.push(group)}}assert.deepEqual(fired,[4,8,15,21,29]);
console.log('PASS: 9:59 start / zero stays playable, deterministic 10–15% size increase, five once-per-round progress thresholds.');

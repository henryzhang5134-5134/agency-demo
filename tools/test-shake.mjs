import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shakeTargets,ShakeReminder} from '../src/shake-rules.ts';
import {ShakeDetector,PhoneShakeInput} from '../src/phone-shake.ts';
import {collect,initialState} from '../src/rules.ts';
const kinds=['milk','cup','carrot','burger'],tokens=kinds.flatMap((kind,k)=>Array.from({length:24},(_,j)=>({id:k*24+j,kind})));
for(let mask=0;mask<81;mask++){
 let m=mask,tray=[];for(const k of kinds){const n=m%3;m=Math.floor(m/3);tray.push(...tokens.filter(t=>t.kind===k).slice(0,n));}
 if(tray.length>=7)continue;let s={...initialState(),tray,removed:tray.map(t=>t.id)};
 while(s.removed.length<96){const remaining=tokens.filter(t=>!s.removed.includes(t.id)),before=JSON.stringify(s),ids=shakeTargets(s.tray,remaining);assert.ok(ids.length>0&&ids.length<=7-s.tray.length);assert.equal(JSON.stringify(s),before);for(const id of ids)s=collect(s,tokens[id]).state;}
 assert.equal(s.cleared,96);assert.equal(s.tray.length,0);
}
const d=new ShakeDetector();for(let t=0;t<1000;t+=16)assert.equal(d.sample({x:1,y:.6,z:.2},null,t),null);
assert.equal(d.sample({x:12,y:0,z:0},null,1100),null);assert.equal(d.sample({x:-12,y:0,z:0},null,1120),null);assert.ok(d.sample({x:-12,y:0,z:0},null,1210));assert.equal(d.sample({x:20,y:0,z:0},null,1310),null);assert.equal(d.sample(null,null,4500),null);assert.equal(d.sample({x:12,y:0,z:0},null,4600),null);assert.ok(d.sample({x:-12,y:0,z:0},null,4710));
const gravity=new ShakeDetector();for(let t=0;t<1000;t+=16)assert.equal(gravity.sample(null,{x:0,y:9.8,z:0},t),null);gravity.sample(null,{x:14,y:9.8,z:0},1010);assert.ok(gravity.sample(null,{x:-14,y:9.8,z:0},1120));
const delayed=new ShakeDetector();assert.equal(delayed.sample({x:14,y:0,z:0},null,100),null);assert.ok(delayed.sample({x:-14,y:0,z:0},null,600),'Opposing peaks inside 650ms survive sparse/delayed events');
const sparse=new ShakeDetector();sparse.sample({x:14,y:0,z:0},null,100);assert.equal(sparse.sample({x:null,y:null,z:null},{x:null,y:null,z:null},130),null);assert.ok(sparse.sample({x:-14,y:0,z:0},null,240),'Empty WebView packets must not erase the first peak');
const webidl=new ShakeDetector(),native=(x,y=0,z=0)=>Object.create({get x(){return x},get y(){return y},get z(){return z}});webidl.sample(native(14),null,100);assert.ok(webidl.sample(native(-14),null,220),'Native WebIDL prototype getters must be copied explicitly');
const nativeGravity=new ShakeDetector();nativeGravity.sample(null,native(0,9.8),10);nativeGravity.sample(null,native(14,9.8),100);assert.ok(nativeGravity.sample(null,native(-14,9.8),220));
const reminder=new ShakeReminder();assert.equal(reminder.update(4,0),false);assert.equal(reminder.update(5,0),true);assert.equal(reminder.update(5,8.1),false);assert.equal(reminder.update(6,1),false);reminder.update(3,31);assert.equal(reminder.update(5,0),true);assert.equal(reminder.update(7,0),false);
function host(secure=true){const h=new EventTarget();h.document=new EventTarget();h.document.hidden=false;h.isSecureContext=secure;h.screen={orientation:{angle:0}};h.performance={now:()=>now};h.DeviceMotionEvent={};return h;}
let now=0,allowed=true,triggered=0,requests=0;const h=host();h.DeviceMotionEvent.requestPermission=async()=>{requests++;return'granted'};
const input=new PhoneShakeInput(()=>triggered++,()=>allowed,()=>{},h);assert.equal(input.status,'permission');assert.equal(requests,0);assert.equal(await input.enable(),'ready');assert.equal(requests,1);
const sample=(x,t)=>{now=t;const e=new Event('devicemotion');Object.assign(e,{acceleration:{x,y:0,z:0},accelerationIncludingGravity:null});h.dispatchEvent(e);};
sample(15,100);allowed=false;sample(-15,220);allowed=true;sample(-15,340);assert.equal(triggered,0);sample(15,460);assert.equal(triggered,1);h.document.hidden=true;sample(-15,5000);sample(15,5150);assert.equal(triggered,1);input.destroy();h.document.hidden=false;sample(-15,5300);sample(15,5450);assert.equal(triggered,1);
const unavailable=new PhoneShakeInput(()=>{},()=>true,()=>{},host(false));assert.equal(unavailable.status,'unavailable');unavailable.destroy();
const deniedHost=host();deniedHost.DeviceMotionEvent.requestPermission=async()=>{throw new Error('denied')};const denied=new PhoneShakeInput(()=>{},()=>true,()=>{},deniedHost);assert.equal(await denied.enable(),'denied');denied.destroy();
// Sensor/reminder modules remain archived for later use, but the live preview is click-only.
const game=readFileSync(new URL('../src/game.ts',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.doesNotMatch(game,/new PhoneShakeInput|new ShakeReminder|\$\(['"]progress['"]\)/);
assert.doesNotMatch(html,/id="progress"|已归好/);
assert.match(html,/<button id="shake-hint"[^>]*>/);assert.doesNotMatch(html,/<button id="shake-hint"[^>]*hidden/);
console.log('PASS: all four-kind tray combinations remain solvable; persistent click-only footer with no progress caption; retained inactive sensor/reminder module regressions.');

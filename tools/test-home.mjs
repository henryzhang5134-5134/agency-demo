import assert from 'node:assert/strict';
import fs from 'node:fs';
import {simulatedTilt,deviceTilt} from '../src/home-motion.ts';
for(let t=0;t<=7;t+=.01){const p=simulatedTilt(t);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=.6);}
assert.deepEqual(simulatedTilt(0),{x:0,y:0,done:false});
assert.deepEqual(simulatedTilt(7),{x:0,y:0,done:true});
assert.deepEqual(deviceTilt(40,10,{beta:40,gamma:10},0),{x:0,y:0});
assert.deepEqual(deviceTilt(100,100,{beta:0,gamma:0},0),{x:1,y:1});
const landscape=deviceTilt(0,14,{beta:0,gamma:0},90);assert.ok(Math.abs(landscape.x)<1e-8&&landscape.y===-1);
const html=fs.readFileSync('home.html','utf8');
for(const [,asset] of html.matchAll(/src="(\/home\/[^"]+)"/g))assert.ok(fs.existsSync('public'+asset),asset+' exists');
assert.ok(!html.includes('src="/src/game.ts"'),'homepage must not load the 3D game');
assert.ok(html.includes('id="fixed-ui"'),'UI must stay outside parallax layers');
assert.ok(fs.readFileSync('src/home.ts','utf8').includes("a.href='/'"),'first-case link is preserved');
console.log('PASS: motion bounds, seven-second return, sensor calibration/orientation, home assets and isolated game entry.');

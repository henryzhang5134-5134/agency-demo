import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),html=read('index.html').toString(),code=read('src/presentation.ts').toString();
assert.doesNotMatch(html,/<video\b[^>]*\sautoplay(?:\s|=|>)/);
assert.doesNotMatch(html,/<video\b[^>]*\scontrols(?:\s|=|>)/);
assert.equal((html.match(/<canvas id="bear-frame-/g)||[]).length,2);
assert.match(html,/width:1px!important/);assert.match(html,/clip-path:inset\(50%\)!important/);
assert.doesNotMatch(code,/v\.autoplay\s*=\s*true/);
assert.match(code,/v\.controls=false/);assert.match(code,/requestVideoFrameCallback/);
assert.doesNotMatch(html,/<link[^>]+(?:completion-poster|welcome-backplate)/);
function boxes(buffer,start=0,end=buffer.length){
 const result=[];for(let p=start;p<end;){let size=buffer.readUInt32BE(p),head=8;if(size===1){size=Number(buffer.readBigUInt64BE(p+8));head=16;}if(size===0)size=end-p;assert.ok(size>=head&&p+size<=end);result.push({type:buffer.toString('ascii',p+4,p+8),start:p,data:p+head,end:p+size});p+=size;}return result;
}
let oldBytes=0,newBytes=0;
for(const name of ['arrival','idle-a','idle-b','smile','praise','completion']){
 const file=read(`public/video/web/${name}.mp4`),old=statSync(new URL(`public/video/mobile/${name}.mp4`,root)).size;
 assert.ok(file.length>10000&&file.length<old*.65,`${name} is valid and lighter`);oldBytes+=old;newBytes+=file.length;
 const top=boxes(file),movie=top.find(b=>b.type==='moov'),data=top.find(b=>b.type==='mdat');assert.ok(movie&&data&&movie.start<data.start,'Fast-start metadata precedes video bytes');
 const children=boxes(file,movie.data,movie.end),header=children.find(b=>b.type==='mvhd'),v=file[header.data];
 const timescale=file.readUInt32BE(header.data+(v?20:12)),duration=v?Number(file.readBigUInt64BE(header.data+24)):file.readUInt32BE(header.data+16);
 if(name==='arrival')assert.ok(Math.abs(duration/timescale-7.666667)<.05);
 const types=children.filter(b=>b.type==='trak').map(track=>{const media=boxes(file,track.data,track.end).find(b=>b.type==='mdia'),handler=boxes(file,media.data,media.end).find(b=>b.type==='hdlr');return file.toString('ascii',handler.data+8,handler.data+12);});
 assert.deepEqual(types,['vide'],'Runtime clips must have no silent or audible audio track');
}
console.log(`PASS video delivery: no exposed native video/autoplay controls; canvas display; six valid, video-only, fast-start clips ${oldBytes} -> ${newBytes} bytes; short arrival preserved.`);

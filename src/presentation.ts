/** Small presentation controllers. The physics world never depends on these clocks. */
const assetBase=import.meta.env?.BASE_URL??'/';
export class Effects {
 private running=new Set<Animation>(); private paused=false;
 animate(node:Element,frames:Keyframe[],duration:number,easing='ease-out'){
  const a=node.animate(frames,{duration,easing,fill:'forwards'});this.running.add(a);if(this.paused)a.pause();
  return a.finished.catch(()=>{}).finally(()=>{this.running.delete(a);a.cancel();});
 }
 setPaused(value:boolean){this.paused=value;for(const a of this.running)value?a.pause():a.play();}
 loop(node:Element,frames:Keyframe[],duration:number){
  const a=node.animate(frames,{duration,iterations:Infinity,easing:'linear'});this.running.add(a);if(this.paused)a.pause();
  void a.finished.catch(()=>{}).finally(()=>this.running.delete(a));return()=>a.cancel();
 }
 async likes(host:HTMLElement){
  await Promise.all(Array.from({length:9},(_,j)=>{const icon=document.createElement('i');icon.className='like-particle';icon.textContent=j%3?'👍':'♥';host.append(icon);const dx=(Math.random()-.5)*45,delay=j*.07,total=2.5+delay;
   return this.animate(icon,[{offset:0,opacity:0,transform:'translateY(15px) scale(.45)'},{offset:delay/total,opacity:0,transform:'translateY(15px) scale(.45)'},{offset:(delay+.22)/total,opacity:1,transform:`translate(${dx*.2}px,-20px) scale(1)`},{offset:(delay+1.7)/total,opacity:.9,transform:`translate(${dx}px,-175px) rotate(${j%2?12:-12}deg) scale(.85)`},{offset:1,opacity:0,transform:`translate(${-dx*.4}px,-275px) scale(.6)`}],total*1000,'linear').then(()=>icon.remove());}));
 }
 async stars(host:HTMLElement,x:number,y:number,count=9){
  await Promise.all(Array.from({length:count},(_,j)=>{const star=document.createElement('i');star.className='effect-star';star.textContent=j%3?'✦':'✧';star.style.left=x+'px';star.style.top=y+'px';star.style.color=j%2?'#ffd659':'#fff4bf';host.append(star);const angle=j/count*Math.PI*2,reach=38+Math.random()*35;
   return this.animate(star,[{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{offset:.18,transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(angle)*reach}px),calc(-50% + ${Math.sin(angle)*reach+15}px)) rotate(${j*43}deg) scale(.1)`,opacity:0}],520+Math.random()*150).then(()=>star.remove());}));
 }
}

type Clip='arrival'|'idle-a'|'idle-b'|'smile'|'praise'|'completion';
export class VideoDirector {
 private videos:HTMLVideoElement[];private front=0;private active:Clip='arrival';private nextIdle:Clip;private phase='stopped';private wait=0;private paused=false;private praise=false;private requestedAt=-100;private clock=0;
 private generation=0;private finale=false;private finaleElapsed=0;private lastFinalTime=-1;private nearEnd:(()=>void)|null=null;private failed:(()=>void)|null=null;
 private arrivalCallback:(()=>void)|null=null;private arrivalNotified=false;private arrivalElapsed=0;
 constructor(private retry:HTMLButtonElement,private random:()=>number=Math.random){
  this.nextIdle=this.chooseIdle('arrival');
  this.videos=[document.querySelector('#bear-video-a')!,document.querySelector('#bear-video-b')!];
  this.videos.forEach((v,i)=>{v.muted=true;v.pause();v.addEventListener('ended',()=>{if(i!==this.front)return;if(this.active==='completion'){this.finishNearEnd();this.phase='completion-tail';return;}if(!this.finale&&this.phase==='playing'){if(this.active==='arrival')this.finishArrival();this.phase='waiting';this.wait=this.praise?.25:5+Math.random()*5;this.warm(this.praise?'praise':this.nextIdle);}});v.addEventListener('timeupdate',()=>{if(i===this.front)this.checkNearEnd();});v.addEventListener('error',()=>{if(this.finale&&this.phase!=='completion-hold'&&v.getAttribute('src')?.endsWith('/completion.mp4'))this.failCompletion();else if(!this.finale&&i===this.front&&this.active==='arrival')this.finishArrival();});});
  retry.onclick=()=>{if(this.paused)return;if(this.phase==='waiting')this.wait=0;else void this.play(this.videos[this.front]);};
 }
 private chooseIdle(previous:Clip):Clip{const pool=(['idle-a','idle-b','smile'] as Clip[]).filter(c=>c!==previous);return pool[Math.floor(this.random()*pool.length)];}
 private warm(clip:Clip){const v=this.videos[1-this.front],src=`${assetBase}video/${clip}.mp4`;if(v.getAttribute('src')!==src){v.src=src;v.preload='auto';v.load();}}
 private async play(v:HTMLVideoElement){try{await v.play();this.retry.hidden=true;}catch{this.retry.hidden=false;}}
 whenArrivalEnds(callback:()=>void){this.arrivalCallback=callback;if(this.arrivalNotified)callback();}
 private finishArrival(){if(this.arrivalNotified||this.finale)return;this.arrivalNotified=true;this.arrivalCallback?.();}
 start(resumed:boolean){
  if(resumed){this.active='arrival';this.phase='waiting';this.wait=5+Math.random()*5;const v=this.videos[0];v.removeAttribute('src');v.load();v.poster=assetBase+'video/rest-poster.jpg';this.warm(this.nextIdle);}
  else {this.videos[0].currentTime=0;this.phase='playing';if(!this.paused)void this.play(this.videos[0]);}
 }
 requestPraise(){if(this.finale||this.clock-this.requestedAt<10)return;this.requestedAt=this.clock;this.praise=true;if(this.phase==='waiting'){this.wait=Math.min(this.wait,.4);this.warm('praise');}}
 holdForCompletion(){this.generation++;this.finale=true;this.praise=false;this.phase='completion-hold';this.retry.hidden=true;this.videos.forEach((v,i)=>{v.pause();v.style.opacity=i===this.front?'1':'0';v.style.zIndex=i===this.front?'1':'0';});const pose=this.videos[this.front];pose.poster=assetBase+'video/completion-poster.jpg';pose.removeAttribute('src');pose.load();this.warm('completion');}
 playCompletion(nearEnd:()=>void,failed:()=>void){this.nearEnd=nearEnd;this.failed=failed;this.finaleElapsed=0;this.lastFinalTime=-1;this.wait=0;this.phase='completion-loading';this.warm('completion');}
 private finishNearEnd(){if(this.paused)return;const callback=this.nearEnd;this.nearEnd=null;callback?.();}
 private checkNearEnd(){const v=this.videos[this.front];if(this.active==='completion'&&Number.isFinite(v.duration)&&v.duration>0&&v.currentTime>=Math.max(0,v.duration-1))this.finishNearEnd();}
 private failCompletion(){if(this.phase==='completion-failed'||this.phase==='completion-tail')return;this.generation++;this.phase='completion-failed';this.videos.forEach(v=>v.pause());this.retry.hidden=true;this.nearEnd=null;const callback=this.failed;this.failed=null;callback?.();}
 setPaused(value:boolean){this.paused=value;for(const v of this.videos){if(value)v.pause();}if(!value){if(this.phase==='playing')void this.play(this.videos[this.front]);this.checkNearEnd();}}
 tick(dt:number){if(this.paused)return;this.clock+=dt;
  if(!this.finale&&this.active==='arrival'&&this.phase==='playing'&&!this.arrivalNotified){this.arrivalElapsed+=dt;if(this.arrivalElapsed>=20)this.finishArrival();}
  if(this.finale){
   if(this.phase==='completion-hold'||this.phase==='completion-tail'||this.phase==='completion-failed')return;
   const time=this.active==='completion'?this.videos[this.front].currentTime:0;
   this.finaleElapsed=time>this.lastFinalTime+.01?0:this.finaleElapsed+dt;this.lastFinalTime=time;
   if(this.finaleElapsed>20){this.failCompletion();return;}
   this.checkNearEnd();
   if(this.phase==='completion-loading'){this.wait-=dt;const next=this.videos[1-this.front];if(this.wait<=0&&next.readyState>=2){this.phase='transition';next.currentTime=0;void this.transition('completion');}}return;
  }
  if(this.phase==='waiting'){this.wait-=dt;if(this.wait<=0){const clip=this.praise?'praise':this.nextIdle;this.warm(clip);const next=this.videos[1-this.front];if(next.readyState<2)return;this.phase='transition';next.currentTime=0;void this.transition(clip);}}}
 private async transition(clip:Clip){
  const old=this.videos[this.front],next=this.videos[1-this.front],generation=this.generation;
  // Decode/play the incoming frame before exposing it. The old tail remains underneath.
  try{await next.play();}catch{if(generation!==this.generation)return;this.phase=clip==='completion'?'completion-loading':'waiting';this.wait=2;this.retry.hidden=false;return;}
  if(generation!==this.generation){next.pause();return;}
  if(this.paused)next.pause();next.style.zIndex='2';old.style.zIndex='1';next.style.transition='opacity 160ms ease';next.style.opacity='1';
  await new Promise<void>(r=>setTimeout(r,180));if(generation!==this.generation)return;old.pause();old.style.opacity='0';old.style.zIndex='0';this.front=1-this.front;this.active=clip;
  if(clip==='praise')this.praise=false;else if(clip!=='completion')this.nextIdle=this.chooseIdle(clip);
  this.phase='playing';this.retry.hidden=true;if(this.paused)next.pause();
 }
 report(){return{clip:this.active,phase:this.phase,wait:Math.max(0,Math.round(this.wait*10)/10),paused:this.paused,praisePending:this.praise,time:this.videos[this.front].currentTime,duration:this.videos[this.front].duration,completion:this.finale};}
}

const stories=[
 ['第一次一起来看这家店，就让你帮忙找东西，怪不好意思的。','没关系，我也想看看这里。'],
 ['这家店的主人不常露面，倒是很在意来访的人。','听起来有点神秘。'],
 ['委托书就放在那只橙色钱包里。也许一起混进旅行箱了。','记住啦，找橙色的小钱包！'],
 ['我也有看走眼的时候。对方越着急，我越会多问一句。','嗯，先不急。'],
 ['你喜欢这扇窗吗？坐在里面，应该能看见整条街。','我已经开始期待了！'],
 ['找到委托书之后，也记得看看上面到底写了什么。','放心，我会看仔细的。'],
];
export class ChatDirector {
 private held=false;
 private time=0;private next=13;private used=new Set<number>();private rows:HTMLElement[]=[];private reply:{text:string;at:number}|null=null;private cooldown=0;private invalidAt:number|null=null;private helps=0;private lastPick=-100;private quickGroups=0;private fired=new Set<string>();public storyMode=false;
 constructor(private host:HTMLElement,private effects:Effects){}
 message(text:string,player=false){
  const before=new Map(this.rows.map(n=>[n,n.offsetTop-this.host.offsetHeight]));const row=document.createElement('div');row.className='chat-message '+(player?'player':'bear');const avatar=document.createElement('img');avatar.className='chat-avatar';avatar.src=assetBase+'art/game-v2/'+(player?'player':'bear')+'-avatar.png';avatar.alt=player?'我':'白熊';const copy=document.createElement('div');copy.className='chat-copy';copy.textContent=text;row.append(avatar,copy);this.host.append(row);this.rows.push(row);
  for(const n of this.rows){if(before.has(n))void this.effects.animate(n,[{transform:`translateY(${before.get(n)!-(n.offsetTop-this.host.offsetHeight)}px)`},{transform:'translateY(0)'}],360);}
  void this.effects.animate(row,[{opacity:0,transform:'translateY(28px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],360).then(()=>{
   // History is removed only after it has moved completely beyond the clipping edge.
   while(this.rows.length>1&&this.rows[0].offsetTop+this.rows[0].offsetHeight<this.host.offsetHeight-(this.host.parentElement?.clientHeight??260)){this.rows.shift()!.remove();}
  });
  return row;
 }
 setHeld(value:boolean){this.held=value;}
 pair(text:string,reply:string,priority=false){if(this.held||this.storyMode||(!priority&&this.time<this.cooldown))return;if(this.reply){this.message(this.reply.text,true);this.reply=null;}const row=this.message(text);this.reply={text:reply,at:this.time+1.3+Math.random()*.8};this.cooldown=this.time+8;this.next=Math.max(this.next,this.time+13);return row;}
 invalid(){if(this.invalidAt===null)this.invalidAt=this.time;}
 picked(){this.invalidAt=null;if(this.time-this.lastPick>=1)this.quickGroups=0;this.lastPick=this.time;}
 match(remaining:number,total:number){
  this.quickGroups++;
  if(this.quickGroups>=3&&!this.fired.has('fast')){this.fired.add('fast');this.pair('这么快就整理好了三组？你还挺有一手。','找到一点诀窍了！',true);}
  if(remaining/total<=.3&&!this.fired.has('thirty')){this.fired.add('thirty');this.pair('已经整理好大半了，那份委托书应该快找到了。','我再仔细看看！',true);}
 }
 tick(dt:number){if(this.held)return;this.time+=dt;if(this.storyMode)return;
  if(this.reply&&this.time>=this.reply.at){this.message(this.reply.text,true);this.reply=null;}
  if(this.invalidAt!==null&&this.time-this.invalidAt>=8&&this.helps<2){this.helps++;this.invalidAt=null;this.pair('先看看槽里已有的，再找一样的。我们不赶时间。','好，我慢慢找。',true);}
  if(this.time>=this.next&&this.time>=this.cooldown&&this.used.size<stories.length){const available=stories.map((_,i)=>i).filter(i=>!this.used.has(i));const i=available[Math.floor(Math.random()*available.length)];this.used.add(i);this.pair(stories[i][0],stories[i][1]);this.next=this.time+13+Math.random()*8;}
 }
 snapshot(){return{used:[...this.used],fired:[...this.fired],helps:this.helps};}
 enterStory(){if(this.reply){this.message(this.reply.text,true);this.reply=null;}this.storyMode=true;}
 restore(data:ReturnType<ChatDirector['snapshot']>|undefined){if(!data)return;this.used=new Set(data.used);this.fired=new Set(data.fired);this.helps=data.helps||0;}
 clear(){this.reply=null;this.rows=[];this.host.replaceChildren();}
}

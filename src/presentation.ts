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

/** Only decoded pixels are visible; native media chrome never occupies the stage. */
export class VideoSurface {
 private ctx:CanvasRenderingContext2D|null;private callback:number|null=null;private nativeCallback=false;private posterVersion=0;private lastTime=-1;frames=0;
 constructor(private video:HTMLVideoElement,readonly canvas:HTMLCanvasElement|null){
  this.ctx=canvas?.getContext?.('2d',{alpha:false})??null;
  if(!this.ctx||!canvas)return;canvas.style.visibility='hidden';
  video.addEventListener('playing',()=>this.start());
  for(const event of ['loadeddata','seeked'])video.addEventListener(event,()=>this.paint());
  for(const event of ['pause','ended'])video.addEventListener(event,()=>{this.paint();this.stop();});
  video.addEventListener('emptied',()=>{this.stop();this.lastTime=-1;});
  this.poster(video.poster);
 }
 poster(src:string){
  this.stop();this.lastTime=-1;if(!this.ctx||!this.canvas||!src)return;
  const version=++this.posterVersion,img=new Image();img.onload=()=>{if(version!==this.posterVersion||!this.ctx||!this.canvas)return;this.ctx.drawImage(img,0,0,this.canvas.width,this.canvas.height);this.canvas.style.visibility='visible';};img.src=src;
 }
 paint(){
  if(!this.ctx||!this.canvas||this.video.readyState<2||!this.video.videoWidth||document.hidden)return;
  if(this.video.currentTime===this.lastTime)return;
  try{this.ctx.drawImage(this.video,0,0,this.canvas.width,this.canvas.height);this.posterVersion++;this.lastTime=this.video.currentTime;this.frames++;this.canvas.style.visibility='visible';}catch{/* Keep the previous valid frame while a decoder is changing source. */}
 }
 private start(){this.stop();this.paint();this.schedule();}
 private schedule(){
  if(!this.ctx||this.video.paused||this.video.ended||document.hidden)return;
  const frame=()=>{this.callback=null;this.paint();this.schedule();};
  this.nativeCallback=typeof this.video.requestVideoFrameCallback==='function';
  this.callback=this.nativeCallback?this.video.requestVideoFrameCallback(frame):requestAnimationFrame(frame);
 }
 stop(){if(this.callback!==null){if(this.nativeCallback)this.video.cancelVideoFrameCallback(this.callback);else cancelAnimationFrame(this.callback);this.callback=null;}}
}

type Clip='arrival'|'idle-a'|'idle-b'|'smile'|'praise'|'completion';
export class VideoDirector {
 private videos:HTMLVideoElement[];private front=0;private active:Clip='arrival';private nextIdle:Clip;private phase='stopped';private wait=0;private paused=false;private praise=false;private requestedAt=-100;private clock=0;
 private generation=0;private finale=false;private finaleElapsed=0;private lastFinalTime=-1;private nearEnd:(()=>void)|null=null;private failed:(()=>void)|null=null;
 private arrivalCallback:(()=>void)|null=null;private arrivalNotified=false;private arrivalElapsed=0;
 private playPending=new Set<HTMLVideoElement>();private retryAt=0;private lastPlayError:string|null=null;
 private surfaces:VideoSurface[];
 constructor(private random:()=>number=Math.random){
  this.nextIdle=this.chooseIdle('arrival');
  this.videos=[document.querySelector('#bear-video-a')!,document.querySelector('#bear-video-b')!];
  this.surfaces=this.videos.map((v,i)=>new VideoSurface(v,document.querySelector(i?'#bear-frame-b':'#bear-frame-a')));
  this.videos.forEach((v,i)=>{this.configure(v);v.autoplay=false;v.pause();v.addEventListener('ended',()=>{if(i!==this.front)return;if(this.active==='completion'){this.finishNearEnd();this.phase='completion-tail';return;}if(!this.finale&&this.phase==='playing'){if(this.active==='arrival')this.finishArrival();this.phase='waiting';this.wait=this.praise?.25:5+Math.random()*5;this.warm(this.praise?'praise':this.nextIdle);}});v.addEventListener('timeupdate',()=>{if(i===this.front)this.checkNearEnd();});v.addEventListener('error',()=>{if(this.finale&&this.phase!=='completion-hold'&&v.getAttribute('src')?.endsWith('/completion.mp4'))this.failCompletion();else if(!this.finale&&i===this.front&&this.active==='arrival'&&this.phase==='playing')this.fallbackArrival();});for(const event of ['loadeddata','canplay'])v.addEventListener(event,()=>{if(i===this.front)this.resumeAutomatically();});});
  const lifecycle=new AbortController(),opts={signal:lifecycle.signal};
  const hostReady=()=>{
   // Use the host-ready playback opportunity before/after model loading, without a button.
   if(this.phase==='stopped'&&!this.paused&&!document.hidden){for(const v of this.videos){if(!v.getAttribute('src'))continue;this.configure(v);void v.play().then(()=>{if(this.phase==='stopped'){v.pause();v.autoplay=false;}}).catch(()=>{});}}
   else this.resumeAutomatically();
  };
  document.addEventListener?.('WeixinJSBridgeReady',hostReady,opts);
  if('WeixinJSBridge' in globalThis)hostReady();
  for(const event of ['pointerdown','touchstart','keydown'])document.addEventListener?.(event,()=>this.resumeAutomatically(),{...opts,passive:true});
  document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)this.resumeAutomatically();},opts);
  globalThis.addEventListener?.('pageshow',()=>this.resumeAutomatically(),opts);
  globalThis.addEventListener?.('pagehide',()=>{lifecycle.abort();this.surfaces.forEach(s=>s.stop());},{once:true});
 }
 private configure(v:HTMLVideoElement){v.defaultMuted=true;v.muted=true;v.volume=0;v.playsInline=true;v.controls=false;v.autoplay=false;v.removeAttribute('controls');v.removeAttribute('autoplay');v.disablePictureInPicture=true;v.disableRemotePlayback=true;v.setAttribute('controlslist','nodownload nofullscreen noremoteplayback');v.setAttribute('x-webkit-airplay','deny');for(const name of ['muted','playsinline','webkit-playsinline','x5-playsinline'])v.setAttribute(name,'');v.setAttribute('x5-video-player-type','h5-page');v.setAttribute('x5-video-player-fullscreen','false');}
 private resumeAutomatically(){if(this.paused||document.hidden)return;const v=this.videos[this.front];if(this.phase==='playing'&&v.paused&&!v.ended)void this.play(v);else if(this.lastPlayError&&(this.phase==='waiting'||this.phase==='completion-loading'))this.wait=0;}
 private chooseIdle(previous:Clip):Clip{const pool=(['idle-a','idle-b','smile'] as Clip[]).filter(c=>c!==previous);return pool[Math.floor(this.random()*pool.length)];}
 private warm(clip:Clip){const v=this.videos[1-this.front],src=`${assetBase}video/web/${clip}.mp4`;if(v.getAttribute('src')!==src){v.autoplay=false;v.pause();v.src=src;v.preload='auto';v.load();}}
 private async play(v:HTMLVideoElement){
  if(this.paused||document.hidden||this.playPending.has(v))return false;
  const generation=this.generation;this.configure(v);this.retryAt=this.clock+1.2;this.playPending.add(v);
  try{await v.play();if(generation!==this.generation||this.paused||document.hidden){v.autoplay=false;v.pause();return false;}this.lastPlayError=null;return true;}
  catch(error){if(generation===this.generation)this.lastPlayError=error instanceof Error?error.name:'PlaybackError';return false;}
  finally{this.playPending.delete(v);}
 }
 whenArrivalEnds(callback:()=>void){this.arrivalCallback=callback;if(this.arrivalNotified)callback();}
 private finishArrival(){if(this.arrivalNotified||this.finale)return;this.arrivalNotified=true;this.arrivalCallback?.();}
 private fallbackArrival(){if(this.arrivalNotified||this.finale)return;this.generation++;const v=this.videos[this.front];v.autoplay=false;v.pause();v.removeAttribute('src');v.poster=assetBase+'video/rest-poster.jpg';v.load();this.surfaces[this.front].poster(v.poster);this.phase='waiting';this.wait=5;this.warm(this.nextIdle);this.finishArrival();}
 start(resumed:boolean){
  if(resumed){this.active='arrival';this.phase='waiting';this.wait=5+Math.random()*5;const v=this.videos[0];v.removeAttribute('src');v.load();v.poster=assetBase+'video/rest-poster.jpg';this.surfaces[0].poster(v.poster);this.warm(this.nextIdle);}
  else {this.videos[0].currentTime=0;this.phase='playing';if(!this.paused)void this.play(this.videos[0]);}
 }
 requestPraise(){if(this.finale||this.clock-this.requestedAt<10)return;this.requestedAt=this.clock;this.praise=true;if(this.phase==='waiting'){this.wait=Math.min(this.wait,.4);this.warm('praise');}}
 holdForCompletion(){this.generation++;this.finale=true;this.praise=false;this.phase='completion-hold';this.videos.forEach((v,i)=>{v.autoplay=false;v.pause();const surface=this.surfaces[i].canvas;if(surface){surface.style.opacity=i===this.front?'1':'0';surface.style.zIndex=i===this.front?'1':'0';}});const pose=this.videos[this.front];pose.poster=assetBase+'video/completion-poster.jpg';pose.removeAttribute('src');pose.load();this.surfaces[this.front].poster(pose.poster);this.warm('completion');}
 playCompletion(nearEnd:()=>void,failed:()=>void){this.nearEnd=nearEnd;this.failed=failed;this.finaleElapsed=0;this.lastFinalTime=-1;this.wait=0;this.phase='completion-loading';this.warm('completion');}
 private finishNearEnd(){if(this.paused)return;const callback=this.nearEnd;this.nearEnd=null;callback?.();}
 private checkNearEnd(){const v=this.videos[this.front];if(this.active==='completion'&&Number.isFinite(v.duration)&&v.duration>0&&v.currentTime>=Math.max(0,v.duration-1))this.finishNearEnd();}
 private failCompletion(){if(this.phase==='completion-failed'||this.phase==='completion-tail')return;this.generation++;this.phase='completion-failed';this.videos.forEach(v=>{v.autoplay=false;v.pause();});this.nearEnd=null;const callback=this.failed;this.failed=null;callback?.();}
 setPaused(value:boolean){this.paused=value;for(const v of this.videos){if(value){v.autoplay=false;v.pause();}}if(!value){if(this.phase==='playing')void this.play(this.videos[this.front]);this.checkNearEnd();}}
 tick(dt:number){if(this.paused)return;this.clock+=dt;
  if(this.phase==='playing'&&this.clock>=this.retryAt)this.resumeAutomatically();
  if(!this.finale&&this.active==='arrival'&&this.phase==='playing'&&!this.arrivalNotified){this.arrivalElapsed+=dt;if(this.arrivalElapsed>=20||(this.lastPlayError==='NotAllowedError'&&this.arrivalElapsed>=4)){this.fallbackArrival();return;}}
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
  if(!await this.play(next)){if(generation!==this.generation)return;this.phase=clip==='completion'?'completion-loading':'waiting';this.wait=1.2;return;}
  if(generation!==this.generation){next.pause();return;}
  const incoming=this.surfaces[1-this.front],outgoing=this.surfaces[this.front];incoming.paint();
  if(this.paused)next.pause();if(incoming.canvas){incoming.canvas.style.zIndex='2';incoming.canvas.style.transition='opacity 160ms ease';incoming.canvas.style.opacity='1';}if(outgoing.canvas)outgoing.canvas.style.zIndex='1';
  await new Promise<void>(r=>setTimeout(r,180));if(generation!==this.generation)return;old.pause();if(outgoing.canvas){outgoing.canvas.style.opacity='0';outgoing.canvas.style.zIndex='0';}this.front=1-this.front;this.active=clip;
  if(clip==='praise')this.praise=false;else if(clip!=='completion')this.nextIdle=this.chooseIdle(clip);
  this.phase='playing';if(this.paused)next.pause();
 }
 report(){return{clip:this.active,phase:this.phase,wait:Math.max(0,Math.round(this.wait*10)/10),paused:this.paused,praisePending:this.praise,time:this.videos[this.front].currentTime,duration:this.videos[this.front].duration,completion:this.finale,playbackError:this.lastPlayError,display:'canvas',paintedFrames:this.surfaces.map(s=>s.frames)};}
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

type Vector={x:number;y:number;z:number};
type Acceleration={x:number|null;y:number|null;z:number|null}|null;
export type ShakeSignal={x:number;y:number;strength:number};
export type MotionStatus='ready'|'permission'|'denied'|'unavailable';
const valid=(v:Acceleration):v is Vector=>!!v&&[v.x,v.y,v.z].every(n=>typeof n==='number'&&Number.isFinite(n));

/** Two opposing acceleration peaks reject ordinary taps/tilts. No raw data is stored. */
export class ShakeDetector {
 private gravity:Vector|null=null;private last=0;private peak:{v:Vector;time:number}|null=null;private cooldown=0;
 reset(){this.gravity=null;this.last=0;this.peak=null;}
 sample(acceleration:Acceleration,includingGravity:Acceleration,now:number):ShakeSignal|null{
  // Some WebViews interleave empty packets with real samples. Ignore them; they
  // are not evidence of rest and must not erase a valid first shake peak.
  if(!Number.isFinite(now)||(!valid(acceleration)&&!valid(includingGravity)))return null;
  const dt=this.last?now-this.last:16;if(dt<0||dt>800)this.reset();this.last=now;
  let v:Vector;
  if(valid(acceleration))v=acceleration;
  else if(valid(includingGravity)){
   if(!this.gravity){this.gravity={x:includingGravity.x,y:includingGravity.y,z:includingGravity.z};return null;}
   const alpha=Math.min(.35,Math.max(.025,dt/400));
   for(const k of ['x','y','z'] as const)this.gravity[k]+=alpha*(includingGravity[k]-this.gravity[k]);
   v={x:includingGravity.x-this.gravity.x,y:includingGravity.y-this.gravity.y,z:includingGravity.z-this.gravity.z};
  }else return null;
  if(now<this.cooldown)return null;
  const magnitude=Math.hypot(v.x,v.y,v.z);if(magnitude<7)return null;
  const p=this.peak,age=p?now-p.time:0;
  const opposite=p&&(v.x*p.v.x+v.y*p.v.y+v.z*p.v.z)/(magnitude*Math.hypot(p.v.x,p.v.y,p.v.z))<-.35;
  if(p&&age>=70&&age<=650&&opposite){this.peak=null;this.cooldown=now+2800;const length=Math.hypot(v.x,v.y)||1;return{x:v.x/length,y:v.y/length,strength:Math.min(1.15,Math.max(.8,magnitude/14))};}
  // WebIDL acceleration components are prototype getters, not spreadable own fields.
  if(!p||age>650)this.peak={v:{x:v.x,y:v.y,z:v.z},time:now};return null;
 }
}

type MotionConstructor={requestPermission?:()=>Promise<'granted'|'denied'>};
export class PhoneShakeInput {
 status:MotionStatus;private detector=new ShakeDetector();private abort=new AbortController();private pending=false;
 private trigger:(signal:ShakeSignal)=>void;private eligible:()=>boolean;private notify:()=>void;private host:Window;
 constructor(trigger:(signal:ShakeSignal)=>void,eligible:()=>boolean,notify:()=>void,host:Window=window){
  this.trigger=trigger;this.eligible=eligible;this.notify=notify;this.host=host;
  const motion=this.motion();this.status=!host.isSecureContext||!motion?'unavailable':typeof motion.requestPermission==='function'?'permission':'ready';
  host.addEventListener('devicemotion',e=>{
   if(this.status!=='ready'||host.document.hidden||!this.eligible()){this.detector.reset();return;}
   const signal=this.detector.sample(e.acceleration,e.accelerationIncludingGravity,host.performance.now());
   if(signal){const angle=(host.screen.orientation?.angle??0)*Math.PI/180,x=signal.x,y=signal.y;this.trigger({...signal,x:x*Math.cos(angle)-y*Math.sin(angle),y:x*Math.sin(angle)+y*Math.cos(angle)});}
  },{passive:true,signal:this.abort.signal});
  host.document.addEventListener('visibilitychange',()=>this.detector.reset(),{signal:this.abort.signal});
  host.addEventListener('pagehide',()=>this.destroy(),{once:true,signal:this.abort.signal});
 }
 private motion(){return (this.host as unknown as {DeviceMotionEvent?:MotionConstructor}).DeviceMotionEvent;}
 async enable(){
  if(this.status!=='permission'||this.pending)return this.status;
  this.pending=true;
  try{const result=await this.motion()!.requestPermission!();this.status=result==='granted'?'ready':'denied';}catch{this.status='denied';}
  finally{this.pending=false;this.detector.reset();this.notify();}return this.status;
 }
 reset(){this.detector.reset();}
 destroy(){this.abort.abort();this.detector.reset();}
}

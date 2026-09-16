import './home.css';
import {simulatedTilt,deviceTilt} from './home-motion';
const assetBase=import.meta.env?.BASE_URL??'/';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const home=$('home'),shell=$('home-shell'),dialog=$<HTMLDialogElement>('home-dialog'),content=$('panel-content'),preview=$<HTMLButtonElement>('tilt-preview');
const layers=Array.from(document.querySelectorAll<HTMLElement>('[data-depth]'));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let motion=!reduced.matches,sensor=false,baseline:{beta:number;gamma:number}|null=null;
let targetX=0,targetY=0,x=0,y=0,simulationStart:number|null=null,lastFrame=performance.now(),raf=0,toastTimer=0,sensorTimeout=0;
let panelName='',signed=false,returnFocus:HTMLElement|null=null;
const touch=matchMedia('(pointer:coarse)').matches;
let previewPeak=0,previewCompleted=false;
function fit(){const s=Math.min(innerWidth/845,innerHeight/1860,1);shell.style.width=845*s+'px';shell.style.height=1860*s+'px';home.style.transform='scale('+s+')';}
fit();addEventListener('resize',fit);
function toast(text:string){$('home-toast').textContent=text;$('home-toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('home-toast').classList.remove('visible'),2800);}
function reset(){targetX=targetY=0;baseline=null;simulationStart=null;preview.setAttribute('aria-pressed','false');preview.setAttribute('aria-label',touch&&!sensor?'启用手机倾斜':'模拟手机倾斜');preview.innerHTML='<span aria-hidden="true">↔</span> '+(touch&&!sensor?'启用倾斜':'模拟倾斜');}
function setMotion(enabled:boolean){motion=enabled;home.classList.toggle('still',!enabled);home.classList.toggle('motion-enabled',enabled);if(!enabled)reset();}
function simulate(){if(!motion){toast('请先在设置中开启场景动效');return;}if(simulationStart!==null){reset();return;}
 simulationStart=performance.now();previewPeak=0;previewCompleted=false;preview.setAttribute('aria-pressed','true');preview.innerHTML='<span aria-hidden="true">↔</span> 停止模拟';
}
preview.onclick=()=>{if(touch&&!sensor)void enableSensor();else simulate();};
function orientation(e:DeviceOrientationEvent){
 if(!sensor||!motion||dialog.open||simulationStart!==null||document.hidden||e.beta===null||e.gamma===null)return;
 clearTimeout(sensorTimeout);baseline??={beta:e.beta,gamma:e.gamma};
 const tilt=deviceTilt(e.beta,e.gamma,baseline,screen.orientation?.angle??0);targetX=tilt.x;targetY=tilt.y;
}
addEventListener('deviceorientation',orientation);
screen.orientation?.addEventListener('change',reset);
async function enableSensor(){
 if(!motion)setMotion(true);
 const Device=window.DeviceOrientationEvent as typeof DeviceOrientationEvent&{requestPermission?:()=>Promise<string>};
 const feedback=(message:string)=>{if(dialog.open){let p=content.querySelector<HTMLElement>('#motion-feedback');if(!p){p=document.createElement('p');p.id='motion-feedback';p.className='panel-note';p.setAttribute('role','status');content.append(p);}p.textContent=message;}else toast(message);};
 if(!Device||!window.isSecureContext){feedback('当前环境无法读取倾斜，可用右下角模拟效果');return;}
 try{
  if(Device.requestPermission&&await Device.requestPermission()!=='granted'){feedback('未开启倾斜权限，仍可模拟体验');return;}
  sensor=true;baseline=null;closePanel();toast('轻轻倾斜手机，看看街景的纵深');
  sensorTimeout=window.setTimeout(()=>{toast('暂未收到倾斜数据，可先用右下角模拟');},5000);
 }catch{sensor=false;feedback('倾斜功能暂不可用，页面仍可正常操作');}
}
function tick(now:number){
 const dt=Math.min(now-lastFrame,40);lastFrame=now;
 if(motion&&!dialog.open){
  if(simulationStart!==null){const t=(now-simulationStart)/1000;
   const tilt=simulatedTilt(t);if(tilt.done){reset();previewCompleted=true;}else{targetX=tilt.x;targetY=tilt.y;previewPeak=Math.max(previewPeak,Math.abs(targetX));}
  }
 }else{targetX=targetY=0;}
 const smooth=1-Math.exp(-dt/165);x+=(targetX-x)*smooth;y+=(targetY-y)*smooth;
 if(Math.abs(x)<.0001)x=0;if(Math.abs(y)<.0001)y=0;
 for(const layer of layers){const depth=Number(layer.dataset.depth);layer.style.transform='translate3d('+(-x*depth).toFixed(3)+'px,'+(-y*depth*.65).toFixed(3)+'px,0)';}
 raf=requestAnimationFrame(tick);
}
raf=requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);reset();home.classList.add('still');}else{lastFrame=performance.now();home.classList.toggle('still',!motion);raf=requestAnimationFrame(tick);}});
reduced.addEventListener('change',e=>setMotion(!e.matches));
function closePanel(){dialog.close();panelName='';home.classList.toggle('still',!motion);baseline=null;returnFocus?.focus();}
$('close-panel').onclick=closePanel;
dialog.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
function button(label:string,fn:()=>void,secondary=false){const b=document.createElement('button');b.className=secondary?'secondary':'primary';b.textContent=label;b.onclick=fn;content.append(b);}
function text(value:string,className=''){const p=document.createElement('p');p.textContent=value;p.className=className;content.append(p);}
function profile(){try{return JSON.parse(localStorage.getItem('finding-profile')||'{}');}catch{return{};}}
function showPanel(name:string){
 returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;panelName=name;content.replaceChildren();reset();home.classList.add('still');
 const titles:Record<string,string>={settings:'事务所设置',commissions:'今天的委托',archive:'我的档案',achievement:'我的成就',ranking:'事务所排名',checkin:'今日签到',tasks:'每日任务',dress:'装扮事务所',exchange:'兑换',challenge:'挑战模式'};
 const h=document.createElement('h2');h.textContent=titles[name]??'钱包去哪了';content.append(h);
 if(name==='settings'){
  const row=document.createElement('label');row.className='setting-row';const label=document.createElement('span');label.textContent='场景动效与云朵飘动';const input=document.createElement('input');input.type='checkbox';input.checked=motion;input.onchange=()=>{setMotion(input.checked);home.classList.add('still');};row.append(label,input);content.append(row);
  button(sensor?'重新校准手机倾斜':'启用手机倾斜',()=>void enableSensor());
  button('模拟倾斜效果',()=>{closePanel();simulate();},true);
  text('本页为主页展示 Demo。资产、签到与挑战次数为演示信息，不关联钱包资产。','panel-note');
 }else if(name==='commissions'){
  text('柜台留言：今天的委托到了，来接一份吧。');
  const card=document.createElement('article');card.className='case-card';card.innerHTML='<div class="case-meta"><span>白熊的委托</span><span>剧情首案</span></div><h3>寻找委托书</h3><p>帮小白熊整理旅行箱，找出那份神秘委托书。</p><div class="case-meta"><span>目标 · 委托书</span><span>难度 · 入门</span><span>计时归零仍可继续</span><span>奖励 · 1000 游戏币</span></div>';content.append(card);
  const a=document.createElement('a');a.className='primary';a.textContent='进入首案试玩';a.href=assetBase;content.append(a);
  text('目前开放首案试玩，已有整理进度会保留。后续委托尚未开放。','panel-note');
 }else if(name==='archive'){
  const entries=profile().archives;
  if(Array.isArray(entries)&&entries.length){for(const entry of entries){const d=document.createElement('div');d.className='archive-entry';d.textContent='《'+String(entry)+'》';content.append(d);}}
  else{text('找回的东西，会留下故事。');text('完成首案后，第一份档案会收录在这里。','empty-mark');}
 }else if(name==='checkin'){
  text(signed?'今天已经来过了，明天再见。':'新的一天，事务所开门了。');
  button(signed?'今日已签到':'签到留个脚印',()=>{signed=true;showPanel('checkin');});text('本轮仅演示签到状态，不发放或扣减资产。','panel-note');
 }else if(name==='challenge'){
  text('每日 2 次 · 今日剩余 2 次');text('挑战关正在准备中。先接一份委托，熟悉整理物品的诀窍吧。');
  button('去看今日委托',()=>showPanel('commissions'));text('次数为展示占位，不扣减。','panel-note');
 }else{
  const copies:Record<string,string>={achievement:'那些认真找回的东西，会成为你的成就。成就内容将在后续版本开放。',ranking:'排名入口已预留，当前没有联网榜单。',tasks:'先完成一份委托。每日任务与奖励规则将在后续版本开放。',dress:'给事务所换个模样。这一版先保留装扮入口。',exchange:'兑换入口已预留，当前不会消耗金币或钻石。'};
  text(copies[name]??'更多内容正在准备中。');button('知道了',closePanel);
 }
 if(!dialog.open)dialog.showModal();
}
document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel!));
setMotion(motion);reset();
const modelContext=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>void}}).modelContext;
const toolLife=new AbortController();
const readHome=()=>({panel:panelName,motion,sensor,simulating:simulationStart!==null,offset:{x,y},lastPreview:{peak:previewPeak,completed:previewCompleted},cloudsPaused:home.classList.contains('still'),uiFixed:true});
if(modelContext?.registerTool){
 const register=(name:string,description:string,inputSchema:object,execute:(input:unknown)=>unknown,readOnlyHint=false)=>{try{modelContext.registerTool({name,description,inputSchema,execute,annotations:{readOnlyHint}},{signal:toolLife.signal});}catch{/* Optional browser tools must not block the page. */}};
 register('read_home_state','Read the current homepage panel, motion preference and tilt-preview state.',{type:'object',properties:{},additionalProperties:false},readHome,true);
 register('preview_home_tilt','Play the same seven-second tilt preview as the homepage button. Does not request sensor permission.',{type:'object',properties:{},additionalProperties:false},()=>{if(dialog.open)throw new Error('Close the panel first');if(!motion)throw new Error('Motion is disabled');simulate();return readHome();});
 register('open_home_panel','Open or close an existing homepage panel; does not spend currency or start a game.',{type:'object',properties:{name:{type:'string',enum:['settings','commissions','archive','achievement','ranking','checkin','tasks','dress','exchange','challenge','close']}},required:['name'],additionalProperties:false},input=>{
  const name=(input as {name?:unknown})?.name;if(typeof name!=='string'||!['settings','commissions','archive','achievement','ranking','checkin','tasks','dress','exchange','challenge','close'].includes(name))throw new Error('Unknown homepage panel');
  if(name==='close')closePanel();else showPanel(name);return readHome();
 });
}
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);clearTimeout(sensorTimeout);});
addEventListener('pagehide',()=>toolLife.abort(),{once:true});

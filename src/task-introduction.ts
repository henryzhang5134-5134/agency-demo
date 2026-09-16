import type {Effects} from './presentation';
const assetBase=import.meta.env?.BASE_URL??'/';

/** Presentation only: reveal the brief, then guide the same icon into its target well. */
export class TaskIntroduction {
 phase:'idle'|'dialogue'|'arriving'|'center'|'docking'|'done'='idle';
 private generation=0;
 private host:HTMLElement|null=null;
 constructor(private game:HTMLElement,private effects:Effects){}
 get active(){return !['idle','done'].includes(this.phase);}
 cancel(){
  this.generation++;this.host?.getAnimations({subtree:true}).forEach(a=>a.cancel());this.host?.remove();this.host=null;this.phase='done';
  this.game.classList.remove('task-guiding','task-unintroduced');
 }
 async run(source:HTMLElement|undefined,onSound:(name:'hint'|'pick'|'slot')=>void,onDone:()=>void){
  if(this.active)return;
  const generation=++this.generation,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host=document.createElement('div');host.id='task-introduction';host.setAttribute('role','status');host.setAttribute('aria-live','polite');
  host.innerHTML='<div class="task-intro-shade"></div><section class="task-card"><img class="task-card-icon" src="'+assetBase+'art/game-v2/wallet-commission.png" alt="钱包里的委托书"><div class="task-card-copy"><span>新任务</span><h2>找到小白熊的钱包</h2><p>委托书就藏在里面</p></div></section>';
  const card=host.querySelector<HTMLElement>('.task-card')!,shade=host.querySelector<HTMLElement>('.task-intro-shade')!,icon=host.querySelector<HTMLImageElement>('.task-card-icon')!;
  card.style.opacity='0';shade.style.opacity='0';this.host=host;this.game.append(host);this.game.classList.add('task-guiding');host.dataset.phase=this.phase='dialogue';
  const live=()=>generation===this.generation&&host.isConnected;
  const center=(node:Element)=>{const r=node.getBoundingClientRect(),g=this.game.getBoundingClientRect(),s=g.width/750;return{x:(r.left+r.width/2-g.left)/s,y:(r.top+r.height/2-g.top)/s};};
  // An animation-based hold shares the game's pause clock; no orphaned wall-clock timers.
  await this.effects.animate(card,[{opacity:0},{opacity:0}],1400,'linear');if(!live())return;
  const from=source?.isConnected?center(source.querySelector('.chat-copy')??source):{x:150,y:350},to=center(card);
  host.dataset.phase=this.phase='arriving';onSound('hint');card.style.opacity='1';shade.style.opacity='1';
  void this.effects.animate(shade,[{opacity:0},{opacity:1}],300);
  await this.effects.animate(card,reduced?[{opacity:0},{opacity:1}]:[
   {transform:`translate(${from.x-to.x}px,${from.y-to.y}px) rotate(-9deg) scale(.16)`,opacity:.15},
   {offset:.65,transform:'translate(0,12px) rotate(2deg) scale(1.045)',opacity:1},
   {offset:.84,transform:'translate(0,-4px) rotate(-.5deg) scale(.985)'},
   {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1},
  ],reduced?180:760,'cubic-bezier(.2,.72,.26,1)');if(!live())return;
  host.dataset.phase=this.phase='center';await this.effects.animate(card,[{opacity:1},{opacity:1}],1300,'linear');if(!live())return;
  host.dataset.phase=this.phase='docking';onSound('pick');
  const start=center(icon),target=this.game.querySelector<HTMLElement>('#commission-thumb')!,end=center(target);
  const flight=icon.cloneNode(true) as HTMLImageElement;flight.className='task-flight-icon';flight.style.left=(start.x-64)+'px';flight.style.top=(start.y-64)+'px';flight.alt='';flight.setAttribute('aria-hidden','true');host.append(flight);icon.style.visibility='hidden';
  void this.effects.animate(card,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translate(12px,18px) scale(.94)'}],220).then(()=>{card.style.opacity='0';});
  void this.effects.animate(shade,[{opacity:1},{opacity:0}],400).then(()=>{shade.style.opacity='0';});
  const dx=end.x-start.x,dy=end.y-start.y;
  await this.effects.animate(flight,reduced?[{opacity:1},{opacity:0}]:[
   {transform:'translate(0,0) rotate(-4deg) scale(1)',opacity:1},
   {offset:.25,transform:`translate(${dx*.13}px,${dy*.05-35}px) rotate(7deg) scale(1.08)`},
   {offset:.72,transform:`translate(${dx*.82}px,${dy*.61}px) rotate(-6deg) scale(.8)`},
   {transform:`translate(${dx}px,${dy}px) rotate(0deg) scale(.609375)`,opacity:1},
  ],reduced?180:820,'cubic-bezier(.38,.05,.52,1)');if(!live())return;
  flight.remove();this.game.classList.remove('task-unintroduced');this.game.querySelector('#target-status')!.textContent='寻找中';onSound('slot');
  void this.effects.stars(this.game,end.x,end.y,reduced?3:7);
  await this.effects.animate(target,reduced?[{opacity:.5},{opacity:1}]:[{transform:'scale(.9)'},{offset:.45,transform:'scale(1.2)'},{offset:.75,transform:'scale(.95)'},{transform:'scale(1)'}],330);if(!live())return;
  host.remove();this.host=null;this.phase='done';this.game.classList.remove('task-guiding');onDone();
 }
}

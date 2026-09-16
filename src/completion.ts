import type {Effects} from './presentation';
import {elementCenter,bearBagPoint} from './mobile-layout';
const assetBase=import.meta.env?.BASE_URL??'/';
export class CompletionSequence {
 phase:'idle'|'reveal'|'collect'|'video'|'reward'='idle';
 constructor(private game:HTMLElement,private effects:Effects){}
 private confetti(host:HTMLElement){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const welcome=host.id==='welcome-overlay',height=this.game.offsetHeight;
  for(let j=0;j<(reduced?10:40);j++){
   const bit=document.createElement('i');bit.className='completion-confetti';const left=j%2===0;
   bit.style.background=['#ffcd57','#ee8568','#258c92','#fff5d4','#a3bccf'][j%5];host.append(bit);
   const fromX=left?-35:785,fromY=height*.6+Math.random()*250,toX=welcome?(left?30+Math.random()*145:575+Math.random()*145):70+Math.random()*610,peak=(welcome?height/2-555:height/2-375)+Math.random()*300;
   void this.effects.animate(bit,[{transform:`translate(${fromX}px,${fromY}px) rotate(0deg)`,opacity:0},{offset:.09,opacity:1},{offset:.42,transform:`translate(${toX}px,${peak}px) rotate(${j*37}deg)`,opacity:1},{offset:.73,transform:`translate(${toX+(left?-24:24)}px,${peak+390}px) rotate(${j*53}deg)`,opacity:1},{transform:`translate(${toX+(left?35:-35)}px,${height}px) rotate(${j*73+240}deg)`,opacity:0}],2500+Math.random()*1000,'cubic-bezier(.2,.5,.5,1)').then(()=>bit.remove());
  }
 }
 async reveal(onCollect:()=>void){
  if(this.phase!=='idle')return;this.phase='reveal';this.game.classList.add('completing');
  const host=document.createElement('div');host.id='completion-overlay';host.setAttribute('aria-live','polite');
  host.innerHTML='<div class="completion-shade"></div><div class="completion-halo"><div class="completion-rays"></div></div><div class="completion-heading"><span>委托完成</span><h2>钱包和委托书，找到啦！</h2></div><div class="completion-prize"><img src="'+assetBase+'art/game-v2/wallet-commission.png" alt="已找到钱包和委托书"></div><p class="completion-caption">好好收起，一起开启新的故事</p>';
  this.game.append(host);this.confetti(host);
  const prize=host.querySelector<HTMLElement>('.completion-prize')!,rays=host.querySelector<HTMLElement>('.completion-rays')!;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,prizeCenter=elementCenter(this.game,prize),targetCenter=elementCenter(this.game,this.game.querySelector('#commission-thumb')!);
  void this.effects.animate(rays,[{transform:'rotate(-15deg)'},{transform:`rotate(${reduced?-15:55}deg)`}],3300,'linear');
  void this.effects.animate(host,[{opacity:0},{opacity:1}],180);
  // Includes arrival + a quiet 2 second hold. WAAPI pauses with the rest of the game.
  await this.effects.animate(prize,[{offset:0,transform:`translate(${targetCenter.x-prizeCenter.x}px,${targetCenter.y-prizeCenter.y}px) rotate(12deg) scale(.22)`,opacity:.2},{offset:.16,transform:'translate(0,-15px) rotate(-5deg) scale(1.08)',opacity:1},{offset:.24,transform:'translate(0,0) rotate(-3deg) scale(1)'},{offset:1,transform:'translate(0,0) rotate(-3deg) scale(1)'}],2500,'ease-out');
  this.phase='collect';onCollect();
  for(const el of host.querySelectorAll<HTMLElement>('.completion-shade,.completion-halo,.completion-heading,.completion-caption')){el.style.opacity='0';}
  const bag=bearBagPoint(this.game),dx=bag.x-prizeCenter.x,dy=bag.y-prizeCenter.y;
  await this.effects.animate(prize,[{transform:'translate(0,0) rotate(-3deg) scale(1)',opacity:1},{offset:.5,transform:`translate(${dx*.62}px,${dy*.57}px) rotate(13deg) scale(.55)`,opacity:1},{offset:.88,transform:`translate(${dx*.96}px,${dy*.97}px) rotate(20deg) scale(.1)`,opacity:.9},{transform:`translate(${dx}px,${dy}px) rotate(20deg) scale(0)`,opacity:0}],820,'cubic-bezier(.4,0,.55,1)');
  host.remove();this.phase='video';
 }
 showReward(onRestart:()=>void,fallback=false){
  if(this.phase==='reward')return;this.phase='reward';this.game.dataset.ending='reward';
  const host=document.createElement('div');host.id='welcome-overlay';
  host.innerHTML='<div class="welcome-aura" aria-hidden="true"><div class="welcome-rays"></div></div><section class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title" tabindex="-1"><img class="welcome-backplate" src="'+assetBase+'art/game-v2/welcome-backplate-v3.png" alt="" draggable="false"><div class="welcome-content"><p class="welcome-congrats">第一份委托，圆满完成</p><h2 id="welcome-title">事务所经营权</h2><p class="welcome-intro">正式交给你啦，新任主理人！</p><div class="welcome-coins"><img src="'+assetBase+'home/coin.png" alt=""><div><span>开店启动金 · 已到账</span><strong>1,000 <small>游戏币</small></strong></div></div><div class="welcome-coupon"><div class="coupon-value"><small>¥</small>5</div><div><span>小白熊的见面礼</span><strong>信用购打车券</strong></div></div><p class="welcome-note">Demo 奖励展示 · 不发放真实优惠券</p><button class="welcome-home" type="button">开启我的小店</button><button class="welcome-replay" type="button">再演示一次</button>'+(fallback?'<p class="welcome-fallback">开门动画暂时未能播放，通关奖励展示不受影响。</p>':'')+'</div></section>';
  this.game.append(host);this.confetti(host);
  const shopStatus=host.querySelector<HTMLElement>('.welcome-intro')!;
  shopStatus.setAttribute('role','status');shopStatus.setAttribute('aria-live','polite');
  host.querySelector<HTMLButtonElement>('.welcome-home')!.onclick=()=>{shopStatus.textContent='小店建设中，敬请期待！';host.querySelector<HTMLButtonElement>('.welcome-home')!.textContent='建设中 · 敬请期待';};
  host.querySelector<HTMLButtonElement>('.welcome-replay')!.onclick=onRestart;
  const card=host.querySelector<HTMLElement>('.welcome-card')!;card.focus({preventScroll:true});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const stop=this.effects.loop(host.querySelector('.welcome-rays')!,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],32000);
   addEventListener('pagehide',stop,{once:true});
  }
  host.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const a=host.querySelector<HTMLButtonElement>('.welcome-home')!,b=host.querySelector<HTMLButtonElement>('.welcome-replay')!;if(e.shiftKey&&(document.activeElement===a||document.activeElement===card)){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}});
  void this.effects.animate(card,[{transform:'translateY(44px) rotate(-3deg) scale(.68)',opacity:0},{offset:.66,transform:'translateY(-8px) rotate(1deg) scale(1.045)',opacity:1},{offset:.84,transform:'translateY(3px) rotate(-.4deg) scale(.985)',opacity:1},{transform:'translateY(0) rotate(0deg) scale(1)',opacity:1}],650,'cubic-bezier(.18,.75,.25,1)');
 }
}

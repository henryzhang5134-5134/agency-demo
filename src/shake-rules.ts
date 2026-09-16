import type {Token} from './rules';

/** Expose a complete, capacity-safe next match; never change identities or inventory. */
export function shakeTargets(tray:Token[],remaining:Token[],preferred?:string):number[]{
 const room=7-tray.length;if(room<=0)return[];
 const kinds=[...new Set(remaining.map(i=>i.kind))].filter(k=>!preferred||k===preferred);
 const counts=(k:string)=>tray.filter(i=>i.kind===k).length;
 kinds.sort((a,b)=>counts(b)-counts(a));
 for(const kind of kinds){const need=3-counts(kind),pool=remaining.filter(i=>i.kind===kind);if(need>0&&need<=room&&pool.length>=need)return pool.slice(0,need).map(i=>i.id);}
 return[];
}

/** A quiet reminder on entering five occupied slots, never a transient matching frame. */
export class ShakeReminder {
 private previous=0;private cooldown=0;private left=0;
 update(count:number,dt:number){
  this.cooldown=Math.max(0,this.cooldown-dt);this.left=Math.max(0,this.left-dt);
  if(count>=5&&count<7&&this.previous<5&&this.cooldown===0){this.left=8;this.cooldown=30;}
  if(count<5||count>=7)this.left=0;this.previous=count;return this.left>0;
 }
 dismiss(){this.left=0;}
 extend(){this.left=8;}
}

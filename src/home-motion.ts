export const clampTilt=(n:number)=>Math.max(-1,Math.min(1,n));
export function simulatedTilt(seconds:number){
 if(seconds<0||seconds>=7)return{x:0,y:0,done:seconds>=7};
 const envelope=Math.min(1,seconds/.7,(7-seconds)/.8);
 return{x:Math.sin(seconds/7*Math.PI*2)*envelope,y:Math.sin(seconds/7*Math.PI*4)*.6*envelope,done:false};
}
export function deviceTilt(beta:number,gamma:number,base:{beta:number;gamma:number},angle:number){
 const dx=clampTilt((gamma-base.gamma)/14),dy=clampTilt((beta-base.beta)/14),r=angle*Math.PI/180;
 return{x:clampTilt(dx*Math.cos(r)+dy*Math.sin(r)),y:clampTilt(dy*Math.cos(r)-dx*Math.sin(r))};
}

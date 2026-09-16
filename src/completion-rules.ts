/** Local demo rewards only; never issues a real coupon or touches wallet assets. */
export function welcomeProfile(value:unknown){
 const p=(value&&typeof value==='object'&&!Array.isArray(value)?value:{}) as Record<string,unknown>;
 const claimed=p.welcomeRewardV2===true;
 const coins=typeof p.coins==='number'&&Number.isFinite(p.coins)?Math.max(0,p.coins):0;
 // An old first-case save already received 100. Upgrade it to the same 1000 total.
 const increase=claimed?0:1000-(p.firstReward===true?100:0);
 return {...p,coins:coins+increase,firstReward:true,welcomeRewardV2:true,isOwner:true,
  archives:[...new Set([...(Array.isArray(p.archives)?p.archives.filter(v=>typeof v==='string'):[]),'新主理人的见面礼'])],
  demoCoupons:[...new Set([...(Array.isArray(p.demoCoupons)?p.demoCoupons.filter(v=>typeof v==='string'):[]),'credit-ride-5-demo'])]};
}

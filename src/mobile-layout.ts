const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** All coordinates stay in a uniform 750-unit space; models never stretch. */
export function mobileLayout(width:number,height:number){
 const mobile=width<768;
 const scale=mobile?width/750:Math.min(width/750,height/1650,1);
 const artHeight=mobile?height/scale:1650;
 const compact=mobile?clamp((1608-artHeight)/324,0,1):0;
 const stageScale=1-compact/6,stageY=-35*compact,boardScale=1-.12*compact;
 // Rest-poster toes end around 470; 484 also leaves room for the moving poses.
 const caseTop=stageY+494*stageScale;
 const boardLeft=(750-750*boardScale)/2;
 // The suitcase PNG ends at 731, not 750: count the visible edge, then an 8px gap.
 const trayTop=caseTop+739*boardScale,propsTop=trayTop+186*boardScale;
 return{scale,artHeight,compact,stageScale,stageY,boardScale,boardLeft,caseTop,trayTop,propsTop};
}

export function elementCenter(game:HTMLElement,node:Element){
 const r=node.getBoundingClientRect(),g=game.getBoundingClientRect(),s=g.width/750;
 return{x:(r.left+r.width/2-g.left)/s,y:(r.top+r.height/2-g.top)/s};
}

export function bearBagPoint(game:HTMLElement){
 const r=game.querySelector('#video-stage')!.getBoundingClientRect(),g=game.getBoundingClientRect(),s=g.width/750;
 return{x:(r.left+r.width*(517/900)-g.left)/s,y:(r.top+r.height*(411/506.25)-g.top)/s};
}

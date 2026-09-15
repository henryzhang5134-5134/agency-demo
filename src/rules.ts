export const KINDS = ['camera','car','cup','glass','glove','plush'] as const;
export type Kind = typeof KINDS[number] | 'milk' | 'carrot' | 'burger';
export type Token = {id:number;kind:Kind};
export type State = {tray:Token[];cleared:number;removed:number[]};
export function initialState():State{return {tray:[],cleared:0,removed:[]};}
export function collect(state:State, token:Token):{state:State;matched:Token[];full:boolean}{
 if(state.tray.length>=7||state.removed.includes(token.id))throw new Error('Invalid pickup');
 const tray=[...state.tray];const last=tray.map(t=>t.kind).lastIndexOf(token.kind);
 tray.splice(last<0?tray.length:last+1,0,token);
 const same=tray.filter(t=>t.kind===token.kind);
 const matched=same.length>=3?same.slice(0,3):[];
 const next={tray:tray.filter(t=>!matched.includes(t)),cleared:state.cleared+matched.length,removed:[...state.removed,token.id]};
 return {state:next,matched,full:next.tray.length===7};
}
export function canTakeKey(state:State,busy=false,total=72){return state.cleared===total&&state.tray.length===0&&!busy;}
export function spawnKinds():Kind[]{
 const bag:Kind[]=KINDS.flatMap(k=>Array<Kind>(k==='camera'?9:12).fill(k));
 let seed=94107;
 for(let i=bag.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[bag[i],bag[j]]=[bag[j],bag[i]];}
 return [...bag,'camera','camera','camera'];
}

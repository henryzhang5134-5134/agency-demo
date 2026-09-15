/** Presentation-only countdown: reaching zero never ends the round. */
export function countdown(elapsed:number){const left=Math.max(0,599-Math.floor(elapsed));return `${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;}
export const LIKE_MILESTONES=[.1,.25,.45,.65,.9] as const;
// Stable per object, so refreshing never grows models a second time.
export function sizeBoost(id:number){return 1.1+((Math.imul(id+1,73)>>>0)%101)/100*.05;}

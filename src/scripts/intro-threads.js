// Per-filament timing, independent from camera, geometry and the production scene.
export const INTRO_SECONDS=1.1;
export function threadEase(x){
 if(x<=0)return 0;if(x>=1)return 1;
 // Existing motion token: cubic-bezier(.23,1,.32,1).
 let lo=0,hi=1,t=x;
 for(let n=0;n<12;n++){t=(lo+hi)/2;const inv=1-t;const px=3*inv*inv*t*.23+3*inv*t*t*.32+t*t*t;if(px<x)lo=t;else hi=t;}
 return 1-Math.pow(1-t,3);
}
export function createThreadTimings(count,random=Math.random){
 return Array.from({length:count},(_,row)=>({
  // A few early threads already trace the silhouette while slower ones catch up.
  leftDelay:row%7===0?0:random()*.22,
  rightDelay:row%9===0?0:random()*.22,
  leftDuration:.36+random()*.49,
  rightDuration:.36+random()*.49,
  join:.34+random()*.32
 }));
}
export function threadProgress(timing,elapsed){
 return [threadEase((elapsed-timing.leftDelay)/timing.leftDuration),threadEase((elapsed-timing.rightDelay)/timing.rightDuration)];
}

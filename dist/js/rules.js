export const HIT_WINDOW = .18;
export function timingGrade(delta) {
  const distance = Math.abs(delta);
  return distance <= .065 ? 'PERFECT' : distance <= HIT_WINDOW ? 'GOOD' : null;
}
export function carouselDistance(index, selected, count) {
  return ((index - selected + count + Math.floor(count / 2)) % count) - Math.floor(count / 2);
}
export function wrapIndex(index, count) { return (index + count) % count; }
export function holdReleaseIsValid(time, end) { return time >= end - .1; }

export function resultGrade(accuracy){return accuracy>=.95?'S':accuracy>=.85?'A':accuracy>=.70?'B':'C';}
export function comboProgress(combo){
  const steps=[0,10,25,50,100];
  let previous=0,next=10;
  for(const step of steps)if(step<=combo)previous=step;else{next=step;break;}
  if(combo>=100){previous=Math.floor(combo/50)*50;next=previous+50;}
  return {next,fill:(combo-previous)/(next-previous)};
}
export function isComboMilestone(combo){return [10,25,50,100].includes(combo)||(combo>100&&combo%50===0);}
export function noteTravelSpeed(height,level){return Math.max(1,height)/(level==='hard'?1.25:level==='normal'?1.65:2);}

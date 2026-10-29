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

export const COMBO_TIERS=[
  {at:0,name:'READY',id:'ready',multiplier:1},
  {at:10,name:'NICE!',id:'nice',multiplier:1.1},
  {at:25,name:'SUPER!',id:'super',multiplier:1.2},
  {at:50,name:'ULTRA!',id:'ultra',multiplier:1.3},
  {at:100,name:'ULTRA FEVER!',id:'fever',multiplier:1.5},
  {at:150,name:'LEGEND!',id:'legend',multiplier:1.7}
];
export function comboTier(combo){return [...COMBO_TIERS].reverse().find(t=>combo>=t.at)||COMBO_TIERS[0];}
export function performanceSummary({perfect,good,miss,wrong,maxCombo}){
  const notes=perfect+good+miss;
  const accuracy=(perfect+good*.65)/Math.max(1,notes+wrong);
  const comboRate=Math.min(1,maxCombo/Math.max(1,notes));
  const cleanRate=(perfect+good)/Math.max(1,notes+wrong);
  const accuracyPoints=accuracy*70,comboPoints=comboRate*20,cleanPoints=cleanRate*10;
  const overall=Math.round((accuracyPoints+comboPoints+cleanPoints)*10)/10;
  return {notes,accuracy,comboRate,cleanRate,accuracyPoints,comboPoints,cleanPoints,overall,
    grade:resultGrade(overall/100),fullCombo:notes>0&&miss===0&&wrong===0,
    evaluation:overall>=95?'타이밍도 흐름도 빛나는 연주예요!':overall>=85?'안정적인 연주예요. 다음엔 더 긴 콤보에 도전!':overall>=70?'좋아요! 끊긴 구간을 연습하면 더 높이 올라갈 수 있어요.':'천천히 박자를 익혀봐요. 다음 연주는 더 좋아질 거예요.'};
}
export function dragTarget(index,delta,spacing,count){
  if(Math.abs(delta)<Math.max(30,spacing*.25))return index;
  return wrapIndex(index+(delta<0?1:-1),count);
}

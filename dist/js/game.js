import {createActionGuard,createTapGuard,installZoomLock} from './controls.js?v=12';
import {makeSong,SONGS} from './song.js?v=12';
import {AudioEngine} from './audio.js?v=12';
import {timingGrade,carouselDistance,wrapIndex,holdReleaseIsValid,resultGrade,comboProgress,isComboMilestone,noteTravelSpeed,comboTier,performanceSummary,dragTarget} from './rules.js?v=12';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d'),audio=new AudioEngine(),previewAudio=new AudioEngine();
const buttons=[...document.querySelectorAll('[data-lane]')];
const colors=['#c44885','#2684af','#8651b5','#be8619'];
let wrongPresses=0;
let selectedSong='turkish',level='easy',state='idle',song,chart=[];
let score=0,combo=0,maxCombo=0,total=0,judged=0,origin=0,autoIndex=0,beatIndex=0,offset=0;
let flashes=[0,0,0,0],particles=[],judgeUntil=0,burstUntil=0,starting=false,resumeGrace=0;
const held=new Set(),pointers=new Map();
const runControl=createActionGuard(),allowSongTap=createTapGuard(),allowDifficultyTap=createTapGuard();
let cdAnimation=null,switchingPause=false,previewToken=0,previewTimer=null,previewRunning=false;
installZoomLock(document,window);
function read(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,value);}catch{}}
function bestKey(){return `neon-beat-best-v2-${selectedSong}-${level}`;}
function refreshBest(){$('best').textContent=read(bestKey(),'0');}
for(const id of ['music','effects','offset']) {
  const input=$(id),saved=Number(read('neon-beat-'+id,input.value));
  if(Number.isFinite(saved))input.value=Math.max(Number(input.min),Math.min(Number(input.max),saved));
  input.oninput=()=>{write('neon-beat-'+id,input.value);volume();};
}
function volume(){
  if(audio.music){audio.music.gain.value=$('music').value/100;audio.effects.gain.value=$('effects').value/100;}
  if(previewAudio.music)previewAudio.music.gain.value=$('music').value/100;
  offset=Number($('offset').value)/1000;
  $('offset-value').textContent=`${$('offset').value} ms`;
}
volume();
document.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>{
  if(!allowDifficultyTap())return;
  level=button.dataset.level;
  document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('selected',b===button));
  refreshBest();
});
function hud(){
  $('score').textContent=String(score).padStart(6,'0');$('combo').textContent=combo;
  $('accuracy').textContent=judged+wrongPresses?`${(total/(judged+wrongPresses)*100).toFixed(1)}%`:'—';
  const tier=comboTier(combo);$('combo-tier').textContent=tier.name;$('score-rate').textContent=`×${tier.multiplier.toFixed(1)}`;
  document.body.dataset.comboTier=tier.id;
  const progress=comboProgress(combo),meter=$('combo-meter');
  meter.style.setProperty('--combo-fill',`${progress.fill*360}deg`);
  meter.setAttribute('aria-valuenow',String(combo));meter.setAttribute('aria-valuemax',String(progress.next));
  $('combo-target').textContent=`NEXT ${progress.next}`;
}
function animateUI(element,frames,options){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  element?.getAnimations?.().forEach(animation=>animation.cancel());
  return element?.animate?.(frames,options);
}
function feedback(text,color){
  $('judge').textContent=text;$('judge').style.color=color;judgeUntil=performance.now()+(text==='MISS'?650:500);
  animateUI($('judge'),[{transform:'translateY(8px) scale(.8)',opacity:0},{transform:'translateY(0) scale(1.12)',opacity:1,offset:.25},{transform:'scale(1)',opacity:1}],{duration:300,easing:'ease-out'});
  if(text==='MISS')animateUI($('lane-feedback'),[{opacity:.7,transform:'scaleX(.85)'},{opacity:0,transform:'scaleX(1.1)'}],{duration:550,easing:'ease-out'});
}
function showOverlay(label,title,copy,button){
  $('result-grade').hidden=true;$('result-details').hidden=true;
  $('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
  $('start').innerHTML=`${button} <span>↗</span>`;$('difficulty').hidden=state==='paused';$('overlay').hidden=false;
}
async function start(){
  if(starting||!['idle','ended'].includes(state))return;
  starting=true;$('start').disabled=true;$('home').disabled=true;
  try{
    await stopPreview();await audio.reset();volume();song=makeSong(level,selectedSong);
    chart=song.notes.filter(n=>n.playable).map(n=>({...n,result:null}));
    score=combo=maxCombo=total=judged=autoIndex=beatIndex=wrongPresses=0;particles=[];held.clear();pointers.clear();hud();
    origin=audio.ctx.currentTime+3;state='playing';$('song-picker').hidden=true;
    $('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='일시정지 Ⅱ';
    $('judge').textContent='';$('combo-burst').textContent='';
    document.body.classList.add('is-playing');if(compactQuery?.matches)$('settings-panel').open=false;
  }catch{
    state='idle';song=null;$('song-picker').hidden=false;
    showOverlay('AUDIO','소리를 켜고 다시 시도해주세요','시작 버튼을 다시 눌러주세요.','다시 시작');
  }finally{starting=false;$('start').disabled=false;$('home').disabled=false;}
}
async function pause(){
  if(switchingPause||starting)return;
  switchingPause=true;
  try{
  if(state==='playing'){
    state='paused';await audio.pause();if(state!=='paused')return;
    showOverlay('INTERMISSION','잠시 쉬어가기','긴 노트는 이어서 누르세요. 준비되면 계속!','계속 연주');
    $('pause').textContent='계속 연주 ▷';
  }else if(state==='paused'){
    await audio.resume();if(state!=='paused')return;
    resumeGrace=audio.ctx.currentTime-origin-offset+.35;
    state='playing';$('overlay').hidden=true;$('pause').textContent='일시정지 Ⅱ';
    if(document.hidden){state='paused';await audio.pause();if(state==='paused'){showOverlay('INTERMISSION','잠시 쉬어가기','준비되면 계속 연주하세요.','계속 연주');$('pause').textContent='계속 연주 ▷';}}
  }
  }finally{switchingPause=false;}
}
$('start').onclick=()=>runControl(()=>state==='paused'?pause():start());$('pause').onclick=()=>runControl(pause);
function finish(){
  state='ended';document.body.classList.remove('is-playing');$('pause').disabled=true;
  if(score>Number(read(bestKey(),'0')))write(bestKey(),score);refreshBest();
  const perfect=chart.filter(n=>n.result==='PERFECT').length,good=chart.filter(n=>n.result==='GOOD').length,miss=chart.filter(n=>n.result==='MISS').length;
  const summary=performanceSummary({perfect,good,miss,wrong:wrongPresses,maxCombo});
  showOverlay('PERFORMANCE COMPLETE',summary.fullCombo?'FULL COMBO!':summary.overall>=85?'멋진 무대였어요!':'한 곡을 완성했어요.',summary.evaluation,'다시 연주');
  $('result-grade').textContent=summary.grade;$('result-grade').hidden=false;
  $('result-grade').setAttribute('aria-label',`종합 등급 ${summary.grade}`);
  $('result-details').innerHTML=`<div class="overall-score"><strong>${summary.overall.toFixed(1)}</strong><span>/ 100 종합점수</span></div><div class="result-grid"><span>총점 <b>${score.toLocaleString()}</b></span><span>정확도 <b>${(summary.accuracy*100).toFixed(1)}%</b></span><span>최대 콤보 <b>${maxCombo}</b></span><span>최고 단계 <b>${comboTier(maxCombo).name}</b></span><span>PERFECT <b>${perfect}</b></span><span>GOOD <b>${good}</b></span><span>노트 MISS <b>${miss}</b></span><span>잘못 누름 <b>${wrongPresses}</b></span></div><p class="score-breakdown">정확도 ${summary.accuracyPoints.toFixed(1)}/70 · 콤보 ${summary.comboPoints.toFixed(1)}/20 · 실수 억제 ${summary.cleanPoints.toFixed(1)}/10</p>`;
  $('result-details').hidden=false;
}
function wrongHit(lane){
  wrongPresses++;combo=0;$('combo-burst').textContent='';burstUntil=0;
  feedback('MISS','#bc476e');hud();
  // No note is consumed; missed notes and extra presses stay separate in results.
}

function complete(note,grade){
  if(note.result&&note.result!=='HOLD')return;
  note.result=grade;note.voice?.stop();judged++;
  if(grade==='MISS'){combo=0;$('combo-burst').textContent='';burstUntil=0;feedback('MISS','#bc476e');hud();return;}
  const value=grade==='PERFECT'?1:.65;
  total+=value;combo++;maxCombo=Math.max(combo,maxCombo);score+=Math.round(value*1000*comboTier(combo).multiplier);hud();
  feedback(grade,grade==='PERFECT'?'#267b68':'#8550b5');
  animateUI($('combo-meter'),[{transform:'scale(1)'},{transform:'scale(1.18)',offset:.35},{transform:'scale(1)'}],{duration:220});
  const milestone=isComboMilestone(combo);
  if(milestone){
    $('combo-burst').textContent=`${comboTier(combo).name} ${combo} COMBO!`;burstUntil=performance.now()+1400;
    animateUI($('combo-burst'),[{transform:'translateY(-10px) scale(.7)',opacity:0},{transform:'scale(1.12)',opacity:1,offset:.25},{transform:'scale(1)',opacity:1}],{duration:600,easing:'ease-out'});
  }
  const count=milestone?64:14;
  for(let i=0;i<count;i++)particles.push({lane:milestone?i%4:note.lane,x:Math.random(),y:0,vx:(Math.random()-.5)*(milestone?3:2),vy:Math.random()*3+1,life:1,shape:i%3});
  particles=particles.slice(-200);
}
function hit(lane){
  if(state!=='playing')return;
  const t=audio.ctx.currentTime-origin;if(t<0)return;
  const now=t-offset;flashes[lane]=performance.now();
  // Finalize the previous tail at input time, before looking up the next head.
  // A new press can arrive before the animation frame that completes the hold.
  for(const active of chart)if(active.lane===lane&&active.result==='HOLD'){
    if(holdReleaseIsValid(now,active.time+active.hold))complete(active,active.headGrade);
    else return;
  }
  const note=chart.find(n=>n.lane===lane&&!n.result&&timingGrade(n.time-now));
  if(!note){wrongHit(lane);return;}
  const grade=timingGrade(note.time-now);
  if(note.hold){note.result='HOLD';note.headGrade=grade;note.voice=audio.tone(note.pitch,audio.ctx.currentTime,note.hold,.38,audio.effects,true);feedback('HOLD','#96621a');}
  else{audio.tone(note.pitch,audio.ctx.currentTime,note.duration,.45);complete(note,grade);}
}
function isDown(lane){return held.has(lane)||[...pointers.values()].includes(lane);}
function release(lane){
  buttons[lane]?.classList.toggle('active',isDown(lane));
  if(state!=='playing'||isDown(lane))return;
  const now=audio.ctx.currentTime-origin-offset;
  for(const note of chart)if(note.lane===lane&&note.result==='HOLD')
    complete(note,holdReleaseIsValid(now,note.time+note.hold)?note.headGrade:'MISS');
}
function updateHolds(now){
  for(const note of chart)if(note.result==='HOLD'){
    if(now>=note.time+note.hold)complete(note,note.headGrade);
    else if(!isDown(note.lane)&&now>resumeGrace)complete(note,'MISS');
  }
}
window.addEventListener('keydown',event=>{
  const lane=['KeyD','KeyF','KeyJ','KeyK'].indexOf(event.code);
  if(lane>=0){event.preventDefault();if(event.repeat||held.has(lane))return;held.add(lane);buttons[lane].classList.add('active');hit(lane);}
  if(event.code==='Escape'&&!event.repeat)runControl(pause);
});
window.addEventListener('keyup',event=>{
  const lane=['KeyD','KeyF','KeyJ','KeyK'].indexOf(event.code);
  if(lane>=0){held.delete(lane);release(lane);}
});
// Suppress the native long-press menu without changing pointer/hold timing.
$('keys').oncontextmenu=event=>event.preventDefault();
$('keys').onselectstart=event=>event.preventDefault();
buttons.forEach((button,lane)=>{
  button.onpointerdown=event=>{event.preventDefault();const down=held.has(lane)||[...pointers].some(([id,value])=>id!==event.pointerId&&value===lane);pointers.set(event.pointerId,lane);button.setPointerCapture(event.pointerId);button.classList.add('active');if(!down)hit(lane);};
  const lift=event=>{if(pointers.get(event.pointerId)!==lane)return;pointers.delete(event.pointerId);release(lane);};
  button.onpointerup=button.onpointercancel=lift;
  button.onlostpointercapture=event=>{if(button.hasPointerCapture(event.pointerId))return;lift(event);};
});
function clearInput(){stopPreview();held.clear();pointers.clear();buttons.forEach(b=>b.classList.remove('active'));if(state==='playing')pause();}
window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
function schedule(t){
  while(autoIndex<song.notes.length&&song.notes[autoIndex].time<t+.15){
    const note=song.notes[autoIndex++];
    if(!note.playable&&note.time>=t-.03)audio.tone(note.pitch,origin+note.time,note.duration,.22,audio.music);
  }
  while(beatIndex*song.beat<t+.15){
    const beat=beatIndex++,at=beat*song.beat;
    if(at>song.duration-2||at<t-.03)continue;
    audio.drum(origin+at,true);audio.percussion(origin+at+song.beat/2);
    if(beat%2===1)audio.percussion(origin+at,true);
    audio.tone(song.bass[beat%8],origin+at,.18,.2,audio.music);
    if(beat%2===1)for(const pitch of song.chord)audio.tone(pitch,origin+at+song.beat/2,.1,.055,audio.music);
  }
}
let last=performance.now();function frame(ms){const dt=Math.min((ms-last)/1000,.05);last=ms;const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const laneWidth=w/4,line=h-18,travelSpeed=noteTravelSpeed(line,level);
for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#8550b506':'#267b6804';ctx.fillRect(i*laneWidth,0,laneWidth,h);ctx.strokeStyle='#8b6caa30';ctx.beginPath();ctx.moveTo(i*laneWidth,0);ctx.lineTo(i*laneWidth,h);ctx.stroke();const f=Math.max(0,1-(ms-flashes[i])/250);if(f){const g=ctx.createLinearGradient(0,h,0,h-150);g.addColorStop(0,colors[i]+Math.round(f*80).toString(16).padStart(2,'0'));g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(i*laneWidth,h-150,laneWidth,150);}}
ctx.strokeStyle='#267b6866';ctx.beginPath();ctx.moveTo(0,line);ctx.lineTo(w,line);ctx.stroke();
if(song){const t=audio.ctx.currentTime-origin;if(state==='playing'){schedule(t);$('countdown').textContent=t<0?Math.ceil(-t):'';updateHolds(t-offset);for(const n of chart)if(!n.result&&t-offset-n.time>.18){complete(n,'MISS');}if(t>=song.duration)finish();$('progress').style.width=`${Math.max(0,Math.min(100,t/song.duration*100))}%`;}
for(const n of chart){if(n.result&&n.result!=='HOLD')continue;const y=line-(n.time-(t-offset))*travelSpeed;const tail=line-(n.time+(n.hold||0)-(t-offset))*travelSpeed;if(y< -25||tail>h+30)continue;if(n.hold){ctx.fillStyle=colors[n.lane]+'55';ctx.fillRect(n.lane*laneWidth+laneWidth*.32,Math.max(-20,tail),laneWidth*.36,Math.max(0,Math.min(line,y)-Math.max(-20,tail)));}ctx.fillStyle=colors[n.lane];ctx.shadowColor=colors[n.lane];ctx.shadowBlur=13;ctx.fillRect(n.lane*laneWidth+12,(n.result==='HOLD'?line:y)-10,laneWidth-24,10);ctx.shadowBlur=0;ctx.fillStyle='#ffffffaa';ctx.fillRect(n.lane*laneWidth+12,y-10,laneWidth-24,2);}}
if(state==='playing'){particles=particles.filter(p=>p.life>0);for(const p of particles){p.life-=dt*2;p.x+=p.vx*dt;p.y+=p.vy*dt*80;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=colors[p.lane];ctx.font=p.shape===1?'bold 17px Arial':'bold 14px Arial';ctx.textAlign='center';ctx.fillText(p.shape===1?'♪':'✦',(p.lane+p.x)*laneWidth,line-p.y);}ctx.globalAlpha=1;}if(ms>judgeUntil)$('judge').textContent='';if(ms>burstUntil)$('combo-burst').textContent='';requestAnimationFrame(frame);}requestAnimationFrame(frame);


function selectSong(id,animate=false){
  if(!SONGS.some(s=>s.id===id))return;
  if(selectedSong!==id)stopPreview();
  selectedSong=id;
  const selected=makeSong(level,id),index=SONGS.findIndex(s=>s.id===id);
  $('song-title').textContent=selected.title;$('song-composer').textContent=selected.composer+' · Neon pop mix';
  $('song-icon').textContent=selected.icon;$('song-tag').textContent=selected.tag;
  $('song-bpm').textContent=selected.bpm+' BPM';$('song-duration').textContent=Math.round(selected.duration)+'초';
  $('song-position').textContent=`${index+1} / ${SONGS.length} · ${selected.title}`;
  document.querySelectorAll('[data-song]').forEach((button,i)=>{
    const distance=carouselDistance(i,index,SONGS.length),active=i===index;
    button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
    button.style.setProperty('--slot',distance);button.style.setProperty('--distance',Math.abs(distance));
    button.style.zIndex=String(10-Math.abs(distance));
    button.setAttribute('aria-hidden',String(Math.abs(distance)>1));button.tabIndex=Math.abs(distance)>1?-1:0;
  });
  if(animate&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){const selected=document.querySelector('[data-song="'+id+'"]');
    cdAnimation?.cancel();
    cdAnimation=selected?.querySelector('.track-disc')?.animate?.([{transform:'scale(1)'},{transform:'scale(1.2)',offset:.45},{transform:'scale(1.06)'}],{duration:400,easing:'ease-out'});
  }
  refreshBest();
}
function moveSong(direction){
  if(state!=='idle')return;
  selectSong(SONGS[wrapIndex(SONGS.findIndex(s=>s.id===selectedSong)+direction,SONGS.length)].id,true);
}
let dragging=null,ignoreClickUntil=0;
function renderSongs(){
  $('song-list').innerHTML=SONGS.map((s,i)=>`<button class="song-card" data-song="${s.id}" aria-pressed="${s.id===selectedSong}"><span class="track-number">${String(i+1).padStart(2,'0')}</span><span class="track-disc" style="--disc-hue:${i*45}deg" aria-hidden="true"><span class="track-icon">${s.icon}</span></span><strong>${s.title}</strong><small>${s.composer}</small><span class="track-meta">${s.bpm} BPM · ${Math.round(makeSong('easy',s.id).duration)}초</span></button>`).join('');
  document.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>{if(performance.now()>ignoreClickUntil&&allowSongTap())selectSong(b.dataset.song,true);});
  const list=$('song-list');
  list.onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();if(!allowSongTap())return;moveSong(event.key==='ArrowLeft'?-1:1);}};
  list.ondragstart=event=>event.preventDefault();
  const resetDrag=()=>{dragging=null;list.classList.remove('dragging');list.style.setProperty('--drag-offset','0px');};
  list.onpointerdown=event=>{
    if(state!=='idle'||(event.button!==undefined&&event.button!==0)||dragging)return;
    const target=event.target.closest?.('[data-song]');
    dragging={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,moved:false,target:target?.dataset.song,
      start:SONGS.findIndex(s=>s.id===selectedSong),spacing:Math.max(80,Math.min(210,list.clientWidth*.32))};
    list.setPointerCapture(event.pointerId);
  };
  list.onpointermove=event=>{
    if(!dragging||dragging.id!==event.pointerId)return;
    const dx=event.clientX-dragging.x,dy=event.clientY-dragging.y;
    if(!dragging.moved&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){resetDrag();return;}
    if(Math.abs(dx)>7)dragging.moved=true;
    if(dragging.moved){
      dragging.dx=dx;list.classList.add('dragging');
      list.style.setProperty('--drag-offset',`${Math.max(-dragging.spacing,Math.min(dragging.spacing,dx))}px`);
    }
  };
  list.onpointerup=event=>{
    if(!dragging||dragging.id!==event.pointerId)return;
    const drag=dragging;resetDrag();ignoreClickUntil=performance.now()+350;
    if(drag.moved){
      const target=dragTarget(drag.start,event.clientX-drag.x,drag.spacing,SONGS.length);
      if(target!==drag.start&&allowSongTap())selectSong(SONGS[target].id,true);
    }else if(drag.target&&allowSongTap())selectSong(drag.target,true);
  };
  list.onpointercancel=event=>{if(dragging?.id===event.pointerId)resetDrag();};
  list.onlostpointercapture=event=>{if(dragging?.id===event.pointerId&&!list.hasPointerCapture(event.pointerId))resetDrag();};

  selectSong(selectedSong);
}
async function home(){
  if(starting)return;
  state='idle';song=null;chart=[];particles=[];held.clear();pointers.clear();
  document.body.classList.remove('is-playing');buttons.forEach(b=>b.classList.remove('active'));
  score=combo=maxCombo=total=judged=wrongPresses=0;hud();$('pause').disabled=true;$('pause').textContent='일시정지 Ⅱ';
  $('countdown').textContent='';$('judge').textContent='';$('combo-burst').textContent='';$('progress').style.width='0%';
  $('song-picker').hidden=false;
  showOverlay('READY, SET, GROOVE!','오늘의 텐션을 올려봐요!','곡을 고르고 빛이 건반에 닿는 순간 눌러주세요.','LET’S PLAY');
  await Promise.all([audio.stop(),stopPreview()]);
}
$('home').onclick=()=>runControl(home);renderSongs();
const settingsSummary=document.querySelector('#settings-panel > summary'),allowSettingsTap=createTapGuard();
settingsSummary?.addEventListener('click',event=>{if(!allowSettingsTap())event.preventDefault();});


// Use the actual visible viewport when browser chrome or the keyboard changes.
const compactQuery=window.matchMedia?.('(max-width:650px), (max-width:950px) and (max-height:500px) and (orientation:landscape)');
function syncViewport(){
  if(window.visualViewport)document.documentElement.style.setProperty('--app-height',Math.floor(window.visualViewport.height)+'px');
}
function syncSettings(){
  if(compactQuery)$('settings-panel').open=!compactQuery.matches;
  syncViewport();
}
compactQuery?.addEventListener('change',syncSettings);
window.visualViewport?.addEventListener('resize',syncViewport);
window.addEventListener('resize',syncViewport);
window.addEventListener('orientationchange',syncViewport);
syncSettings();


async function stopPreview(){
  previewToken++;previewRunning=false;
  if(previewTimer!==null){clearTimeout(previewTimer);previewTimer=null;}
  $('preview').textContent='▶ 미리듣기';$('preview').setAttribute('aria-pressed','false');
  await previewAudio.stop();
}
async function togglePreview(){
  if(previewRunning){await stopPreview();return;}
  if(state!=='idle')return;
  const token=++previewToken;
  previewRunning=true;$('preview').textContent='■ 미리듣기 종료';$('preview').setAttribute('aria-pressed','true');
  try{
    await previewAudio.reset();
    if(token!==previewToken||state!=='idle'){await previewAudio.stop();return;}
    previewAudio.music.gain.value=$('music').value/100;
    const track=makeSong('normal',selectedSong),start=previewAudio.ctx.currentTime+.08;
    for(const note of track.notes)if(note.time<7.4&&!note.harmony)
      previewAudio.tone(note.pitch,start+note.time,Math.min(note.duration,7.5-note.time),.3,previewAudio.music);
    for(let beat=0;beat*track.beat<7.4;beat+=2)
      previewAudio.tone(track.bass[beat%8],start+beat*track.beat,.25,.14,previewAudio.music);
    previewTimer=setTimeout(()=>stopPreview(),8000);
  }catch{await stopPreview();$('preview').textContent='▶ 다시 미리듣기';}
}
$('preview').onclick=()=>runControl(togglePreview);

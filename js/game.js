import {makeSong,SONGS} from './song.js?v=7';
import {AudioEngine} from './audio.js?v=7';
import {timingGrade,carouselDistance,wrapIndex,holdReleaseIsValid} from './rules.js?v=7';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d'),audio=new AudioEngine();
const buttons=[...document.querySelectorAll('[data-lane]')];
const colors=['#c44885','#2684af','#8651b5','#be8619'];
let selectedSong='turkish',level='easy',state='idle',song,chart=[];
let score=0,combo=0,maxCombo=0,total=0,judged=0,origin=0,autoIndex=0,beatIndex=0,offset=0;
let flashes=[0,0,0,0],particles=[],judgeUntil=0,burstUntil=0,starting=false,resumeGrace=0;
const held=new Set(),pointers=new Map();
function read(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,value);}catch{}}
function bestKey(){return `neon-beat-best-${selectedSong}-${level}`;}
function refreshBest(){$('best').textContent=read(bestKey(),'0');}
for(const id of ['music','effects','offset']) {
  const input=$(id),saved=Number(read('neon-beat-'+id,input.value));
  if(Number.isFinite(saved))input.value=Math.max(Number(input.min),Math.min(Number(input.max),saved));
  input.oninput=()=>{write('neon-beat-'+id,input.value);volume();};
}
function volume(){
  if(audio.music){audio.music.gain.value=$('music').value/100;audio.effects.gain.value=$('effects').value/100;}
  offset=Number($('offset').value)/1000;
  $('offset-value').textContent=`${$('offset').value} ms`;
}
volume();
document.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>{
  level=button.dataset.level;
  document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('selected',b===button));
  refreshBest();
});
function hud(){
  $('score').textContent=String(score).padStart(6,'0');$('combo').textContent=combo;
  $('accuracy').textContent=judged?`${(total/judged*100).toFixed(1)}%`:'—';
}
function feedback(text,color){$('judge').textContent=text;$('judge').style.color=color;judgeUntil=performance.now()+500;}
function showOverlay(label,title,copy,button){
  $('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
  $('start').innerHTML=`${button} <span>↗</span>`;$('difficulty').hidden=state==='paused';$('overlay').hidden=false;
}
async function start(){
  if(starting)return;
  starting=true;$('start').disabled=true;$('home').disabled=true;
  try{
    await audio.reset();volume();song=makeSong(level,selectedSong);
    chart=song.notes.filter(n=>n.playable).map(n=>({...n,result:null}));
    score=combo=maxCombo=total=judged=autoIndex=beatIndex=0;particles=[];held.clear();pointers.clear();hud();
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
  if(state==='playing'){
    state='paused';await audio.pause();if(state!=='paused')return;
    showOverlay('INTERMISSION','잠시 쉬어가기','긴 노트는 이어서 누르세요. 준비되면 계속!','계속 연주');
    $('pause').textContent='계속 연주 ▷';
  }else if(state==='paused'){
    await audio.resume();if(state!=='paused')return;
    resumeGrace=audio.ctx.currentTime-origin-offset+.35;
    state='playing';$('overlay').hidden=true;$('pause').textContent='일시정지 Ⅱ';
  }
}
$('start').onclick=()=>state==='paused'?pause():start();$('pause').onclick=pause;
function finish(){
  state='ended';document.body.classList.remove('is-playing');$('pause').disabled=true;
  if(score>Number(read(bestKey(),'0')))write(bestKey(),score);refreshBest();
  const accuracy=judged?total/judged:0;
  showOverlay('PERFORMANCE COMPLETE',accuracy>.9?'무대를 찢었어요!':'좋아요, 한 판 더?',
    `정확도 ${(accuracy*100).toFixed(1)}% · 최대 콤보 ${maxCombo} · MISS ${chart.filter(n=>n.result==='MISS').length}`,'다시 연주');
}
function complete(note,grade){
  if(note.result&&note.result!=='HOLD')return;
  note.result=grade;note.voice?.stop();judged++;
  if(grade==='MISS'){combo=0;feedback('MISS','#bc476e');hud();return;}
  const value=grade==='PERFECT'?1:.65;
  total+=value;combo++;maxCombo=Math.max(combo,maxCombo);score+=Math.round(value*1000);hud();
  feedback(grade,grade==='PERFECT'?'#267b68':'#8550b5');
  if(combo%10===0){$('combo-burst').textContent=`${combo} COMBO! ✦`;burstUntil=performance.now()+1000;}
  for(let i=0;i<10;i++)particles.push({lane:note.lane,x:Math.random(),y:0,vx:(Math.random()-.5)*2,vy:Math.random()*2+1,life:1});
}
function hit(lane){
  if(state!=='playing')return;
  const t=audio.ctx.currentTime-origin;if(t<0)return;
  const now=t-offset;flashes[lane]=performance.now();
  if(chart.some(n=>n.lane===lane&&n.result==='HOLD'))return;
  const note=chart.find(n=>n.lane===lane&&!n.result&&timingGrade(n.time-now));
  if(!note){audio.tone(48+lane*4,audio.ctx.currentTime,.08,.045);return;}
  const grade=timingGrade(note.time-now);
  if(note.hold){note.result='HOLD';note.headGrade=grade;note.voice=audio.tone(note.pitch,audio.ctx.currentTime,note.hold,.45);feedback('HOLD','#96621a');}
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
  if(event.code==='Escape'&&!event.repeat)pause();
});
window.addEventListener('keyup',event=>{
  const lane=['KeyD','KeyF','KeyJ','KeyK'].indexOf(event.code);
  if(lane>=0){held.delete(lane);release(lane);}
});
// Suppress the native long-press menu without changing pointer/hold timing.
$('keys').oncontextmenu=event=>event.preventDefault();
$('keys').onselectstart=event=>event.preventDefault();
buttons.forEach((button,lane)=>{
  button.onpointerdown=event=>{event.preventDefault();const down=isDown(lane);pointers.set(event.pointerId,lane);button.setPointerCapture(event.pointerId);button.classList.add('active');if(!down)hit(lane);};
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=event=>{pointers.delete(event.pointerId);release(lane);};
});
function clearInput(){held.clear();pointers.clear();buttons.forEach(b=>b.classList.remove('active'));if(state==='playing')pause();}
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
let last=performance.now();function frame(ms){const dt=Math.min((ms-last)/1000,.05);last=ms;const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const laneWidth=w/4,line=h-18;
for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#8550b506':'#267b6804';ctx.fillRect(i*laneWidth,0,laneWidth,h);ctx.strokeStyle='#8b6caa30';ctx.beginPath();ctx.moveTo(i*laneWidth,0);ctx.lineTo(i*laneWidth,h);ctx.stroke();const f=Math.max(0,1-(ms-flashes[i])/250);if(f){const g=ctx.createLinearGradient(0,h,0,h-150);g.addColorStop(0,colors[i]+Math.round(f*80).toString(16).padStart(2,'0'));g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(i*laneWidth,h-150,laneWidth,150);}}
ctx.strokeStyle='#267b6866';ctx.beginPath();ctx.moveTo(0,line);ctx.lineTo(w,line);ctx.stroke();
if(song){const t=audio.ctx.currentTime-origin;if(state==='playing'){schedule(t);$('countdown').textContent=t<0?Math.ceil(-t):'';updateHolds(t-offset);for(const n of chart)if(!n.result&&t-offset-n.time>.18){complete(n,'MISS');}if(t>=song.duration)finish();$('progress').style.width=`${Math.max(0,Math.min(100,t/song.duration*100))}%`;}
for(const n of chart){if(n.result&&n.result!=='HOLD')continue;const y=line-(n.time-(t-offset))*165;const tail=line-(n.time+(n.hold||0)-(t-offset))*165;if(y< -25||tail>h+30)continue;if(n.hold){ctx.fillStyle=colors[n.lane]+'55';ctx.fillRect(n.lane*laneWidth+laneWidth*.32,Math.max(-20,tail),laneWidth*.36,Math.max(0,Math.min(line,y)-Math.max(-20,tail)));}ctx.fillStyle=colors[n.lane];ctx.shadowColor=colors[n.lane];ctx.shadowBlur=13;ctx.fillRect(n.lane*laneWidth+12,(n.result==='HOLD'?line:y)-10,laneWidth-24,10);ctx.shadowBlur=0;ctx.fillStyle='#ffffffaa';ctx.fillRect(n.lane*laneWidth+12,y-10,laneWidth-24,2);}}
if(state==='playing'){particles=particles.filter(p=>p.life>0);for(const p of particles){p.life-=dt*2;p.x+=p.vx*dt;p.y+=p.vy*dt*80;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=colors[p.lane];ctx.fillRect((p.lane+p.x)*laneWidth,line-p.y,3,3);}ctx.globalAlpha=1;}if(ms>judgeUntil)$('judge').textContent='';if(ms>burstUntil)$('combo-burst').textContent='';requestAnimationFrame(frame);}requestAnimationFrame(frame);


function selectSong(id){
  if(!SONGS.some(s=>s.id===id))return;
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
  refreshBest();
}
function moveSong(direction){
  if(state!=='idle')return;
  selectSong(SONGS[wrapIndex(SONGS.findIndex(s=>s.id===selectedSong)+direction,SONGS.length)].id);
}
let dragX=null,dragY=null,ignoreClickUntil=0;
function renderSongs(){
  $('song-list').innerHTML=SONGS.map((s,i)=>`<button class="song-card" data-song="${s.id}" aria-pressed="${s.id===selectedSong}"><span class="track-number">0${i+1}</span><span class="track-disc" style="--disc-hue:${i*45}deg" aria-hidden="true"><span class="track-icon">${s.icon}</span></span><strong>${s.title}</strong><small>${s.composer}</small><span class="track-meta">${s.bpm} BPM · ${Math.round(makeSong('easy',s.id).duration)}초</span></button>`).join('');
  document.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>{if(performance.now()>ignoreClickUntil)selectSong(b.dataset.song);});
  $('previous-song').onclick=()=>moveSong(-1);$('next-song').onclick=()=>moveSong(1);
  const list=$('song-list');
  list.onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveSong(event.key==='ArrowLeft'?-1:1);}};
  list.onpointerdown=event=>{dragX=event.clientX;dragY=event.clientY;};
  list.onpointerup=event=>{
    if(dragX===null)return;
    const dx=event.clientX-dragX,dy=event.clientY-dragY;dragX=null;
    if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){ignoreClickUntil=performance.now()+350;moveSong(dx<0?1:-1);}
  };
  list.onpointercancel=list.onpointerleave=()=>{dragX=null;};
  selectSong(selectedSong);
}
async function home(){
  if(starting)return;
  state='idle';song=null;chart=[];particles=[];held.clear();pointers.clear();
  document.body.classList.remove('is-playing');buttons.forEach(b=>b.classList.remove('active'));
  score=combo=maxCombo=total=judged=0;hud();$('pause').disabled=true;$('pause').textContent='일시정지 Ⅱ';
  $('countdown').textContent='';$('judge').textContent='';$('combo-burst').textContent='';$('progress').style.width='0%';
  $('song-picker').hidden=false;
  showOverlay('READY, SET, GROOVE!','오늘의 텐션을 올려봐요!','곡을 고르고 빛이 건반에 닿는 순간 눌러주세요.','LET’S PLAY');
  await audio.stop();
}
$('home').onclick=home;renderSongs();


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

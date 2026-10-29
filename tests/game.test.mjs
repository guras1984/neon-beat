import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8')).toString('base64'));
const songs=await load('song.js'),rules=await load('rules.js'),controls=await load('controls.js');
const {makeSong,SONGS}=songs;
assert.equal(rules.carouselDistance(5,0,6),-1);
assert.equal(rules.carouselDistance(0,5,6),1);
assert.equal(rules.wrapIndex(-1,6),5);
assert.equal(rules.timingGrade(.064),'PERFECT');
assert.equal(rules.timingGrade(.12),'GOOD');
assert.equal(rules.timingGrade(.2),null);
for(const definition of SONGS){
  for(const level of ['easy','normal','hard']){
    const song=makeSong(level,definition.id);
    assert(song.duration>25&&song.duration<100);
    assert(song.notes.every((n,i)=>Number.isFinite(n.pitch)&&n.lane>=0&&n.lane<4&&(!i||n.time>=song.notes[i-1].time)));
    if(level==='easy')assert(!song.notes.some(n=>n.hold>0));else assert(song.notes.some(n=>n.hold>0),'Normal/Hard need holds');
    if(level!=='easy')assert(song.notes.some(n=>n.harmony),'Normal needs chords');
    const playable=song.notes.filter(n=>n.playable);
    for(let i=0;i<playable.length;i++)for(let j=i+1;j<playable.length;j++){
      const a=playable[i],b=playable[j];
      if(a.lane===b.lane)assert(b.time>=a.time+(a.hold||0)-.001,'Conflicting lane notes');
    }
  }
}
assert.equal(SONGS.length,11);
for(const track of SONGS){
 const count=mode=>makeSong(mode,track.id).notes.filter(n=>n.playable).length;
 assert(count('easy')<count('normal'),track.id+' Easy/Normal distinction');
 assert(count('normal')<count('hard'),track.id+' Normal/Hard distinction');
}
const elements=new Map(),store=new Map();
function element(){return {dataset:{},setAttribute(){},min:'-200',max:'200',value:'55',textContent:'',style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setPointerCapture(){},hasPointerCapture(){return false;},clientWidth:300,getContext(){return {};}};}
const document={body:element(),querySelector(){return null;},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [element(),element(),element(),element()];},addEventListener(){}};
const context=vm.createContext({document,window:{addEventListener(){}},performance:{now:()=>1000},localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))},requestAnimationFrame(){},...songs,...rules,...controls,AudioEngine:class{constructor(){this.ctx={currentTime:10};}tone(){return {stop(){}};}async stop(){}},console});
const source=fs.readFileSync(new URL('../js/game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source,context);
vm.runInContext(`
offset=0;state='playing';origin=10;chart=[{time:0,lane:0,pitch:60,duration:.2,result:null}];
hit(0);if(score!==1000||combo!==1||chart[0].result!=='PERFECT')throw Error('Perfect hit failed');
hit(0);if(score!==1000||judged!==1)throw Error('Duplicate scoring');
chart=[{time:.12,lane:1,pitch:62,duration:.2,result:null}];hit(1);
if(chart[0].result!=='GOOD'||score!==1650)throw Error('Good judgement failed');
state='paused';hit(1);if(judged!==2)throw Error('Paused input accepted');
state='playing';chart=[{time:0,lane:0,pitch:60,hold:.6,duration:.6,result:null}];held.add(0);hit(0);
if(chart[0].result!=='HOLD'||judged!==2)throw Error('Hold head counted too soon');
updateHolds(.61);if(chart[0].result!=='PERFECT'||judged!==3)throw Error('Hold completion failed');
chart=[{time:0,lane:0,pitch:60,hold:1,duration:1,result:null}];hit(0);held.delete(0);release(0);
if(chart[0].result!=='MISS'||combo!==0)throw Error('Early release must miss');
chart=[{time:0,lane:0,pitch:60,result:null},{time:0,lane:2,pitch:64,result:null}];hit(0);hit(2);
if(chart.some(n=>n.result!=='PERFECT'))throw Error('Chord input failed');
// A new head arrives after the tail but before the next animation frame.
held.clear();audio.ctx.currentTime=11.01;
chart=[{time:0,lane:0,pitch:60,hold:1,result:'HOLD',headGrade:'PERFECT',voice:{stop(){}}},{time:1,lane:0,pitch:62,duration:.2,result:null}];
const before=judged;hit(0);
if(chart[0].result!=='PERFECT'||chart[1].result!=='PERFECT'||judged!==before+2)throw Error('Hold-to-next head swallowed');
// Delayed capture loss from a previous tap must not clear a newly captured tap.
pointers.set(7,0);buttons[0].hasPointerCapture=()=>true;
buttons[0].onlostpointercapture({pointerId:7});
if(pointers.get(7)!==0)throw Error('Stale capture loss cleared new press');pointers.clear();
state='idle';selectedSong='turkish';moveSong(-1);if(selectedSong!==SONGS.at(-1).id)throw Error('Carousel previous wrap');
moveSong(1);if(selectedSong!=='turkish')throw Error('Carousel next wrap');
state='paused';song=makeSong();home();
if(state!=='idle'||song!==null||chart.length||score!==0||!$('pause').disabled||$('song-picker').hidden)throw Error('Home reset failed');
`,context);
console.log('PASS: 11 tracks × 3 levels, playable holds/chords, lane conflicts, timing, duplicate input, pause, hold completion/early release, simultaneous hits, carousel wrap, home reset');


// UI action locks must cover both pending async work and rapid repeated clicks.
let now=0,completeAction,calls=0;
const guard=controls.createActionGuard(300,()=>now);
const pending=guard(()=>{calls++;return new Promise(resolve=>completeAction=resolve);});
now=500;assert.equal(await guard(()=>calls++),false);
completeAction();assert.equal(await pending,true);
assert.equal(await guard(()=>calls++),true);
now=600;assert.equal(await guard(()=>calls++),false);
assert.equal(calls,2);
now=900;await assert.rejects(guard(()=>{throw new Error('test failure');}));
now=1300;assert.equal(await guard(()=>calls++),true,'Failure must release action lock');
const allow=controls.createTapGuard(280,()=>now);
assert(allow());assert(!allow());now+=281;assert(allow());

const listeners=new Map(),keys=new Map();
controls.installZoomLock({addEventListener:(name,fn,options)=>listeners.set(name,{fn,options})},{addEventListener:(name,fn)=>keys.set(name,fn)});
let blocked=0;
const event={cancelable:true,preventDefault(){blocked++;}};
listeners.get('gesturestart').fn(event);
listeners.get('touchmove').fn({...event,touches:[{},{}]});
assert.equal(blocked,2);
listeners.get('touchmove').fn({...event,touches:[{}]});assert.equal(blocked,2,'Single touch remains usable');
listeners.get('touchend').fn({...event,timeStamp:100,touches:[],changedTouches:[{clientX:20,clientY:20}]});
listeners.get('touchend').fn({...event,timeStamp:220,touches:[],changedTouches:[{clientX:22,clientY:21}]});assert.equal(blocked,3);
assert.equal(listeners.get('touchmove').options.passive,false);
keys.get('keydown')({...event,key:'d'});assert.equal(blocked,3,'Musical keys are not blocked');
keys.get('keydown')({...event,key:'+',ctrlKey:true});assert.equal(blocked,4);
console.log('PASS: pending-action lock, repeated clicks, lock recovery, menu debounce, pinch/double-tap guards, normal touch and musical keys');


assert.equal(rules.resultGrade(.95),'S');assert.equal(rules.resultGrade(.85),'A');
assert.equal(rules.resultGrade(.7),'B');assert.equal(rules.resultGrade(.69),'C');
assert.deepEqual(rules.comboProgress(9),{next:10,fill:.9});
assert.deepEqual(rules.comboProgress(10),{next:25,fill:0});
assert.equal(rules.comboProgress(24).next,25);assert.equal(rules.comboProgress(100).next,150);
for(const milestone of [10,25,50,100,150])assert(rules.isComboMilestone(milestone));
assert(!rules.isComboMilestone(11));
assert.equal(rules.noteTravelSpeed(300,'easy'),150);
assert.equal(rules.noteTravelSpeed(150,'easy'),75);
assert(rules.noteTravelSpeed(300,'hard')>rules.noteTravelSpeed(300,'normal'));

context.setTimeout=()=>123;context.clearTimeout=()=>{};
await vm.runInContext(`(async()=>{
 let notesPlayed=0,stops=0;
 previewAudio.reset=async()=>{previewAudio.ctx={currentTime:0};previewAudio.music={gain:{value:1}};};
 previewAudio.tone=()=>{notesPlayed++;};previewAudio.stop=async()=>{stops++;previewAudio.ctx=null;};
 state='idle';await togglePreview();
 if(!previewRunning||notesPlayed===0||previewTimer!==123)throw Error('Preview start failed');
 selectSong(SONGS[1].id);
 if(previewRunning||previewAudio.ctx!==null||previewTimer!==null)throw Error('Song change must stop preview');
 await togglePreview();await home();
 if(previewRunning||previewAudio.ctx!==null||stops<2)throw Error('Home must stop preview');
})()`,context);
console.log('PASS: grade boundaries, combo targets/milestones, constant reaction time, preview playback and cancellation');


assert.equal(rules.comboTier(9).name,'READY');assert.equal(rules.comboTier(10).multiplier,1.1);
assert.equal(rules.comboTier(25).name,'SUPER!');assert.equal(rules.comboTier(50).name,'ULTRA!');
assert.equal(rules.comboTier(100).name,'ULTRA FEVER!');assert.equal(rules.comboTier(150).name,'LEGEND!');
const perfectRun=rules.performanceSummary({perfect:100,good:0,miss:0,wrong:0,maxCombo:100});
assert.equal(perfectRun.overall,100);assert.equal(perfectRun.grade,'S');assert(perfectRun.fullCombo);
const mixedRun=rules.performanceSummary({perfect:80,good:10,miss:10,wrong:5,maxCombo:40});
assert(Math.abs(mixedRun.overall-(Math.round((86.5/105*70+8+90/105*10)*10)/10))<.001);
assert(!mixedRun.fullCombo);
assert.equal(rules.performanceSummary({perfect:0,good:0,miss:0,wrong:0,maxCombo:0}).overall,0);
assert.equal(rules.dragTarget(0,100,120,11),10);assert.equal(rules.dragTarget(10,-100,120,11),0);
assert.equal(rules.dragTarget(0,10,120,11),0);
vm.runInContext(`
state='playing';audio.ctx={currentTime:20};origin=20;offset=0;combo=9;wrongPresses=0;score=0;
chart=[{time:0,lane:0,pitch:60,duration:.1,result:null}];
hit(0);if(score!==1100||combo!==10||$('combo-tier').textContent!=='NICE!')throw Error('Tier score boundary');
hit(3);if(wrongPresses!==1||combo!==0||$('combo-tier').textContent!=='READY'||$('score-rate').textContent!=='×1.0')throw Error('Wrong press reset');
if($('accuracy').textContent!=='50.0%')throw Error('Wrong press accuracy penalty');
chart=[{time:0,lane:0,pitch:60,hold:1,result:'HOLD',headGrade:'PERFECT'}];
const wrongBefore=wrongPresses;hit(0);if(wrongPresses!==wrongBefore)throw Error('Maintaining hold is not an extra press');
chart=[{result:'PERFECT'},{result:'GOOD'},{result:'MISS'}];maxCombo=2;
finish();if($('result-details').hidden||!$('result-details').innerHTML.includes('잘못 누름'))throw Error('Result breakdown missing');
state='idle';selectedSong='turkish';
const list=$('song-list'),first=SONGS[0].id;
list.onpointerdown({pointerId:42,button:0,clientX:150,clientY:50,target:{closest:()=>({dataset:{song:first}})}});
list.onpointermove({pointerId:42,clientX:70,clientY:50});
if(!dragging?.moved)throw Error('Drag did not track');
list.onpointerup({pointerId:42,clientX:70,clientY:50});
if(selectedSong!==SONGS[1].id||dragging!==null||ignoreClickUntil<=1000)throw Error('Drag did not select and suppress click');
`,context);
console.log('PASS: tier multipliers, wrong-press penalties, hold protection, comprehensive results and captured drag selection');

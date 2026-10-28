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
function element(){return {dataset:{},setAttribute(){},min:'-200',max:'200',value:'55',textContent:'',style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},getContext(){return {};}};}
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

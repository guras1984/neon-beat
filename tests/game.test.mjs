import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const songSource=fs.readFileSync(new URL('../js/song.js',import.meta.url),'utf8');
const {makeSong,BEAT}=await import('data:text/javascript;base64,'+Buffer.from(songSource).toString('base64'));
for(const level of ['easy','normal']){
  const song=makeSong(level);
  assert(song.duration>45&&song.duration<90);
  assert(song.notes.every((n,i)=>n.lane>=0&&n.lane<4&&Number.isFinite(n.pitch)&&(!i||n.time>song.notes[i-1].time)));
}
assert(makeSong('normal').notes.filter(n=>n.playable).length>makeSong('easy').notes.filter(n=>n.playable).length);
const elements=new Map();
function element(){return {value:'55',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},getContext(){return {};}};}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [element(),element(),element(),element()];},addEventListener(){}};
const context=vm.createContext({document,window:{addEventListener(){}},performance:{now:()=>1000},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},makeSong,BEAT,AudioEngine:class{constructor(){this.ctx={currentTime:10};}tone(){}},console});
const source=fs.readFileSync(new URL('../js/game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source,context);
vm.runInContext(`
state='playing';origin=10;chart=[{time:0,lane:0,pitch:60,duration:.2,result:null}];
hit(0);
if(score!==1000||combo!==1||chart[0].result!=='PERFECT')throw Error('Perfect hit failed');
hit(0);
if(score!==1000||judged!==1)throw Error('Duplicate scoring');
chart=[{time:.12,lane:1,pitch:62,duration:.2,result:null}];hit(1);
if(chart[0].result!=='GOOD'||score!==1650)throw Error('Good timing failed');
state='paused';hit(1);if(judged!==2)throw Error('Paused input accepted');
`,context);
console.log('PASS: chart timing, lanes, difficulty, perfect/good judgement, duplicate input, paused input');

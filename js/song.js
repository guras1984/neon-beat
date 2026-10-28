// Original sequencing of Mozart's public-domain K.331 opening theme.
// No third-party recording, MIDI, score edition, or game chart is bundled.
export const BPM = 150;
export const BEAT = 60 / BPM;
const pitches = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export function midi(name) { const [,n,s,o] = name.match(/^([A-G])(#?)(\d)$/); return (Number(o)+1)*12+pitches[n]+(s?1:0); }
const a = 'B4 A4 G#4 A4 C5:2 D5 C5 B4 C5 E5:2 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6:4 A5:2 C6:2 B5:2 A5:2 G5:2 A5:2 B5:2 A5:2 G5:2 A5:2 B5:2 A5:2 G5:2 F#5:2 E5:4';
const b = 'A4:2 B4:2 C5:2 D5:2 E5:2 F5:2 E5:2 D5:2 C5:2 B4:2 A4:2 G#4:2 A4:4 E4:4 A4:2 B4:2 C5:2 D5:2 E5:2 F5:2 E5:2 D5:2 C5:2 B4:2 A4:2 G#4:2 A4:8';
export function makeSong(level='easy') {
  let cursor=0, index=0; const notes=[];
  for (const section of [a,a,b,a]) for (const token of section.split(' ')) {
    const [name,length='1']=token.split(':'); const duration=Number(length)*BEAT/2;
    const pitch=midi(name); const playable=level==='normal'||index%2===0||Number(length)>=4;
    notes.push({time:cursor,pitch,duration:Math.max(.12,duration*.85),lane:[0,1,2,3,2,1,0][pitch%7],playable,id:index++});
    cursor+=duration;
  }
  return {notes,duration:cursor+2};
}

// Short original arrangements of public-domain themes; no external audio or MIDI.
export const BPM = 150;
export const BEAT = 60 / BPM;
const pitches = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export function midi(name) {
  const match = name.match(/^([A-G])(#?)(\d)$/);
  if (!match) throw new Error(`Invalid pitch: ${name}`);
  const [,n,s,o] = match;
  return (Number(o)+1)*12+pitches[n]+(s?1:0);
}
const turkish = 'B4 A4 G#4 A4 C5:2 D5 C5 B4 C5 E5:2 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6:4 A5:2 C6:2 B5:2 A5:2 G5:2 A5:2 B5:2 A5:2 G5:2 A5:2 B5:2 A5:2 G5:2 F#5:2 E5:4';
const bridge = 'A4:2 B4:2 C5:2 D5:2 E5:2 F5:2 E5:2 D5:2 C5:2 B4:2 A4:2 G#4:2 A4:4 E4:4 A4:2 B4:2 C5:2 D5:2 E5:2 F5:2 E5:2 D5:2 C5:2 B4:2 A4:2 G#4:2 A4:8';
export const SONGS = [
  {id:'turkish',title:'터키 행진곡',composer:'W. A. Mozart',years:'1756–1791',work:'K.331 · Rondo alla turca',bpm:150,tag:'PIANO POP',icon:'♪',sections:[turkish,turkish,bridge,turkish],bass:[45,45,52,52,48,48,52,52],chord:[57,60,64]},
  {id:'joy',title:'환희의 송가',composer:'L. van Beethoven',years:'1770–1827',work:'Symphony No.9 · Ode to Joy',bpm:144,tag:'HAPPY ANTHEM',icon:'✦',theme:'E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 E5:3 D5 D5:4 E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 D5:3 C5 C5:4',repeat:4,bass:[48,48,55,55,53,53,55,55],chord:[60,64,67]},
  {id:'cancan',title:'캉캉',composer:'J. Offenbach',years:'1819–1880',work:'Orpheus in the Underworld · Galop infernal',bpm:160,tag:'PARTY GALOP',icon:'★',theme:'G4:2 C5 C5 D5 D5 E5 E5 F5 F5 E5 D5 C5 E5:2 D5:2 D5 B4:2 G4:2 C5 C5 D5 D5 E5 E5 F5 F5 E5 D5 C5 D5:2 B4:2 C5:4',repeat:6,bass:[48,55,48,55,53,55,48,55],chord:[60,64,67]},
  {id:'spring',title:'사계 · 봄',composer:'A. Vivaldi',years:'1678–1741',work:'The Four Seasons · Spring, I',bpm:148,tag:'SUNSHINE DANCE',icon:'☀',theme:'E5:2 G#5 G#5 G#5:2 F#5 E5 B5:4 B5 A5 G#5 G#5 G#5:2 F#5 E5 B5:4 B5 A5 G#5 A5 B5 A5 G#5 F#5 E5 F#5 G#5 E5 F#5:4 E5:4',repeat:6,bass:[40,47,40,47,45,47,40,47],chord:[56,59,64]},
  {id:'entertainer',title:'엔터테이너',composer:'S. Joplin',years:'1868–1917',work:'The Entertainer · A Rag Time Two Step (1902)',bpm:140,tag:'BOUNCY RAGTIME',icon:'♫',theme:'D5 D#5 E5 C6:2 E5 C6:2 E5 C6:4 C6 D6 D#6 E6 C6 D6 E6:2 B5 D6:2 C6:4 D5 D#5 E5 C6:2 E5 C6:2 E5 C6:4 A5 G5 F#5 A5 C6 E6 D6:2 C6:4',repeat:5,bass:[48,55,48,55,53,55,48,55],chord:[60,64,67]},
  {id:'william',title:'윌리엄 텔 서곡',composer:'G. Rossini',years:'1792–1868',work:'William Tell Overture · Finale',bpm:156,tag:'VICTORY RUN',icon:'⚡',theme:'G4 G4 G4:2 G4 G4 G4:2 G4 G4 C5:2 D5:2 E5:2 G4 G4 G4:2 G4 G4 C5:2 E5:2 D5:4 E5 E5 E5:2 E5 E5 E5:2 E5 E5 G5:2 F5:2 E5:2 D5 C5 D5:2 E5:2 C5:4',repeat:5,bass:[48,55,48,55,53,55,48,55],chord:[60,64,67]}
];
export function makeSong(level='easy',songId='turkish') {
  const definition = SONGS.find(s=>s.id===songId);
  if (!definition) throw new Error('Unknown song');
  const beat = 60 / definition.bpm;
  let cursor=0,index=0; const notes=[];
  const sections=definition.sections || Array(definition.repeat).fill(definition.theme);
  for (const section of sections) for (const token of section.split(' ')) {
    const [name,length='1']=token.split(':');
    const duration=Number(length)*beat/2,pitch=midi(name);
    notes.push({time:cursor,pitch,duration:Math.max(.12,duration*.85),lane:[0,1,2,3,2,1,0][pitch%7],playable:level==='normal'||index%2===0||Number(length)>=4,id:index++});
    cursor+=duration;
  }
  // Sustain long melody tones, and add occasional two-hand harmony in Normal.
  const harmony=[];
  for (const note of notes) {
    note.hold = note.playable && note.duration >= beat * (level==='normal' ? 1.2 : 1.5)
      ? Math.max(.3,note.duration-.06) : 0;
    if(level==='normal' && note.id%12===0 && note.duration>=beat*.8) {
      const lane=(note.lane+2)%4;
      harmony.push({...note,id:'h'+note.id,lane,pitch:definition.chord[note.id%3]-12,
        duration:.22,hold:0,harmony:true});
    }
  }
  notes.push(...harmony);
  notes.sort((a,b)=>a.time-b.time || a.lane-b.lane);
  return {...definition,beat,notes,duration:cursor+2};
}

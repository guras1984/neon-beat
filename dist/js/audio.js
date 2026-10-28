export class AudioEngine {
  async init() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    this.ctx ||= new Audio();
    await this.ctx.resume();
    if(this.master) return;
    const c=this.ctx;
    this.master=c.createGain();
    this.master.gain.value=.65;
    const compressor=c.createDynamicsCompressor();
    compressor.threshold.value=-12;
    compressor.ratio.value=2.5;compressor.release.value=.18;
    this.master.connect(compressor);compressor.connect(c.destination);
    this.music=c.createGain();this.effects=c.createGain();
    this.music.connect(this.master);this.effects.connect(this.master);
    // A quiet, original room impulse gives the keyboard a little depth.
    this.room=c.createConvolver();
    const impulse=c.createBuffer(2,c.sampleRate*.65,c.sampleRate);
    for(let channel=0;channel<2;channel++) {
      const data=impulse.getChannelData(channel);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);
    }
    this.room.buffer=impulse;
    const wet=c.createGain();wet.gain.value=.1;
    this.effects.connect(this.room);this.room.connect(wet);wet.connect(this.master);
  }
  tone(pitch,when,duration=.3,volume=.35,bus=this.effects,sustain=false) {
    const c=this.ctx;
    if(!c || c.state==='closed')return;
    const t=Math.max(c.currentTime,when),g=c.createGain(),oscillators=[];
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(volume,t+.009);
    g.gain.exponentialRampToValueAtTime(Math.max(.001,volume*.28),t+.12);
    if(sustain)g.gain.setValueAtTime(Math.max(.001,volume*.28),t+Math.max(.13,duration));
    g.gain.exponentialRampToValueAtTime(.001,t+Math.max(.15,duration)+.32);
    const warmth=c.createBiquadFilter();warmth.type='lowpass';warmth.frequency.value=5200;warmth.Q.value=.3;g.connect(warmth);warmth.connect(bus);
    let remaining=4;
    for(const [ratio,weight] of [[1,1],[2.001,.2],[3.002,.055],[4.004,.018]]) {
      const oscillator=c.createOscillator(),partial=c.createGain();
      oscillator.type='sine';oscillator.frequency.value=440*2**((pitch-69)/12)*ratio;
      partial.gain.value=weight;oscillator.connect(partial);partial.connect(g);
      oscillator.start(t);oscillator.stop(t+Math.max(.15,duration)+.38);
      oscillator.onended=()=>{oscillator.disconnect();partial.disconnect();if(--remaining===0){g.disconnect();warmth.disconnect();}};
      oscillators.push(oscillator);
    }
    let released=false;
    return {stop:()=>{
      if(c.state==='closed'||released)return;released=true;
      const now=c.currentTime;
      if(g.gain.cancelAndHoldAtTime)g.gain.cancelAndHoldAtTime(now);else{g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(volume*.18,now);}
      g.gain.setTargetAtTime(.001,now,.03);
      for(const oscillator of oscillators)try{oscillator.stop(now+.15);}catch{}
    }};
  }
  drum(when,accent) {
    const c=this.ctx,t=Math.max(when,c.currentTime),o=c.createOscillator(),g=c.createGain();
    o.frequency.setValueAtTime(accent?120:65,t);o.frequency.exponentialRampToValueAtTime(35,t+.12);
    g.gain.setValueAtTime(accent?.18:.1,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
    o.connect(g);g.connect(this.music);o.start(t);o.stop(t+.18);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  percussion(when,clap=false) {
    const c=this.ctx,t=Math.max(when,c.currentTime),length=clap?.11:.035;
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=buffer;filter.type='highpass';filter.frequency.value=clap?1400:7500;
    gain.gain.setValueAtTime(clap?.13:.055,t);gain.gain.exponentialRampToValueAtTime(.001,t+length);
    source.connect(filter);filter.connect(gain);gain.connect(this.music);source.start(t);source.stop(t+length);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  async stop(){const c=this.ctx;this.ctx=null;this.master=null;if(c&&c.state!=='closed')await c.close();}
  async pause(){await this.ctx?.suspend();}
  async resume(){await this.ctx?.resume();}
  async reset(){await this.stop();await this.init();}
}

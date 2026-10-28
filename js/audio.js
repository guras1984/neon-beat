export class AudioEngine {
  async init(){this.ctx ||= new AudioContext(); await this.ctx.resume(); if(!this.master){this.master=this.ctx.createGain();this.master.gain.value=.65;this.master.connect(this.ctx.destination);this.music=this.ctx.createGain();this.music.connect(this.master);this.effects=this.ctx.createGain();this.effects.connect(this.master);} }
  tone(pitch,when,duration=.3,volume=.35,bus=this.effects){const c=this.ctx;if(!c)return;const t=Math.max(c.currentTime,when);const g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.006);g.gain.exponentialRampToValueAtTime(.001,t+duration+.15);g.connect(bus);for(const [ratio,weight] of [[1,1],[2,.32],[3,.12]]){const o=c.createOscillator();const partial=c.createGain();o.type='sine';o.frequency.value=440*2**((pitch-69)/12)*ratio;partial.gain.value=weight;o.connect(partial);partial.connect(g);o.start(t);o.stop(t+duration+.2);o.onended=()=>{o.disconnect();partial.disconnect();};}setTimeout(()=>g.disconnect(),Math.max(0,(t-c.currentTime+duration+.3)*1000));}
  drum(when,accent){const c=this.ctx,t=Math.max(when,c.currentTime),o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(accent?120:65,t);o.frequency.exponentialRampToValueAtTime(35,t+.12);g.gain.setValueAtTime(accent?.18:.1,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.connect(g);g.connect(this.music);o.start(t);o.stop(t+.18);o.onended=()=>{o.disconnect();g.disconnect();};}
  // Short synthesized noise bursts add a light dance groove without samples.
  percussion(when, clap = false) {
    const c = this.ctx, t = Math.max(when, c.currentTime);
    const length = clap ? .11 : .035;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = clap ? 1400 : 7500;
    gain.gain.setValueAtTime(clap ? .13 : .055, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + length);
    source.connect(filter); filter.connect(gain); gain.connect(this.music);
    source.start(t); source.stop(t + length);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  async pause(){await this.ctx?.suspend();}async resume(){await this.ctx?.resume();}
  async reset(){if(this.ctx){await this.ctx.close();this.ctx=null;this.master=null;}await this.init();}
}

export class GameAudio{
 context:AudioContext|null=null;sfx=true;music=true;paused=false;next=0;step=0;
 constructor(){try{const p=JSON.parse(localStorage.getItem('finding-audio')||'{}');this.sfx=p.sfx??true;this.music=p.music??true;}catch{}}
 async unlock(){if(!this.context)this.context=new AudioContext();if(this.context.state==='suspended'&&!this.paused)await this.context.resume();}
 save(){try{localStorage.setItem('finding-audio',JSON.stringify({sfx:this.sfx,music:this.music}));}catch{}}
 note(freq:number,volume:number,duration:number,delay=0,type:OscillatorType='sine',channel:'sfx'|'music'='sfx'){
  const c=this.context;if(!c||c.state!=='running'||this.paused)return;
  const t=c.currentTime+delay;const o=c.createOscillator();const g=c.createGain();o.type=type;o.frequency.value=freq;
  const level=volume*(channel==='music'?1.8:1.35);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.03);
 }
 play(event:'pick'|'slot'|'match'|'hint'|'tap'|'key'|'drop'|'shake'){
  if(!this.sfx)return;
  if(event==='pick'){this.note(620,.06,.085);this.note(920,.022,.08,.018);}
  if(event==='slot')this.note(300,.035,.1);
  if(event==='drop'){[740,660,590,520,440,350].forEach((f,i)=>this.note(f,.02,.12,i*.105));}
  if(event==='shake'){[280,350,300,420].forEach((f,i)=>this.note(f,.017,.09,i*.12,'triangle'));}
  if(event==='tap')this.note(440,.018,.065);
  if(event==='hint')this.note(760,.018,.19);
  if(event==='match'||event==='key'){[523.25,659.25,783.99,event==='key'?1046.5:987.77].forEach((f,i)=>this.note(f,.035,.23,i*.058));}
 }
 update(){const c=this.context;if(!c||!this.music||this.paused||c.state!=='running')return;
  if(c.currentTime>this.next){const phrase=[261.63,0,329.63,392,0,329.63,293.66,0,261.63,0,196,0,220,0,293.66,0];const f=phrase[this.step++%phrase.length];if(f){this.note(f,.006,.62,0,'sine','music');this.note(f/2,.004,.85,0,'sine','music');}this.next=c.currentTime+.52;}
 }
 setPaused(value:boolean){this.paused=value;if(value)void this.context?.suspend();else{this.next=0;void this.context?.resume();}}
}

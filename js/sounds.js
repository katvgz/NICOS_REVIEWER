// Small synthesized effects: no audio downloads or additional libraries.
let enabled=true;
let context;
try {enabled=localStorage.getItem('mste-sound-effects')!=='off';}catch{}

export function soundEnabled(){return enabled;}
export function setSoundEnabled(value){
  enabled=Boolean(value);
  try {localStorage.setItem('mste-sound-effects',enabled?'on':'off');}catch{}
}

async function play(wrong) {
  if(!enabled||document.hidden)return;
  try {
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return;
    // Created/resumed only from a real button interaction (mobile audio policy).
    context??=new AudioContext();
    if(context.state!=='running')await context.resume();
    if(!enabled||document.hidden||context.state!=='running')return;
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    const now=context.currentTime;
    const duration=wrong?.22:.065;
    oscillator.type=wrong?'triangle':'sine';
    oscillator.frequency.setValueAtTime(wrong?190:950,now);
    oscillator.frequency.exponentialRampToValueAtTime(wrong?85:620,now+duration);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(wrong?.09:.07,now+.006);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(gain);gain.connect(context.destination);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    oscillator.start(now);oscillator.stop(now+duration+.01);
  }catch{/* Unavailable or blocked audio must never interrupt the quiz. */}
}

export function playClick(){void play(false);}
export function playWrong(){void play(true);}

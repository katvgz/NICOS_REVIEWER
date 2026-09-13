import {createCharacterInteraction} from './character.js';
import {createQuiz} from './quiz.js';
import {playClick,soundEnabled,setSoundEnabled} from './sounds.js';

document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  // Answers play their own effect after checking whether the choice is correct.
  if(button&&!button.disabled&&!button.classList.contains('answer-button'))playClick();
},true);
const soundToggle=document.querySelector('#sound-toggle');
soundToggle.checked=soundEnabled();
soundToggle.addEventListener('change',()=>{setSoundEnabled(soundToggle.checked);if(soundToggle.checked)playClick();});

const START_DESTINATION = '#mste';
const MSTE_DESTINATION = '#qs';
const stage=document.querySelector('#landing');
const mste=document.querySelector('#mste');
const msteButton=document.querySelector('#mste-button');
const start=document.querySelector('#start-button');
const dialog=document.querySelector('#settings-dialog');
const toggle=document.querySelector('#motion-toggle');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let preference=null;
try {preference=localStorage.getItem('reviewer-motion');}catch{/* Storage can be unavailable in private browsers. */}
toggle.checked=preference===null?!reducedMotion.matches:preference==='on';
const character=createCharacterInteraction({stage,anchor:document.querySelector('#character-anchor'),character:document.querySelector('#character'),motionEnabled:()=>toggle.checked&&!reducedMotion.matches});
toggle.addEventListener('change',()=>{try{localStorage.setItem('reviewer-motion',toggle.checked?'on':'off');}catch{}});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)toggle.checked=false;});
document.querySelector('#settings-button').addEventListener('click',()=>{character.setPaused(true);dialog.showModal();});
dialog.addEventListener('close',()=>character.setPaused(stage.hidden));
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});

// Local pixel lettering stays crisp and works offline; START remains native button text for AT.
const glyphs={S:['11111','10000','10000','11111','00001','00001','11111'],T:['11111','00100','00100','00100','00100','00100','00100'],A:['01110','11011','10001','10001','11111','10001','10001'],R:['11110','10001','10001','11110','10100','10010','10001']};
const svgNS='http://www.w3.org/2000/svg';
const word=document.createElementNS(svgNS,'svg');word.setAttribute('viewBox','0 0 41 7');word.setAttribute('aria-hidden','true');
[...'START'].forEach((letter,index)=>glyphs[letter].forEach((row,y)=>[...row].forEach((pixel,x)=>{if(pixel==='1'){const rect=document.createElementNS(svgNS,'rect');rect.setAttribute('x',index*9+x);rect.setAttribute('y',y);rect.setAttribute('width','1');rect.setAttribute('height','1');word.append(rect);}})));
document.querySelector('#start-label').replaceChildren(word);

const screens={home:stage,mste,qs:document.querySelector('#qs'),quiz:document.querySelector('#quiz'),results:document.querySelector('#results')};
const quiz=createQuiz(route=>{if(location.hash===`#${route}`)showScreen();else location.hash=route;});
function showScreen() {
  quiz.pause();
  const route=location.hash.slice(1);
  let next=Object.hasOwn(screens,route)?route:'home';
  if((next==='quiz'&&!quiz.hasSession())||(next==='results'&&!quiz.isComplete()))next='qs';
  if(next==='quiz'&&quiz.isComplete())next='results';
  if(next!==route)history.replaceState(null,'',`#${next}`);
  for(const [name,screen] of Object.entries(screens)) {
    screen.hidden=name!==next;
    screen.inert=name!==next;
  }
  character.setPaused(next!=='home');
  if(next==='results')quiz.renderResults();
  if(next==='quiz')quiz.render();
  else {
    const focusTarget=next==='home'?start:next==='mste'?msteButton:next==='qs'?document.querySelector('.qs-choice'):document.querySelector('#results-title');
    focusTarget.focus({preventScroll:true});
  }
}
start.addEventListener('click',()=>location.assign(START_DESTINATION));
msteButton.addEventListener('click',()=>location.assign(MSTE_DESTINATION));
document.querySelector('#mste-home').addEventListener('click',()=>{location.hash='home';});
document.querySelector('#qs-back').addEventListener('click',()=>{location.hash='mste';});
document.querySelectorAll('.qs-choice').forEach(button=>button.addEventListener('click',()=>quiz.start(Number(button.dataset.count))));
document.querySelector('#results-mste').addEventListener('click',()=>{location.hash='qs';});
document.querySelector('#quiz-home').addEventListener('click',()=>{location.hash='home';});
window.addEventListener('hashchange',showScreen);
if(location.hash)showScreen();

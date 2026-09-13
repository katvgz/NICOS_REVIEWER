// Optional local QA: uses an installed Chromium browser, no packages required.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {questionBank as sourceBank} from '../js/questions.js';
await mkdir('artifacts',{recursive:true});
const browserPath=process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const proc=spawn(browserPath,['--headless=new','--remote-debugging-port=9223',`--user-data-dir=${path.resolve('.browser-qa')}`,'--no-first-run','--no-default-browser-check','--disable-gpu','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;
try {
  let pages;
  for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9223/json')).json();break;}catch{await delay(250);}}
  if(!pages)throw new Error('Headless browser did not start.');
  const page=await(await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let id=0;const pending=new Map();const errors=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const handler=pending.get(message.id);pending.delete(message.id);if(message.error)handler.reject(message.error);else handler.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);else if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const current=++id;pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const currentCorrectIndex=async()=>{
    const displayed=await evaluate(`({text:document.querySelector('#question-text').textContent,choices:[...document.querySelectorAll('.answer-label')].map(element=>element.textContent)})`);
    const source=sourceBank.find(question=>question.text===displayed.text&&question.choices.every(choice=>displayed.choices.includes(choice)));
    assert(source,'Displayed question/choices must exactly match the PDF');
    return displayed.choices.indexOf(source.choices[source.correctIndex]);
  };
  const waitFor=async expression=>{for(let n=0;n<40;n++){if(await evaluate(expression))return;await delay(100);}throw new Error(`Timed out: ${expression}`);};
  const screenshot=async file=>{const {data}=await send('Page.captureScreenshot',{format:'png'});await writeFile(`artifacts/${file}.png`,Buffer.from(data,'base64'));};
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
  if(!process.argv.includes('--guards')&&!process.argv.includes('--results')) {
  for(const [width,height] of [[390,844],[320,568],[430,932],[768,1024],[1440,900],[844,390]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await send('Page.navigate',{url:'http://localhost:3000'});await delay(550);
    const layout=await evaluate(`(()=>{const c=document.querySelector('#character').getBoundingClientRect(),b=document.querySelector('#start-button').getBoundingClientRect(),img=document.querySelector('.character img');return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,button:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},character:{top:c.top,bottom:c.bottom,left:c.left,right:c.right},imageLoaded:img.complete&&img.naturalWidth>0}})()`);
    assert.equal(layout.scrollWidth,width,'Horizontal overflow');assert.equal(layout.scrollHeight,height,'Vertical overflow');assert(layout.imageLoaded,'Missing character');assert(layout.button.bottom<=height,'Button below viewport');assert(layout.character.top>=0&&layout.character.bottom<=height,'Character clipped');
    console.log(`${width}x${height}: layout and asset checks passed`);
    if(width===390||width===1440)await screenshot(width===390?'mobile':'desktop');
    await evaluate(`document.querySelector('#start-button').click()`);
    await waitFor(`location.hash==='#mste'&&!document.querySelector('#mste').hidden`);
    await waitFor(`document.querySelector('#mste img').complete&&document.querySelector('#mste img').naturalWidth>0`);
    const msteLayout=await evaluate(`(()=>{const image=document.querySelector('#mste img').getBoundingClientRect(),button=document.querySelector('#mste-button').getBoundingClientRect();return {left:(button.left-image.left)/image.width,top:(button.top-image.top)/image.height,width:button.width/image.width,height:button.height/image.height,visible:button.left>=0&&button.right<=innerWidth&&button.top>=0&&button.bottom<=innerHeight,buttons:document.querySelectorAll('#mste button').length,animations:document.querySelector('#mste').getAnimations({subtree:true}).length,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert(Math.abs(msteLayout.left-.408)<.001&&Math.abs(msteLayout.top-.0622)<.001,'MSTE hit area misaligned');
    assert(Math.abs(msteLayout.width-.402)<.001&&Math.abs(msteLayout.height-.1376)<.001,'MSTE hit area scale incorrect');
    assert(msteLayout.visible&&!msteLayout.overflow,'MSTE viewport issue');assert.equal(msteLayout.buttons,2);assert.equal(msteLayout.animations,0);
    console.log(`${width}x${height}: static MSTE and hit-area alignment passed`);
    if(width===390)await screenshot('mste-mobile');
    const homeBox=await evaluate(`(()=>{const r=document.querySelector('#mste-home').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,visible:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,width:r.width,height:r.height}})()`);
    assert(homeBox.visible&&homeBox.width>=44&&homeBox.height>=44,'Home must remain reachable');
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:homeBox.x,y:homeBox.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:homeBox.x,y:homeBox.y,button:'left',clickCount:1});
    await waitFor(`location.hash==='#home'&&!document.querySelector('#landing').hidden`);
    await evaluate(`location.hash='qs'`);await waitFor(`!document.querySelector('#qs').hidden`);
    await waitFor(`document.querySelector('#qs img').complete&&document.querySelector('#qs img').naturalWidth>0`);
    assert.equal(await evaluate(`document.querySelectorAll('.qs-choice').length`),4);
    assert(await evaluate(`[...document.querySelectorAll('.qs-choice')].every(button=>{const r=button.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight&&r.height>=44})`),'Question selection buttons clipped');
    if(width===390)await screenshot('qs-mobile');
    console.log(`${width}x${height}: question selection buttons visible`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:'http://localhost:3000'});await delay(400);
  const center=await evaluate(`(()=>{const r=document.querySelector('#character').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:center.x,y:center.y});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:center.x,y:center.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:389,y:800,button:'left',buttons:1});await delay(500);
  const drag=await evaluate(`(()=>{const r=document.querySelector('#character').getBoundingClientRect();return {x:r.left,right:r.right,bottom:r.bottom,dragging:document.querySelector('#character').classList.contains('is-dragging'),hash:location.hash}})()`);
  assert(drag.dragging,'Mouse drag not active');assert(drag.x>=0&&drag.right<=390&&drag.bottom<700,'Drag escaped bounds');assert.equal(drag.hash,'');
  await screenshot('drag');
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:195,y:720,button:'left',clickCount:1});await delay(900);
  assert.equal(await evaluate('location.hash'),'','Drag triggered START');
  assert.equal(await evaluate(`document.querySelector('#character').classList.contains('is-dragging')`),false);
  const returned=await evaluate(`(()=>{const r=document.querySelector('#character').getBoundingClientRect();return r.x+r.width/2})()`);
  assert(Math.abs(returned-center.x)<3,'Spring did not return');
  console.log('Mouse drag, bounds, spring return, and START isolation passed');
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:center.x,y:center.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:25,y:80}]});await delay(400);
  assert.equal(await evaluate(`document.querySelector('#character').classList.contains('is-dragging')`),true);
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(900);
  assert.equal(await evaluate(`document.querySelector('#character').classList.contains('is-dragging')`),false);
  console.log('Touch drag and release passed');
  const button=await evaluate(`(()=>{const r=document.querySelector('#start-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+50}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[button]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(650);
  await waitFor(`location.hash==='#mste'&&!document.querySelector('#mste').hidden`);
  const msteTarget=await evaluate(`(()=>{const r=document.querySelector('#mste-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[msteTarget]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await waitFor(`location.hash==='#qs'&&!document.querySelector('#qs').hidden`);
  assert.equal(await evaluate(`document.activeElement.getAttribute('data-count')`),'10');
  const {questionBank}=await import('../js/questions.js');
  for(const count of [10,25,50,100]) {
    await evaluate(`location.hash='qs'`);await waitFor(`!document.querySelector('#qs').hidden`);
    const option=await evaluate(`(()=>{const r=document.querySelector('[data-count="${count}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[option]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await waitFor(`!document.querySelector('#quiz').hidden`);
    assert.equal(await evaluate(`document.querySelectorAll('#quiz img').length`),0);
    for(let index=0;index<count;index++) {
      const expected=`QUESTION ${index+1} / ${count}`;
      await waitFor(`document.querySelector('#question-number').textContent===${JSON.stringify(expected)}`);
      assert.equal(await evaluate(`document.querySelectorAll('.answer-button').length`),4);
      const correct=await currentCorrectIndex();
      if(index===0) {
        if(count===10)await screenshot('quiz-mobile');
        for(let wrong=0;wrong<4;wrong++)if(wrong!==correct){
          await evaluate(`document.querySelectorAll('.answer-button')[${wrong}].click()`);
          assert.equal(await evaluate(`document.querySelectorAll('.answer-button')[${wrong}].disabled`),true);
          assert.equal(await evaluate(`document.querySelector('#question-number').textContent`),expected);
        }
        await delay(750);
        assert.equal(await evaluate(`document.querySelector('#question-number').textContent`),expected,'Wrong answers advanced quiz');
        assert.equal(await evaluate(`document.querySelectorAll('.answer-button:not(:disabled)').length`),1);
        if(count===10)await screenshot('quiz-retry');
      }
      await evaluate(`document.querySelectorAll('.answer-button')[${correct}].click()`);
      assert.equal(await evaluate(`document.querySelectorAll('.answer-button:disabled').length`),4,'Correct answer should lock choices');
      assert.equal(await evaluate(`document.querySelector('#answer-feedback').textContent`),'Correct! Well done.');
      if(index===0&&count===10)await screenshot('quiz-correct');
      if(index===count-1)await waitFor(`!document.querySelector('#results').hidden`);
      else await waitFor(`document.querySelector('#question-number').textContent==='QUESTION ${index+2} / ${count}'`);
    }
    assert.equal(await evaluate(`document.querySelector('#quiz-progress').value`),count);
    console.log(`${count}-question quiz: exact length, all wrong choices retry, correct feedback, and completion passed`);
    if(count===10)await screenshot('quiz-results');
    assert.equal(await evaluate(`document.querySelector('#result-correct').textContent`),String(count-1));
    assert.equal(await evaluate(`document.querySelector('#result-incorrect').textContent`),'1');
    await evaluate(`document.querySelector('#results-mste').click()`);await waitFor(`!document.querySelector('#qs').hidden`);
    await evaluate(`document.querySelector('[data-count="${count}"]').click()`);await waitFor(`!document.querySelector('#quiz').hidden`);
    assert.equal(await evaluate(`document.querySelector('#question-number').textContent`),`QUESTION 1 / ${count}`);
    assert.equal(await evaluate(`document.querySelectorAll('.answer-button:disabled').length`),0);
  }
  await evaluate(`location.hash='qs'`);await waitFor(`!document.querySelector('#qs').hidden`);
  await evaluate(`document.querySelector('[data-count="10"]').click()`);await waitFor(`!document.querySelector('#quiz').hidden`);
  await evaluate(`document.querySelectorAll('.answer-button')[${await currentCorrectIndex()}].click();location.hash='mste'`);
  await waitFor(`!document.querySelector('#mste').hidden`);await delay(800);
  assert.equal(await evaluate('location.hash'),'#mste','Delayed feedback navigated after leaving quiz');
  }
  if(process.argv.includes('--results')) {
    const {questionBank}=await import('../js/questions.js');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await send('Page.navigate',{url:'http://localhost:3000/#qs'});await delay(400);
    for(const [count,wrongCount] of [[10,2],[25,4]]) {
      await evaluate(`document.querySelector('[data-count="${count}"]').click()`);await waitFor(`!document.querySelector('#quiz').hidden`);
      if(count===10)await screenshot('quiz-question-bank');
      for(let n=0;n<count;n++) {
        await waitFor(`document.querySelector('#question-number').textContent==='QUESTION ${n+1} / ${count}'`);
        const correct=await currentCorrectIndex();
        if(n<wrongCount) {
          await evaluate(`document.querySelectorAll('.answer-button')[${(correct+1)%4}].click();document.querySelectorAll('.answer-button')[${(correct+2)%4}].click()`);
          assert.equal(await evaluate(`document.querySelector('#question-number').textContent`),`QUESTION ${n+1} / ${count}`);
        }
        await evaluate(`document.querySelectorAll('.answer-button')[${correct}].click();document.querySelectorAll('.answer-button')[${correct}].click()`);
      }
      await waitFor(`!document.querySelector('#results').hidden`);
      await waitFor(`document.querySelector('#results img').complete&&document.querySelector('#results img').naturalWidth>0`);
      assert.equal(await evaluate(`document.querySelector('#result-score-correct').textContent`),String(count-wrongCount));
      assert.equal(await evaluate(`document.querySelector('#result-score-total').textContent`),`/ ${count}`);
      assert.equal(await evaluate(`document.querySelector('#result-correct').textContent`),String(count-wrongCount));
      assert.equal(await evaluate(`document.querySelector('#result-incorrect').textContent`),String(wrongCount));
      if(count===25) {
        for(const [width,height] of [[390,844],[320,568],[430,932],[768,1024],[1440,900],[844,390]]) {
          await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
          assert(await evaluate(`[...document.querySelectorAll('.result-number-cover,.results-next')].every(element=>{const r=element.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight})`),'Results clipped');
          if(width===390)await screenshot('results-mobile');
        }
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
      }
      const arrow=await evaluate(`(()=>{const r=document.querySelector('#results-mste').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...arrow,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...arrow,button:'left',clickCount:1});
      await waitFor(`location.hash==='#qs'&&!document.querySelector('#qs').hidden`);
      console.log(`${count-wrongCount} / ${count}: first-attempt totals, retries, reset, and result arrow passed`);
    }
    await evaluate(`document.querySelector('[data-count="100"]').click()`);await waitFor(`!document.querySelector('#quiz').hidden`);
    const previousIds=await evaluate(`JSON.parse(localStorage.getItem('mste-recent-question-ids-v1'))`);
    assert.equal(previousIds.length,100);assert.equal(new Set(previousIds).size,100);
    await send('Page.reload');await delay(400);await waitFor(`location.hash==='#qs'`);
    await evaluate(`document.querySelector('[data-count="100"]').click()`);await waitFor(`!document.querySelector('#quiz').hidden`);
    const currentIds=await evaluate(`JSON.parse(localStorage.getItem('mste-recent-question-ids-v1'))`);
    assert.equal(currentIds.length,100);assert.equal(new Set(currentIds).size,100);
    const previousPrompts=new Set(sourceBank.filter(question=>previousIds.includes(question.id)).map(question=>question.text));
    assert(currentIds.every(id=>{const source=sourceBank.find(question=>question.id===id);return source&&!previousPrompts.has(source.text);}));
    console.log('Full-bank 100-question selection and recent-session avoidance survive browser reload');
  }
  await send('Page.navigate',{url:'http://localhost:3000/#quiz'});await delay(400);await send('Page.reload');await delay(300);await waitFor(`location.hash==='#qs'`);
  console.log('Restart, pending feedback cancellation, and direct-link guard passed');
  await send('Page.navigate',{url:'http://localhost:3000'});await delay(400);
  await evaluate(`document.querySelector('#settings-button').click()`);
  assert.equal(await evaluate(`document.querySelector('dialog').open`),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await evaluate(`document.querySelector('dialog').open`),false);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(400);
  const still=await evaluate(`document.querySelector('#character').style.transform`);await delay(300);
  assert.equal(await evaluate(`document.querySelector('#character').style.transform`),still);
  assert.deepEqual(errors,[],'Browser errors');
  console.log('Settings, Escape dismissal, reduced motion, and browser error checks passed');
  await send('Browser.close');
} finally {socket?.close();proc.kill();}


/** Pointer tracking, bounded dragging and a damped return, all in one RAF. */
export function createCharacterInteraction({stage, anchor, character, motionEnabled}) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let activePointer = null, origin = {x:0,y:0}, bounds;
  let target = {x:0,y:0}, position = {x:0,y:0}, velocity = {x:0,y:0};
  let gaze = {x:0,y:0}, smoothGaze = {x:0,y:0}, angle = 0;
  let lastInput = 0, lastTime = 0, frame = 0, paused = false;
  function measure() {
    const box = anchor.getBoundingClientRect();
    const area = stage.getBoundingClientRect();
    // Reserve space around the body and above the START hit target.
    bounds = {left:Math.max(-65,area.left+16-box.left),right:Math.min(65,area.right-16-box.right),
      top:Math.max(-65,area.top+90-box.top),bottom:Math.max(0,Math.min(24,area.height*.795-(box.bottom-area.top)))};
  }
  function reset() {
    const pointer = activePointer;
    activePointer = null;
    if (pointer !== null && character.hasPointerCapture(pointer)) character.releasePointerCapture(pointer);
    target = {x:0,y:0}; gaze = {x:0,y:0};
    character.classList.remove('is-dragging');
    lastInput = performance.now();
  }
  character.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || activePointer !== null) return;
    measure();
    activePointer = event.pointerId;
    origin = {x:event.clientX-position.x,y:event.clientY-position.y};
    character.setPointerCapture(event.pointerId);
    character.classList.add('is-dragging');
    gaze = {x:0,y:0};
    lastInput = performance.now();
    event.preventDefault();
  });
  stage.addEventListener('pointermove', event => {
    if (!event.isPrimary) return;
    lastInput = performance.now();
    if (activePointer === event.pointerId) {
      target.x = clamp(event.clientX-origin.x,bounds.left,bounds.right);
      target.y = clamp(event.clientY-origin.y,bounds.top,bounds.bottom);
    } else if (activePointer === null) {
      const box = stage.getBoundingClientRect();
      gaze.x = clamp((event.clientX-box.left)/box.width*2-1,-1,1);
      gaze.y = clamp((event.clientY-box.top)/box.height*2-1,-1,1);
    }
  },{passive:true});
  for (const type of ['pointerup','pointercancel','lostpointercapture']) character.addEventListener(type,event => {
    if (event.pointerId === activePointer) reset();
  });
  stage.addEventListener('pointerup',event => {if(event.pointerType !== 'mouse' && activePointer === null) gaze={x:0,y:0};},{passive:true});
  stage.addEventListener('pointerleave',()=>{if(activePointer===null) gaze={x:0,y:0};});
  character.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
  window.addEventListener('blur',reset);
  const resizeObserver = new ResizeObserver(()=>{reset();measure();});
  resizeObserver.observe(stage);
  function tick(time) {
    if (paused || document.hidden) {frame=0;return;}
    const dt = Math.min((time-lastTime)/1000 || 1/60,1/30);
    lastTime = time;
    const enabled = motionEnabled();
    const idle = enabled && activePointer===null && time-lastInput>1400;
    for (const axis of ['x','y']) {
      // Critically damped spring: no large overshoot outside the drag bounds.
      velocity[axis] += ((target[axis]-position[axis])*180-velocity[axis]*26)*dt;
      position[axis] += velocity[axis]*dt;
      smoothGaze[axis] += ((enabled && activePointer===null ? gaze[axis] : 0)-smoothGaze[axis])*(1-Math.exp(-7*dt));
    }
    const tilt = activePointer===null ? smoothGaze.x*.8 : 0;
    angle += (tilt-angle)*(1-Math.exp(-10*dt));
    const floatY = idle ? Math.sin(time/1300)*1.6 : 0;
    character.style.transform = `translate3d(${position.x+smoothGaze.x*5}px,${position.y+smoothGaze.y*3+floatY}px,0) rotate(${angle}deg)`;
    frame=requestAnimationFrame(tick);
  }
  function resume(){if(!frame && !paused && !document.hidden){lastTime=0;frame=requestAnimationFrame(tick);}}
  document.addEventListener('visibilitychange',()=>{reset();resume();});
  measure();resume();
  return {setPaused(value){paused=value;reset();if(value){cancelAnimationFrame(frame);frame=0;}else resume();}};
}

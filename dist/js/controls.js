// Locks apply to menu actions only; performance-key input never passes through them.
export function createActionGuard(interval=300,clock=()=>performance.now()) {
  let busy=false,last=-Infinity;
  return async action=>{
    const now=clock();
    if(busy||now-last<interval)return false;
    busy=true;last=now;
    try{await action();return true;}finally{busy=false;}
  };
}
export function createTapGuard(interval=280,clock=()=>performance.now()) {
  let last=-Infinity;
  return ()=>{const now=clock();if(now-last<interval)return false;last=now;return true;};
}
export function installZoomLock(doc,win) {
  const prevent=event=>{if(event.cancelable)event.preventDefault();};
  const options={passive:false};
  for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])doc.addEventListener(type,prevent,options);
  doc.addEventListener('touchmove',event=>{if(event.touches.length>1)prevent(event);},options);
  let previous=null;
  doc.addEventListener('touchend',event=>{
    if(event.touches.length||!event.changedTouches.length)return;
    const touch=event.changedTouches[0],now=event.timeStamp;
    if(previous&&now-previous.time<300&&Math.hypot(touch.clientX-previous.x,touch.clientY-previous.y)<30)prevent(event);
    previous={time:now,x:touch.clientX,y:touch.clientY};
  },options);
  doc.addEventListener('wheel',event=>{if(event.ctrlKey)prevent(event);},options);
  win.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&['+','=','-','0'].includes(event.key))prevent(event);
  });
}

'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {MessageCircle,Minimize2,Maximize2,ChevronDown,Sparkles} from 'lucide-react';
import AIProgress,{type AIPhase} from './AIProgress';

type Turn={role:'user'|'assistant';content:string};
export default function FloatingAssistant({history,composer,he,busy,error,onRetry,phase}:{history:Turn[];composer:ReactNode;he:boolean;busy:boolean;error:string;onRetry:()=>void;phase:AIPhase}){
 const reducedMotion=useReducedMotion();
 const transition={duration:reducedMotion?0:.24,ease:'easeOut' as const};
 const [size,setSize]=useState<'mini'|'compact'|'expanded'>('mini');
 const messages=useRef<HTMLDivElement>(null);
 const following=useRef(true);
 const pendingScroll=useRef(false);
 const resizing=useRef(false);
 const root=useRef<HTMLDivElement>(null);
 const launcher=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLElement>(null);
 function scrollLatest(){
  if(size==='mini'||resizing.current||!following.current||!pendingScroll.current)return;
  const element=messages.current;if(!element)return;
  pendingScroll.current=false;element.scrollTo({top:element.scrollHeight,behavior:reducedMotion?'instant':'smooth'});
 }
 useEffect(()=>{
  pendingScroll.current=following.current;
  if(reducedMotion){const frame=requestAnimationFrame(scrollLatest);return()=>cancelAnimationFrame(frame);}
 },[history,busy,reducedMotion]);
 useEffect(()=>{
  if(size==='mini'){pendingScroll.current=false;return;}
  pendingScroll.current=following.current;resizing.current=true;
  const computed=root.current?getComputedStyle(root.current):null;
  const seconds=(value:string)=>Math.max(0,...value.split(',').map(part=>part.trim().endsWith('ms')?parseFloat(part)/1000:parseFloat(part)||0));
  const duration=reducedMotion?0:computed?seconds(computed.transitionDuration)+seconds(computed.transitionDelay):0;
  const timer=window.setTimeout(()=>{resizing.current=false;scrollLatest();},duration*1000+16);
  return()=>window.clearTimeout(timer);
 },[size,reducedMotion]);
 useEffect(()=>{
  if(size==='mini')return;
  function dismissOutside(event:PointerEvent){
   if(event.target instanceof Node&&!root.current?.contains(event.target))setSize('mini');
  }
  document.addEventListener('pointerdown',dismissOutside);
  return()=>document.removeEventListener('pointerdown',dismissOutside);
 },[size]);
 function minimize(restoreFocus=true){setSize('mini');if(restoreFocus)requestAnimationFrame(()=>launcher.current?.focus({preventScroll:true}));}
 function open(){following.current=true;setSize('compact');requestAnimationFrame(()=>panel.current?.querySelector('textarea')?.focus({preventScroll:true}));}
 return <div ref={root} className={`floating-assistant is-${size}`} dir={he?'rtl':'ltr'} lang={he?'he':'en'} onTransitionEnd={event=>{if(event.target===event.currentTarget&&['height','width'].includes(event.propertyName)){resizing.current=false;scrollLatest();}}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();minimize();}}}>
  <button ref={launcher} type="button" className="assistant-launcher" tabIndex={size==='mini'?0:-1} aria-hidden={size!=='mini'} aria-label={he?'פתיחת העוזר':'Open assistant'} aria-expanded={size!=='mini'} aria-controls="assistant-panel" onClick={open}><MessageCircle size={20}/><span>{he?'העוזר שלכם':'Your assistant'}</span>{busy&&<span className="spinner"/>}</button>
  <section ref={panel} id="assistant-panel" className={size==='mini'?'is-hidden':''} aria-hidden={size==='mini'} inert={size==='mini'} aria-label={he?'העוזר של ShadowUI':'ShadowUI assistant'}>
   <div className="assistant-header"><span className="assistant-avatar"><Sparkles size={18}/></span><div><strong dir="ltr">ShadowUI</strong><small>{busy?(he?'עובד על הבקשה…':'Working on your request…'):(he?'העוזר של סביבת העבודה':'Your workspace assistant')}</small></div><button type="button" className="icon-button" aria-label={size==='expanded'?(he?'הקטנת העוזר':'Compact assistant'):(he?'הרחבת העוזר':'Expand assistant')} onClick={()=>setSize(size==='expanded'?'compact':'expanded')}>{size==='expanded'?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button type="button" className="icon-button" aria-label={he?'מזעור העוזר':'Minimize assistant'} onClick={()=>minimize()}><ChevronDown size={19}/></button></div>
   <div ref={messages} className="assistant-messages" onScroll={event=>{const element=event.currentTarget;following.current=element.scrollHeight-element.scrollTop-element.clientHeight<=80;}} role="log" aria-label={he?'היסטוריית שיחה':'Conversation history'} aria-live="polite" aria-relevant="additions">
    {!history.length&&<div className="assistant-empty"><MessageCircle size={25}/><strong>{he?'מה נעשה עכשיו?':'What shall we do next?'}</strong><p>{he?'אפשר לבקש שינוי בסביבת העבודה או להמשיך מאיפה שעצרתם. השיחה תופיע כאן.':'Ask for a change or pick up where you left off. Your conversation will appear here.'}</p></div>}
    <AnimatePresence initial={false}>
    {history.map((turn,index)=><motion.div key={`${turn.role}:${turn.content}:${history.slice(0,index).filter(previous=>previous.role===turn.role&&previous.content===turn.content).length}`} initial={{opacity:0,height:0,y:reducedMotion?0:7}} animate={{opacity:1,height:'auto',y:0}} exit={{opacity:0,height:0,y:reducedMotion?0:-4}} transition={transition} onAnimationComplete={scrollLatest} className={`assistant-message from-${turn.role}`}><strong dir={turn.role==='assistant'?'ltr':undefined}>{turn.role==='user'?(he?'אתם':'You'):'ShadowUI'}</strong><p dir="auto">{turn.content}</p></motion.div>)}
    </AnimatePresence>
    <AnimatePresence initial={false}>{busy&&<motion.div key="activity" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={transition} onAnimationComplete={scrollLatest} style={{overflow:'hidden',flexShrink:0}}><AIProgress phase={phase} he={he}/></motion.div>}</AnimatePresence>
   </div>
   <AnimatePresence initial={false}>{error&&<motion.div key="error" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={transition} className="assistant-error" role="alert"><span dir="auto">{error}</span><button type="button" disabled={busy} onClick={onRetry}>{he?'ניסיון נוסף':'Retry'}</button></motion.div>}</AnimatePresence>
   <div className="assistant-composer">{composer}</div>
  </section>
 </div>;
}

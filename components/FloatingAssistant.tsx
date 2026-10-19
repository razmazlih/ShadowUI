'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {MessageCircle,Minimize2,Maximize2,ChevronDown,Sparkles} from 'lucide-react';

type Turn={role:'user'|'assistant';content:string};
export default function FloatingAssistant({history,composer,he,busy,error,onRetry}:{history:Turn[];composer:ReactNode;he:boolean;busy:boolean;error:string;onRetry:()=>void}){
 const [size,setSize]=useState<'mini'|'compact'|'expanded'>('compact');
 const end=useRef<HTMLDivElement>(null);
 const launcher=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(size!=='mini')end.current?.scrollIntoView({block:'nearest'});},[history.length,busy,size]);
 function minimize(){setSize('mini');requestAnimationFrame(()=>launcher.current?.focus());}
 function open(){setSize('compact');requestAnimationFrame(()=>panel.current?.querySelector('textarea')?.focus());}
 return <div className={`floating-assistant is-${size}`} dir={he?'rtl':'ltr'} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();minimize();}}}>
  <button ref={launcher} type="button" className="assistant-launcher" hidden={size!=='mini'} aria-label="Open assistant" aria-expanded={size!=='mini'} aria-controls="assistant-panel" onClick={open}><MessageCircle size={20}/><span>{he?'העוזר שלכם':'Your assistant'}</span>{busy&&<span className="spinner"/>}</button>
  <section ref={panel} id="assistant-panel" aria-label="ShadowUI assistant" hidden={size==='mini'}>
   <div className="assistant-header"><span className="assistant-avatar"><Sparkles size={18}/></span><div><strong>ShadowUI</strong><small>{busy?(he?'עובד על הבקשה…':'Working on your request…'):(he?'העוזר של סביבת העבודה':'Your workspace assistant')}</small></div><button type="button" className="icon-button" aria-label={size==='expanded'?'Compact assistant':'Expand assistant'} onClick={()=>setSize(size==='expanded'?'compact':'expanded')}>{size==='expanded'?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button type="button" className="icon-button" aria-label="Minimize assistant" onClick={minimize}><ChevronDown size={19}/></button></div>
   <div className="assistant-messages" role="log" aria-label={he?'היסטוריית שיחה':'Conversation history'} aria-live="polite" aria-relevant="additions">
    {!history.length&&<div className="assistant-empty"><MessageCircle size={25}/><strong>{he?'מה נעשה עכשיו?':'What shall we do next?'}</strong><p>{he?'אפשר לבקש שינוי בסביבת העבודה או להמשיך מאיפה שעצרתם. השיחה תופיע כאן.':'Ask for a change or pick up where you left off. Your conversation will appear here.'}</p></div>}
    {history.map((turn,index)=><div key={index} className={`assistant-message from-${turn.role}`} dir="auto"><strong>{turn.role==='user'?(he?'אתם':'You'):'ShadowUI'}</strong><p>{turn.content}</p></div>)}
    {busy&&<p className="assistant-thinking" role="status"><span className="spinner"/>{he?'מעבד את הבקשה…':'Processing your request…'}</p>}<div ref={end}/>
   </div>
   {error&&<div className="assistant-error" role="alert"><span>{error}</span><button type="button" disabled={busy} onClick={onRetry}>{he?'ניסיון נוסף':'Retry'}</button></div>}
   <div className="assistant-composer">{composer}</div>
  </section>
 </div>;
}

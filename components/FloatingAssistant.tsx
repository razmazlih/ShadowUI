'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {MessageCircle,Minimize2,Maximize2,ChevronDown,Sparkles,Check} from 'lucide-react';

type Turn={role:'user'|'assistant';content:string};
type Phase='interpret'|'assemble'|'compose'|'validate'|'save'|'complete'|null;
const phases=['interpret','assemble','compose','validate','save'] as const;
const phaseCopy={
 interpret:{he:'מבין את הבקשה',en:'Understanding your request',detailHe:'מזהה את המטרה והפרטים שצריך לשמור.',detailEn:'Identifying the goal and the details it needs.'},
 assemble:{he:'בוחר רכיבים',en:'Choosing workspace tools',detailHe:'מחפש רכיבים שמתאימים לפעולות שביקשת.',detailEn:'Finding tools that match the actions you asked for.'},
 compose:{he:'בונה את סביבת העבודה',en:'Building your workspace',detailHe:'ה־AI מרכיב ממשק ונתונים לעריכה.',detailEn:'The AI is shaping an editable interface and its data.'},
 validate:{he:'בודק את התוצאה',en:'Checking the result',detailHe:'מוודא שהרכיבים והחיבורים תקינים.',detailEn:'Checking that the tools and their connections work.'},
 save:{he:'שומר את הרכיבים',en:'Saving the tools',detailHe:'שומר רכיבים חדשים אחרי שהבדיקות עברו.',detailEn:'Saving any new tools after validation.'},
 complete:{he:'מוכן',en:'Ready',detailHe:'סביבת העבודה הוכנה.',detailEn:'The workspace is ready.'}
};
export default function FloatingAssistant({history,composer,he,busy,error,onRetry,phase}:{history:Turn[];composer:ReactNode;he:boolean;busy:boolean;error:string;onRetry:()=>void;phase:Phase}){
 const [size,setSize]=useState<'mini'|'compact'|'expanded'>('compact');
 const end=useRef<HTMLDivElement>(null);
 const root=useRef<HTMLDivElement>(null);
 const launcher=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(size!=='mini')end.current?.scrollIntoView({block:'nearest'});},[history.length,busy,size]);
 useEffect(()=>{
  if(size==='mini')return;
  function dismissOutside(event:PointerEvent){
   if(event.target instanceof Node&&!root.current?.contains(event.target))setSize('mini');
  }
  document.addEventListener('pointerdown',dismissOutside);
  return()=>document.removeEventListener('pointerdown',dismissOutside);
 },[size]);
 function minimize(restoreFocus=true){setSize('mini');if(restoreFocus)requestAnimationFrame(()=>launcher.current?.focus());}
 function open(){setSize('compact');requestAnimationFrame(()=>panel.current?.querySelector('textarea')?.focus());}
 return <div ref={root} className={`floating-assistant is-${size}`} dir={he?'rtl':'ltr'} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();minimize();}}}>
  <button ref={launcher} type="button" className="assistant-launcher" tabIndex={size==='mini'?0:-1} aria-hidden={size!=='mini'} aria-label={he?'פתיחת העוזר':'Open assistant'} aria-expanded={size!=='mini'} aria-controls="assistant-panel" onClick={open}><MessageCircle size={20}/><span>{he?'העוזר שלכם':'Your assistant'}</span>{busy&&<span className="spinner"/>}</button>
  <section ref={panel} id="assistant-panel" className={size==='mini'?'is-hidden':''} aria-hidden={size==='mini'} inert={size==='mini'} aria-label={he?'העוזר של ShadowUI':'ShadowUI assistant'}>
   <div className="assistant-header"><span className="assistant-avatar"><Sparkles size={18}/></span><div><strong dir="ltr">ShadowUI</strong><small>{busy?(he?'עובד על הבקשה…':'Working on your request…'):(he?'העוזר של סביבת העבודה':'Your workspace assistant')}</small></div><button type="button" className="icon-button" aria-label={size==='expanded'?(he?'הקטנת העוזר':'Compact assistant'):(he?'הרחבת העוזר':'Expand assistant')} onClick={()=>setSize(size==='expanded'?'compact':'expanded')}>{size==='expanded'?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button type="button" className="icon-button" aria-label={he?'מזעור העוזר':'Minimize assistant'} onClick={()=>minimize()}><ChevronDown size={19}/></button></div>
   <div className="assistant-messages" role="log" aria-label={he?'היסטוריית שיחה':'Conversation history'} aria-live="polite" aria-relevant="additions">
    {!history.length&&<div className="assistant-empty"><MessageCircle size={25}/><strong>{he?'מה נעשה עכשיו?':'What shall we do next?'}</strong><p>{he?'אפשר לבקש שינוי בסביבת העבודה או להמשיך מאיפה שעצרתם. השיחה תופיע כאן.':'Ask for a change or pick up where you left off. Your conversation will appear here.'}</p></div>}
    {history.map((turn,index)=><div key={index} className={`assistant-message from-${turn.role}`}><strong dir={turn.role==='assistant'?'ltr':undefined}>{turn.role==='user'?(he?'אתם':'You'):'ShadowUI'}</strong><p dir="auto">{turn.content}</p></div>)}
    {busy&&<div className="assistant-activity" role="status" aria-live="polite">
     <div className="assistant-activity-heading"><span className="assistant-activity-orb"><Sparkles size={15}/></span><div><strong>{phase?phaseCopy[phase][he?'he':'en']:(he?'עובד על הבקשה…':'Working on your request…')}</strong><small>{phase?phaseCopy[phase][he?'detailHe':'detailEn']:(he?'ממתין לעדכון מהשרת.':'Waiting for the server update.')}</small></div><span className="spinner" aria-hidden="true"/></div>
     {phase&&<ol className="assistant-phases">{phases.map((step,index)=>{const current=phase==='complete'?phases.length:phases.indexOf(phase as typeof phases[number]);const done=index<current;return <li key={step} className={index===current?'is-current':done?'is-done':''} aria-current={index===current?'step':undefined}><span className="assistant-phase-marker">{done?<Check size={11}/>:String(index+1).padStart(2,'0')}</span><span>{phaseCopy[step][he?'he':'en']}</span></li>})}</ol>}
    </div>}<div ref={end}/>
   </div>
   {error&&<div className="assistant-error" role="alert"><span>{error}</span><button type="button" disabled={busy} onClick={onRetry}>{he?'ניסיון נוסף':'Retry'}</button></div>}
   <div className="assistant-composer">{composer}</div>
  </section>
 </div>;
}

'use client';

import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {Check,Sparkles} from 'lucide-react';

export type AIPhase='prepare'|'interpret'|'assemble'|'compose'|'validate'|'save'|'complete'|null;
const phases=['interpret','assemble','compose','validate','save'] as const;
const copy={
 prepare:{he:'בודק זמינות AI',en:'Checking AI availability',detailHe:'מוודא שאפשר להתחיל לעבד את הבקשה.',detailEn:'Making sure the AI service is ready for your request.'},
 interpret:{he:'מבין את הבקשה',en:'Understanding your request',detailHe:'מזהה את המטרה והפרטים שצריך לשמור.',detailEn:'Identifying the goal and the details it needs.'},
 assemble:{he:'בוחר רכיבים',en:'Choosing workspace tools',detailHe:'מחפש רכיבים שמתאימים לפעולות שביקשת.',detailEn:'Finding tools that match the actions you asked for.'},
 compose:{he:'בונה את סביבת העבודה',en:'Building your workspace',detailHe:'ה־AI מרכיב ממשק ונתונים לעריכה.',detailEn:'The AI is shaping an editable interface and its data.'},
 validate:{he:'בודק את התוצאה',en:'Checking the result',detailHe:'מוודא שהרכיבים והחיבורים תקינים.',detailEn:'Checking that the tools and their connections work.'},
 save:{he:'שומר את הרכיבים',en:'Saving the tools',detailHe:'שומר רכיבים חדשים אחרי שהבדיקות עברו.',detailEn:'Saving any new tools after validation.'},
 complete:{he:'מוכן',en:'Ready',detailHe:'סביבת העבודה הוכנה.',detailEn:'The workspace is ready.'}
} as const;

export default function AIProgress({phase,he}:{phase:AIPhase;he:boolean}){
 const reducedMotion=useReducedMotion();
 const transition={duration:reducedMotion?0:.2,ease:'easeOut' as const};
 const current=phase==='complete'?phases.length:phase?phases.indexOf(phase as typeof phases[number]):-1;
 const active=phase??'prepare';
 return <div className="assistant-activity" aria-live="off">
  <div className="assistant-activity-heading"><span className="assistant-activity-orb"><Sparkles size={15}/></span><div style={{minHeight:44}}><AnimatePresence mode="wait" initial={false}><motion.div key={active} initial={{opacity:0,y:reducedMotion?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-3}} transition={transition}><strong>{copy[active][he?'he':'en']}</strong><small>{copy[active][he?'detailHe':'detailEn']}</small></motion.div></AnimatePresence></div><span className="spinner" aria-hidden="true"/></div>
  <AnimatePresence>{phase&&phase!=='prepare'&&<motion.ol key="phases" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={transition} style={{overflow:'hidden'}} className="assistant-phases">{phases.map((step,index)=>{const done=index<current;return <li key={step} className={index===current?'is-current':done?'is-done':''} aria-current={index===current?'step':undefined}><span className="assistant-phase-marker">{done?<Check size={11}/>:String(index+1).padStart(2,'0')}</span><span>{copy[step][he?'he':'en']}</span></li>})}</motion.ol>}</AnimatePresence>
 </div>;
}

'use client';

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
 const current=phase==='complete'?phases.length:phase?phases.indexOf(phase as typeof phases[number]):-1;
 const active=phase??'prepare';
 return <div className="assistant-activity" aria-live="off">
  <div className="assistant-activity-heading"><span className="assistant-activity-orb"><Sparkles size={15}/></span><div><strong>{copy[active][he?'he':'en']}</strong><small>{copy[active][he?'detailHe':'detailEn']}</small></div><span className="spinner" aria-hidden="true"/></div>
  {phase&&phase!=='prepare'&&<ol className="assistant-phases">{phases.map((step,index)=>{const done=index<current;return <li key={step} className={index===current?'is-current':done?'is-done':''} aria-current={index===current?'step':undefined}><span className="assistant-phase-marker">{done?<Check size={11}/>:String(index+1).padStart(2,'0')}</span><span>{copy[step][he?'he':'en']}</span></li>})}</ol>}
 </div>;
}

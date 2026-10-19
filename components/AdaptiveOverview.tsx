'use client';
import {ArrowUpRight, Check, Layers, Target, ListChecks, Route, CalendarDays, Columns3, BookOpen, CircleHelp, SlidersHorizontal, Table2, Scale, NotebookPen, Timer, ShieldCheck, ChartNoAxesCombined, Link} from 'lucide-react';
import type {UIComponent} from '@/lib/schema';

type ToolType=UIComponent['type'];
export const toolLabels:Record<ToolType,string>={checklist:'Action plan',timeline:'Timeline',calendar:'Calendar',kanban:'Task board',flashcards:'Recall cards',quiz:'Practice',slider:'Constraints',table:'Working table',comparison:'Compare options',notes:'Your context',timer:'Focus timer',approval:'Confirmation',chart:'Breakdown',links:'Useful links'};
const hebrewLabels:Record<ToolType,string>={checklist:'צעדים לביצוע',timeline:'ציר זמן',calendar:'לוח שנה',kanban:'לוח משימות',flashcards:'כרטיסיות לימוד',quiz:'תרגול',slider:'הגדרת מגבלות',table:'טבלת עבודה',comparison:'השוואת אפשרויות',notes:'הערות והקשר',timer:'זמן לריכוז',approval:'אישור החלטה',chart:'תמונת הנתונים',links:'קישורים שימושיים'};
export const toolIcons={checklist:ListChecks,timeline:Route,calendar:CalendarDays,kanban:Columns3,flashcards:BookOpen,quiz:CircleHelp,slider:SlidersHorizontal,table:Table2,comparison:Scale,notes:NotebookPen,timer:Timer,approval:ShieldCheck,chart:ChartNoAxesCombined,links:Link};
export function toolLabel(type:ToolType,locale:'he'|'en'='en'){return locale==='he'?hebrewLabels[type]:toolLabels[type];}
export function isComplete(c:UIComponent|undefined){if(!c)return false;return c.type==='approval'?c.value===1:['checklist','quiz','kanban'].includes(c.type)&&c.items.length>0&&c.items.every(i=>i.done||i.group==='Done');}
export function visibleComponents(components:UIComponent[]){return components.filter(c=>{if(!c.visibleWhen)return true;const dependency=components.find(d=>d.id===c.visibleWhen?.componentId);const completed=dependency?.type==='approval'?dependency.value===1:!!dependency?.items.length&&dependency.items.every(i=>i.done);return completed===c.visibleWhen.completed;});}
export default function AdaptiveOverview({components,focus,onFocus,locale='en'}:{components:UIComponent[];focus:string|null;onFocus:(id:string|null)=>void;locale?:'he'|'en'}){
 const he=locale==='he';
 const checklist=components.find(c=>c.type==='checklist');const tasks=checklist?.items??[];const completed=tasks.filter(i=>i.done).length;
 const budget=components.find(c=>c.type==='slider');const costs=components.find(c=>c.type==='chart'&&c.dependsOn===budget?.id);const total=costs?.items.reduce((s,i)=>s+(i.value??0),0)??0;
 const over=!!budget&&!!costs&&total>(budget.value??0);
 const next=over?budget:components.find(c=>c.type==='checklist'&&!isComplete(c))??components.find(c=>c.type==='quiz'&&!isComplete(c))??components.find(c=>c.type==='comparison')??components.find(c=>c.type==='approval'&&!isComplete(c))??components.find(c=>c.type!=='notes');
 const nextTask=tasks.find(i=>!i.done);
 const message=over?(he?'העלויות חורגות מהתקציב. אפשר לעדכן את המגבלה.':'Costs exceed your budget. Adjust the limit.'):next?.type==='checklist'&&nextTask?nextTask.label:next?.type==='quiz'?(he?'אפשר לתרגל את מה שלמדת.':'Put what you know into practice.'):next?.type==='comparison'?(he?'עדכון הציונים יעזור לבחור אפשרות.':'Adjust the scores to compare options.'):next?.type==='approval'?(he?'בדיקת ההנחות לפני האישור.':'Review your assumptions before confirming.'):(he?'בחרו כלי כדי לעדכן את התוצר.':'Choose a tool to update your work.');
 return <aside className="adaptive-overview" aria-label={he?'כלי סביבת העבודה':'Workspace tools'}>
  <div className="adaptive-summary"><div className="adaptive-metrics"><span><Layers size={14}/>{components.length} {he?'כלים':'tools'}</span>{tasks.length>0&&<span><Target size={14}/>{completed}/{tasks.length} {he?'צעדים הושלמו':'steps complete'}</span>}</div></div>
  {next&&<div className={'adaptive-next '+(over?'needs-attention':'')}><div><span className="adaptive-eyebrow">{he?'הצעד הבא':'Next step'}</span><p>{message}</p></div><button onClick={()=>onFocus(next.id)} aria-controls={`tool-${next.id}`} aria-label={`${he?'פתיחת':'Open'} ${next.title}`}>{he?'פתיחה':'Open'}<ArrowUpRight size={16}/></button></div>}
  <nav className="adaptive-tools" aria-label={he?'בחירת כלי':'Choose a tool'}>{components.map(c=>{const Icon=toolIcons[c.type];return <button key={c.id} type="button" aria-pressed={focus===c.id} aria-controls={`tool-${c.id}`} onClick={()=>onFocus(c.id)}><Icon size={18} aria-hidden="true"/><span className="tool-nav-copy"><strong>{c.title}</strong><small>{toolLabel(c.type,locale)}</small></span>{isComplete(c)&&<Check size={15} aria-label={he?'הושלם':'Complete'}/>}</button>;})}</nav>
 </aside>;
}

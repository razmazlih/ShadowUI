'use client';

import {useId,useRef,useState,type KeyboardEvent} from 'react';
import {ArrowUpRight,BookOpen,Check,ChevronRight,GitBranch,MapPin,SlidersHorizontal} from 'lucide-react';
import InterfaceSymbol from './InterfaceSymbol';
import './workspace-showcase.css';

const categories=[
 {en:'Learn',he:'ללמוד',icon:BookOpen},
 {en:'Plan',he:'לתכנן',icon:GitBranch},
 {en:'Explore',he:'לגלות',icon:MapPin},
 {en:'Decide',he:'להחליט',icon:SlidersHorizontal},
];

export default function WorkspaceShowcase({he,onStart,disabled}:{he:boolean;onStart:(index:number)=>void;disabled:boolean}){
 const [active,setActive]=useState(0);
 const [completed,setCompleted]=useState([true,false,false]);
 const [choice,setChoice]=useState(0);
 const tabs=useRef<Array<HTMLButtonElement|null>>([]);
 const id=useId();
 const labels=he?['להבין את התמונה הגדולה','לתרגל את מה שחשוב','לבדוק מה כבר יודעים']:['Connect the big ideas','Practice what matters','See what you remember'];
 const titles=he?['מרעיון להבנה.','מכאוס לקצב.','מסקרנות למסלול.','מאפשרויות לבחירה.']:['From curious to confident.','From scattered to scheduled.','From someday to a route.','From options to clarity.'];
 const subtitles=he?['קצת מבנה. הרבה מקום למחשבה.','כל השבוע, בתמונה אחת.','דרך חדשה מתחילה בנקודה אחת.','משווים לפי מה שחשוב לכם.']:['A little structure. Room to think.','The whole week, in one picture.','A new direction starts with one place.','Compare by what matters to you.'];
 function navigate(event:KeyboardEvent<HTMLButtonElement>){
  let next:number|undefined;
  if(event.key==='ArrowRight')next=(active+(he?3:1))%4;
  if(event.key==='ArrowLeft')next=(active+(he?1:3))%4;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=3;
  if(next!==undefined){event.preventDefault();setActive(next);tabs.current[next]?.focus();}
 }
 return <section className={'showcase showcase-mode-'+active} aria-label={he?'נסו סביבת עבודה לדוגמה':'Try a sample workspace'} dir={he?'rtl':'ltr'}>
  <div className="showcase-top"><span className="showcase-preview"><i/>{he?'תצוגה מקדימה':'INTERACTIVE PREVIEW'}</span><span className="showcase-index" aria-hidden="true">0{active+1} / 04</span></div>
  <div className="showcase-tabs" role="tablist" aria-label={he?'סוג סביבת העבודה':'Workspace type'}>{categories.map((category,index)=>{const Icon=category.icon;return <button key={category.en} ref={element=>{tabs.current[index]=element;}} id={`${id}-tab-${index}`} role="tab" type="button" aria-selected={active===index} aria-controls={`${id}-panel-${index}`} tabIndex={active===index?0:-1} onKeyDown={navigate} onClick={()=>setActive(index)}><Icon size={13}/>{he?category.he:category.en}</button>;})}</div>
  {categories.map((category,index)=>index!==active?<div key={category.en} hidden role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`}/>:null)}
  <div key={active} className="showcase-panel" role="tabpanel" id={`${id}-panel-${active}`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
   <div className="showcase-heading"><div><h2>{titles[active]}</h2><p>{subtitles[active]}</p></div><span className="showcase-emblem" aria-hidden="true"><InterfaceSymbol kind={active===0?'diamond':active===1?'grid':active===2?'arrow':'decision'}/></span></div>
   {active===0&&<div className="showcase-learning">{labels.map((label,index)=><button className={completed[index]?'is-complete':''} type="button" key={label} aria-pressed={completed[index]} onClick={()=>setCompleted(old=>old.map((value,i)=>i===index?!value:value))}><span className="showcase-checkbox">{completed[index]&&<Check size={11}/>}</span><span>{label}</span><span className="showcase-task-number" aria-hidden="true">0{index+1}</span></button>)}</div>}
   {active===1&&<div className="showcase-week" aria-label={he?'שבוע עבודה לדוגמה':'Sample work week'}>{(he?['א׳','ב׳','ג׳','ד׳','ה׳']:['MON','TUE','WED','THU','FRI']).map((day,index)=><div key={day}><span className="showcase-day">{day}</span><div className={'showcase-slot slot-'+index}><span>{he?['מיקוד','יצירה','מיקוד','צוות','סיכום'][index]:['Focus','Make','Focus','Team','Review'][index]}</span></div><div className={'showcase-slot secondary-slot slot-'+((index+2)%5)}/></div>)}</div>}
   {active===2&&<div className="showcase-route">{['Tokyo','Kyoto','Osaka'].map((place,index)=><div key={place}><span className="showcase-route-node">{index===0?<MapPin size={13}/>:index+1}</span><div><strong>{he?['טוקיו','קיוטו','אוסקה'][index]:place}</strong><small>{he?['אנרגיה של התחלה','רגע לעצור','עוד משהו לגלות'][index]:['A fresh perspective','A slower moment','One more discovery'][index]}</small></div>{index<2&&<ChevronRight className="showcase-route-arrow" size={13}/>}</div>)}</div>}
   {active===3&&<div className="showcase-decisions" role="group" aria-label={he?'בחירת אפשרות לדוגמה':'Choose a sample option'}>{[76,54,88].map((score,index)=><button key={score} type="button" aria-pressed={choice===index} onClick={()=>setChoice(index)} className={choice===index?'is-chosen':''}><span>{he?'אפשרות ':'Option '}{['A','B','C'][index]}</span><span className="showcase-bar"><i style={{width:score+'%'}}/></span><span className="showcase-score">{score}<small>/100</small></span></button>)}</div>}
  </div>
  <div className="showcase-bottom"><span>{active===0?(he?'לחצו כדי לסמן התקדמות':'Click to mark your progress'):active===3?(he?'ציוני דוגמה · לחצו לבחירה':'Sample scores · click to choose'):(he?'דוגמה שאפשר להפוך לשלכם':'A starting point to make your own')}</span><button type="button" disabled={disabled} onClick={()=>onStart(active)}>{he?'נבנה את זה':'Make it mine'}<ArrowUpRight size={14}/></button></div>
 </section>;
}

'use client';
import type {ReactNode} from 'react';
import {ArrowUpRight,ArrowRight,Layers,ArrowDown} from 'lucide-react';
import InterfaceSymbol from './InterfaceSymbol';
import WorkspaceShowcase from './WorkspaceShowcase';

type Example={icon:'diamond'|'grid'|'arrow'|'decision';label:string;tag:string};
type Recent={id:string;title:string;components:unknown[]};
const descriptions={
 en:['A study plan, practice and a space to focus.','A clear week. The right people in the right places.','An itinerary, a budget and room to explore.','Trade-offs made visible. Choose with clarity.'],
 he:['תוכנית למידה, תרגול ומקום להתרכז.','שבוע ברור. האנשים הנכונים בזמן הנכון.','מסלול, תקציב ומקום לגלות משהו חדש.','רואים את השיקולים. בוחרים בביטחון.'],
};
export default function HomeStudio({he,accountName,composer,conversation,examples,onStart,disabled,recent,onOpen}:{he:boolean;accountName:string;composer:ReactNode;conversation:ReactNode;examples:Example[];onStart:(index:number)=>void;disabled:boolean;recent:Recent[];onOpen:(id:string)=>void}){
 return <>
  <div className="studio-edition"><span><span className="studio-signal"/>{he?'המרחב לרעיון הבא שלכם':'A SPACE FOR YOUR NEXT CHAPTER'}</span><span dir="ltr">SHADOWUI / STUDIO 01</span></div>
  <div className="studio-hero">
   <div className="studio-intro">
    {accountName&&<p className="studio-greeting">{he?'טוב שחזרתם, ':'Good to see you, '}<bdi>{accountName}</bdi></p>}
    <div className="studio-kicker"><InterfaceSymbol kind="sparkle"/>{he?'מרעיון. לתנועה.':'FROM A THOUGHT. TO A FLOW.'}</div>
    <h1>{he?'העבודה משתנה.':'Work changes.'}<br/><span>{he?'גם הממשק שלכם.':'Your interface'}<br className="studio-title-break"/>{he?'':' should, too.'}</span><span className="studio-title-dot" aria-hidden="true">✳</span></h1>
    <p className="hero-description">{he?'לא כל מטרה צריכה עוד אפליקציה. היא צריכה מרחב משלה. תארו מה תרצו להשיג — והכלים יתחברו סביבכם.':'Every goal deserves its own space. Describe what you want to accomplish. We’ll bring the right tools together around you.'}</p>
    <div className="studio-principles"><span><i/>{he?'כלים שאפשר לעבוד איתם':'Tools you can work with'}</span><span><i/>{he?'משתנה יחד איתכם':'Changes with you'}</span></div>
   </div>
   <WorkspaceShowcase he={he} onStart={onStart} disabled={disabled}/>
  </div>
  <section className="studio-launch" aria-label={he?'התחלת סביבת עבודה':'Start a workspace'}>
   <div className="studio-launch-caption"><span className="studio-index" dir="ltr">01 /</span><span>{he?'רעיון אחד. אפשרויות חדשות.':'One idea. New possibilities.'}</span><ArrowDown size={15} aria-hidden="true"/></div>
   {conversation}{composer}
   <div className="studio-input-hint"><span>{he?'אפשר להתחיל במשפט אחד. אפשר לשנות בהמשך.':'Start with a sentence. Make it yours as you go.'}</span><span dir="ltr">↵ {he?'שליחה':'to create'} <span>·</span> Shift + ↵ {he?'שורה חדשה':'new line'}</span></div>
  </section>
  <section className="studio-starting-points" aria-label={he?'נקודות התחלה':'Starting points'}>
   <div className="studio-section-heading"><div><span className="studio-index" dir="ltr">02 /</span><h2>{he?'לאן הרעיון שלכם הולך?':'Where will your idea take you?'}</h2></div><span>{he?'בחרו כיוון. נעצב את הדרך.':'Pick a direction. Shape what comes next.'}</span></div>
   <div className="examples">{examples.map((example,index)=><button key={example.icon} data-studio-tone={index} onClick={()=>onStart(index)} disabled={disabled}>
    <div className="studio-card-top"><span className="example-icon"><InterfaceSymbol kind={example.icon}/></span><span className="studio-card-index" dir="ltr">0{index+1}</span></div>
    <span className="example-tag">{example.tag}</span><strong>{example.label}</strong><p>{descriptions[he?'he':'en'][index]}</p>
    <div className={`studio-card-art art-${index}`} aria-hidden="true">{index===0?<><span/><span/><span/><b>✳</b></>:index===1?<>{Array.from({length:15},(_,i)=><i key={i}/>)}</>:index===2?<><svg viewBox="0 0 200 50"><path d="M8 35C50 35 37 8 80 15S126 50 191 12"/><circle cx="8" cy="35" r="4"/><circle cx="80" cy="15" r="4"/><circle cx="191" cy="12" r="4"/></svg></>:<><span/><span/><span/></>}</div>
    <div className="studio-card-bottom"><span>{he?'בואו נתחיל':'Make it happen'}</span><ArrowUpRight size={17} aria-hidden="true"/></div>
   </button>)}</div>
  </section>
  {recent.length>0&&<section className="studio-resume" aria-label={he?'חזרה לעבודה':'Continue your work'}><div className="studio-section-heading"><div><span className="studio-index" dir="ltr">03 /</span><h2>{he?'ממשיכים מאיפה שהפסקתם.':'A little momentum. Pick it back up.'}</h2></div><Layers size={16} aria-hidden="true"/></div><div className="studio-recent-list">{recent.map(workspace=><button key={workspace.id} onClick={()=>onOpen(workspace.id)}><span className="studio-recent-icon"><InterfaceSymbol kind="grid"/></span><span><strong><bdi>{workspace.title}</bdi></strong><small>{workspace.components.length} {he?'כלים בסביבת העבודה':'tools in your workspace'}</small></span><ArrowRight size={17} aria-hidden="true"/></button>)}</div></section>}
  <div className="studio-signoff"><InterfaceSymbol/><span>{he?'הרעיון שלכם. הדרך שלכם. המרחב שלכם.':'YOUR IDEA. YOUR RHYTHM. YOUR SPACE.'}</span><span dir="ltr">MADE TO ADAPT.</span></div>
 </>;
}

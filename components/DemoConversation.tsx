'use client';
import {useState} from 'react';
import WorkspaceRenderer from './WorkspaceRenderer';
import type {DemoConversation as Conversation} from '@/lib/demo-conversations';

export function demoDate(at:string){return new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'}).format(new Date(at));}
export default function DemoConversation({conversation}:{conversation:Conversation}){
 const [result,setResult]=useState(conversation.result);
 return <section className="workspace demo-conversation" dir="rtl" aria-label={`שיחת דמו: ${conversation.title}`}>
  <div className="intro-tag">DEMO · שיחה לדוגמה</div>
  <h1>{conversation.title}</h1>
  <p className="demo-subtitle">{conversation.preview} <time dateTime={conversation.at}>{demoDate(conversation.at)}</time></p>
  <p className="demo-disclosure" role="note">כל הפרטים בדיוניים. זו שיחה מוקלטת לדוגמה: חיפוש במייל, במסמכים וביומן מדגים חוויית ממשק בלבד. אין חיבור לחשבונות, שליחה או הזמנה. אפשר לערוך את התוצר למטה; העריכות זמניות ואינן נשמרות בחשבון.</p>
  <ol className="demo-messages">{conversation.messages.map((message,index)=><li className={`demo-message ${message.role}`} key={index}>
   <div className="demo-message-author">{message.role==='user'?'אתם':'ShadowUI'} <span>{String(index+1).padStart(2,'0')}</span></div>
   {message.steps&&<details className="demo-steps" open><summary>שלבי העבודה · הדמיה</summary><ul>{message.steps.map(step=><li key={step}>{step}</li>)}</ul></details>}
   <p>{message.text}</p>
  </li>)}</ol>
  <div className="demo-result-heading"><h2>מבקשה לתוצר</h2><p>ערכו את הטיוטה וסמנו את הצעדים הבאים — באמצעות כלי המוצר הקיימים.</p></div>
  <WorkspaceRenderer workspace={result} onChange={setResult} explain={false}/>
  <p className="demo-end">סוף שיחת הדוגמה · כדי לנסות בקשה משלכם, פתחו New workspace.</p>
 </section>;
}

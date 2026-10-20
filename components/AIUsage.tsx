'use client';
import {useState} from 'react';
import './ai-usage.css';

type Status={liveEnabled:boolean;storageReady:boolean;spent?:number;limit?:number};
export default function AIUsage({status,he,onRefresh}:{status?:Status;he:boolean;onRefresh:()=>Promise<unknown>}){
 const [refreshing,setRefreshing]=useState(false);
 if(!status?.liveEnabled)return null;
 const available=status.storageReady&&Number.isFinite(status.spent)&&Number.isFinite(status.limit)&&status.spent!>=0&&status.limit!>0;
 const spent=status.spent??0,limit=status.limit??1,remaining=Math.max(0,limit-spent);
 const amount=(value:number,digits=4)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
 async function refresh(){setRefreshing(true);try{await onRefresh();}finally{setRefreshing(false);}}
 return <section className="ai-usage" dir={he?'rtl':'ltr'} aria-label={he?'שימוש ב־OpenAI API':'OpenAI API usage'}>
  <div className="ai-usage-heading"><strong>{he?'שימוש ב־OpenAI API':'OpenAI API usage'}</strong><button type="button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?(he?'מעדכן…':'Refreshing…'):(he?'רענון שימוש':'Refresh usage')}</button></div>
  {available?<><dl className="ai-usage-values" aria-live="polite"><div><dt>{he?'נוצל — מוערך':'Used — estimated'}</dt><dd dir="ltr">{amount(spent)}</dd></div><div><dt>{he?'נותר עד התקרה':'Remaining to cap'}</dt><dd dir="ltr">{amount(remaining)}</dd></div><div><dt>{he?'תקרת התקציב':'Budget cap'}</dt><dd dir="ltr">{amount(limit,2)}</dd></div></dl><progress className={spent>=limit*.8?'near-limit':''} aria-label={he?'ניצול תקציב ה־API':'API budget utilization'} max={limit} value={Math.min(spent,limit)}/>{spent>=limit&&<p role="status">{he?'תקרת התקציב הושגה. בקשות AI נוספות ייחסמו.':'Budget cap reached. Further AI requests will be blocked.'}</p>}</>:<p role="status">{he?'נתוני השימוש אינם זמינים כרגע.':'Usage data is currently unavailable.'}</p>}
  <small>{he?'הערכה מצטברת לכל האפליקציה, כולל בקשות בתהליך. זו אינה יתרת החשבון או חשבונית OpenAI.':'App-wide cumulative estimate, including in-flight requests. This is not your OpenAI account balance or invoice.'}</small>
 </section>;
}

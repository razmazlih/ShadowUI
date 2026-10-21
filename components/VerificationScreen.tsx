'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {completeAccountVerification} from '@/lib/firebase-client';
import styles from '@/app/auth/page.module.css';
import {readAuthReturn} from '@/lib/auth-return';
export default function VerificationScreen(){
 const router=useRouter();
 const [state,setState]=useState<'working'|'done'|'error'>('working');
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const url=new URL(window.location.href),code=url.searchParams.get('oobCode'),mode=url.searchParams.get('mode');
  if(mode!=='verifyEmail'||!code){setState('error');setMessage('קישור האימות אינו תקין. אפשר לבקש קישור חדש במסך החשבון.');return;}
  let active=true;
  void completeAccountVerification(code).then(()=>{if(active){window.history.replaceState(null,'','/auth/verify');setState('done');let target='/';try{target=readAuthReturn(sessionStorage);}catch{}router.replace(target);}},error=>{
   if(!active)return;
   setState('error');setMessage(error?.code==='auth/network-request-failed'?'אין חיבור לשירות האימות. בדקו את החיבור ורעננו את הדף.':'קישור האימות פג תוקף או שכבר נעשה בו שימוש. אם החשבון עדיין לא אומת, בקשו קישור חדש.');
  });return()=>{active=false;};
 },[router]);
 return <main className={styles.screen} dir="rtl" lang="he"><div className={styles.brand} dir="ltr"><span>S</span><strong>ShadowUI</strong></div><section className={styles.card} aria-live="polite" aria-busy={state==='working'}><h1>{state==='working'?'מאמתים את האימייל…':state==='done'?'האימייל אומת בהצלחה':'לא הצלחנו להשלים את האימות'}</h1><p>{state==='working'?'זה ייקח רק רגע.':state==='done'?'הכול מוכן. מעבירים אותך לסביבת העבודה…':message}</p>{state!=='working'&&<Link href={state==='done'?'/':'/auth'} className={styles.continue}>{state==='done'?'חזרה לסביבת העבודה':'מעבר לחשבון'}</Link>}</section></main>;
}

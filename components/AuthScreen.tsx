'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {safeAuthReturnTo,rememberAuthReturn} from '@/lib/auth-return';
import Link from 'next/link';
import AccountPanel from '@/components/AccountPanel';
import styles from '@/app/auth/page.module.css';
export default function AuthScreen({initialLocale,returnTo='/',initialMode='login'}:{initialLocale:'he'|'en';returnTo?:string;initialMode?:'login'|'register'}){
 const [locale,setLocale]=useState(initialLocale);
 const [signedIn,setSignedIn]=useState(false);
 const he=locale==='he';
 const router=useRouter(),target=safeAuthReturnTo(returnTo);
 useEffect(()=>{try{if(target!=='/')rememberAuthReturn(sessionStorage,target);}catch{/* The explicit return URL still works when storage is unavailable. */}},[target]);
 function toggleLanguage(){const next=he?'en':'he';setLocale(next);const url=new URL(window.location.href);url.searchParams.set('lang',next);window.history.replaceState(null,'',url);}
 return <main className={styles.screen} dir={he?'rtl':'ltr'} lang={locale}><div className={styles.glow} aria-hidden="true"/><Link href={target} className={styles.brand} aria-label={he?'ShadowUI — חזרה לסביבת העבודה':'ShadowUI — Back to workspace'}><span>S</span><strong dir="ltr">Shadow<span>UI</span></strong></Link><section className={`${styles.card} ${signedIn?styles.profileCard:''}`}><button className={styles.language} type="button" onClick={toggleLanguage} aria-label={he?'Switch to English':'מעבר לעברית'}>{he?'English':'עברית'}</button>{target!=='/'&&<p className={styles.note}>{he?'לאחר הכניסה נחזור לשיחה ונפתח את השיתוף.':'After signing in, we’ll return to your conversation and open sharing.'}</p>}<AccountPanel locale={locale} initialMode={initialMode} returnTo={target} onUser={user=>{setSignedIn(Boolean(user));if(user?.emailVerified&&target!=='/')router.replace(target);}}/><Link className={styles.continue} href={target}>{target!=='/'?(he?'חזרה לשיחה':'Back to conversation'):signedIn?(he?'חזרה לסביבת העבודה':'Back to workspace'):(he?'להתחיל עם AI':'Start with AI')} <span aria-hidden="true">{he?'←':'→'}</span></Link>{!signedIn&&<p className={styles.note}>{he?'אפשר גם בלי חשבון.':'You can also continue without an account.'}</p>}</section></main>;
}

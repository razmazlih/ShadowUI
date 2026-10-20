'use client';
import {useState} from 'react';
import Link from 'next/link';
import AccountPanel from '@/components/AccountPanel';
import styles from '@/app/auth/page.module.css';
export default function AuthScreen({initialLocale}:{initialLocale:'he'|'en'}){
 const [locale,setLocale]=useState(initialLocale);
 const he=locale==='he';
 function toggleLanguage(){const next=he?'en':'he';setLocale(next);const url=new URL(window.location.href);url.searchParams.set('lang',next);window.history.replaceState(null,'',url);}
 return <main className={styles.screen} dir={he?'rtl':'ltr'} lang={locale}><div className={styles.glow} aria-hidden="true"/><Link href="/" className={styles.brand} aria-label={he?'ShadowUI — חזרה לסביבת העבודה':'ShadowUI — Back to workspace'}><span>S</span><strong dir="ltr">Shadow<span>UI</span></strong></Link><section className={styles.card}><button className={styles.language} type="button" onClick={toggleLanguage} aria-label={he?'Switch to English':'מעבר לעברית'}>{he?'English':'עברית'}</button><AccountPanel locale={locale}/><Link className={styles.continue} href="/">{he?'להתחיל עם AI':'Start with AI'} <span aria-hidden="true">{he?'←':'→'}</span></Link><p className={styles.note}>{he?'אפשר גם בלי חשבון.':'You can also continue without an account.'}</p></section></main>;
}

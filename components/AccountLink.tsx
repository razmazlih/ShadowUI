'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {User} from 'firebase/auth';
import {observeAccountUser} from '@/lib/firebase-client';
import styles from './AccountPanel.module.css';
export default function AccountLink({onUser,disabled=false,locale='he'}:{locale?:'he'|'en';onUser:(user:User|null)=>void;disabled?:boolean}){
 const [user,setUser]=useState<User|null>(null);const callback=useRef(onUser);callback.current=onUser;const router=useRouter();
 useEffect(()=>observeAccountUser(value=>{setUser(value);callback.current(value);}),[]);
 return <div className={styles.account} dir={locale==='he'?'rtl':'ltr'}><button className={styles.toggle} type="button" disabled={disabled} onClick={()=>router.push(`/auth?lang=${locale}`)}>{locale==='en'?(user?(user.emailVerified?'My account':'Verify account'):'Sign in / Sign up'):(user?(user.emailVerified?'החשבון שלי':'אימות החשבון'):'כניסה / הרשמה')}</button></div>;
}

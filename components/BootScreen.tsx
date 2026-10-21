'use client';
import {useEffect,useState,useRef} from 'react';
import {usePathname} from 'next/navigation';

/** Server-rendered first paint stays in place until the restored workspace is mounted. */
export default function BootScreen(){
 const pathname=usePathname();
 const enabled=useRef(pathname==='/'||pathname.startsWith('/conversations/'));
 const [leaving,setLeaving]=useState(false);
 const [finished,setFinished]=useState(false);
 useEffect(()=>{
  let frame=0;
  const reveal=()=>{frame=requestAnimationFrame(()=>setLeaving(true));};
  window.addEventListener('shadowui:ready',reveal);
  return ()=>{window.removeEventListener('shadowui:ready',reveal);cancelAnimationFrame(frame);};
 },[]);
 useEffect(()=>{
  if(!leaving)return;
  const timer=window.setTimeout(()=>setFinished(true),650);
  return ()=>window.clearTimeout(timer);
 },[leaving]);
 if(finished||!enabled.current)return null;
 return <div className={`boot-screen${leaving?' is-leaving':''}`} aria-hidden={leaving||undefined}>
  <div className="boot-emblem" aria-hidden="true"><i/><i/><i/><span>✳</span></div>
  <div className="boot-wordmark">Shadow<span>UI</span></div>
  <div className="boot-pulse" role="status" aria-label="Loading your workspace"><i/><i/><i/></div>
 </div>;
}

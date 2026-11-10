'use client';
import {useCallback,useEffect,useState} from 'react';

const themeKey='shadowui.ui-theme.v1';

/** Device preference, independent of the signed-in account and workspace. */
export function useColorTheme(){
 const [dark,setDark]=useState(true);
 useEffect(()=>{
  try{setDark(localStorage.getItem(themeKey)!=='light');}catch{}
  const synchronize=(event:StorageEvent)=>{
   if(event.key===themeKey||event.key===null)setDark(event.newValue!=='light');
  };
  window.addEventListener('storage',synchronize);
  return()=>window.removeEventListener('storage',synchronize);
 },[]);
 const toggleTheme=useCallback(()=>{
  const next=!dark;
  setDark(next);
  try{localStorage.setItem(themeKey,next?'dark':'light');}catch{}
 },[dark]);
 return {dark,toggleTheme};
}

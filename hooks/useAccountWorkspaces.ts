'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {User} from 'firebase/auth';
import {migrateGuestToAccount,parseWorkspaceSnapshot,readAccountWorkspaces,readAccountSyncBase,writeAccountWorkspaces,type WorkspaceSnapshot} from '@/lib/account-workspaces';
import {setDeviceDataOwner,snapshotDeviceData,restoreDeviceData} from '@/lib/account-device-data';
import {reconcileSnapshots} from '@/lib/workspace-sync';

export function useAccountWorkspaces(snapshot:WorkspaceSnapshot,load:(value:WorkspaceSnapshot)=>void,busy:boolean){
 const [ready,setReady]=useState(false),[owner,setOwner]=useState<string|null>(null),[status,setStatus]=useState('טוען שיחות…');
 const live=useRef(snapshot),apply=useRef(load),identity=useRef<User|null>(null),initialized=useRef(false),scope=useRef<string|null>(null),base=useRef(parseWorkspaceSnapshot(null)),pending=useRef<User|null|undefined>(undefined),working=useRef(false),blocked=useRef(busy),epoch=useRef(0);
 live.current=snapshot;apply.current=load;blocked.current=busy;
 const changeUser=useCallback((user:User|null)=>{
  if(blocked.current){pending.current=user;return;}
  const uid=user?.emailVerified?user.uid:null;
  identity.current=user;
  if(initialized.current&&scope.current===uid)return;
  epoch.current++;setReady(false);
  try{
   if(initialized.current)writeAccountWorkspaces(localStorage,scope.current,{...live.current,deviceData:snapshotDeviceData(localStorage,live.current.workspaces)},base.current);
   if(uid){const guest=readAccountWorkspaces(localStorage,null);writeAccountWorkspaces(localStorage,null,{...guest,deviceData:{...guest.deviceData,...snapshotDeviceData(localStorage,guest.workspaces,null)}});}
   const next=uid?migrateGuestToAccount(localStorage,uid):readAccountWorkspaces(localStorage,null);
   setDeviceDataOwner(uid);
   restoreDeviceData(localStorage,next.deviceData);
   next.deviceData={...next.deviceData,...snapshotDeviceData(localStorage,next.workspaces)};
   let previous=parseWorkspaceSnapshot(null);
   if(uid)previous=readAccountSyncBase(localStorage,uid);
   base.current=previous;scope.current=uid;initialized.current=true;live.current=next;apply.current(next);setOwner(uid);setReady(true);setStatus(uid?'ממתין לסנכרון…':'חשבון אורח · נשמר במכשיר זה');
  }catch{setStatus('לא ניתן לקרוא או להעביר שיחות. העותק הקיים נשמר; פנו מקום בדפדפן ונסו לרענן.');}
 },[]);
 useEffect(()=>{if(!busy&&pending.current!==undefined){const user=pending.current;pending.current=undefined;changeUser(user);}},[busy,changeUser]);
 useEffect(()=>{if(!ready)return;try{writeAccountWorkspaces(localStorage,owner,{...snapshot,deviceData:snapshotDeviceData(localStorage,snapshot.workspaces)},base.current);}catch{setStatus('השמירה במכשיר נכשלה. פנו מקום לפני יציאה.');}},[snapshot,owner,ready]);
 useEffect(()=>{
  if(!ready||!owner)return;
  let disposed=false;
  const synchronize=async()=>{
   if(disposed||working.current||blocked.current||!identity.current?.emailVerified||identity.current.uid!==owner)return;
   working.current=true;const version=epoch.current;
   const valid=()=>!disposed&&version===epoch.current;
   try{
    setStatus('מסנכרן שיחות…');
    const token=await identity.current.getIdToken();
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    for(let attempt=0;attempt<3;attempt++){
     const response=await fetch('/api/account/workspaces',{headers,cache:'no-store',signal:AbortSignal.timeout(20000)});
     if(!response.ok)throw new Error('sync');
     const remote=await response.json();if(!valid())return;
     if(blocked.current)return;
     const captured={...live.current,deviceData:snapshotDeviceData(localStorage,live.current.workspaces)};
     const merged=reconcileSnapshots(base.current,captured,parseWorkspaceSnapshot(remote.snapshot));
     const cloudChanged=JSON.stringify({...merged,active:null})!==JSON.stringify({...parseWorkspaceSnapshot(remote.snapshot),active:null});
     if(cloudChanged){
      const result=await fetch('/api/account/workspaces',{method:'PUT',headers,body:JSON.stringify({snapshot:merged,expectedRevision:remote.revision}),signal:AbortSignal.timeout(20000)});
      if(!valid())return;
      if(result.status===409)continue;
      if(!result.ok)throw new Error('sync');
     }
     if(blocked.current)return;
     // Changes made while uploading stay ahead of this acknowledgement.
     const next=reconcileSnapshots(captured,{...live.current,deviceData:snapshotDeviceData(localStorage,live.current.workspaces)},merged);
     writeAccountWorkspaces(localStorage,owner,next,merged);
     restoreDeviceData(localStorage,next.deviceData,captured.deviceData);
     base.current=merged;
     if(JSON.stringify(next)!==JSON.stringify(live.current)){live.current=next;apply.current(next);window.dispatchEvent(new Event('shadowui:account-synced'));}
     setStatus(JSON.stringify(next)===JSON.stringify(merged)?'השיחות מסונכרנות לחשבון':'השינויים נשמרו במכשיר · ממתין לסנכרון');return;
    }
    throw new Error('conflict');
   }catch{if(valid())setStatus('הסנכרון לא הושלם · השיחות נשמרות במכשיר וננסה שוב');}
   finally{working.current=false;}
  };
  const timer=setTimeout(()=>void synchronize(),800);
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void synchronize();},15000);
  const refresh=()=>void synchronize();window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
  return()=>{disposed=true;clearTimeout(timer);clearInterval(interval);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);};
 },[owner,ready,snapshot]);
 return {ready,owner,status,onUser:changeUser};
}

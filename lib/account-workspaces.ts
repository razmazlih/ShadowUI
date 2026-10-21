import {WorkspaceSchema,type Workspace} from './schema';
import {parseConversationHistory,type ConversationHistory} from './conversation-history';

export type WorkspaceSnapshot={workspaces:Workspace[];active:string|null;conversations:ConversationHistory;undoWorkspaces:Record<string,Workspace>;sources:Record<string,string>;deviceData?:Record<string,string>};
export type WorkspaceStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const guestKey='shadowui.device.v1.guest';
const legacyKey='shadowui.v1';
const legacySources='shadowui.sources';
type Envelope={snapshot:WorkspaceSnapshot;generation:string;importedGuests:string[];syncBase?:WorkspaceSnapshot};
const safe=(key:string)=>!!key&&key.length<=200&&!['__proto__','constructor','prototype'].includes(key);
export function accountWorkspaceKey(uid:string|null){if(uid===null)return guestKey;if(!uid||uid.length>128)throw new Error('Invalid account identity');return `shadowui.device.v1.user.${encodeURIComponent(uid)}`;}
export function parseWorkspaceSnapshot(value:unknown):WorkspaceSnapshot{
 const raw=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const workspaces:Workspace[]=[];const ids=new Set<string>();
 for(const candidate of Array.isArray(raw.workspaces)?raw.workspaces:[]){const parsed=WorkspaceSchema.safeParse(candidate);if(parsed.success&&safe(parsed.data.id)&&!ids.has(parsed.data.id)){ids.add(parsed.data.id);workspaces.push(parsed.data);}}
 const deviceData:Record<string,string>=Object.create(null);let deviceBytes=0;
 if(raw.deviceData&&typeof raw.deviceData==='object'&&!Array.isArray(raw.deviceData))for(const [key,entry] of Object.entries(raw.deviceData)){
  const suffix=key.startsWith('shadowui.browser-schedule.v1.')?key.slice('shadowui.browser-schedule.v1.'.length):key.startsWith('shadowui.layout.v1:')?key.slice('shadowui.layout.v1:'.length):null;
  if(suffix===null||!safe(suffix)||typeof entry!=='string'||entry.length>300000)continue;
  const presentation=key.startsWith('shadowui.layout.v1:')&&key.endsWith(':presentation');
  if(presentation&&!['fit','vertical'].includes(entry))continue;
  const bytes=new TextEncoder().encode(key+entry).byteLength;if(deviceBytes+bytes>300000)continue;
  try{if(!presentation&&!(key.startsWith('shadowui.layout.v1:')&&key.endsWith(':density')&&['compact','comfortable'].includes(entry)))JSON.parse(entry);deviceData[key]=entry;deviceBytes+=bytes;}catch{}
 }
 const undoWorkspaces:Record<string,Workspace>=Object.create(null),sources:Record<string,string>=Object.create(null);
 if(raw.undoWorkspaces&&typeof raw.undoWorkspaces==='object')for(const [id,candidate] of Object.entries(raw.undoWorkspaces)){const parsed=WorkspaceSchema.safeParse(candidate);if(ids.has(id)&&parsed.success&&parsed.data.id===id)undoWorkspaces[id]=parsed.data;}
 if(raw.sources&&typeof raw.sources==='object')for(const [id,source] of Object.entries(raw.sources))if(ids.has(id)&&typeof source==='string'&&source.length<=100)sources[id]=source;
 return {workspaces,active:typeof raw.active==='string'&&ids.has(raw.active)?raw.active:null,conversations:parseConversationHistory(raw.conversations),undoWorkspaces,sources,deviceData};
}
function readEnvelope(storage:WorkspaceStorage,uid:string|null):Envelope{
 const raw=storage.getItem(accountWorkspaceKey(uid));
 if(raw!==null){const envelope=JSON.parse(raw);if(!envelope||typeof envelope!=='object'||!envelope.snapshot)throw new Error('Saved account data could not be read');return {snapshot:parseWorkspaceSnapshot(envelope.snapshot),...(envelope.syncBase?{syncBase:parseWorkspaceSnapshot(envelope.syncBase)}:{}),generation:typeof envelope.generation==='string'?envelope.generation:crypto.randomUUID(),importedGuests:Array.isArray(envelope.importedGuests)?envelope.importedGuests.filter((id:unknown):id is string=>typeof id==='string'):[]};}
 if(uid===null){const legacy=storage.getItem(legacyKey);if(legacy!==null){const value=JSON.parse(legacy);const sources=JSON.parse(storage.getItem(legacySources)||'{}');return {snapshot:parseWorkspaceSnapshot({...value,sources}),generation:'legacy-v1',importedGuests:[]};}}
 return {snapshot:parseWorkspaceSnapshot(null),generation:crypto.randomUUID(),importedGuests:[]};
}
export function readAccountWorkspaces(storage:WorkspaceStorage,uid:string|null):WorkspaceSnapshot{return readEnvelope(storage,uid).snapshot;}
export function readAccountSyncBase(storage:WorkspaceStorage,uid:string):WorkspaceSnapshot{return readEnvelope(storage,uid).syncBase??parseWorkspaceSnapshot(null);}
export function writeAccountWorkspaces(storage:WorkspaceStorage,uid:string|null,snapshot:WorkspaceSnapshot,syncBase?:WorkspaceSnapshot):void{
 const previous=readEnvelope(storage,uid);storage.setItem(accountWorkspaceKey(uid),JSON.stringify({...previous,snapshot:parseWorkspaceSnapshot(snapshot),...(syncBase?{syncBase:parseWorkspaceSnapshot(syncBase)}:{})}));
 // A legacy snapshot belongs only to the guest who first loaded this device.
 if(uid===null){storage.removeItem(legacyKey);storage.removeItem(legacySources);}
}
/** Copy guest work before clearing it; receipts make retries safe after a failed clear. */
export function migrateGuestToAccount(storage:WorkspaceStorage,uid:string):WorkspaceSnapshot{
 const guest=readEnvelope(storage,null),target=readEnvelope(storage,uid);
 if(!target.importedGuests.includes(guest.generation)){
  const merged=parseWorkspaceSnapshot(target.snapshot),idMap=new Map<string,string>(),domainMap=new Map<string,string>();
  const used=new Set([...merged.workspaces.map(w=>w.id),...Object.keys(merged.conversations)]);
  const domains=new Set(merged.workspaces.flatMap(workspace=>workspace.domain?[workspace.domain.id]:[]));
  for(const workspace of guest.snapshot.workspaces){
   let id=workspace.id;if(used.has(id))id=crypto.randomUUID();used.add(id);idMap.set(workspace.id,id);
   let domain=workspace.domain;
   if(domain){let domainId=domainMap.get(domain.id);if(!domainId){domainId=domains.has(domain.id)?crypto.randomUUID():domain.id;domainMap.set(domain.id,domainId);domains.add(domainId);}domain={...domain,id:domainId};}
   merged.workspaces.push({...workspace,id,...(domain?{domain}:{})});
   if(guest.snapshot.undoWorkspaces[workspace.id])merged.undoWorkspaces[id]={...guest.snapshot.undoWorkspaces[workspace.id],id,...(domain?{domain}:{})};
   if(guest.snapshot.sources[workspace.id])merged.sources[id]=guest.snapshot.sources[workspace.id];
  }
  for(const [key,history] of Object.entries(guest.snapshot.conversations)){
   let id=idMap.get(key)??key;
   if(Object.hasOwn(merged.conversations,id)){
    // Keep complete histories in independently accessible workspace cards.
    id=crypto.randomUUID();
    merged.workspaces.push({id,title:'שיחת אורח',description:'שיחה שהועברה מחשבון אורח במכשיר זה',goal:'המשך השיחה',components:[{id:'guest-chat-notes',type:'notes',title:'שיחת אורח',reason:'שמירת השיחה שהועברה',span:'wide',items:[],text:''}]});
   }
   merged.conversations[id]=history;
  }
  merged.deviceData??={};
  for(const [key,value] of Object.entries(guest.snapshot.deviceData??{})){
   const prefix='shadowui.layout.v1:',schedulePrefix='shadowui.browser-schedule.v1.';
   let mapped=key,nextValue=value;
   if(key.startsWith(prefix)){
    const original=key.slice(prefix.length),suffix=original.endsWith(':density')?':density':original.endsWith(':presentation')?':presentation':'',workspaceId=suffix?original.slice(0,-suffix.length):original;
    mapped=prefix+(idMap.get(workspaceId)??workspaceId)+suffix;
   }else if(key.startsWith(schedulePrefix)){
    const original=key.slice(schedulePrefix.length),domainId=domainMap.get(original);
    if(domainId&&domainId!==original){
     mapped=schedulePrefix+domainId;
     const state=JSON.parse(value);
     const remap=(schedule:unknown)=>schedule&&typeof schedule==='object'&&!Array.isArray(schedule)&&'id' in schedule&&schedule.id===original?{...schedule,id:domainId}:schedule;
     if(state&&typeof state==='object'&&!Array.isArray(state)){
      state.schedule=remap(state.schedule);
      if(Array.isArray(state.history))state.history=state.history.map(remap);
      if(state.actions&&typeof state.actions==='object'&&!Array.isArray(state.actions))for(const action of Object.values(state.actions))if(action&&typeof action==='object'&&'result' in action)action.result=remap(action.result);
     }
     nextValue=JSON.stringify(state);
    }
   }
   if(!Object.hasOwn(merged.deviceData,mapped))merged.deviceData[mapped]=nextValue;
  }
  if(guest.snapshot.active)merged.active=idMap.get(guest.snapshot.active)??merged.active;
  storage.setItem(accountWorkspaceKey(uid),JSON.stringify({...target,snapshot:merged,generation:target.generation,importedGuests:[...target.importedGuests,guest.generation]} satisfies Envelope));
  target.snapshot=merged;
 }
 storage.removeItem(legacyKey);storage.removeItem(legacySources);storage.removeItem(guestKey);
 return target.snapshot;
}

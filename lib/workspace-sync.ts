import {parseWorkspaceSnapshot,type WorkspaceSnapshot} from './account-workspaces';
// Compare JSON values independently of object insertion order.
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const extendsHistory=(a:unknown[],b:unknown[])=>a.length>=b.length&&b.every((entry,index)=>same(entry,a[index]));
const copySuffix=' · עותק ממכשיר אחר';
const originalTitle=(title:string):string=>title.endsWith(copySuffix)?originalTitle(title.slice(0,-copySuffix.length)):title;
function equivalent(snapshot:WorkspaceSnapshot,id:string,other:WorkspaceSnapshot,otherId:string){
 const a=snapshot.workspaces.find(w=>w.id===id),b=other.workspaces.find(w=>w.id===otherId);
 if(!a||!b)return false;
 const content=(w:typeof a)=>({...w,id:undefined,title:originalTitle(w.title).slice(0,150-copySuffix.length),...(w.domain?{domain:{...w.domain,id:undefined}}:{})});
 const undo=(state:WorkspaceSnapshot,key:string)=>state.undoWorkspaces[key]?content(state.undoWorkspaces[key]):undefined;
 const schedule=(state:WorkspaceSnapshot,w:typeof a)=>{if(!w.domain)return undefined;const raw=state.deviceData?.[`shadowui.browser-schedule.v1.${w.domain.id}`];return raw?JSON.stringify(JSON.parse(raw),(_key,value)=>value===w.domain?.id?'__schedule_id__':value):undefined;};
 return same(content(a),content(b))&&same(schedule(snapshot,a),schedule(other,b))&&same(snapshot.conversations[id],other.conversations[otherId])&&same(undo(snapshot,id),undo(other,otherId))&&same(snapshot.sources[id],other.sources[otherId])&&['',':density'].every(suffix=>same(snapshot.deviceData?.[`shadowui.layout.v1:${id}${suffix}`],other.deviceData?.[`shadowui.layout.v1:${otherId}${suffix}`]));
}
/** Remove only generated copies with identical contents, retaining every distinct edit. */
export function consolidateConflictCopies(snapshot:WorkspaceSnapshot):WorkspaceSnapshot{
 const result=parseWorkspaceSnapshot(snapshot);
 const ordered=[...result.workspaces].sort((a,b)=>Number(a.title.endsWith(copySuffix))-Number(b.title.endsWith(copySuffix)));
 const kept:string[]=[];
 for(const workspace of ordered){
  const original=workspace.title.endsWith(copySuffix)?kept.find(id=>equivalent(result,id,result,workspace.id)):undefined;
  if(!original){kept.push(workspace.id);continue;}
  result.workspaces=result.workspaces.filter(w=>w.id!==workspace.id);
  if(result.active===workspace.id)result.active=original;
  for(const field of ['conversations','undoWorkspaces','sources'] as const)delete result[field][workspace.id];
  for(const suffix of ['',':density'])delete result.deviceData?.[`shadowui.layout.v1:${workspace.id}${suffix}`];
 }
 return result;
}
/** Apply only local changes since the last acknowledgement to the latest cloud state. */
export function reconcileSnapshots(base:WorkspaceSnapshot,local:WorkspaceSnapshot,remote:WorkspaceSnapshot):WorkspaceSnapshot{
 const result=parseWorkspaceSnapshot(remote);
 // Keep a separate copy if two devices edited the same chat since their common base.
 for(const id of new Set([...local.workspaces.map(w=>w.id),...Object.keys(local.conversations)])){
  const previous=base.workspaces.find(w=>w.id===id),ours=local.workspaces.find(w=>w.id===id),theirs=remote.workspaces.find(w=>w.id===id);
  const workspaceConflict=ours&&theirs&&!same(ours,previous)&&!same(theirs,previous)&&!same(ours,theirs);
  const historyConflict=local.conversations[id]&&remote.conversations[id]&&!same(local.conversations[id],base.conversations[id])&&!same(remote.conversations[id],base.conversations[id])&&!extendsHistory(local.conversations[id],remote.conversations[id])&&!extendsHistory(remote.conversations[id],local.conversations[id]);
  if(!workspaceConflict&&!historyConflict)continue;
  // A previously uploaded conflict branch already preserves these exact contents.
  if(theirs&&result.workspaces.some(w=>w.id!==id&&w.title.endsWith(copySuffix)&&equivalent(result,w.id,remote,id)))continue;
  const copy=crypto.randomUUID();
  const domain=theirs?.domain?{...theirs.domain,id:crypto.randomUUID()}:undefined;
  result.workspaces.push(theirs?{...theirs,id:copy,...(domain?{domain}:{}),title:`${originalTitle(theirs.title).slice(0,150-copySuffix.length)}${copySuffix}`}:{id:copy,title:'שיחה ממכשיר אחר',goal:'המשך השיחה',description:'עותק שנשמר בעקבות שינויים במקביל',components:[{id:'notes',type:'notes',title:'שיחה',reason:'שמירת השיחה',span:'normal',items:[],text:''}]});
  if(remote.conversations[id])result.conversations[copy]=remote.conversations[id];
  if(remote.sources[id])result.sources[copy]=remote.sources[id];
  if(remote.undoWorkspaces[id])result.undoWorkspaces[copy]={...remote.undoWorkspaces[id],id:copy,...(domain?{domain}:{})};
  if(theirs?.domain&&domain&&result.deviceData){
   const key=`shadowui.browser-schedule.v1.${theirs.domain.id}`,raw=remote.deviceData?.[key];
   if(raw){const state=JSON.parse(raw);const remap=(schedule:Record<string,unknown>)=>({...schedule,id:domain.id});if(state.schedule)state.schedule=remap(state.schedule);if(Array.isArray(state.history))state.history=state.history.map(remap);for(const action of Object.values(state.actions??{}) as Array<{result?:Record<string,unknown>}>)if(action.result)action.result=remap(action.result);result.deviceData[`shadowui.browser-schedule.v1.${domain.id}`]=JSON.stringify(state);}
  }
  if(theirs&&result.deviceData)for(const suffix of ['',':density']){const raw=remote.deviceData?.[`shadowui.layout.v1:${id}${suffix}`];if(raw)result.deviceData[`shadowui.layout.v1:${copy}${suffix}`]=raw;}
 }
 const before=new Map(base.workspaces.map(w=>[w.id,w]));
 const current=new Map(local.workspaces.map(w=>[w.id,w]));
 const merged=new Map(result.workspaces.map(w=>[w.id,w]));
 for(const id of new Set([...before.keys(),...current.keys()]))if(!same(before.get(id),current.get(id))){const value=current.get(id);if(value)merged.set(id,value);else merged.delete(id);}
 result.workspaces=[...merged.values()];
 for(const field of ['conversations','undoWorkspaces','sources','deviceData'] as const){
  const target=(result[field]??={}) as Record<string,unknown>;
  for(const id of new Set([...Object.keys(base[field]??{}),...Object.keys(local[field]??{})]))if(!same(base[field]?.[id],local[field]?.[id])){if(Object.hasOwn(local[field]??{},id))target[id]=local[field]?.[id];else delete target[id];}
 }
 // Compatible histories are one conversation; retain the longer continuation.
 for(const [id,history] of Object.entries(local.conversations)){const other=remote.conversations[id];if(other&&extendsHistory(other,history)&&!same(history,base.conversations[id]))result.conversations[id]=other;}
 // Selecting a chat is device-local and must not move another device's current view.
 result.active=local.active;
 return consolidateConflictCopies(result);
}

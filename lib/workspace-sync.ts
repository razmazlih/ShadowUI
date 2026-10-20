import {parseWorkspaceSnapshot,type WorkspaceSnapshot} from './account-workspaces';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Apply only local changes since the last acknowledgement to the latest cloud state. */
export function reconcileSnapshots(base:WorkspaceSnapshot,local:WorkspaceSnapshot,remote:WorkspaceSnapshot):WorkspaceSnapshot{
 const result=parseWorkspaceSnapshot(remote);
 // Keep a separate copy if two devices edited the same chat since their common base.
 for(const id of new Set([...local.workspaces.map(w=>w.id),...Object.keys(local.conversations)])){
  const previous=base.workspaces.find(w=>w.id===id),ours=local.workspaces.find(w=>w.id===id),theirs=remote.workspaces.find(w=>w.id===id);
  const workspaceConflict=ours&&theirs&&!same(ours,previous)&&!same(theirs,previous)&&!same(ours,theirs);
  const historyConflict=local.conversations[id]&&remote.conversations[id]&&!same(local.conversations[id],base.conversations[id])&&!same(remote.conversations[id],base.conversations[id])&&!same(local.conversations[id],remote.conversations[id]);
  if(!workspaceConflict&&!historyConflict)continue;
  const copy=crypto.randomUUID();
  const domain=theirs?.domain?{...theirs.domain,id:crypto.randomUUID()}:undefined;
  result.workspaces.push(theirs?{...theirs,id:copy,...(domain?{domain}:{}),title:`${theirs.title} · עותק ממכשיר אחר`}:{id:copy,title:'שיחה ממכשיר אחר',goal:'המשך השיחה',description:'עותק שנשמר בעקבות שינויים במקביל',components:[{id:'notes',type:'notes',title:'שיחה',reason:'שמירת השיחה',span:'normal',items:[],text:''}]});
  if(remote.conversations[id])result.conversations[copy]=remote.conversations[id];
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
 // Selecting a chat is device-local and must not move another device's current view.
 result.active=local.active;
 return parseWorkspaceSnapshot(result);
}

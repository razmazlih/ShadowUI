import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkspaceSnapshot} from '../lib/account-workspaces';
import {reconcileSnapshots} from '../lib/workspace-sync';
const workspace=(id:string,text=id)=>({id,title:id,goal:'Keep notes',description:'Notes',components:[{id:'notes',type:'notes',title:'Notes',reason:'Keep notes',items:[],text}]});
const state=(ids:string[])=>parseWorkspaceSnapshot({workspaces:ids.map(id=>workspace(id)),conversations:Object.fromEntries(ids.map(id=>[id,[{role:'user',content:id}]]))});
test('independent devices retain each other’s new chats',()=>{
 const base=state(['original']),local=state(['original','local']),remote=state(['original','remote']);
 assert.deepEqual(reconcileSnapshots(base,local,remote).workspaces.map(w=>w.id),['original','remote','local']);
});
test('remote deletion survives an unchanged local copy',()=>{
 const base=state(['deleted','kept']);const result=reconcileSnapshots(base,base,state(['kept']));
 assert.deepEqual(result.workspaces.map(w=>w.id),['kept']);assert.equal(result.conversations.deleted,undefined);
});
test('local deletion applies to newest remote without deleting another device’s addition',()=>{
 const result=reconcileSnapshots(state(['deleted']),state([]),state(['deleted','new']));
 assert.deepEqual(result.workspaces.map(w=>w.id),['new']);assert.equal(result.conversations.deleted,undefined);
});
test('changes made during upload remain unsynchronized edits against acknowledgement',()=>{
 const base=state(['a']);const captured=state(['a','b']);const merged=reconcileSnapshots(base,captured,state(['a','c']));
 const next=reconcileSnapshots(captured,state(['a','b','d']),merged);
 assert.deepEqual(next.workspaces.map(w=>w.id),['a','c','b','d']);
});
test('cloud schedule data merges while the local active selection stays local',()=>{
 const base=state(['a']),local=state(['a']),remote=state(['a']);local.active='a';remote.deviceData={'shadowui.browser-schedule.v1.a':'{"revision":2}'};
 const result=reconcileSnapshots(base,local,remote);assert.equal(result.active,'a');assert.deepEqual({...result.deviceData},remote.deviceData);
});
test('simultaneous edits to the same conversation retain a separate remote copy',()=>{
 const base=state(['a']),local=state(['a']),remote=state(['a']);
 local.conversations.a=[{role:'user',content:'Local followup'}];remote.conversations.a=[{role:'user',content:'Remote followup'}];
 const result=reconcileSnapshots(base,local,remote);assert.equal(result.workspaces.length,2);
 assert.equal(result.conversations.a[0].content,'Local followup');
 assert.ok(Object.entries(result.conversations).some(([id,history])=>id!=='a'&&history[0].content==='Remote followup'));
});
test('retry after a successful upload does not create another conflict copy',()=>{
 const base=state(['a']),local=state(['a']),remote=state(['a']);
 local.conversations.a=[{role:'user',content:'Local'}];remote.conversations.a=[{role:'user',content:'Remote'}];
 const uploaded=reconcileSnapshots(base,local,remote);
 for(let i=0;i<5;i++){
  const retried=reconcileSnapshots(base,local,uploaded);
  assert.equal(retried.workspaces.length,2);
  assert.deepEqual(retried,uploaded);
 }
});
test('existing nested identical copies collapse and active selection follows retained chat',()=>{
 const remote=state(['a']);
 const original=remote.workspaces[0];
 for(const id of ['b','c']){remote.workspaces.push({...original,id,title:'a · עותק ממכשיר אחר'+(id==='c'?' · עותק ממכשיר אחר':'')});remote.conversations[id]=remote.conversations.a;}
 const local=structuredClone(remote);local.active='c';
 const result=reconcileSnapshots(remote,local,remote);
 assert.deepEqual(result.workspaces.map(w=>w.id),['a']);assert.equal(result.active,'a');assert.deepEqual(Object.keys(result.conversations),['a']);
});
test('copies with different messages or layout data are preserved',()=>{
 const remote=state(['a']);
 for(const id of ['b','c']){remote.workspaces.push({...remote.workspaces[0],id,title:'a · עותק ממכשיר אחר'});remote.conversations[id]=remote.conversations.a;}
 remote.conversations.b=[{role:'user',content:'Distinct message'}];remote.deviceData={'shadowui.layout.v1:c':'{"columns":2}'};
 assert.equal(reconcileSnapshots(remote,remote,remote).workspaces.length,3);
});
test('an extended conversation retains the longer history without a conflict copy',()=>{
 const base=state(['a']),local=state(['a']),remote=state(['a']);
 local.conversations.a.push({role:'assistant',content:'Answer'});
 remote.conversations.a.push({role:'assistant',content:'Answer'},{role:'user',content:'Followup'});
 const result=reconcileSnapshots(base,local,remote);
 assert.equal(result.workspaces.length,1);assert.deepEqual(result.conversations.a,remote.conversations.a);
});
test('equivalent objects with different key order do not create conflicts',()=>{
 const base=state(['a']),local=state(['a']),remote=state(['a']);
 local.workspaces[0].description='Updated';remote.workspaces[0]={...local.workspaces[0]};
 remote.workspaces[0]=Object.fromEntries(Object.entries(remote.workspaces[0]).reverse()) as typeof remote.workspaces[0];
 assert.equal(reconcileSnapshots(base,local,remote).workspaces.length,1);
});
test('maximum-length titles retain remote edits in a valid conflict copy',()=>{
 const base=state(['a']),local=state(['a']),remote=state(['a']);
 base.workspaces[0].title=local.workspaces[0].title=remote.workspaces[0].title='א'.repeat(150);
 local.conversations.a=[{role:'user',content:'Local'}];remote.conversations.a=[{role:'user',content:'Remote'}];
 const result=reconcileSnapshots(base,local,remote);
 assert.equal(result.workspaces.length,2);
 assert.ok(result.workspaces.every(w=>w.title.length<=150));
 assert.ok(Object.values(result.conversations).some(history=>history[0].content==='Remote'));
 const retry=reconcileSnapshots(base,local,result);assert.equal(retry.workspaces.length,2);
});

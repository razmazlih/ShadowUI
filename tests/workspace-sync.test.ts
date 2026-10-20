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

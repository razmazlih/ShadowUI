import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserScheduleStore} from '../lib/browser-schedule-store';
test('hosted browser demo survives adapter reload, rejects stale writes, previews without mutation and replays confirmation',()=>{
 const records=new Map<string,string>();const storage={getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>{records.set(key,value)}};
 let store=new BrowserScheduleStore(storage);store.call('create_schedule',{id:'demo',goal:'Schedule six employees'});
 const operation={type:'set_availability',employeeId:'daniel',date:'2026-10-21',unavailable:true};
 assert.equal(store.call('preview_schedule_change',{id:'demo',expectedRevision:0,operation}).evaluation.valid,false);
 assert.equal(store.call('inspect_schedule',{id:'demo'}).schedule.revision,0);
 const changed=store.call('update_schedule',{id:'demo',expectedRevision:0,actionId:'availability',operation});
 assert.throws(()=>store.call('update_schedule',{id:'demo',expectedRevision:0,actionId:'stale',operation}),{code:'STALE_REVISION'});
 assert.throws(()=>store.call('commit_schedule',{id:'demo',expectedRevision:1,actionId:'invalid',confirmed:true}),{code:'CONFLICTS'});
 store.call('update_schedule',{id:'demo',expectedRevision:1,actionId:'repair',operation:{type:'assign',shiftId:'shift-4',employeeId:changed.alternatives['shift-4'][0].employeeId}});
 const args={id:'demo',expectedRevision:2,actionId:'confirmation',confirmed:true};const confirmed=store.call('commit_schedule',args);
 store=new BrowserScheduleStore(storage);assert.equal(store.call('commit_schedule',args).schedule.receipt?.id,confirmed.schedule.receipt?.id);
 assert.equal(store.call('inspect_schedule',{id:'demo'}).schedule.status,'committed');
 const undone=store.call('update_schedule',{id:'demo',expectedRevision:3,actionId:'undo',operation:{type:'undo'}});assert.equal(undone.schedule.status,'draft');assert.equal(undone.schedule.receipt,undefined);
});
test('browser storage failure is surfaced without reporting a saved schedule',()=>{
 const store=new BrowserScheduleStore({getItem:()=>null,setItem:()=>{throw new Error('quota')}});
 assert.throws(()=>store.call('create_schedule',{id:'demo',goal:'Schedule'}),{code:'STORAGE_ERROR'});
});

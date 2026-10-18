import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStoredSchedule,inspectSchedule,updateSchedule,previewSchedule,commitSchedule} from '../lib/schedule-store';
test('durable lifecycle supports preview, idempotent updates, stale rejection, commit receipt and undo',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'shadow-schedule-'));process.env.SHADOWUI_DATA_DIR=dir;
 try{
  const initial=await createStoredSchedule('persisted','Schedule six employees');assert.equal(initial.schedule.revision,0);
  const op={type:'set_availability' as const,employeeId:'daniel',date:'2026-10-21',unavailable:true};
  const preview=await previewSchedule('persisted',0,op);assert.equal(preview.evaluation.valid,false);assert.equal((await inspectSchedule('persisted')).schedule.revision,0);
  const changed=await updateSchedule('persisted',0,'availability',op);assert.equal(changed.schedule.revision,1);assert.equal((await updateSchedule('persisted',0,'availability',op)).schedule.revision,1);
  await assert.rejects(()=>updateSchedule('persisted',0,'stale',op),{code:'STALE_REVISION'});await assert.rejects(()=>updateSchedule('persisted',1,'availability',{...op,unavailable:false}),{code:'ACTION_ID_REUSED'});
  await assert.rejects(()=>commitSchedule('persisted',1,'bad-commit',true),{code:'CONFLICTS'});
  const replacement=changed.alternatives['shift-4'][0].employeeId;const fixed=await updateSchedule('persisted',1,'repair',{type:'assign',shiftId:'shift-4',employeeId:replacement});assert.ok(fixed.evaluation.valid);
  const committed=await commitSchedule('persisted',2,'commit',true);assert.equal(committed.schedule.status,'committed');assert.equal(committed.schedule.receipt?.revision,3);assert.equal((await commitSchedule('persisted',2,'commit',true)).schedule.receipt?.id,committed.schedule.receipt?.id);
  const raw=JSON.parse(await readFile(path.join(dir,'persisted.json'),'utf8'));assert.equal(raw.schedule.receipt.id,committed.schedule.receipt?.id);
  const undone=await updateSchedule('persisted',3,'undo',{type:'undo'});assert.equal(undone.schedule.status,'draft');assert.equal(undone.schedule.receipt,undefined);assert.equal(undone.schedule.revision,4);
  await assert.rejects(()=>commitSchedule('persisted',2,'commit',true),{code:'ACTION_SUPERSEDED'});assert.equal((await inspectSchedule('persisted')).schedule.status,'draft');
  const previous=await updateSchedule('persisted',4,'undo-repair',{type:'undo'});assert.equal(previous.schedule.shifts[4].employeeId,'daniel');assert.equal(previous.evaluation.valid,false);
  const original=await updateSchedule('persisted',5,'undo-availability',{type:'undo'});assert.equal(original.evaluation.valid,true);await assert.rejects(()=>updateSchedule('persisted',6,'empty',{type:'undo'}),{code:'NO_HISTORY'});
 }finally{delete process.env.SHADOWUI_DATA_DIR;await rm(dir,{recursive:true,force:true});}
});
test('concurrent stale writers cannot both mutate same revision and path traversal is rejected',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'shadow-race-'));process.env.SHADOWUI_DATA_DIR=dir;try{await createStoredSchedule('race','Schedule');const result=await Promise.allSettled([updateSchedule('race',0,'one',{type:'set_min_days_off',value:3}),updateSchedule('race',0,'two',{type:'set_min_days_off',value:4})]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await inspectSchedule('race')).schedule.revision,1);await assert.rejects(()=>inspectSchedule('../escape'),{code:'INVALID_INPUT'});}finally{delete process.env.SHADOWUI_DATA_DIR;await rm(dir,{recursive:true,force:true});}});

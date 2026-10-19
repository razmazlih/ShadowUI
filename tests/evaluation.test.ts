import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planDemo } from '../lib/planner';
import { evaluationCases, inspectCapabilities, localCapabilityBoundary } from '../lib/evaluation';
import { createSchedule, applyScheduleOperation, scheduleView, evaluateSchedule, ScheduleError } from '../lib/schedule';
import { createStoredSchedule, updateSchedule, previewSchedule, inspectSchedule, commitSchedule } from '../lib/schedule-store';
import { chooseInteractionModel } from '../lib/adaptation';

function assertCapabilities(workspace:unknown,required:readonly string[]){
 const observed=inspectCapabilities(workspace,required);
 assert.equal(observed.valid,true);assert.deepEqual(observed.missing,[]);assert.equal(observed.dependenciesValid,true);assert.ok(observed.interactive>=2);
}

test('evaluation 1/5: scheduling conflict changes interaction model; eligible preview, confirmed commit and receipt survive reinspection',async()=>{
 const scenario=evaluationCases[0];
 const plan=planDemo(scenario.prompt);assertCapabilities(plan.workspace,scenario.capabilities);
 const storage=await mkdtemp(path.join(tmpdir(),'shadowui-eval-'));
 const before=process.env.SHADOWUI_DATA_DIR;process.env.SHADOWUI_DATA_DIR=storage;
 try{
  const id=`evaluation-${crypto.randomUUID()}`;
  let view=await createStoredSchedule(id,scenario.prompt);
  assert.equal(view.evaluation.valid,true);
  const affected=view.schedule.shifts.find(s=>s.employeeId&&s.date==='2026-10-21');assert.ok(affected);
  view=await updateSchedule(id,0,'availability',{type:'set_availability',employeeId:affected.employeeId!,date:affected.date,unavailable:true});
  assert.ok(view.evaluation.conflicts.some(c=>c.code==='UNAVAILABLE'));
  const model=chooseInteractionModel({objective:scenario.prompt,issueCount:view.evaluation.conflicts.length,hasPreview:false,committed:false});assert.equal(model.model,'resolution');
  await assert.rejects(()=>commitSchedule(id,view.schedule.revision,'blocked-commit',true),(e:unknown)=>e instanceof ScheduleError&&e.code==='CONFLICTS');
  const candidate=view.alternatives[affected.id]?.[0];assert.ok(candidate);assert.notEqual(candidate.employeeId,affected.employeeId);assert.equal(candidate.conflicts,0);
  const preview=await previewSchedule(id,view.schedule.revision,{type:'assign',shiftId:affected.id,employeeId:candidate.employeeId});assert.equal(preview.evaluation.valid,true);
  assert.equal((await inspectSchedule(id)).schedule.shifts.find(s=>s.id===affected.id)?.employeeId,affected.employeeId,'Preview cannot mutate persisted assignments');
  assert.equal(chooseInteractionModel({objective:scenario.prompt,issueCount:0,hasPreview:true,committed:false}).model,'review');
  view=await updateSchedule(id,view.schedule.revision,'apply',{type:'assign',shiftId:affected.id,employeeId:candidate.employeeId});
  await assert.rejects(()=>updateSchedule(id,0,'stale',{type:'set_min_days_off',value:3}),(e:unknown)=>e instanceof ScheduleError&&e.code==='STALE_REVISION');
  const committed=await commitSchedule(id,view.schedule.revision,'confirm',true);assert.equal(committed.schedule.status,'committed');assert.ok(committed.schedule.receipt?.id);
  assert.deepEqual((await inspectSchedule(id)).schedule.receipt,committed.schedule.receipt);
  const replay=await commitSchedule(id,view.schedule.revision,'confirm',true);assert.equal(replay.schedule.receipt?.id,committed.schedule.receipt?.id);
  assert.equal(chooseInteractionModel({objective:scenario.prompt,issueCount:0,hasPreview:false,committed:true}).model,'outcome');
 }finally{if(before===undefined)delete process.env.SHADOWUI_DATA_DIR;else process.env.SHADOWUI_DATA_DIR=before;await rm(storage,{recursive:true,force:true});}
});

test('evaluation 2/5: substantially tighter days-off constraints are recomputed rather than silently declared satisfied',()=>{
 let schedule=createSchedule('tightened','Shift coverage for six staff');
 const original=structuredClone(schedule);
 schedule=applyScheduleOperation(schedule,{type:'set_min_days_off',value:6});
 const view=scheduleView(schedule);assert.equal(view.evaluation.valid,false);assert.ok(view.evaluation.conflicts.some(c=>c.code==='DAYS_OFF'));
 assert.deepEqual(schedule.shifts,original.shifts,'Changing a rule preserves assignments for review');
 schedule=applyScheduleOperation(schedule,{type:'set_availability',employeeId:schedule.shifts[4].employeeId!,date:schedule.shifts[4].date,unavailable:true});
 const blocked=scheduleView(schedule);assert.ok(blocked.evaluation.conflicts.some(c=>c.code==='UNAVAILABLE'));
 for(const [shiftId,candidates]of Object.entries(blocked.alternatives))for(const candidate of candidates){
  const proposed=applyScheduleOperation(schedule,{type:'assign',shiftId,employeeId:candidate.employeeId});
  assert.equal(evaluateSchedule(proposed).conflicts.filter(c=>c.employeeId===candidate.employeeId).length,0);
 }
 assert.equal(original.minDaysOff,2,'Pure rule evaluation does not mutate input');
});

test('evaluation 3/5: another supported domain preserves completed work while adapting its time control',()=>{
 const scenario=evaluationCases[2],first=planDemo(scenario.prompt);assertCapabilities(first.workspace,scenario.capabilities);
 const list=first.workspace.components.find(c=>c.type==='checklist')!;list.items[0].done=true;
 const result=planDemo('Actually I only have one hour tonight',first.workspace);
 assert.equal(result.operation,'patch');assert.equal(result.workspace.id,first.workspace.id);assert.equal(result.workspace.components.find(c=>c.id===list.id)?.items[0].done,true);
 assert.equal(result.workspace.components.find(c=>c.type==='timer')?.value,60);
 const quiz=result.workspace.components.find(c=>c.type==='quiz')!;assert.ok(quiz.items.every(i=>i.answer&&i.options?.includes(i.answer)),'Quiz is evaluable from its structured answer/options');
});

test('evaluation 4/5: unfamiliar mixed goal composes independent affordances without turning into a staffing page',()=>{
 const scenario=evaluationCases[3],result=planDemo(scenario.prompt);assertCapabilities(result.workspace,scenario.capabilities);
 assert.equal(result.workspace.components.some(c=>c.type==='calendar'),false);
 assert.equal(result.workspace.components.find(c=>c.type==='slider')?.value,900);
 const comparison=result.workspace.components.find(c=>c.type==='comparison')!;assert.ok(comparison.criteria?.length);assert.ok(comparison.items.every(i=>i.scores&&comparison.criteria!.every(c=>Number.isFinite(i.scores![c.id]))));
 const chart=result.workspace.components.find(c=>c.type==='chart')!;assert.equal(chart.dependsOn,result.workspace.components.find(c=>c.type==='slider')?.id);
 assert.equal(chart.items.some(i=>/accommodation|hotel/i.test(i.label)),false,'Unrelated travel fixtures are not injected');
});

test('evaluation 5/5: unsupported external execution returns an honest local alternative and no execution receipt',()=>{
 const scenario=evaluationCases[4],result=planDemo(scenario.prompt);assertCapabilities(result.workspace,scenario.capabilities);
 assert.equal(localCapabilityBoundary(result.workspace),true);
 assert.equal('receipt'in result.workspace,false);assert.equal(result.mode,'demo');
 assert.ok(result.workspace.components.some(c=>c.type==='checklist'&&c.items.length>0));
 assert.equal(result.workspace.domain,undefined,'Unsupported bank/payment request cannot gain an executable scheduling binding');
});

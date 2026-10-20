import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runSimulation} from '../lib/simulated-workspace';
import {resolveBindings} from '../lib/data-bindings';
import {evaluateCustomTool} from '../lib/custom-tool';
import {evaluateRecord} from '../lib/record-tool';
import {workspaceReadiness} from '../lib/workspace-progress';
import {comparisonResults} from '../components/renderer-calculations';
import {paidRequest,liveScheduleIntent} from '../lib/openai-planner';
import {embedText,semanticScores} from '../lib/semantic-search';
import {GET,POST} from '../app/api/plan/route';
import {catalogDatabase} from '../lib/firebase-admin';
import type {Workspace} from '../lib/schema';
const session='00000000-0000-0000-0000-000000000061';
let dir:string;const oldDir=process.env.SHADOWUI_SIMULATION_DIR,oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY,oldEnabled=process.env.AI_ENABLED;let requests=0;
before(async()=>{dir=await mkdtemp(path.join(tmpdir(),'shadowui-simulation-'));process.env.SHADOWUI_SIMULATION_DIR=dir;process.env.AI_ENABLED='false';process.env.OPENAI_API_KEY='test-key-must-not-be-used';global.fetch=async()=>{requests++;throw new Error('Network must not be called');};});
after(async()=>{global.fetch=oldFetch;if(oldEnabled===undefined)delete process.env.AI_ENABLED;else process.env.AI_ENABLED=oldEnabled;if(oldDir===undefined)delete process.env.SHADOWUI_SIMULATION_DIR;else process.env.SHADOWUI_SIMULATION_DIR=oldDir;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;await rm(dir,{recursive:true,force:true});assert.equal(requests,0);});
async function workspace(prompt:string,current?:Workspace){const result=await runSimulation(prompt,current,session);assert.ok('workspace' in result&&result.workspace);return result.workspace;}
test('hard block covers model, schedule interpretation, embeddings and forged Live POST before any network request',async()=>{
 await assert.rejects(paidRequest('x','x',session,()=>({})),/disabled/);
 await assert.rejects(embedText('x',{session}),/disabled/);await assert.rejects(semanticScores('x',[],session),/disabled/);
 const response=await POST(new Request('http://localhost:3000/api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:'Create task',mode:'live'})}));assert.equal(response.status,403);
 const status=await GET(new Request('http://localhost:3000/api/plan'));assert.equal((await status.json()).simulation,true);
 assert.throws(()=>catalogDatabase(),/not configured/);assert.equal(requests,0);
});
test('budget edits update chart and remaining total; no completed task is inferred from available tools',async()=>{
 const w=await workspace('Create an event budget of 1000');const t=w.components.find(c=>c.id==='expenses')!;t.items=[{id:'venue',label:'Venue',value:300},{id:'food',label:'Food',value:200}];
 let r=resolveBindings(w,w.bindings);assert.deepEqual(r.errors,[]);assert.equal(evaluateCustomTool(r.workspace.components.find(c=>c.id==='balance')!.custom!)[0].value,500);assert.equal(r.workspace.components.find(c=>c.id==='expense_chart')!.items[0].value,300);
 t.items[0].value=450;r=resolveBindings(w,w.bindings);assert.equal(evaluateCustomTool(r.workspace.components.find(c=>c.id==='balance')!.custom!)[0].value,350);assert.equal(workspaceReadiness(w)!.complete,false);
});
test('inventory and emergency supply allocation keep unknown quantities unknown and recompute shortages',async()=>{
 for(const prompt of ['צור ניהול מלאי ציוד למתנדבים','Create flood response supplies allocation']){
 const w=await workspace(prompt),c=w.components.find(c=>c.recordTool)!;assert.ok(c);assert.equal(evaluateRecord(c.recordTool!,{})[0].value,null);
 c.items=[{id:'water',label:'Water',cells:{available:3,needed:8}}];assert.equal(evaluateRecord(c.recordTool!,c.items[0].cells)[0].value,5);assert.equal(evaluateRecord(c.recordTool!,c.items[0].cells)[1].value,3);
 c.items[0].cells!.available=10;assert.equal(evaluateRecord(c.recordTool!,c.items[0].cells)[0].value,0);assert.equal(evaluateRecord(c.recordTool!,c.items[0].cells)[1].value,8);
 }
});
test('study cards and quiz use supplied facts, absent source is unresolved',async()=>{
 const empty=await workspace('Create a study plan for an exam');assert.equal(workspaceReadiness(empty)!.ready,false);assert.equal(empty.components.some(c=>c.type==='quiz'),false);
 const w=await workspace('Help me study for exam source: ATP: energy; nucleus: DNA');assert.equal(w.components.find(c=>c.type==='flashcards')!.items[0].answer,'energy');const q=w.components.find(c=>c.type==='quiz')!.items[1];assert.equal(q.answer,'DNA');assert.ok(q.options!.includes(q.answer!));
 const follow=await workspace('Add source: ATP: energy; nucleus: DNA',empty);assert.equal(follow.id,empty.id);assert.ok(follow.components.some(c=>c.type==='quiz'));
});
test('comparison weights alter actual rankings rather than just labels',async()=>{
 const w=await workspace('Create a supplier comparison'),c=w.components.find(c=>c.type==='comparison')!;c.items[0].scores={benefit:100,fit:0};c.items[1].scores={benefit:0,fit:100};c.criteria![0].weight=80;c.criteria![1].weight=20;assert.equal(comparisonResults(c.items,c.criteria!)[0].id,'a');c.criteria![0].weight=20;c.criteria![1].weight=80;assert.equal(comparisonResults(c.items,c.criteria!)[0].id,'b');
});
test('new private calculator persists and is reused without leaking to another session; invalid arithmetic errors',async()=>{
 const w=await workspace('Create calculator rectangle area width 3 height 4'),c=w.components[0];assert.equal(evaluateCustomTool(c.custom!)[0].value,12);c.custom!.fields[0].value='8';assert.equal(evaluateCustomTool(c.custom!)[0].value,32);
 const second=await workspace('Create calculator rectangle area width 5 height 9');assert.equal(second.components[0].catalogRef!.definitionId,c.catalogRef!.definitionId);assert.equal(evaluateCustomTool(second.components[0].custom!)[0].value,45);
 const ratio=await workspace('Create a ratio calculator');ratio.components[0].custom!.fields[1].value='0';assert.match(evaluateCustomTool(ratio.components[0].custom!)[0].error!,/באפס/);
 const other=await runSimulation('Create calculator rectangle area width 1 height 2',undefined,'00000000-0000-0000-0000-000000000062');assert.ok('workspace' in other&&other.workspace);assert.notEqual(other.workspace.components[0].catalogRef!.definitionId,c.catalogRef!.definitionId);
});
test('document text and completed tasks survive supported followup; external data never completes',async()=>{
 const w=await workspace('Create document text: My supplied manuscript');const notes=w.components.find(c=>c.id==='document')!;assert.equal(notes.text,'My supplied manuscript');notes.text='My edited manuscript';const checklist=w.components.find(c=>c.type==='checklist')!;checklist.items=[{id:'fix',label:'Fix introduction',done:true}];
 const next=await workspace('Change budget to 500',w);assert.equal(next.components.find(c=>c.id==='document')!.text,'My edited manuscript');assert.equal(next.components.find(c=>c.type==='checklist')!.items[0].done,true);
 const ext=await workspace('Create a travel plan with current price and book flights');assert.equal(ext.taskReport!.complete,false);assert.ok(ext.taskReport!.missing.some(m=>m.capability==='external.retrieve'));assert.equal(workspaceReadiness(ext)!.complete,false);
});

test('followup adds a real notes component and changes a calculator budget while preserving expense data',async()=>{
 const w=await workspace('Create an event budget of 1000');w.components.find(c=>c.id==='expenses')!.items=[{id:'venue',label:'Venue',value:125}];
 const withNotes=await workspace('Add notes',w);assert.ok(withNotes.components.some(c=>c.id==='notes'));assert.ok(withNotes.taskContract!.actions.some(a=>a.componentId==='notes'));
 const changed=await workspace('Change budget to 600',withNotes);const resolved=resolveBindings(changed,changed.bindings);assert.equal(evaluateCustomTool(resolved.workspace.components.find(c=>c.id==='balance')!.custom!)[0].value,475);
});

test('calculator errors and unentered stock cells block result confirmation',async()=>{
 const w=await workspace('Create a ratio calculator');w.taskContract!.inputs=w.taskContract!.inputs.map(i=>({...i,available:true}));w.progress={completedActionIds:w.taskContract!.actions.map(a=>a.id),constraintsSatisfied:true,successCriteriaSatisfied:true};
 assert.equal(workspaceReadiness(w)!.complete,true);w.components[0].custom!.fields[1].value='0';assert.equal(workspaceReadiness(w)!.ready,false);assert.equal(workspaceReadiness(w)!.complete,false);
 const stock=await workspace('Create inventory equipment');stock.components[0].items=[{id:'water',label:'Water',cells:{available:5}}];assert.equal(workspaceReadiness(stock)!.ready,false);stock.components[0].items[0].cells!.needed=8;assert.equal(workspaceReadiness(stock)!.ready,true);
});

test('editing supplied study source updates derived cards and clears stale quiz grading without AI',async()=>{
 const {deriveStudyTools}=await import('../lib/study-source');const w=await workspace('Help me study source: ATP: energy; nucleus: DNA');const q=w.components.find(c=>c.type==='quiz')!;q.items[0]={...q.items[0],group:'energy',done:true,value:1};
 let derived=deriveStudyTools(w.components);assert.equal(derived.find(c=>c.type==='quiz')!.items[0].done,true);
 w.components.find(c=>c.id==='source')!.text='ATP: supplied revised definition; nucleus: DNA';derived=deriveStudyTools(w.components);assert.equal(derived.find(c=>c.type==='flashcards')!.items[0].answer,'supplied revised definition');const updated=derived.find(c=>c.type==='quiz')!.items[0];assert.equal(updated.answer,'supplied revised definition');assert.equal(updated.done,false);assert.equal(updated.group,undefined);
});

test('approved shared calculator is reused across users with supplied values mapped to sanitized fields',async()=>{
 const {composeSimulation}=await import('../lib/simulated-workspace');const {privateDefinition}=await import('../lib/task-pipeline');const {createReviewCandidate}=await import('../lib/component-review');const {seedDefinitions}=await import('../lib/catalog');
 const prompt='Create calculator rectangle area width 3 height 4',draft=composeSimulation(prompt);const privateTool=privateDefinition(draft.workspace.components[0],draft.contract,session,['calculate.area']);const shared={...createReviewCandidate(privateTool).definition,status:'active' as const};
 const result=await runSimulation(prompt,undefined,'00000000-0000-0000-0000-000000000099',[],{list:async()=>[...seedDefinitions(),shared],get:async id=>id===shared.id?shared:null,saveGenerated:async()=>{throw new Error('Shared reuse must not create another private definition');}});
 assert.ok('workspace' in result&&result.workspace);const c=result.workspace.components[0];assert.equal(c.catalogRef!.definitionId,shared.id);assert.equal(c.custom!.fields[0].id,'field_1');assert.equal(c.custom!.fields[0].value,'3');assert.equal(evaluateCustomTool(c.custom!)[0].value,12);assert.equal(workspaceReadiness(result.workspace)!.ready,true);
});

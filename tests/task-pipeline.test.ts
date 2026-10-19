import test from 'node:test';
import {AIError} from '../lib/ai-budget';
import assert from 'node:assert/strict';
import {runTaskPipeline,type PipelineDependencies} from '../lib/task-pipeline';
import {seedDefinitions,type ComponentDefinition} from '../lib/catalog';
import {demoTaskContract} from '../lib/task-engine';
import {resolveBindings} from '../lib/data-bindings';
import {recordInstanceEdit} from '../lib/instance-state';
import {WorkspaceSchema,type Workspace,type UIComponent} from '../lib/schema';
import type {TaskContract} from '../lib/task-contract';
const budget={spent:0,limit:1,warning:false};
const session='00000000-0000-0000-0000-000000000001';
function draft(components:UIComponent[]):Workspace{return WorkspaceSchema.parse({id:'workspace-fixture',title:'סביבת בדיקה',description:'נתונים סינתטיים',goal:'Personal task',components});}
function harness(contract:TaskContract,components:UIComponent[],initial=seedDefinitions()){
 const definitions=structuredClone(initial),saved:ComponentDefinition[]=[],calls={interpret:0,populate:0,semantics:0,get:0};
 const deps:PipelineDependencies={
  async interpret(){calls.interpret++;return {intent:'workspace_change',reply:'הכלים מוכנים לעריכה.',contract,budget,cached:false};},
  async populate(){calls.populate++;return {workspace:draft(structuredClone(components)),budget,cached:false};},
  async list(){return structuredClone(definitions);},
  async get(id,version){calls.get++;return structuredClone(definitions.find(d=>d.id===id&&(!version||d.version===version))??null);},
  async saveGenerated(input){const active={...structuredClone(input),status:'active' as const,version:2};saved.push(active);definitions.push(active);return {definition:active,validation:{valid:true,errors:[]}};},
  async semantics(){calls.semantics++;return {};},
 };
 return {deps,definitions,saved,calls};
}
function component(id:string){return structuredClone(seedDefinitions().find(d=>d.id===id)!.template);}
function week(){const c=component('weekly_schedule');c.weeklySchedule!.days[0].events=[{id:'event-one',title:'פגישה',start:'09:00',end:'10:00'}];return c;}

test('pipeline builds one timed week from its contract and pins the stored component version',async()=>{
 const c=week(),contract=demoTaskContract('Personal week',[c]);contract.actions[0].inputKind='schedule';const h=harness(contract,[c]);
 const result=await runTaskPipeline('Personal week',undefined,session,[],h.deps);
 assert.ok('workspace' in result&&result.workspace);assert.equal(result.operation,'create');assert.equal(result.workspace.components.length,1);
 assert.equal(result.coverage?.complete,true);assert.equal(result.validation?.valid,true);assert.deepEqual(result.workspace.components[0].catalogRef,{definitionId:'weekly_schedule',version:1});
 assert.equal(result.workspace.components[0].weeklySchedule!.days[0].events[0].start,'09:00');assert.deepEqual(h.calls,{interpret:1,populate:1,semantics:1,get:0});assert.equal(h.saved.length,0);
});
test('pipeline composes comparison, real formula, tasks, and a deterministic table-to-chart connection',async()=>{
 const components=['comparison','calculator','checklist','table','chart'].map(component);const table=components.find(c=>c.type==='table')!;table.items=[{id:'cost',label:'עלות נתונה',value:120}];
 const contract=demoTaskContract('Compare costs and track execution',components),h=harness(contract,components);
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);
 assert.ok('workspace' in result&&result.workspace);assert.equal(result.workspace.components.length,5);assert.equal(result.coverage?.covered.length,5);assert.equal(result.validation?.valid,true);
 assert.equal(result.workspace.bindings?.length,1);assert.equal(result.workspace.bindings![0].transform,'copy');const edited=structuredClone(result.workspace);edited.components.find(c=>c.type==='table')!.items[0].value=240;const bound=resolveBindings(edited,edited.bindings);assert.deepEqual(bound.errors,[]);assert.equal(bound.workspace.components.find(c=>c.type==='chart')!.items[0].value,240);assert.equal(h.calls.populate,1);assert.equal(h.calls.interpret,1);
});
test('missing calculation is sanitized, persisted privately, then selected again without a second creation',async()=>{
 const c=component('calculator');c.id='area-instance';c.title='שטח מלבן';c.custom!.fields[0].value='17';c.custom!.fields[1].value='23';c.custom!.purpose='Multiply rectangle dimensions';
 const contract=demoTaskContract('Compute rectangular area',[c]);contract.actions[0].capability='calculate.area';contract.actions[0].inputKind='custom';
 const h=harness(contract,[c]);const first=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);
 assert.ok('workspace' in first&&first.workspace);assert.equal(first.coverage?.complete,true);assert.equal(h.saved.length,1);assert.equal(h.saved[0].scope,'private');assert.equal(h.saved[0].ownerSession,session);assert.deepEqual(h.saved[0].examples,[]);
 assert.deepEqual(h.saved[0].template.custom!.fields.map(f=>f.value),['1','1']);assert.deepEqual(first.workspace.components[0].custom!.fields.map(f=>f.value),['17','23']);assert.equal(first.workspace.components[0].catalogRef?.version,2);
 const reused=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in reused&&reused.workspace);assert.equal(h.saved.length,1);assert.equal(reused.workspace.components[0].catalogRef?.definitionId,h.saved[0].id);assert.equal(h.calls.populate,2);
});
test('unsupported external action is reported unavailable without calling the component generator',async()=>{
 const c=component('approval'),contract=demoTaskContract('Send the payment',[c]);contract.actions[0].external=true;contract.actions[0].capability='payments.send';const h=harness(contract,[c]);
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.equal(result.operation,'reply');assert.equal(result.coverage?.complete,false);assert.match(result.explanation,/לא בוצעה/);assert.equal(h.calls.populate,0);assert.equal(h.saved.length,0);
});
test('invalid behavior gets exactly one repair and never persists a failed result',async()=>{
 const c=week();c.weeklySchedule!.days[0].events[0].end='08:00';const contract=demoTaskContract('Personal week',[c]);contract.actions[0].inputKind='schedule';const h=harness(contract,[c]);
 await assert.rejects(runTaskPipeline(contract.objective,undefined,session,[],h.deps),/after one repair/);assert.equal(h.calls.populate,2);assert.equal(h.saved.length,0);
});
test('focused repair can fix behavior without an extra interpretation or semantic request',async()=>{
 const c=week(),contract=demoTaskContract('Personal week',[c]);contract.actions[0].inputKind='schedule';const h=harness(contract,[c]);const feedback:string[]=[];
 h.deps.populate=async(_contract,_definitions,_current,_session,repair)=>{h.calls.populate++;const data=structuredClone(c);if(!repair)data.weeklySchedule!.days[0].events[0].end='08:00';else feedback.push(repair);return {workspace:draft([data]),budget,cached:false};};
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(result.validation?.valid,true);assert.equal(h.calls.populate,2);assert.equal(h.calls.interpret,1);assert.equal(h.calls.semantics,1);assert.match(feedback[0],/Repair only/);
});
test('followup preserves explicitly edited data and historical catalog pins across a catalog update',async()=>{
 const original=week(),edited=structuredClone(original);edited.weeklySchedule!.days[0].events[0].title='עריכה פרטית';const c=recordInstanceEdit(original,edited);c.catalogRef={definitionId:'weekly_schedule',version:1};
 const current=draft([c]),contract=demoTaskContract(current.goal,[original]);contract.actions[0].inputKind='schedule';const definitions=seedDefinitions();const historical=structuredClone(definitions.find(d=>d.id==='weekly_schedule')!);definitions.find(d=>d.id==='weekly_schedule')!.version=2;
 const h=harness(contract,[{...original,id:'changed-provider-id'}],definitions);h.deps.get=async(id,version)=>{h.calls.get++;return id===historical.id&&version===1?historical:null;};
 const result=await runTaskPipeline('Adjust the workspace',current,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(result.operation,'patch');assert.equal(result.workspace.id,current.id);assert.equal(result.workspace.components[0].weeklySchedule!.days[0].events[0].title,'עריכה פרטית');assert.deepEqual(result.workspace.components[0].catalogRef,{definitionId:'weekly_schedule',version:1});assert.equal(result.workspace.components[0].id,c.id);assert.equal(h.calls.get,1);
});

test('mixed local and unavailable external work presents useful tools plus explicit nonexecution without repair',async()=>{
 const c=component('checklist'),external=component('approval'),contract=demoTaskContract('Prepare tasks and send payment',[c,external]);contract.actions[1].external=true;contract.actions[1].capability='payments.send';const h=harness(contract,[c]);
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(result.workspace.components.length,1);assert.equal(result.coverage?.complete,false);assert.equal(result.coverage?.missing[0].actionId,contract.actions[1].id);assert.match(result.workspace.taskReport!.limitations.join(' '),/לא בוצעה/);assert.equal(h.calls.populate,1);assert.equal(h.saved.length,0);
});

test('explicit empty bindings preserves independent table and chart data',async()=>{
 const components=['table','chart'].map(component),contract=demoTaskContract('Independent data views',components),h=harness(contract,components);h.deps.populate=async()=>{h.calls.populate++;return {workspace:{...draft(components),bindings:[]},budget,cached:false};};
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.deepEqual(result.workspace.bindings,[]);assert.equal(h.calls.populate,1);
});
test('binding errors receive one focused repair before any generated definition is persisted',async()=>{
 const c=component('calculator');c.id='custom-area';const contract=demoTaskContract('Calculate area',[c]);contract.actions[0].capability='calculate.area';contract.actions[0].inputKind='custom';const h=harness(contract,[c]);
 h.deps.populate=async(_contract,_definitions,_current,_session,feedback)=>{h.calls.populate++;assert.equal(h.saved.length,0);return {workspace:{...draft([c]),bindings:feedback?[]:[{id:'bad-edge',source:{componentId:'missing',port:'items'},target:{componentId:c.id,port:'customField',fieldId:'quantity'},transform:'sum'}]},budget,cached:false};};
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(h.calls.populate,2);assert.equal(h.saved.length,1);assert.deepEqual(result.workspace.bindings,[]);
});
test('runtime binding division failures are repairable and never trigger a third population',async()=>{
 const c=component('calculator');c.id='formula';c.custom!.fields[0].value='2';c.custom!.fields[1].value='1';const slider=component('slider');slider.id='zero-source';slider.value=0;
 const contract=demoTaskContract('Bound local calculation',[c,slider]),defs=seedDefinitions(),trusted=defs.find(d=>d.id==='calculator')!;trusted.template.custom!.outputs[0].expression=['quantity','unitValue','/'];c.custom!.outputs[0].expression=['quantity','unitValue','/'];const h=harness(contract,[c,slider],defs);
 h.deps.populate=async()=>{h.calls.populate++;return {workspace:{...draft([c,slider]),bindings:[{id:'divide-zero',source:{componentId:slider.id,port:'value'},target:{componentId:c.id,port:'customField',fieldId:'unitValue'},transform:'copy'}]},budget,cached:false};};
 await assert.rejects(runTaskPipeline(contract.objective,undefined,session,[],h.deps),/after one repair.*binding/i);assert.equal(h.calls.populate,2);assert.equal(h.saved.length,0);
});
test('generated neutral defaults probe safe values without copying private instance values',async()=>{
 const c=component('calculator');c.custom!.fields[0].value='37';c.custom!.fields[1].value='43';c.custom!.outputs[0].expression=['quantity','unitValue','1','-','/'];const contract=demoTaskContract('Offset denominator',[c]);contract.actions[0].capability='calculate.offset_ratio';contract.actions[0].inputKind='custom';const h=harness(contract,[c]);
 const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(h.saved.length,1);assert.deepEqual(h.saved[0].template.custom!.fields.map(f=>f.value),['2','2']);assert.deepEqual(result.workspace.components[0].custom!.fields.map(f=>f.value),['37','43']);assert.equal(h.calls.populate,1);
});
test('all distinct historical versions remain selectable instead of the final pin replacing earlier pins',async()=>{
 const old=structuredClone(seedDefinitions().find(d=>d.id==='notes')!),newer=structuredClone(old);old.capabilities=['notes.edit'];old.actions=['notes.old'];newer.version=2;newer.capabilities=['notes.edit'];newer.actions=['notes.new'];newer.template.id='notes-new';
 const a={...structuredClone(old.template),id:'old-instance',catalogRef:{definitionId:'notes',version:1}},b={...structuredClone(newer.template),id:'new-instance',catalogRef:{definitionId:'notes',version:2}},contract=demoTaskContract('Text work',[a,b]);contract.actions[0].capability='notes.old';contract.actions[1].capability='notes.new';const current=draft([a,b]),h=harness(contract,[a,b],[newer]);h.deps.get=async(id,version)=>{h.calls.get++;return id==='notes'?(version===1?old:newer):null;};
 const result=await runTaskPipeline('Adjust wording',current,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(result.coverage?.complete,true);assert.deepEqual(result.workspace.components.map(c=>c.catalogRef?.version),[1,2]);assert.equal(h.calls.get,2);
});

test('missing collection form generates a validated private form with real editable fields and no fake calculations',async()=>{
 const c=component('calculator');c.custom!.outputs=[];c.custom!.fields=[{id:'contactName',label:'שם איש קשר',type:'text',value:'',options:[],min:null,max:null}];const contract=demoTaskContract('Collect contact details',[c]);contract.actions[0].capability='collect.contact_details';contract.actions[0].inputKind='custom';const h=harness(contract,[c]);const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(result.coverage?.complete,true);assert.equal(result.workspace.components[0].custom!.fields[0].type,'text');assert.deepEqual(result.workspace.components[0].custom!.outputs,[]);assert.equal(h.saved.length,1);
});

test('task interpretation schema failure gets one focused repair',async()=>{
 const c=component('calculator'),contract=demoTaskContract('Calculate supplied cost',[c]),h=harness(contract,[c]);const valid=h.deps.interpret;let attempts=0;h.deps.interpret=async(...args)=>{if(attempts++===0)throw new AIError(502,'Invalid JSON',new SyntaxError('Bad task JSON'));assert.ok(args[4]?.includes('validation'));return valid(...args);};const result=await runTaskPipeline(contract.objective,undefined,session,[],h.deps);assert.ok('workspace' in result&&result.workspace);assert.equal(attempts,2);assert.equal(h.calls.populate,1);
});
test('interpretation and behavior share one repair allowance',async()=>{
 const c=week(),contract=demoTaskContract('Timed week',[c]);contract.actions[0].inputKind='schedule';const h=harness(contract,[c]);c.weeklySchedule!.days[0].events[0].end='01:00';const valid=h.deps.interpret;let attempts=0;h.deps.interpret=async(...args)=>{if(attempts++===0)throw new AIError(502,'Invalid JSON',new SyntaxError('Bad task JSON'));return valid(...args);};await assert.rejects(runTaskPipeline(contract.objective,undefined,session,[],h.deps),/after one repair/);assert.equal(attempts,2);assert.equal(h.calls.populate,1);assert.equal(h.saved.length,0);
});

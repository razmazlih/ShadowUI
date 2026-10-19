import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDefinitions} from '../lib/catalog';
import {assembleTask,demoTaskContract,rankTaskCandidates} from '../lib/task-engine';
import {validateTaskInstances} from '../lib/task-instance-validation';

test('simple timed schedule is validated and pinned to catalog version',()=>{
 const definitions=seedDefinitions(),definition=definitions.find(d=>d.id==='weekly_schedule')!;
 const component=structuredClone(definition.template);component.weeklySchedule!.days[0].events=[{id:'event',title:'פגישה',start:'09:00',end:'10:00'}];
 const contract=demoTaskContract('לוז שבועי',[component]);contract.actions[0].inputKind='schedule';
 const assembly=assembleTask(contract,definitions,{componentData:[component]});
 assert.equal(assembly.components.length,1);assert.equal(assembly.components[0].type,'weekly_schedule');assert.deepEqual(assembly.components[0].catalogRef,{definitionId:'weekly_schedule',version:1});assert.equal(validateTaskInstances(contract,assembly).valid,true);
 assembly.components[0].weeklySchedule!.days[0].events[0].end='08:00';assert.equal(validateTaskInstances(contract,assembly).valid,false);
});
test('comparison, calculation and task tracking cover independent actions',()=>{
 const definitions=seedDefinitions(),components=definitions.filter(d=>['comparison','calculator','checklist'].includes(d.id)).map(d=>d.template);
 const contract=demoTaskContract('השוואה, עלויות ופעולות',[...components]);
 const assembly=assembleTask(contract,definitions,{componentData:components});const report=validateTaskInstances(contract,assembly);
 assert.equal(report.valid,true);assert.equal(report.checkedActions.length,3);assert.equal(assembly.components.length,3);
});
test('generic calculator cannot satisfy a task-specific algorithm',()=>{
 const definitions=seedDefinitions(),calc=definitions.find(d=>d.id==='calculator')!;
 const contract=demoTaskContract('תשלום הלוואה',[calc.template]);contract.actions[0].capability='calculate.loan_payment';
 const assembly=assembleTask(contract,definitions);assert.equal(assembly.coverage.complete,false);assert.equal(validateTaskInstances(contract,assembly).valid,false);
});
test('schema field mismatch excludes a candidate even when its capability and primitive match',()=>{
 const definitions=seedDefinitions(),contract=demoTaskContract('חשב',[definitions.find(d=>d.id==='calculator')!.template]);contract.actions[0].inputKind='custom';
 const candidate=structuredClone(definitions.find(d=>d.id==='calculator')!);candidate.inputSchema={type:'object',properties:{text:{type:'string'}}};
 assert.equal(rankTaskCandidates(contract,[candidate]).length,0);
});
test('comparison without usable criteria and invalid formula defaults fail instance validation',()=>{
 const definitions=seedDefinitions(),components=definitions.filter(d=>['calculator','comparison'].includes(d.id)).map(d=>d.template),contract=demoTaskContract('השווה וחשב',components);
 const assembly=assembleTask(contract,definitions);
 const calculator=assembly.components.find(c=>c.type==='custom')!;calculator.custom!.outputs[0].expression=['quantity','unitValue','/'];calculator.custom!.fields[1].value='0';
 const comparison=assembly.components.find(c=>c.type==='comparison')!;comparison.criteria![0].weight=0;
 const report=validateTaskInstances(contract,assembly);assert.equal(report.valid,false);assert.ok(report.errors.some(error=>error.includes('positive criterion weight')));assert.ok(report.errors.some(error=>error.includes('באפס')));
});
test('selection cannot silently point at a different definition version',()=>{
 const definitions=seedDefinitions(),contract=demoTaskContract('השווה',[definitions.find(d=>d.id==='comparison')!.template]);const assembly=assembleTask(contract,definitions);assembly.components[0].catalogRef!.version=2;
 assert.equal(validateTaskInstances(contract,assembly).valid,false);
});
test('multiple calculator instances match their algorithm and cannot override trusted expressions',()=>{
 const definitions=seedDefinitions(),generic=definitions.find(d=>d.id==='calculator')!;
 const specific=structuredClone(generic);specific.id='specific';specific.template.id='specific';specific.capabilities=['calculate.loan_payment'];specific.actions=['calculate.loan_payment'];specific.template.custom!.outputs[0].expression=['quantity','unitValue','+'];
 const input=structuredClone(specific.template);input.id='user-specific';input.catalogRef={definitionId:'specific',version:1};input.custom!.fields[0].value='8';input.custom!.outputs[0].expression=['quantity','unitValue','/'];
 const genericInput=structuredClone(generic.template);genericInput.id='user-generic';genericInput.custom!.fields[0].value='4';
 const contract=demoTaskContract('שני חישובים',[genericInput,input]);contract.actions[1].capability='calculate.loan_payment';
 const assembly=assembleTask(contract,[generic,specific],{componentData:[input,genericInput]});
 const selected=assembly.components.find(component=>component.catalogRef!.definitionId==='specific')!;assert.equal(selected.id,'user-specific');assert.equal(selected.custom!.fields[0].value,'8');assert.deepEqual(selected.custom!.outputs[0].expression,['quantity','unitValue','+']);
 const general=assembly.components.find(component=>component.catalogRef!.definitionId==='calculator')!;assert.equal(general.id,'user-generic');assert.equal(general.custom!.fields[0].value,'4');
});

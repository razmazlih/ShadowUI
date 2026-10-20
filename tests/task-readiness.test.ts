import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDefinitions} from '../lib/catalog';
import {assembleTask,demoTaskContract,evaluateTaskReadiness} from '../lib/task-engine';
import {evaluateCustomTool,CustomToolSchema} from '../lib/custom-tool';
import {resolveBindings} from '../lib/data-bindings';

test('capability coverage does not assert readiness or completion without inputs and evidence',()=>{
 const definitions=seedDefinitions(),contract=demoTaskContract('Record stock',[definitions.find(d=>d.id==='table')!.template]);
 contract.inputs=[{id:'stock',label:'Stock quantities',kind:'items',required:true,available:false}];
 const assembly=assembleTask(contract,definitions);
 assert.equal(assembly.coverage.complete,true);
 assert.equal(evaluateTaskReadiness(contract,assembly.coverage).ready,false);
 contract.inputs[0]={...contract.inputs[0],available:true,value:[]};
 assert.equal(evaluateTaskReadiness(contract,assembly.coverage).ready,true);
 assert.equal(evaluateTaskReadiness(contract,assembly.coverage).complete,false);
 assert.equal(evaluateTaskReadiness(contract,assembly.coverage,{completedActionIds:contract.actions.map(a=>a.id),constraintsSatisfied:true,successCriteriaSatisfied:true}).complete,true);
});
test('two same-capability datasets keep their own editable records',()=>{
 const definitions=seedDefinitions(),template=definitions.find(d=>d.id==='table')!.template;
 const components=['warehouse','shop'].map((id,index)=>({...structuredClone(template),id,items:[{id:'row',label:id,value:index+1}]}));
 const contract=demoTaskContract('Track two inventories',components);
 contract.actions.forEach((action,index)=>action.datasetId=components[index].id);
 const assembly=assembleTask(contract,definitions,{componentData:components});
 assert.deepEqual(assembly.components.map(c=>[c.id,c.items[0].label]),[['warehouse','warehouse'],['shop','shop']]);
 assert.notEqual(assembly.coverage.covered[0].instanceId,assembly.coverage.covered[1].instanceId);
});
test('bounded conditional arithmetic reacts to inputs and date differences use explicit epoch milliseconds',()=>{
 const tool=structuredClone(seedDefinitions().find(d=>d.id==='calculator')!.template.custom!);
 tool.outputs[0].expression=['quantity','2','gt','10','20','if'];
 tool.fields[0].value='3';assert.equal(evaluateCustomTool(tool)[0].value,10);
 tool.fields[0].value='1';assert.equal(evaluateCustomTool(tool)[0].value,20);
 tool.outputs[0].expression=['0','172800000','days_between'];assert.equal(evaluateCustomTool(tool)[0].value,2);
 tool.outputs[0].expression=['1','2','if'];assert.equal(CustomToolSchema.safeParse(tool).success,false);
});
test('filter and group bindings recompute from editable records without changing source',()=>{
 const template=seedDefinitions().find(d=>d.id==='table')!.template;
 const source={...structuredClone(template),id:'source',items:[{id:'a',label:'A',group:'urgent'},{id:'b',label:'B',group:'later'},{id:'c',label:'C',group:'urgent'}]};
 const workspace={components:[source,{...structuredClone(template),id:'filtered'},{...structuredClone(template),id:'counts'}]};
 const bindings=[{id:'filter',source:{componentId:'source',port:'items' as const},target:{componentId:'filtered',port:'items' as const},transform:'filter' as const,field:'group' as const,match:'urgent'},{id:'group',source:{componentId:'source',port:'items' as const},target:{componentId:'counts',port:'items' as const},transform:'group' as const,field:'group' as const}];
 const first=resolveBindings(workspace,bindings);assert.deepEqual(first.errors,[]);assert.equal(first.workspace.components[1].items.length,2);assert.deepEqual(first.workspace.components[2].items[0],{id:'group_0',label:'urgent',value:2});
 source.items[0].group='later';const next=resolveBindings(workspace,bindings);assert.equal(next.workspace.components[1].items.length,1);assert.equal(workspace.components[1].items.length,0);
});
test('explicit action instance selection cannot consume a different same-type dataset',()=>{
 const definitions=seedDefinitions(),template=definitions.find(d=>d.id==='table')!.template;
 const first={...structuredClone(template),id:'first',items:[{id:'a',label:'First'}]},second={...structuredClone(template),id:'second',items:[{id:'b',label:'Second'}]};
 const contract=demoTaskContract('Edit second dataset',[second]);contract.actions[0].componentId='second';
 const assembled=assembleTask(contract,definitions,{componentData:[first,second]});assert.equal(assembled.components[0].id,'second');assert.equal(assembled.components[0].items[0].label,'Second');
});
test('clarification blocks readiness and prerequisite progress is explicit',()=>{
 const definitions=seedDefinitions(),contract=demoTaskContract('Prepare then review',definitions.filter(d=>['table','approval'].includes(d.id)).map(d=>d.template));
 contract.subtasks[1].dependsOn=[contract.subtasks[0].id];contract.clarification='Which records?';
 const coverage=assembleTask(contract,definitions).coverage;
 const initial=evaluateTaskReadiness(contract,coverage);assert.equal(initial.ready,false);assert.deepEqual(initial.blockedSubtasks,[contract.subtasks[1].id]);
 delete contract.clarification;
 const next=evaluateTaskReadiness(contract,coverage,{completedActionIds:[contract.subtasks[0].actionIds[0]]});assert.equal(next.ready,true);assert.deepEqual(next.blockedSubtasks,[]);assert.equal(next.complete,false);
});

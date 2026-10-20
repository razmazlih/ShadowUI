import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTaskInterpretation,TaskInterpretationProviderSchema,populationFormat,learningPopulationFormat,reuseTaskData} from '../lib/task-ai';
import {demoTaskContract} from '../lib/task-engine';
import {seedDefinitions} from '../lib/catalog';
import {zodSchema} from 'ai';
function sample(){const contract=demoTaskContract('Capture supplied data',[seedDefinitions()[0].template]);return {intent:'workspace_change',reply:'Prepared for editing',contract:{...contract,clarification:null,actions:contract.actions.map(({datasetId:_,componentId:__,...a})=>({...a,inputKind:null,datasetId:null,componentId:null})),inputs:[{id:'count',label:'Count',kind:'number',required:true,available:true,valueJson:'3',binding:null}]}};}
test('strict task provider boundary normalizes JSON values and nullable optional fields',()=>{const parsed=parseTaskInterpretation(sample());assert.equal(parsed.contract!.inputs[0].value,3);assert.equal(parsed.contract!.actions[0].inputKind,undefined);assert.equal(parsed.contract!.clarification,undefined);assert.throws(()=>parseTaskInterpretation({...sample(),intent:'create_calculator'}));});
test('every task-provider object declares all properties required and denies extra keys',()=>{function visit(value:unknown){if(!value||typeof value!=='object')return;const node=value as Record<string,unknown>;if(node.type==='object'){assert.equal(node.additionalProperties,false);assert.deepEqual(new Set(node.required as string[]),new Set(Object.keys(node.properties as object)));}for(const child of Object.values(node))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);}visit(zodSchema(TaskInterpretationProviderSchema).jsonSchema);});
test('task provider rejects malformed supplied JSON and cyclic task dependencies',()=>{const input=sample();input.contract.inputs[0].valueJson='{bad';assert.throws(()=>parseTaskInterpretation(input));const cycle=sample();cycle.contract.subtasks[0].dependsOn=[cycle.contract.subtasks[0].id];assert.throws(()=>parseTaskInterpretation(cycle),/Cyclic/);});

test('provider carries stable dataset/component identity and missing-input edit bindings',()=>{
 const data=sample();Object.assign(data.contract.actions[0],{datasetId:'stock',componentId:'stock_table'});
 Object.assign(data.contract.inputs[0],{binding:{componentId:'stock_table',port:'customField',fieldId:'count'}});
 const task=parseTaskInterpretation(data).contract!;assert.equal(task.actions[0].datasetId,'stock');assert.equal(task.actions[0].componentId,'stock_table');assert.deepEqual(task.inputs[0].binding,{componentId:'stock_table',port:'customField',fieldId:'count'});
});
test('population response has strict required objects including custom and record definitions',()=>{
 let count=0;function visit(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const node=value as Record<string,unknown>;if(node.type==='object'){count++;assert.equal(node.additionalProperties,false);assert.deepEqual(new Set(node.required as string[]),new Set(Object.keys(node.properties as object)));}Object.values(node).forEach(visit);}
 visit(populationFormat.json_schema.schema);visit(learningPopulationFormat.json_schema.schema);assert.ok(count>15);
});
test('reuse never conflates independent components with the same renderer',()=>{
 const left=seedDefinitions().find(d=>d.template.type==='table')!.template;const a={...structuredClone(left),id:'a'},b={...structuredClone(left),id:'b'};
 const current={id:'w',title:'w',description:'',goal:'w',components:[a,b]};
 assert.deepEqual(reuseTaskData([b,a],current).map(c=>c.id),['b','a']);
});

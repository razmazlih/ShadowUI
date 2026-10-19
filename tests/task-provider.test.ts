import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTaskInterpretation,TaskInterpretationProviderSchema} from '../lib/task-ai';
import {demoTaskContract} from '../lib/task-engine';
import {seedDefinitions} from '../lib/catalog';
import {zodSchema} from 'ai';
function sample(){const contract=demoTaskContract('Capture supplied data',[seedDefinitions()[0].template]);return {intent:'workspace_change',reply:'Prepared for editing',contract:{...contract,clarification:null,actions:contract.actions.map(a=>({...a,inputKind:null})),inputs:[{id:'count',label:'Count',kind:'number',required:true,available:true,valueJson:'3'}]}};}
test('strict task provider boundary normalizes JSON values and nullable optional fields',()=>{const parsed=parseTaskInterpretation(sample());assert.equal(parsed.contract!.inputs[0].value,3);assert.equal(parsed.contract!.actions[0].inputKind,undefined);assert.equal(parsed.contract!.clarification,undefined);assert.throws(()=>parseTaskInterpretation({...sample(),intent:'create_calculator'}));});
test('every task-provider object declares all properties required and denies extra keys',()=>{function visit(value:unknown){if(!value||typeof value!=='object')return;const node=value as Record<string,unknown>;if(node.type==='object'){assert.equal(node.additionalProperties,false);assert.deepEqual(new Set(node.required as string[]),new Set(Object.keys(node.properties as object)));}for(const child of Object.values(node))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);}visit(zodSchema(TaskInterpretationProviderSchema).jsonSchema);});
test('task provider rejects malformed supplied JSON and cyclic task dependencies',()=>{const input=sample();input.contract.inputs[0].valueJson='{bad';assert.throws(()=>parseTaskInterpretation(input));const cycle=sample();cycle.contract.subtasks[0].dependsOn=[cycle.contract.subtasks[0].id];assert.throws(()=>parseTaskInterpretation(cycle),/Cyclic/);});

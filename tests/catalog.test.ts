import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDefinitions,validateDefinition,findCatalogCandidates,instantiateDefinition,ComponentDefinitionSchema} from '../lib/catalog';
test('catalog has unique varied validated definitions and explicit primitive schemas',()=>{
 const definitions=seedDefinitions();assert.equal(definitions.length,16);assert.equal(new Set(definitions.map(d=>d.id)).size,16);
 for(const definition of definitions){assert.deepEqual(validateDefinition(definition),{valid:true,errors:[]});assert.ok(definition.inputSchema.properties);assert.ok(definition.stateSchema.properties);assert.ok((definition.inputSchema.required as string[]).length);}
});
test('capability match excludes title-only candidates and instances are independent',()=>{
 const definitions=seedDefinitions();const candidates=findCatalogCandidates(definitions,{capabilities:['calculate.formula'],query:'weekly planner'});assert.equal(candidates.length,1);assert.equal(candidates[0].definition.id,'calculator');
 const instance=instantiateDefinition(candidates[0].definition,'my-calculator');instance.custom!.fields[0].value='20';assert.equal(candidates[0].definition.template.custom!.fields[0].value,'1');
});
test('capability spoof and broken default formulas cannot activate',()=>{
 const notes=seedDefinitions().find(d=>d.id==='notes')!;assert.equal(validateDefinition({...notes,capabilities:['calculate.formula']}).valid,false);
 const calculator=seedDefinitions().find(d=>d.id==='calculator')!;calculator.template.custom!.outputs[0].expression=['quantity','0','/'];assert.equal(validateDefinition(calculator).valid,false);
});
test('private definitions require ownership and shared definitions cannot retain owners',()=>{
 const definition=seedDefinitions()[0];assert.equal(ComponentDefinitionSchema.safeParse({...definition,scope:'private'}).success,false);assert.equal(ComponentDefinitionSchema.safeParse({...definition,ownerSession:'someone'}).success,false);
});

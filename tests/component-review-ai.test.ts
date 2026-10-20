import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReviewProposal} from '../lib/component-review-ai';
import {workspaceResponseFormat} from '../lib/ai-workspace';
import {seedDefinitions} from '../lib/catalog';

const source=()=>structuredClone(seedDefinitions().find(d=>d.template.type==='custom')!);
function provider(definition:ReturnType<typeof source>){
 const component=structuredClone(definition.template);
 return {workspace:{id:'review',title:'Synthetic review',description:'Review proposal',goal:'Edit reusable component',components:[{
 custom:null,recordTool:null,weeklySchedule:null,criteria:null,value:null,text:null,dependsOn:null,visibleWhen:null,...component,
 items:component.items.map(item=>({url:null,detail:null,value:null,done:null,date:null,group:null,answer:null,options:null,scores:null,cells:null,...item}))
 }]}};
}
test('review proposal is unsaved, preserves source metadata and never mutates before',()=>{
 const definition=source(),original=structuredClone(definition),data=provider(definition);
 data.workspace.components[0].title='מחשבון משופר';data.workspace.components[0].reason='הסבר חדש';
 const result=parseReviewProposal(definition,data);
 assert.deepEqual(definition,original);assert.deepEqual(result.before,original);
 assert.equal(result.after.name,'מחשבון משופר');assert.equal(result.after.description,'הסבר חדש');
 assert.equal(result.after.id,definition.id);assert.equal(result.after.version,definition.version);
 assert.equal(result.after.ownerSession,definition.ownerSession);assert.equal(result.after.status,definition.status);
 assert.equal(result.simulation,false);
});
test('review rejects changed primitive, changed component identity and multiple components',()=>{
 const definition=source();
 const renamed=provider(definition);renamed.workspace.components[0].id='replacement';assert.throws(()=>parseReviewProposal(definition,renamed),/identity/);
 const retyped=provider(definition);Object.assign(retyped.workspace.components[0],{type:'notes',custom:null,text:'Changed'});assert.throws(()=>parseReviewProposal(definition,retyped),/identity/);
 const multiple=provider(definition);multiple.workspace.components.push({...structuredClone(multiple.workspace.components[0]),id:'second'});assert.throws(()=>parseReviewProposal(definition,multiple),/identity/);
});
test('review rejects executable formulas and missing strict provider fields',()=>{
 const definition=source(),bad=provider(definition);
 bad.workspace.components[0].custom!.outputs[0].expression=['fetch(url)'];assert.throws(()=>parseReviewProposal(definition,bad));
 const missing=provider(definition);delete (missing.workspace.components[0] as Record<string,unknown>).recordTool;assert.throws(()=>parseReviewProposal(definition,missing));
});
test('review wire schema is strict and required recursively for every object',()=>{
 let count=0;function visit(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const node=value as Record<string,unknown>;if(node.type==='object'){count++;assert.equal(node.additionalProperties,false);assert.deepEqual(new Set(node.required as string[]),new Set(Object.keys(node.properties as object)));}Object.values(node).forEach(visit);}
 visit(workspaceResponseFormat.json_schema.schema);assert.ok(count>10);
});

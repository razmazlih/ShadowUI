import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDefinitions} from '../lib/catalog';
import {assembleTask,demoTaskContract} from '../lib/task-engine';
import {taskInstanceIdentityMap} from '../lib/task-pipeline';
import {type Workspace} from '../lib/schema';

test('reordered same-type dataset actions preserve their prior identities rather than array positions',()=>{
 const definitions=seedDefinitions(),table=definitions.find(d=>d.id==='table')!.template;
 const data=['warehouse','shop'].map(id=>({...structuredClone(table),id,items:[{id:'r',label:id}]}));
 const prior=demoTaskContract('Track inventory',data),old=assembleTask(prior,definitions,{componentData:data});
 const previous:Workspace={id:'workspace',title:'Inventory',description:'Two stores',goal:prior.objective,components:old.components,taskContract:prior,taskReport:{...old.coverage,limitations:[]}};
 const next=structuredClone(prior);next.actions.reverse();
 const assembly=assembleTask(next,definitions);
 const ids=taskInstanceIdentityMap(assembly,next,previous);
 assert.equal(ids.get(assembly.selections[0].instanceId),'shop');assert.equal(ids.get(assembly.selections[1].instanceId),'warehouse');
});
test('a new explicitly bound dataset never inherits another dataset edits',()=>{
 const definitions=seedDefinitions(),table=definitions.find(d=>d.id==='table')!.template;
 const prior=demoTaskContract('Old inventory',[{...structuredClone(table),id:'old'}]);
 const previous:Workspace={id:'workspace',title:'Inventory',description:'Old',goal:prior.objective,components:[{...structuredClone(table),id:'old'}],taskContract:prior};
 const next=demoTaskContract('New inventory',[{...structuredClone(table),id:'new'}]);
 const assembly=assembleTask(next,definitions);assert.equal(taskInstanceIdentityMap(assembly,next,previous).size,0);
});

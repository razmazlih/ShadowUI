import test from 'node:test';
import assert from 'node:assert/strict';
import {enforceWorkspaceBehavior,LEARNING_PLAN_POLICY} from '../lib/task-workspace-policy';
import {demoTaskContract,assembleTask} from '../lib/task-engine';
import {seedDefinitions} from '../lib/catalog';
import {validateTaskInstances} from '../lib/task-instance-validation';
const seeds=seedDefinitions();
const notes=structuredClone(seeds.find(d=>d.id==='notes')!.template);
for(const request of ['תכין תוכנית לימוד Backend עם תרגילים','בנה תכנית לימוד מסודרת','Create a backend development learning plan'])test(`learning plan requires interactive behaviors: ${request}`,()=>{
 const contract=enforceWorkspaceBehavior(demoTaskContract(request,[notes]),request);
 assert.ok(contract.actions.some(a=>a.capability==='timeline.edit'));assert.ok(contract.actions.some(a=>a.capability==='tasks.check'));
 assert.ok(contract.constraints.includes(LEARNING_PLAN_POLICY));
 const empty=assembleTask(contract,seeds);
 assert.equal(validateTaskInstances(contract,empty).valid,false);
 const filled=empty.components.map(c=>c.type==='timeline'?{...c,items:[{id:'foundation',label:'Learn HTTP requests'},{id:'api',label:'Build an API'}]}:c.type==='checklist'?{...c,items:[{id:'exercise',label:'Implement GET /health',done:false},{id:'project',label:'Add database-backed CRUD',done:false}]}:c);
 assert.equal(validateTaskInstances(contract,filled,empty.selections).valid,true);
 assert.equal(enforceWorkspaceBehavior(contract,request).actions.length,contract.actions.length);
});
test('an explicit document request remains a document',()=>{
 const contract=demoTaskContract('Write an article explaining backend development',[notes]);
 assert.deepEqual(enforceWorkspaceBehavior(contract,contract.objective),contract);
});

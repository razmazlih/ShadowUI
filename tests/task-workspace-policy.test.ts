import {learningContentProblems} from '../lib/response-quality';
import test from 'node:test';
import assert from 'node:assert/strict';
import {enforceWorkspaceBehavior,LEARNING_PLAN_POLICY} from '../lib/task-workspace-policy';
import {demoTaskContract,assembleTask} from '../lib/task-engine';
import {seedDefinitions} from '../lib/catalog';
import {validateTaskInstances} from '../lib/task-instance-validation';
const seeds=seedDefinitions();
const notes=structuredClone(seeds.find(d=>d.id==='notes')!.template);
for(const request of ['תכין תוכנית לימוד Backend עם תרגילים','בנה תכנית לימוד מסודרת','Create a backend development learning plan','ללמוד למבחן במבוא להסתברות','תלמד אותי מה זה api','Teach me what an API is'])test(`learning plan requires interactive behaviors: ${request}`,()=>{
 const contract=enforceWorkspaceBehavior(demoTaskContract(request,[notes]),request);
 assert.ok(contract.actions.some(a=>a.capability==='timeline.edit'));assert.ok(contract.actions.some(a=>a.capability==='tasks.check'));
 assert.ok(contract.constraints.includes(LEARNING_PLAN_POLICY));
 const empty=assembleTask(contract,seeds);
 assert.equal(validateTaskInstances(contract,empty).valid,false);
 const filled=empty.components.map(c=>c.type==='timeline'?{...c,items:[{id:'foundation',label:'Learn HTTP requests'},{id:'api',label:'Build an API'}]}:c.type==='checklist'?{...c,items:[{id:'exercise',label:'Implement GET /health',done:false},{id:'project',label:'Add database-backed CRUD',done:false}]}:c.type==='notes'?{...c,text:'P(A) is the number of favorable equally likely outcomes divided by the total. Example: a fair die has six outcomes; three are even, so P(even)=3/6=1/2.'}:c.type==='quiz'?{...c,items:[{id:'q1',label:'What is P(even) for a fair die?',options:['1/2','1/6'],answer:'1/2',detail:'Three of six equally likely outcomes are even: 3/6=1/2.'},{id:'q2',label:'What is P(rolling 6) for a fair die?',options:['1/2','1/6'],answer:'1/6',detail:'One of six equally likely outcomes is a six.'}]}:c);
 assert.equal(validateTaskInstances(contract,filled,empty.selections).valid,true);
 assert.equal(enforceWorkspaceBehavior(contract,request).actions.length,contract.actions.length);
});
test('an explicit document request remains a document',()=>{
 const contract=demoTaskContract('Write an article explaining backend development',[notes]);
 assert.deepEqual(enforceWorkspaceBehavior(contract,contract.objective),contract);
});

test('a topic-only timeline cannot pass as exam preparation',()=>{
 const request='ללמוד למבחן במבוא להסתברות';
 const contract=enforceWorkspaceBehavior(demoTaskContract(request,[notes]),request);
 const assembly=assembleTask(contract,seeds);
 const components=assembly.components.map(c=>c.type==='timeline'||c.type==='checklist'?{...c,items:[{id:'a',label:'Understand basic concepts'},{id:'b',label:'Practice examples'}]}:c);
 const report=validateTaskInstances(contract,components,assembly.selections);
 assert.equal(report.valid,false);
 assert.ok(report.errors.some(e=>e.includes('worked example')));
 assert.ok(report.errors.some(e=>e.includes('explanatory feedback')));
});

test('quiz instructions cannot pass as explanatory feedback',()=>{
 const quiz=structuredClone(seeds.find(d=>d.id==='quiz')!.template);
 quiz.items=[{id:'a',label:'What is API?',options:['Interface','Hardware'],answer:'Interface',detail:'בחר את התשובה הנכונה.'},{id:'b',label:'Which method reads data?',options:['GET','POST'],answer:'GET',detail:'Choose the correct answer.'}];
 assert.ok(learningContentProblems([{...notes,text:'A lesson with a concrete example.'},quiz]).some(problem=>problem.includes('explanatory feedback')));
 quiz.items=quiz.items.map(item=>({...item,detail:'The interface lets a client request data from a server using agreed rules.'}));
 assert.deepEqual(learningContentProblems([{...notes,text:'A lesson with a concrete example.'},quiz]),[]);
});

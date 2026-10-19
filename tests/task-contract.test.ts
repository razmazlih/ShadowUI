import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskContractSchema } from '../lib/task-contract';
import { demoTaskContract,assembleTask,rankTaskCandidates } from '../lib/task-engine';
import { seedDefinitions } from '../lib/catalog';
import { cosineSimilarity } from '../lib/semantic-search';
const definitions=()=>seedDefinitions();
const contract=()=>demoTaskContract('השווה והכן רשימת עבודה',definitions().filter(d=>['comparison','checklist'].includes(d.id)).map(d=>d.template));

test('contract validates references and rejects cyclic or missing dependencies',()=>{
 const task=contract();assert.equal(TaskContractSchema.safeParse(task).success,true);
 task.subtasks[0].dependsOn=[task.subtasks[1].id];task.subtasks[1].dependsOn=[task.subtasks[0].id];assert.equal(TaskContractSchema.safeParse(task).success,false);
 task.subtasks[1].dependsOn=['missing'];assert.equal(TaskContractSchema.safeParse(task).success,false);
});
test('contract rejects duplicate action IDs and untracked deliverables',()=>{
 const task=contract();task.actions[1].id=task.actions[0].id;assert.equal(TaskContractSchema.safeParse(task).success,false);
 const other=contract();other.deliverables[0].actionIds=['unknown'];assert.equal(TaskContractSchema.safeParse(other).success,false);
});
test('capability coverage selects complementary real tools and ignores title similarity',()=>{
 const task=contract(),defs=definitions();const result=assembleTask(task,defs,{semanticScores:{notes:1,comparison:-1}});
 assert.equal(result.coverage.complete,true);assert.equal(result.components.length,2);assert.deepEqual(new Set(result.components.map(c=>c.type)),new Set(['checklist','comparison']));
});
test('unsupported external action never passes semantic or local behavior filtering',()=>{
 const task=contract();task.actions[0].external=true;const result=assembleTask(task,definitions());assert.equal(result.coverage.complete,false);assert.equal(result.coverage.missing.length,1);assert.match(result.coverage.missing[0].reason,/אינה מחוברת/);
});
test('schema kind and invalid calculation exclude otherwise matching definitions',()=>{
 const task=contract();task.actions[0].inputKind='schedule';assert.equal(rankTaskCandidates(task,definitions()).some(c=>c.actionIds.includes(task.actions[0].id)),false);
});
test('instances retain supplied data without mutating reusable catalog templates',()=>{
 const task=contract(),defs=definitions(),component=structuredClone(defs.find(d=>d.id==='comparison')!.template);component.id='user-instance';component.items[0].label='מוצר מהמשתמש';
 const result=assembleTask(task,defs,{componentData:[component]});assert.equal(result.components.find(c=>c.type==='comparison')!.items[0].label,'מוצר מהמשתמש');assert.notEqual(defs.find(d=>d.id==='comparison')!.template.items[0].label,'מוצר מהמשתמש');
});
test('semantic cosine rejects invalid vectors and treats orthogonal vectors distinctly',()=>{
 assert.equal(cosineSimilarity([1,0],[1,0]),1);assert.equal(cosineSimilarity([1,0],[0,1]),0);assert.equal(cosineSimilarity([NaN],[1]),0);assert.equal(cosineSimilarity([1],[1,2]),0);
});

test('embedding search batches cache misses and never caches private definitions globally',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {semanticScores}=await import('../lib/semantic-search');
 const dir=await mkdtemp(join(tmpdir(),'shadowui-task-embeddings-'));
 const saved={key:process.env.OPENAI_API_KEY,state:process.env.AI_STATE_DIR,budget:process.env.AI_BUDGET_USD};const originalFetch=globalThis.fetch;
 process.env.OPENAI_API_KEY='test-key';process.env.AI_STATE_DIR=dir;process.env.AI_BUDGET_USD='1';
 const calls:string[][]=[];const values=new Map();
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));calls.push(body.input);return new Response(JSON.stringify({data:body.input.map((_:unknown,index:number)=>({index,embedding:Array.from({length:256},(_,i)=>i===0?1:0)})),usage:{total_tokens:100}}),{status:200});};
 const defs=[{id:'shared',version:1,name:'Shared',description:'Synthetic template',capabilities:['edit'],examples:[],scope:'shared'},{id:'private',version:1,name:'Private',description:'Private template',capabilities:['edit'],examples:[],scope:'private'}];
 const cache={async get(key:string){return values.get(key)??null;},async put(key:string,value:unknown){values.set(key,value);}};
 try{
  const result=await semanticScores('first task',defs,'test-session',cache);assert.equal(result['shared@1'],1);assert.equal(calls.length,1);assert.equal(calls[0].length,3);assert.equal(values.size,1);assert.match([...values.keys()][0],/^shared@1:/);
  await semanticScores('second task',defs,'test-session',cache);assert.equal(calls.length,2);assert.equal(calls[1].length,2);
 }finally{globalThis.fetch=originalFetch;for(const [key,value] of Object.entries({OPENAI_API_KEY:saved.key,AI_STATE_DIR:saved.state,AI_BUDGET_USD:saved.budget})){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(dir,{recursive:true,force:true});}
});

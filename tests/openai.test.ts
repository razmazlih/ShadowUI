import {test,after,before,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {livePlan,liveScheduleIntent} from '../lib/openai-planner';
import {transact,reserve,AIError} from '../lib/ai-budget';
import {planDemo} from '../lib/planner';
import {createSchedule} from '../lib/schedule';
const originalFetch=global.fetch;const oldKey=process.env.OPENAI_API_KEY;const oldDir=process.env.AI_STATE_DIR;const oldBudget=process.env.AI_BUDGET_USD;
let dir:string;before(async()=>{dir=await mkdtemp(path.join(tmpdir(),'shadowui-ai-test-'));});
let calls=0;
beforeEach(async()=>{await rm(dir,{recursive:true,force:true});process.env.AI_STATE_DIR=dir;process.env.AI_BUDGET_USD='4.5';process.env.OPENAI_API_KEY='test-not-a-real-key';calls=0;});
after(async()=>{global.fetch=originalFetch;for(const [key,value] of Object.entries({OPENAI_API_KEY:oldKey,AI_STATE_DIR:oldDir,AI_BUDGET_USD:oldBudget})){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(dir,{recursive:true,force:true});});
const workspace=planDemo('Help me study biology').workspace;
function mock(content:unknown,usage={prompt_tokens:1200,completion_tokens:900}){global.fetch=async(_url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,'gpt-4.1-mini');assert.ok(body.max_completion_tokens<=3500);assert.equal(body.store,false);assert.equal(body.messages.length,2);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage});};}
test('missing key sends no request and changes no budget',async()=>{delete process.env.OPENAI_API_KEY;global.fetch=async()=>{calls++;throw new Error('unexpected');};await assert.rejects(livePlan('test',undefined,'a'),/OPENAI_API_KEY/);assert.equal(calls,0);});
test('validated response, usage settlement, session-scoped cache and follow-up context',async()=>{
 mock({workspace});const a=await livePlan('study',undefined,'a');assert.equal(a.mode,'live');assert.equal(a.cached,false);assert.ok(Math.abs(a.budget.spent-0.00192)<1e-9);
 const b=await livePlan('study',undefined,'a');assert.equal(b.cached,true);assert.equal(calls,1);
 await livePlan('study',undefined,'b');assert.equal(calls,2);
 global.fetch=async(_url,init)=>{calls++;const context=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);assert.deepEqual(context.currentWorkspace,workspace);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({workspace})}}],usage:{prompt_tokens:100,completion_tokens:100}});};
 const follow=await livePlan('Make it one hour',workspace,'a');assert.equal(follow.operation,'patch');assert.equal(follow.workspace.id,workspace.id);
});
test('budget blocks before fetch, including reservation for an in-flight request',async()=>{
 await transact(l=>{l.spent=4.4999});mock({workspace});await assert.rejects(livePlan('study',undefined,'a'),(e:unknown)=>e instanceof AIError&&e.status===402);assert.equal(calls,0);
});
test('atomic local lock rejects concurrent reservation rather than overspend',async()=>{
 const results=await Promise.allSettled(Array.from({length:12},(_,i)=>transact(l=>reserve(l,String(i),1))));assert.ok(results.some(r=>r.status==='rejected'));assert.ok((await transact(l=>l.spent))<=4.5);
});
test('duplicate while running never sends second paid request',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);global.fetch=async()=>{calls++;await gate;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({workspace})}}]});};
 const first=livePlan('study',undefined,'a');while(!calls)await new Promise(r=>setTimeout(r,5));await assert.rejects(livePlan('study',undefined,'a'),/already running/);release();await first;assert.equal(calls,1);
});
test('network failure retains reservation and never auto-retries',async()=>{global.fetch=async()=>{calls++;throw new Error('network');};await assert.rejects(livePlan('study',undefined,'a'),/timed out/);assert.ok((await transact(l=>l.spent))>0);assert.equal(calls,1);await assert.rejects(livePlan('study',undefined,'a'),/already running/);assert.equal(calls,1);});
test('rate limit returns a safe error and releases uncharged reservation',async()=>{global.fetch=async()=>{calls++;return new Response('secret-provider-body',{status:429});};await assert.rejects(livePlan('study',undefined,'a'),(e:unknown)=>e instanceof AIError&&e.status===429&&!e.message.includes('secret'));assert.ok((await transact(l=>l.spent))<1e-9);assert.equal(calls,1);});
test('invalid or truncated output is never returned as a workspace',async()=>{mock({workspace:{components:[{type:'javascript'}]}});await assert.rejects(livePlan('study',undefined,'a'));assert.ok((await transact(l=>l.spent))>0);});
test('six requests per minute, corrupt ledger and oversized context fail closed',async()=>{
 for(let i=0;i<6;i++)await transact(l=>reserve(l,String(i),0.001));await assert.rejects(transact(l=>reserve(l,'7',0.001)),(e:unknown)=>e instanceof AIError&&e.status===429);
 await writeFile(path.join(dir,'budget.json'),'{"spent":null,"entries":{}}');mock({workspace});await assert.rejects(livePlan('study',undefined,'a'),/storage/);assert.equal(calls,0);
 await assert.rejects(livePlan('x'.repeat(27000),undefined,'a'),/context limit/);assert.equal(calls,0);
});
test('schedule intent returns validated preview operation and rejects invented IDs',async()=>{
 const schedule=createSchedule('schedule-test','six employees');mock({operation:{type:'set_min_days_off',value:3},explanation:'Three days off.'});const result=await liveScheduleIntent('Three days off',schedule,'a');assert.equal(result.operation?.type,'set_min_days_off');assert.equal(schedule.minDaysOff,2);
 mock({operation:{type:'assign',shiftId:'invented',employeeId:'maya'},explanation:'Assign Maya'});await assert.rejects(liveScheduleIntent('Assign Maya',schedule,'a'));assert.equal(schedule.revision,0);
});

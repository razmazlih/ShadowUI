import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPatches} from '../lib/patch';
import {planDemo} from '../lib/planner';
test('add, move, update, replace and remove preserve unrelated state',()=>{
 const original=planDemo('study biology').workspace;
 original.components[0].items[0].done=true;
 const first=original.components[0];
 const result=applyPatches(original,[{op:'add',component:{id:'extra',type:'notes',title:'Extra',reason:'Context',items:[],span:'normal'}},{op:'move',id:'extra',index:0},{op:'update',id:first.id,changes:{title:'Updated'}},{op:'replace',id:first.id,component:{...first,title:'Replaced',items:first.items.map(i=>({...i,done:false}))}},{op:'remove',id:'timer'}]);
 assert.equal(result.components[0].id,'extra');assert.equal(result.components.find(c=>c.id===first.id)?.items[0].done,true);assert.ok(!result.components.some(c=>c.id==='timer'));assert.ok(original.components.some(c=>c.id==='timer'));assert.equal(original.components[0].title,first.title);
});
test('invalid operations are atomic and cannot leave dangling bindings',()=>{const original=planDemo('Plan a trip on a budget').workspace;assert.throws(()=>applyPatches(original,[{op:'remove',id:'slider'}]));assert.ok(original.components.some(c=>c.id==='slider'));assert.throws(()=>applyPatches(original,[{op:'move',id:'missing',index:0}]));});
test('unknown component type and duplicate IDs are rejected',()=>{const w=planDemo('organize').workspace;assert.throws(()=>applyPatches(w,[{op:'add',component:w.components[0]}]));assert.throws(()=>applyPatches(w,JSON.parse('[{"op":"add","component":{"id":"x","type":"script"}}]')));});
test('candidate adaptation applies metadata and numeric edits while retaining completion',async()=>{const {applyCandidate}=await import('../lib/patch');const original=planDemo('study biology').workspace;original.components[0].items[0].done=true;const candidate=structuredClone(original);candidate.description='A new plan';candidate.components.find(c=>c.type==='timer')!.value=60;candidate.components[0].items[0].done=false;candidate.components.reverse();const result=applyCandidate(original,candidate);assert.equal(result.description,'A new plan');assert.equal(result.components.find(c=>c.type==='timer')?.value,60);assert.equal(result.components.find(c=>c.type==='checklist')?.items[0].done,true);assert.deepEqual(result.components.map(c=>c.id),candidate.components.map(c=>c.id));});

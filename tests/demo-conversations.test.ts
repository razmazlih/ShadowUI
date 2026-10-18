import test from 'node:test';
import assert from 'node:assert/strict';
import {demoConversations} from '../lib/demo-conversations';
import {WorkspaceSchema} from '../lib/schema';
test('ten ordered, complete fictional conversations have supported results',()=>{
 assert.equal(demoConversations.length,10);
 assert.equal(new Set(demoConversations.map(c=>c.id)).size,10);
 demoConversations.forEach((c,i)=>{
  assert.ok(c.id.startsWith('demo-'));
  assert.ok(c.messages.length>=4);
  assert.equal(c.messages[0].role,'user');
  assert.equal(c.messages.at(-1)?.role,'assistant');
  assert.ok(c.messages.every(m=>m.text.trim().length>10));
  assert.ok(WorkspaceSchema.safeParse(c.result).success,c.id);
  assert.equal(c.result.domain,undefined,'Fixtures must never mount scheduling services');
  if(i)assert.ok(Date.parse(demoConversations[i-1].at)>Date.parse(c.at));
 });
});

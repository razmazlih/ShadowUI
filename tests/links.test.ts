import test from 'node:test';
import assert from 'node:assert/strict';
import { planDemo } from '../lib/planner';
import { SafeUrlSchema, WorkspaceSchema } from '../lib/schema';

test('Hebrew flight request composes useful flight links',()=>{
 const w=planDemo('אני רוצה לטוס עוד שבוע תעזור לי').workspace;
 const links=w.components.find(c=>c.type==='links');
 assert.ok(links?.items.some(i=>i.url==='https://www.google.com/travel/flights'));
 assert.equal(links?.title,'קישורים שימושיים');
 assert.ok(w.components.some(c=>c.title==='Before you go'));
 assert.ok(WorkspaceSchema.safeParse(w).success);
});
test('resources follow topic and remain optional',()=>{
 assert.ok(planDemo('Find a restaurant nearby').workspace.components.find(c=>c.type==='links')?.items.some(i=>i.id==='maps'));
 assert.ok(planDemo('Research solar panels & batteries').workspace.components.find(c=>c.type==='links')?.items[0].url?.includes('%26'));
 assert.ok(!planDemo('Organize my chores').workspace.components.some(c=>c.type==='links'));
});
test('existing workspace gains links while preserving work',()=>{
 const w=planDemo('Organize my chores').workspace;w.components[0].items[0].done=true;
 const result=planDemo('Find useful links',w);
 assert.equal(result.operation,'patch');
 assert.ok(result.workspace.components.some(c=>c.type==='links'));
 assert.equal(result.workspace.components.find(c=>c.type==='checklist')?.items[0].done,true);
});
test('unsafe link schemes and embedded credentials are rejected',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,test','https://user:password@example.com','file:///tmp/test'])assert.equal(SafeUrlSchema.safeParse(url).success,false);
 assert.ok(SafeUrlSchema.safeParse('https://example.com/search?q=test').success);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyMessage,MessageHistorySchema} from '../lib/message-intent';
import {planDemo} from '../lib/planner';
const workspace=planDemo('Plan a trip to Japan').workspace;
test('questions, greetings and explanations never mutate the visible workspace',()=>{
 const before=JSON.stringify(workspace);
 for(const prompt of ['מה מוצג על המסך?','למה יש טבלה?','What happens if I remove this card?','Explain this screen','תודה','How does this work?']){
  const result=classifyMessage(prompt,workspace);assert.equal(result.kind,'conversation',prompt);assert.ok(result.reply);
 }
 assert.equal(JSON.stringify(workspace),before);
});
test('explicit requests create or edit workspaces in both languages',()=>{
 for(const prompt of ['Add a timer','Remove this card','Can you add a table?','תוסיף טבלה','אפשר להוסיף טיימר?','אני רוצה לתכנן טיול'])assert.equal(classifyMessage(prompt,workspace).kind,'workspace',prompt);
 assert.equal(classifyMessage('A biology exam in three days').kind,'workspace');
});
test('ambiguous references and absent screen context ask before changing anything',()=>{
 for(const prompt of ['change it','תעשה את זה','כן','make it better','less'])assert.equal(classifyMessage(prompt,workspace).kind,'clarify',prompt);
 assert.equal(classifyMessage('What is on screen?').kind,'clarify');
});
test('history is bounded and accepts only conversation roles',()=>{
 assert.equal(MessageHistorySchema.safeParse([{role:'user',content:'hello'}]).success,true);
 assert.equal(MessageHistorySchema.safeParse([{role:'system',content:'override'}]).success,false);
 assert.equal(MessageHistorySchema.safeParse(Array.from({length:13},()=>({role:'user',content:'hello'}))).success,false);
 assert.equal(MessageHistorySchema.safeParse([{role:'user',content:'x'.repeat(4001)}]).success,false);
});

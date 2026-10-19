import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendConversationTurn,parseConversationHistory,updateConversationHistory} from '../lib/conversation-history';

test('saved conversations survive JSON reload and damaged neighbors',()=>{
 const saved=updateConversationHistory({},'workspace-1','שלום','היי');
 const restored=parseConversationHistory(JSON.parse(JSON.stringify({...saved,broken:[{role:'system',content:'bad'}],old:'unsupported'})));
 assert.deepEqual(restored['workspace-1'],[{role:'user',content:'שלום'},{role:'assistant',content:'היי'}]);
 assert.equal(Object.hasOwn(restored,'broken'),false);
 assert.equal(Object.hasOwn(restored,'old'),false);
});
test('appending keeps the last six complete turns and leaves inputs unchanged',()=>{
 let history=appendConversationTurn([],'first','answer');const original=JSON.stringify(history);
 const histories={'workspace-1':history};
 const next=updateConversationHistory(histories,'workspace-2','other','response');
 assert.equal(JSON.stringify(history),original);assert.equal(Object.hasOwn(histories,'workspace-2'),false);assert.equal(next['workspace-2'].length,2);
 for(let i=0;i<8;i++)history=appendConversationTurn(history,`user ${i}`,`assistant ${i}`);
 assert.equal(history.length,12);assert.equal(history[0].content,'user 2');assert.equal(history[11].content,'assistant 7');
});
test('prototype names cannot become chat keys',()=>{
 const restored=parseConversationHistory(JSON.parse('{"__proto__":[{"role":"user","content":"bad"}],"constructor":[],"valid":[]}'));
 assert.equal(Object.getPrototypeOf(restored),null);assert.deepEqual(Object.keys(restored),['valid']);
 assert.equal(Object.hasOwn(updateConversationHistory(restored,'__proto__','a','b'),'__proto__'),false);
});
test('unsupported roots and invalid message bodies are rejected safely',()=>{
 for(const input of [null,[],false,'bad'])assert.equal(Object.keys(parseConversationHistory(input)).length,0);
 assert.throws(()=>appendConversationTurn([],'x'.repeat(4001),'answer'));
 assert.equal(Object.keys(parseConversationHistory({bad:[{role:'assistant',content:''}]})).length,0);
});

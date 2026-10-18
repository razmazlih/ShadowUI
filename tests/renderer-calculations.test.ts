import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonResults, scheduleFacts } from '../components/renderer-calculations';
test('comparison normalizes criteria weights and updates ranking',()=>{
 const options=[{id:'a',label:'A',scores:{cost:100,return:0}},{id:'b',label:'B',scores:{cost:20,return:90}}];
 const results=comparisonResults(options,[{id:'cost',label:'Cost',weight:25},{id:'return',label:'Return',weight:75}]);
 assert.equal(results[0].id,'b');assert.equal(results[0].score,72.5);
 assert.equal(comparisonResults(options,[{id:'cost',label:'Cost',weight:100}])[0].id,'a');
 assert.equal(comparisonResults(options,[{id:'cost',label:'Cost',weight:0}])[0].score,0);
});
test('schedule counts distinct working days and surfaces duplicate assignments',()=>{
 const items=Array.from({length:6},(_,i)=>({id:String(i),label:'Shift',group:'Maya',date:`2026-10-${19+i}`}));
 items.push({id:'duplicate',label:'Late shift',group:'Maya',date:'2026-10-19'});
 const facts=scheduleFacts(items);
 assert.equal(facts.weekStart,'2026-10-19');assert.equal(facts.daysOff[0].daysOff,1);assert.equal(facts.conflicts.length,1);
});
test('unassigned shifts are counted without inventing employee availability',()=>{
 const facts=scheduleFacts([{id:'a',label:'Open shift',date:'2026-10-19',group:'unassigned'}]);
 assert.equal(facts.unassigned,1);assert.equal(facts.daysOff.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {recordInstanceEdit,preserveInstanceEdits} from '../lib/instance-state';
import {seedDefinitions} from '../lib/catalog';
const component=(id:string)=>structuredClone(seedDefinitions().find(definition=>definition.id===id)!.template);

test('text, values and keyed row edits persist while untouched server fields update',()=>{
 const before=component('table');before.items=[{id:'a',label:'A',value:1},{id:'b',label:'B',value:2}];
 const edited=structuredClone(before);edited.items[0].label='עריכה';edited.items[0].value=7;
 const recorded=recordInstanceEdit(before,edited),incoming=structuredClone(before);incoming.title='Updated title';incoming.items.reverse();incoming.items.find(item=>item.id==='b')!.value=9;
 const result=preserveInstanceEdits(recorded,incoming);assert.equal(result.title,'Updated title');assert.equal(result.items.find(item=>item.id==='a')!.label,'עריכה');assert.equal(result.items.find(item=>item.id==='a')!.value,7);assert.equal(result.items.find(item=>item.id==='b')!.value,9);
 const note=component('notes'),changedNote=recordInstanceEdit(note,{...note,text:'local text'});assert.equal(preserveInstanceEdits(changedNote,{...note,text:'remote text'}).text,'local text');
});
test('user additions and deletions survive incoming array changes',()=>{
 const before=component('checklist');before.items=[{id:'a',label:'Delete me'},{id:'b',label:'Keep me'}];const next=structuredClone(before);next.items=[{id:'b',label:'Keep me'},{id:'local',label:'Added locally'}];
 const recorded=recordInstanceEdit(before,next),incoming=structuredClone(before);incoming.items.push({id:'remote',label:'Added remotely'});
 const result=preserveInstanceEdits(recorded,incoming);assert.deepEqual(new Set(result.items.map(item=>item.id)),new Set(['b','local','remote']));
});
test('schedule times and date-keyed days survive incoming order and label updates',()=>{
 const before=component('weekly_schedule');before.weeklySchedule!.days[0].events=[{id:'e/1',title:'פגישה',start:'09:00',end:'10:00'}];
 const edited=structuredClone(before);edited.weeklySchedule!.days[0].events[0].start='09:30';const recorded=recordInstanceEdit(before,edited),incoming=structuredClone(before);incoming.weeklySchedule!.days[0].events[0].title='כותרת מעודכנת';
 const result=preserveInstanceEdits(recorded,incoming);assert.equal(result.weeklySchedule!.days[0].events[0].start,'09:30');assert.equal(result.weeklySchedule!.days[0].events[0].title,'כותרת מעודכנת');assert.ok(recorded.editedPaths!.some(path=>path.includes('e%2F1')));
});
test('catalog refs remain pinned and metadata updates do not become user edits',()=>{
 const before=component('slider');before.catalogRef={definitionId:'slider',version:1};const changed=recordInstanceEdit(before,{...before,value:42,catalogRef:{definitionId:'slider',version:2}});assert.deepEqual(changed.editedPaths,['/value']);
 const restored=preserveInstanceEdits({...changed,catalogRef:before.catalogRef},{...before,value:0,catalogRef:{definitionId:'slider',version:3}});assert.deepEqual(restored.catalogRef,before.catalogRef);assert.equal(restored.value,42);
});
test('instance identity or primitive changes do not transfer local edits',()=>{
 const before=component('notes'),edited=recordInstanceEdit(before,{...before,text:'Private'});
 assert.equal(preserveInstanceEdits(edited,{...before,id:'different',text:'New'}).text,'New');assert.equal(preserveInstanceEdits(edited,{...before,type:'table',text:'Other'}).text,'Other');
});
test('comparison scores and custom field values use stable IDs through reordering',()=>{
 const compare=component('comparison'),edited=structuredClone(compare);edited.items[0].scores!.fit=80;
 const incoming=structuredClone(compare);incoming.items.reverse();assert.equal(preserveInstanceEdits(recordInstanceEdit(compare,edited),incoming).items.find(item=>item.id==='a')!.scores!.fit,80);
 const custom=component('calculator'),local=structuredClone(custom);local.custom!.fields[0].value='8';const next=structuredClone(custom);next.custom!.fields.reverse();assert.equal(preserveInstanceEdits(recordInstanceEdit(custom,local),next).custom!.fields.find(field=>field.id==='quantity')!.value,'8');
});

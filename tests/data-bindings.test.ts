import test from 'node:test';
import assert from 'node:assert/strict';
import {bindingOrder,resolveBindings,withoutIdentityCopies,type DataBinding} from '../lib/data-bindings';
import {seedDefinitions} from '../lib/catalog';
import {evaluateCustomTool} from '../lib/custom-tool';
const components=()=>seedDefinitions().filter(d=>['table','calculator','slider','notes','chart'].includes(d.id)).map(d=>({...structuredClone(d.template),id:d.id}));
const bind=(id:string,source:string,sourcePort:DataBinding['source']['port'],target:string,targetPort:DataBinding['target']['port'],transform:DataBinding['transform']='copy',extra:Partial<DataBinding>={}):DataBinding=>({id,source:{componentId:source,port:sourcePort},target:{componentId:target,port:targetPort},transform,...extra});
test('sum to custom field then formula output recalculates in topological order',()=>{
 const nodes=components(),table=nodes.find(c=>c.id==='table')!;table.items=[{id:'a',label:'A',value:3},{id:'b',label:'B',value:4}];nodes.find(c=>c.id==='calculator')!.custom!.fields[1].value='2';
 const bindings=[bind('output','calculator','customOutput','slider','value','copy',{source:{componentId:'calculator',port:'customOutput',fieldId:'total'}}),bind('input','table','items','calculator','customField','sum',{target:{componentId:'calculator',port:'customField',fieldId:'quantity'}})];
 const result=resolveBindings({components:nodes},bindings);assert.deepEqual(result.errors,[]);assert.equal(result.workspace.components.find(c=>c.id==='slider')!.value,14);assert.equal(nodes.find(c=>c.id==='slider')!.value,0);
 table.items[0].value=10;assert.equal(resolveBindings({components:nodes},bindings).workspace.components.find(c=>c.id==='slider')!.value,28);
});
test('copy items, project field and count produce usable data',()=>{
 const nodes=components();nodes.find(c=>c.id==='table')!.items=[{id:'a',label:'A',value:3}];
 let result=resolveBindings({components:nodes},[bind('copy','table','items','chart','items')]);assert.deepEqual(result.workspace.components.find(c=>c.id==='chart')!.items,[{id:'a',label:'A',value:3}]);
 result=resolveBindings({components:nodes},[bind('projection','table','items','chart','items','project',{field:'value'}),bind('count','chart','items','slider','value','count')]);assert.deepEqual(result.errors,[]);assert.equal(result.workspace.components.find(c=>c.id==='chart')!.items[0].label,'3');assert.equal(result.workspace.components.find(c=>c.id==='slider')!.value,1);
});
test('schema mismatch, cycles and multiple writers are rejected',()=>{
 const nodes=components();assert.throws(()=>bindingOrder(nodes,[bind('bad','notes','text','slider','value')]),/incompatible/);
 assert.throws(()=>bindingOrder(nodes,[bind('a','table','items','chart','items'),bind('b','chart','items','table','items')]),/cycle/);
 assert.throws(()=>bindingOrder(nodes,[bind('a','table','items','slider','value','sum'),bind('b','chart','items','slider','value','count')]),/Multiple writers/);
});
test('invalid numeric values and overflow surface errors and clear stale target output',()=>{
 const nodes=components();nodes.find(c=>c.id==='table')!.items=[{id:'a',label:'A'}];nodes.find(c=>c.id==='slider')!.value=99;
 let result=resolveBindings({components:nodes},[bind('sum','table','items','slider','value','sum')]);assert.equal(result.errors.length,1);assert.equal(result.workspace.components.find(c=>c.id==='slider')!.value,undefined);
 nodes.find(c=>c.id==='table')!.items=[{id:'a',label:'A',value:Number.MAX_VALUE},{id:'b',label:'B',value:Number.MAX_VALUE}];result=resolveBindings({components:nodes},[bind('sum','table','items','slider','value','sum')]);assert.match(result.errors[0].message,/finite/);
});
test('upstream binding failure invalidates downstream formula fields and values',()=>{
 const nodes=components();nodes.find(c=>c.id==='table')!.items=[{id:'bad',label:'Missing number'}];nodes.find(c=>c.id==='slider')!.value=99;
 const bindings=[bind('input','table','items','calculator','customField','sum',{target:{componentId:'calculator',port:'customField',fieldId:'quantity'}}),bind('output','calculator','customOutput','slider','value','copy',{source:{componentId:'calculator',port:'customOutput',fieldId:'total'}})];
 const result=resolveBindings({components:nodes},bindings);assert.equal(result.errors.length,2);assert.equal(result.workspace.components.find(c=>c.id==='slider')!.value,undefined);assert.ok(evaluateCustomTool(result.workspace.components.find(c=>c.id==='calculator')!.custom!).some(output=>output.error));
});
test('missing source number and missing projected field cannot silently become valid output',()=>{
 const nodes=components();delete nodes.find(c=>c.id==='slider')!.value;
 const timer={...structuredClone(seedDefinitions().find(d=>d.id==='timer')!.template),id:'timer'};nodes.push(timer);
 const result=resolveBindings({components:nodes},[bind('copy','slider','value','timer','value')]);assert.equal(result.errors.length,1);assert.equal(result.workspace.components.find(c=>c.id==='timer')!.value,undefined);
 nodes.find(c=>c.id==='table')!.items=[{id:'a',label:'A'}];assert.equal(resolveBindings({components:nodes},[bind('project','table','items','chart','items','project',{field:'date'})]).errors.length,1);
});

test('identity copies are omitted while real cycles and self transforms remain invalid',()=>{
 const nodes=components();
 const noops=[bind('items','table','items','table','items'),bind('text','notes','text','notes','text')];
 assert.deepEqual(withoutIdentityCopies(noops),[]);
 const cycle=[bind('a','table','items','chart','items'),bind('b','chart','items','table','items')];
 assert.throws(()=>bindingOrder(nodes,withoutIdentityCopies(cycle)),/cycle/);
 const transform=bind('projection','table','items','table','items','project',{field:'value'});
 assert.equal(withoutIdentityCopies([transform]).length,1);
 assert.throws(()=>bindingOrder(nodes,withoutIdentityCopies([transform])),/cycle/);
});

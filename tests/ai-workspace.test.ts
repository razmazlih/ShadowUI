import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceResponseFormat,parseAIWorkspace} from '../lib/ai-workspace';
import {WorkspaceSchema} from '../lib/schema';

function fixture(){return {workspace:{id:'workspace',title:'Trip',description:'Estimated itinerary',goal:'Plan a trip',components:[{
 id:'plan',type:'checklist',title:'Plan',reason:'Prepare the trip',span:'normal',
 custom:null,criteria:null,value:null,text:null,dependsOn:null,visibleWhen:null,
 items:[{id:'book',label:'Choose dates',url:null,detail:null,value:null,done:null,date:null,group:null,answer:null,options:null,scores:null}]
}]}};}

test('strict provider schema requires every declared property and disallows arbitrary properties',()=>{
 assert.equal(workspaceResponseFormat.type,'json_schema');
 assert.equal(workspaceResponseFormat.json_schema.strict,true);
 let objects=0;
 function visit(node:unknown){
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const child of node)visit(child);return;}
  const schema=node as Record<string,unknown>;
  if(schema.type==='object'){
   objects++;
   assert.equal(schema.additionalProperties,false);
   assert.deepEqual([...(schema.required as string[])].sort(),Object.keys(schema.properties as object).sort());
  }
  for(const child of Object.values(schema))visit(child);
 }
 visit(workspaceResponseFormat.json_schema.schema);
 assert.ok(objects>=6,'inspects nested item, score, criterion, and condition objects');
});

test('nullable provider fields become omitted canonical optional fields',()=>{
 const workspace=parseAIWorkspace(fixture());
 assert.deepEqual(WorkspaceSchema.parse(workspace),workspace);
 const component=workspace.components[0];
 assert.deepEqual(Object.keys(component).sort(),['id','items','reason','span','title','type']);
 assert.deepEqual(component.items,[{id:'book',label:'Choose dates'}]);
});

test('score arrays convert to records and duplicate criterion scores are rejected',()=>{
 const data=fixture();
 Object.assign(data.workspace.components[0],{criteria:[{id:'cost',label:'Cost',weight:60}]});
 Object.assign(data.workspace.components[0].items[0],{scores:[{criterionId:'cost',score:85}]});
 assert.deepEqual(parseAIWorkspace(data).components[0].items[0].scores,{cost:85});
 Object.assign(data.workspace.components[0].items[0],{scores:[{criterionId:'cost',score:85},{criterionId:'cost',score:20}]});
 assert.throws(()=>parseAIWorkspace(data),/Duplicate criterion scores/);
});

test('unknown properties, invalid types, and missing provider fields fail before normalization',()=>{
 const unknown=fixture();Object.assign(unknown.workspace.components[0].items[0],{html:'<b>unsafe</b>'});
 assert.throws(()=>parseAIWorkspace(unknown));
 const wrongType=fixture();Object.assign(wrongType.workspace.components[0].items[0],{done:'yes'});
 assert.throws(()=>parseAIWorkspace(wrongType));
 const missing=fixture();delete (missing.workspace.components[0] as Record<string,unknown>).reason;
 assert.throws(()=>parseAIWorkspace(missing));
 const missingOptional=fixture();delete (missingOptional.workspace.components[0].items[0] as Record<string,unknown>).detail;
 assert.throws(()=>parseAIWorkspace(missingOptional));
 const rootUnknown=fixture();Object.assign(rootUnknown,{explanation:'extra'});
 assert.throws(()=>parseAIWorkspace(rootUnknown));
});

test('canonical dependency and identity checks still apply after normalization',()=>{
 const missingDependency=fixture();Object.assign(missingDependency.workspace.components[0],{dependsOn:'missing'});
 assert.throws(()=>parseAIWorkspace(missingDependency),/Unknown dependency/);
 const missingVisibility=fixture();Object.assign(missingVisibility.workspace.components[0],{visibleWhen:{componentId:'missing',completed:true}});
 assert.throws(()=>parseAIWorkspace(missingVisibility),/Unknown dependency/);
 const valid=fixture();const second=structuredClone(valid.workspace.components[0]);second.id='notes';
 Object.assign(second,{dependsOn:'plan',visibleWhen:{componentId:'plan',completed:true}});
 valid.workspace.components.push(second);
 assert.equal(parseAIWorkspace(valid).components[1].dependsOn,'plan');
 const duplicates=fixture();duplicates.workspace.components.push(structuredClone(duplicates.workspace.components[0]));
 assert.throws(()=>parseAIWorkspace(duplicates),/Duplicate component IDs/);
});

test('custom provider tool survives normalization and rejects mismatched or executable definitions',()=>{
 const data=fixture();
 Object.assign(data.workspace.components[0],{type:'custom',items:[],custom:{purpose:'Calculate area',layout:'metrics',accent:'green',fields:[{id:'width',label:'Width',type:'number',value:'3',options:[],min:0,max:null},{id:'height',label:'Height',type:'number',value:'4',options:[],min:0,max:null}],outputs:[{id:'area',label:'Area',expression:['width','height','*'],unit:'m²'}]}});
 const workspace=parseAIWorkspace(data);
 assert.equal(workspace.components[0].custom?.fields[0].value,'3');
 assert.deepEqual(WorkspaceSchema.parse(JSON.parse(JSON.stringify(workspace))),workspace);
 const mismatch=structuredClone(data);mismatch.workspace.components[0].type='notes';
 assert.throws(()=>parseAIWorkspace(mismatch),/Custom tools/);
 const executable=structuredClone(data);
 (executable.workspace.components[0] as unknown as {custom:{outputs:{expression:string[]}[]}}).custom.outputs[0].expression=['fetch(secret)'];
 assert.throws(()=>parseAIWorkspace(executable));
});

import type {Workspace} from './schema';
import {evaluateTaskReadiness} from './task-engine';
import {evaluateRecord} from './record-tool';
import {evaluateCustomTool} from './custom-tool';
import {resolveBindings} from './data-bindings';
/** Readiness follows actual editable values, not the planner's original defaults. */
export function workspaceReadiness(workspace:Workspace){
 if(!workspace.taskContract)return null;
 const bound=resolveBindings(workspace,workspace.bindings??[]);
 const contract={...workspace.taskContract,inputs:workspace.taskContract.inputs.map(input=>{
  if(!input.binding)return input;
  const binding=input.binding,c=workspace.components.find(c=>c.id===binding.componentId);
  const value=binding.port==='text'?c?.text:binding.port==='items'?(c?.items.length?c.items:undefined):c?.custom?.fields.find(f=>f.id===binding.fieldId)?.value;
  let available=value!==undefined&&value!==null&&(typeof value!=='string'||!!value.trim());
  if(c?.type==='comparison'&&!input.available)available=available&&c.items.every(row=>c.criteria?.every(criterion=>c.editedPaths?.some(p=>p===`/items/${encodeURIComponent(row.id)}/scores/${encodeURIComponent(criterion.id)}`)));
  if(c?.recordTool&&c.items.some(row=>evaluateRecord(c.recordTool!,row.cells).some(o=>o.error)))available=false;
  if(binding.port==='customField'&&!input.available)available=available&&!!c?.editedPaths?.some(p=>p.includes(binding.fieldId!));
  return {...input,value,available};
 })};
 const report=workspace.taskReport??{complete:false,covered:[],missing:[]};
 const state=evaluateTaskReadiness(contract,report,workspace.progress);
 if(bound.errors.length||bound.workspace.components.some(c=>c.custom&&evaluateCustomTool(c.custom).some(o=>o.error)))return {...state,ready:false,complete:false};
 return state;
}

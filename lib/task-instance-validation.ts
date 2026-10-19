import { ComponentSchema, type UIComponent } from './schema';
import { evaluateCustomTool } from './custom-tool';
import { TaskContractSchema, type TaskContract } from './task-contract';
import type { TaskAssembly, TaskSelection } from './task-engine';

export type TaskInstanceReport = { valid:boolean; errors:string[]; checkedActions:string[] };
/** Validate renderer behavior against explicit requirements, without prompt heuristics or paid calls. */
export function validateTaskInstances(contract:TaskContract, assembly:TaskAssembly):TaskInstanceReport;
export function validateTaskInstances(contract:TaskContract, components:UIComponent[], selections:TaskSelection[]):TaskInstanceReport;
export function validateTaskInstances(contract:TaskContract, source:TaskAssembly|UIComponent[], selected?:TaskSelection[]):TaskInstanceReport {
 const parsed=TaskContractSchema.safeParse(contract),errors:string[]=[],checkedActions:string[]=[];
 if(!parsed.success)return {valid:false,errors:parsed.error.issues.map(issue=>issue.message),checkedActions};
 const components=Array.isArray(source)?source:source.components,selections=Array.isArray(source)?selected??[]:source.selections;
 if(components.length>16)errors.push('Workspace exceeds the 16 component limit');
 if(new Set(components.map(component=>component.id)).size!==components.length)errors.push('Duplicate component instance IDs');
 const byId=new Map(components.map(component=>[component.id,component]));
 for(const component of components) {
  const shape=ComponentSchema.safeParse(component);
  if(!shape.success){errors.push(`${component.id}: ${shape.error.issues.map(issue=>issue.message).join('; ')}`);continue;}
  if(!component.title.trim())errors.push(`${component.id}: An accessible title is required`);
  if(component.type==='weekly_schedule'){
   if(!component.weeklySchedule||component.weeklySchedule.days.length!==7)errors.push(`${component.id}: Schedule requires seven dated days`);
   else {
    const start=new Date(`${component.weeklySchedule.weekStart}T12:00:00Z`);
    if(!Number.isFinite(start.getTime()))errors.push(`${component.id}: Invalid schedule date`);
    else for(const [index,day] of component.weeklySchedule.days.entries()){
     const expected=new Date(start);expected.setUTCDate(start.getUTCDate()+index);
     if(day.date!==expected.toISOString().slice(0,10))errors.push(`${component.id}: Schedule days must be consecutive`);
     for(const event of day.events)if(event.end<=event.start)errors.push(`${component.id}: Event ${event.id} must end after it starts`);
    }
   }
  }
  if(component.type==='comparison'){
   if(!component.criteria?.length||component.items.length<2)errors.push(`${component.id}: Comparison requires criteria and at least two options`);
   if(component.criteria?.every(criterion=>criterion.weight===0))errors.push(`${component.id}: Comparison needs a positive criterion weight`);
   if(component.criteria)for(const item of component.items)for(const criterion of component.criteria)if(!Number.isFinite(item.scores?.[criterion.id]))errors.push(`${component.id}: Option ${item.id} has no score for ${criterion.id}`);
  }
  if(component.type==='custom'){
   if(!component.custom?.fields.length)errors.push(`${component.id}: Calculator has no editable inputs`);
   if(contract.actions.some(action=>action.capability.startsWith('calculate.')&&selections.some(selection=>selection.instanceId===component.id&&selection.actionIds.includes(action.id)))&&!component.custom?.outputs.length)errors.push(`${component.id}: Calculator has no formula output`);
   if(component.custom)for(const result of evaluateCustomTool(component.custom))if(result.error)errors.push(`${component.id}: ${result.error}`);
  }
 }
 for(const action of parsed.data.actions){
  if(action.external){errors.push(`${action.id}: External action has no connected executor`);continue;}
  const matching=selections.filter(selection=>selection.actionIds.includes(action.id));
  if(!matching.length){errors.push(`${action.id}: Required action is not covered`);continue;}
  let valid=false;
  for(const selection of matching){
   const component=byId.get(selection.instanceId);
   if(!component){errors.push(`${action.id}: Selected instance does not exist`);continue;}
   if(component.catalogRef&&(component.catalogRef.definitionId!==selection.definitionId||component.catalogRef.version!==selection.definitionVersion)){errors.push(`${action.id}: Instance catalog version does not match selection`);continue;}
   if(action.capability.startsWith('calculate.')&&(component.type!=='custom'||!component.custom?.outputs.length)){errors.push(`${action.id}: Calculation needs editable inputs and a deterministic formula`);continue;}
   if(action.inputKind==='schedule'&&component.type!=='weekly_schedule'){errors.push(`${action.id}: Required dated time editor is unavailable`);continue;}
   if(action.inputKind==='comparison'&&component.type!=='comparison'){errors.push(`${action.id}: Required comparison behavior is unavailable`);continue;}
   valid=true;
  }
  if(valid)checkedActions.push(action.id);
 }
 return {valid:errors.length===0,errors:[...new Set(errors)],checkedActions};
}

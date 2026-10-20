import {enforceWorkspaceBehavior} from './task-workspace-policy';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {TaskContractSchema,type TaskContract} from './task-contract';
import {assembleTask,rankTaskCandidates,demoTaskContract,type TaskAssembly} from './task-engine';
import {validateTaskInstances} from './task-instance-validation';
import {ComponentDefinitionSchema,validateDefinition,primitiveInputSchema,primitiveStateSchema,outputSchema,seedDefinitions,primitiveCapabilities,type ComponentDefinition} from './catalog';
import {listDefinitions,getDefinition,saveGeneratedDefinition,getCatalogEmbeddingCache,setCatalogEmbeddingCache} from './catalog-store';
import {semanticScores,type EmbeddingCache} from './semantic-search';
import {interpretTask,populateTask} from './task-ai';
import {WorkspaceSchema,type Workspace,type UIComponent} from './schema';
import {applyCandidate} from './patch';
import {evaluateCustomTool} from './custom-tool';
import {bindingOrder,resolveBindings,withoutIdentityCopies,type DataBinding} from './data-bindings';
import {AIError} from './ai-budget';
import {isNewGoal,isSchedulingGoal} from './planner';
import {createSchedule,summarizeScheduleDraft} from './schedule';

const cache:EmbeddingCache={
 async get(key){const vector=await getCatalogEmbeddingCache(key);return vector?{model:'text-embedding-3-small',fingerprint:key.split(':').at(-1)!,vector}:null;},
 async put(key,record){await setCatalogEmbeddingCache(key,record.vector);}
};
function formulaSignature(component:UIComponent){return JSON.stringify({type:component.type,recordTool:component.recordTool,purpose:component.type==='custom'?undefined:component.title,fields:component.custom?.fields.map(({value:_,...field})=>field),outputs:component.custom?.outputs});}
export function privateDefinition(component:UIComponent,contract:TaskContract,session:string,missing:string[]):ComponentDefinition{
 const stamp=new Date().toISOString();
 const template=structuredClone(component);delete template.catalogRef;delete template.editedPaths;delete template.dependsOn;delete template.visibleWhen;
 // Reusable definition never carries the user's populated field values.
 if(template.custom){
  const neutral=structuredClone(template.custom),probes=[1,2,0,10];
  // At most 64 deterministic probes, independent of all private field values.
  for(let attempt=0;attempt<64;attempt++){
   let numericIndex=0;
   template.custom.fields=neutral.fields.map(field=>{const probe=attempt<4?probes[attempt]:probes[Math.floor((attempt-4)/4**(numericIndex++%3))%4];return {...field,value:field.type==='number'?String(Math.max(field.min??-Infinity,Math.min(field.max??Infinity,probe))):field.type==='toggle'?'false':field.type==='select'?(field.options[0]??''):''};});
   if(evaluateCustomTool(template.custom).every(output=>!output.error))break;
  }
 }
 if(template.type!=='custom'){template.items=[];if(template.text!==undefined)template.text='';if(template.value!==undefined)template.value=0;if(template.weeklySchedule)template.weeklySchedule.days.forEach(day=>day.events=[]);if(template.type==='quiz')template.items=structuredClone(seedDefinitions().find(d=>d.template.type==='quiz')!.template.items);if(template.type==='comparison')template.items=[{id:'option_a',label:'אפשרות א',scores:Object.fromEntries((template.criteria??[]).map(c=>[c.id,0]))},{id:'option_b',label:'אפשרות ב',scores:Object.fromEntries((template.criteria??[]).map(c=>[c.id,0]))}];}
 const canonical=template.type==='custom'&&!template.custom?.outputs.length?'input.form':primitiveCapabilities(template.type)[0];
 const aliases=missing.filter(c=>!primitiveCapabilities(template.type).includes(c)&&!(/^(calculate|collect)\./.test(c)&&template.type==='custom'));
 const id=`generated_${createHash('sha256').update(session+JSON.stringify([...missing].sort())+formulaSignature(template)).digest('hex').slice(0,32)}`;
 return ComponentDefinitionSchema.parse({id,version:1,name:component.title,description:component.reason||'Private task-specific declarative workspace tool',categories:[template.type],tags:[template.type],capabilities:[...new Set(missing)],actions:[...new Set(missing)],capabilityBindings:aliases.map(capability=>({capability,primitiveCapability:canonical})),limitations:['Local interactive workspace only; user inputs remain editable. No external actions are executed.'],inputSchema:primitiveInputSchema(template.type),outputSchema:outputSchema(template.type),stateSchema:primitiveStateSchema(template.type),template,examples:[],nonFitExamples:['External execution or live data retrieval'],source:'ai',status:'draft',scope:'private',ownerSession:session,support:{hebrew:true,rtl:true,mobile:true,accessibility:false},createdAt:stamp,updatedAt:stamp});
}
/** Match task identity before renderer identity so independent datasets cannot swap edits. */
export function taskInstanceIdentityMap(assembly:TaskAssembly,contract:TaskContract,previous:Workspace):Map<string,string>{
 const ids=new Map<string,string>(),used=new Set<string>();
 for(const selection of assembly.selections){
  const component=assembly.components.find(c=>c.id===selection.instanceId)!;
  const actions=contract.actions.filter(action=>selection.actionIds.includes(action.id));
  const explicit=actions.flatMap(action=>action.componentId?[action.componentId]:[]);
  const datasets=actions.flatMap(action=>action.datasetId?[action.datasetId]:[]);
  const priorActions=previous.taskContract?.actions.filter(old=>datasets.includes(old.datasetId??''))??[];
  const priorIds=(previous.taskReport?.covered??[]).filter(entry=>priorActions.some(action=>action.id===entry.actionId)).map(entry=>entry.instanceId);
  const preferred=[...explicit,...priorIds,...datasets,component.id];
  const compatible=(candidate:UIComponent)=>!used.has(candidate.id)&&candidate.type===component.type;
  let old=preferred.map(id=>previous.components.find(candidate=>candidate.id===id&&compatible(candidate))).find(Boolean);
  if(!old&&!explicit.length&&!datasets.length)old=previous.components.find(candidate=>compatible(candidate)&&candidate.catalogRef?.definitionId===selection.definitionId&&candidate.catalogRef.version===selection.definitionVersion)??previous.components.find(candidate=>compatible(candidate)&&!candidate.catalogRef);
  if(old){used.add(old.id);ids.set(component.id,old.id);}
 }
 return ids;
}
function attachPins(assembly:TaskAssembly){
 return assembly.components.map(component=>{const selection=assembly.selections.find(s=>s.instanceId===component.id)!;return {...component,catalogRef:{definitionId:selection.definitionId,version:selection.definitionVersion}};});
}
/** Deterministic glue for compatible data tables and charts; all other edges remain explicit. */
export function inferredBindings(components:UIComponent[],current?:Workspace):DataBinding[]{
 const ids=new Set(components.map(c=>c.id));
 const preserved=(current?.bindings??[]).filter(b=>ids.has(b.source.componentId)&&ids.has(b.target.componentId));
 const chart=components.find(c=>c.type==='chart'),table=components.find(c=>c.type==='table');
 if(chart&&table&&!preserved.some(b=>b.target.componentId===chart.id))preserved.push({id:'table_chart',source:{componentId:table.id,port:'items'},target:{componentId:chart.id,port:'items'},transform:'copy'});
 return preserved;
}
export type PipelineDependencies={
 generalLearningContent?:boolean;
 list:typeof listDefinitions; get:typeof getDefinition; saveGenerated:typeof saveGeneratedDefinition;
 interpret:typeof interpretTask; populate:(contract:TaskContract,definitions:ComponentDefinition[],current:Workspace|undefined,session:string,feedback?:string)=>Promise<{workspace:Workspace;budget:{spent:number;limit:number;warning:boolean};cached:boolean}>; semantics:typeof semanticScores;
};
export type PipelineProgress='interpret'|'assemble'|'compose'|'validate'|'save'|'complete';
const defaults:PipelineDependencies={list:listDefinitions,get:getDefinition,saveGenerated:saveGeneratedDefinition,interpret:interpretTask,populate:populateTask,semantics:semanticScores};
export async function runTaskPipeline(prompt:string,current:Workspace|undefined,session:string,history:unknown[]=[],overrides:Partial<PipelineDependencies>={},onProgress?:(step:PipelineProgress)=>void){
 const deps={...defaults,...overrides};
 // History is persisted by the client even before a workspace exists. Once the
 // assistant has replied, clarification cannot block this conversation again.
 const clarificationUsed=history.some(turn=>!!turn&&typeof turn==='object'&&(turn as {role?:string}).role==='assistant');
 const guidance=clarificationUsed?'The clarification allowance is exhausted. Do not ask any more questions. Interpret the original request plus the latest answer as workspace_change with a complete contract and clarification:null. Proceed with editable missing inputs and explicit assumptions.':'';
 let repairUsed=false,interpretation:Awaited<ReturnType<typeof interpretTask>>;
 onProgress?.('interpret');
 try{interpretation=await deps.interpret(prompt,current,session,history,guidance);}catch(error){if(!(error instanceof AIError)||!(error.sourceError instanceof z.ZodError||error.sourceError instanceof SyntaxError))throw error;repairUsed=true;interpretation=await deps.interpret(prompt,current,session,history,guidance+' The previous task contract failed validation. Correct only its schema/references: '+error.sourceError.message.slice(0,2500));}
 if(clarificationUsed&&(interpretation.intent==='clarification'||interpretation.contract?.clarification)){
  const messages=history.filter((turn):turn is {role:string;content:string}=>!!turn&&typeof turn==='object'&&(turn as {role?:string}).role==='user'&&typeof (turn as {content?:string}).content==='string');
  const objective=[...messages.map(turn=>turn.content),prompt].join('\n').slice(-4000);
  const contract=interpretation.contract??demoTaskContract(current?.goal??objective,[seedDefinitions().find(d=>d.id==='checklist')!.template]);
  interpretation={...interpretation,intent:'workspace_change',contract:{...contract,clarification:undefined},reply:/[א-ת]/.test(prompt)?'יוצר סביבת עבודה לעריכה. מידע חסר נשאר כקלט להשלמה.':'Creating an editable workspace. Missing information remains available for you to enter.'};
 }
 if(interpretation.intent!=='workspace_change')return {operation:interpretation.intent==='schedule_change'?'schedule':'reply',intent:interpretation.intent,explanation:interpretation.reply,mode:'live' as const,budget:interpretation.budget};
 const contract=enforceWorkspaceBehavior(TaskContractSchema.parse(interpretation.contract),current?`${current.goal}\n${prompt}`:prompt,{generalLearningContent:deps.generalLearningContent});
 if(contract.clarification)return {operation:'reply',intent:'clarification',explanation:contract.clarification,contract,mode:'live' as const,budget:interpretation.budget};
 const patch=!!current&&!isNewGoal(prompt,current);
 const previous=patch?current:undefined;
 onProgress?.('assemble');
 let definitions=await deps.list({session});
 // Historical pins remain readable and are used instead of automatically upgrading instances.
 if(previous){const restored=new Set<string>(),removedHeads=new Set<string>();for(const component of previous.components){if(!component.catalogRef)continue;const pin=component.catalogRef,key=`${pin.definitionId}@${pin.version}`;if(restored.has(key))continue;const pinned=await deps.get(pin.definitionId,pin.version,{session});if(pinned){if(!removedHeads.has(pinned.id)){definitions=definitions.filter(d=>d.id!==pinned.id);removedHeads.add(pinned.id);}definitions.push({...pinned,status:'active'});restored.add(key);}}}
 const ranked=rankTaskCandidates(contract,definitions);
 const eligible=ranked.map(candidate=>candidate.definition);
 const scores=eligible.length?await deps.semantics(contract.objective,eligible,session,cache):{};
 let assembly=assembleTask(contract,definitions,{semanticScores:scores});
 const canGenerate=assembly.coverage.missing.some(m=>!contract.actions.find(a=>a.id===m.actionId)?.external);
 if(!assembly.components.length&&!canGenerate)return {operation:'reply',intent:'workspace_question',explanation:assembly.limitations.join(' '),contract,coverage:assembly.coverage,mode:'live' as const,budget:interpretation.budget};
 const chosen=assembly.selections.map(s=>definitions.find(d=>d.id===s.definitionId&&d.version===s.definitionVersion)!);
 let generated:Awaited<ReturnType<PipelineDependencies['populate']>>;
 onProgress?.('compose');
 try{generated=await deps.populate(contract,chosen,previous,session);}catch(error){if(repairUsed||!(error instanceof AIError)||!(error.sourceError instanceof z.ZodError||error.sourceError instanceof SyntaxError))throw error;repairUsed=true;generated=await deps.populate(contract,chosen,previous,session,'Repair the invalid JSON/schema from the previous response; return the required structured workspace and bindings only. Validation errors: '+error.sourceError.message.slice(0,5000));}
 let final:Workspace|undefined,report:ReturnType<typeof validateTaskInstances>|undefined;
 onProgress?.('validate');
 // Exactly one focused repair; persistence is outside the retry so failed drafts are never activated.
 for(let attempt=repairUsed?1:0;attempt<2;attempt++){
  const draft=generated.workspace;
  let provisional=[...definitions],newDefinitions:ComponentDefinition[]=[],next:TaskAssembly|undefined,candidate:Workspace|undefined;
  try{
   const existingInstances=new Set(assembleTask(contract,definitions,{semanticScores:scores,componentData:draft.components}).components.map(c=>c.id));
   const unused=draft.components.filter(c=>!existingInstances.has(c.id));
   for(const missing of assembly.coverage.missing){
    const action=contract.actions.find(a=>a.id===missing.actionId)!;if(action.external)continue;
    if(/(?:^|[._-])(?:export|import|convert|search|fetch|browse|upload|download|run|execute|code|send|pay|purchase|book|deploy)(?:[._-]|$)/i.test(action.capability))throw new Error(`No validated local executor for ${action.capability}`);
    const kinds:Record<string,UIComponent['type'][]>= {custom:['custom'],schedule:['weekly_schedule'],comparison:['comparison'],number:['custom','slider','timer','chart'],text:['notes','custom'],items:['table','checklist','kanban','timeline','calendar','flashcards','quiz','chart','links','approval']};
    const compatible=(c:UIComponent)=>(!action.inputKind||kinds[action.inputKind]?.includes(c.type))&&(!action.capability.startsWith('calculate.')||c.type==='custom');
    const component=unused.find(c=>c.id===(action.componentId??action.id)&&compatible(c))??unused.find(compatible);
    if(!component)throw new Error(`Generate an actual interactive component for ${action.id}: ${action.description}`);
    unused.splice(unused.indexOf(component),1);
    const definition=privateDefinition(component,contract,session,[missing.capability]);
    const validation=validateDefinition(definition);if(!validation.valid)throw new Error(`Generated definition: ${validation.errors.join('; ')}`);
    newDefinitions.push(definition);provisional.push({...definition,status:'active'});
   }
   next=assembleTask(contract,provisional,{semanticScores:scores,componentData:draft.components});
   if(next.coverage.missing.some(m=>!contract.actions.find(a=>a.id===m.actionId)?.external))throw new Error('Generated components must cover every local task action');
   // Keep trusted formulas and renderer types. AI supplies instance data, never replaces a catalog algorithm.
   next.components=next.components.map(component=>{const selection=next!.selections.find(s=>s.instanceId===component.id)!;const definition=provisional.find(d=>d.id===selection.definitionId&&d.version===selection.definitionVersion)!;
    component.recordTool=structuredClone(definition.template.recordTool);
    if(definition.template.custom&&component.custom){const values=new Map(component.custom.fields.map(f=>[f.id,f.value]));component.custom={...structuredClone(definition.template.custom),fields:definition.template.custom.fields.map(f=>({...f,value:values.get(f.id)??f.value}))};}return component;});
   next.components=attachPins(next);
   // Supporting explanations can be distinct from the action's primary tool.
   // Keep validated standard primitives so references and lesson content survive assembly.
   const selectedIds=new Set(next.components.map(component=>component.id));
   const supporting=draft.components.filter(component=>!selectedIds.has(component.id)&&component.type!=='custom'&&!component.recordTool).map(component=>{
    const copy=structuredClone(component);delete copy.catalogRef;delete copy.editedPaths;return copy;
   });
   next.components.push(...supporting);
   // Provider-generated IDs are not authoritative during adaptation.
   const idMap=previous?taskInstanceIdentityMap(next,contract,previous):new Map<string,string>();
   const mapped=(id:string)=>idMap.get(id)??id;
   next.components=next.components.map(c=>({...c,id:mapped(c.id),...(c.dependsOn?{dependsOn:mapped(c.dependsOn)}:{}),...(c.visibleWhen?{visibleWhen:{...c.visibleWhen,componentId:mapped(c.visibleWhen.componentId)}}:{})}));
   next.selections=next.selections.map(selection=>({...selection,instanceId:mapped(selection.instanceId)}));next.coverage.covered=next.coverage.covered.map(entry=>({...entry,instanceId:mapped(entry.instanceId)}));
   const bindings=withoutIdentityCopies(draft.bindings!==undefined?draft.bindings.map(b=>({...b,source:{...b.source,componentId:mapped(b.source.componentId)},target:{...b.target,componentId:mapped(b.target.componentId)}})):inferredBindings(next.components,previous));bindingOrder(next.components,bindings);
   candidate=WorkspaceSchema.parse({...draft,id:previous?.id??draft.id,goal:previous?.goal??prompt,components:next.components,taskContract:{...contract,actions:contract.actions.map(action=>({...action,componentId:mapped(next!.coverage.covered.find(entry=>entry.actionId===action.id)?.instanceId??action.componentId??action.id)})),inputs:contract.inputs.map(input=>({...input,...(input.binding?{binding:{...input.binding,componentId:mapped(input.binding.componentId)}}:{})}))},bindings,taskReport:{...next.coverage,limitations:next.limitations}});
   candidate=previous?applyCandidate(previous,candidate):candidate;
   report=validateTaskInstances(contract,candidate.components,next.selections);
   const missingIds=new Set(next.coverage.missing.map(m=>m.actionId));const blockingErrors=report.errors.filter(error=>![...missingIds].some(id=>error.startsWith(`${id}:`)));
   if(blockingErrors.length)throw new Error(blockingErrors.join('; '));
   const bound=resolveBindings(candidate,bindings);if(bound.errors.length)throw new Error(`Data binding failed: ${bound.errors.map(e=>e.message).join('; ')}`);
   report=validateTaskInstances(contract,bound.workspace.components,next.selections);const boundErrors=report.errors.filter(error=>![...missingIds].some(id=>error.startsWith(`${id}:`)));if(boundErrors.length)throw new Error(`Data binding behavior failed: ${boundErrors.join('; ')}`);
  }catch(error){
   const message=error instanceof Error?error.message:'Invalid task workspace';
   if(attempt===0){generated=await deps.populate(contract,chosen,previous,session,`Repair only these validation problems: ${message}`);continue;}
   throw new AIError(422,`Task validation failed after one repair: ${message}`);
  }
  // Persist only after instance behavior, preserved edits, and all data edges pass.
  onProgress?.('save');
  for(const newDefinition of newDefinitions){const existing=await deps.get(newDefinition.id,undefined,{session});const stored=existing??(await deps.saveGenerated(newDefinition,session)).definition;if(stored.status!=='active')throw new AIError(422,'Generated component remained an invalid draft.');const selection=next!.selections.find(s=>s.definitionId===stored.id);if(selection){selection.definitionVersion=stored.version;next!.components=next!.components.map(c=>c.id===selection.instanceId?{...c,catalogRef:{definitionId:stored.id,version:stored.version}}:c);candidate!.components=candidate!.components.map(c=>c.id===selection.instanceId?{...c,catalogRef:{definitionId:stored.id,version:stored.version}}:c);}}
  final=candidate!;
  if(!previous&&isSchedulingGoal(prompt))final.domain={kind:'schedule',id:crypto.randomUUID()};
  assembly=next!;break;
 }
 if(!final)throw new AIError(422,'No validated workspace was produced.');
 const explanation=final.domain&&!previous?summarizeScheduleDraft(createSchedule(final.domain.id,prompt)):interpretation.reply;
 onProgress?.('complete');
 return {workspace:final,operation:previous?'patch':'create',intent:'workspace_change',mode:'live' as const,explanation,contract,selections:assembly.selections,coverage:assembly.coverage,validation:report,budget:generated.budget};
}

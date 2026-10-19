import {z} from 'zod';
import {preserveInstanceEdits} from './instance-state';
import {reconcileCustomTool} from './custom-tool';
import {ComponentSchema, WorkspaceSchema, type Workspace, type UIComponent} from './schema';
const Id=z.string().min(1).max(100);
export const PatchOperationSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('add'),component:ComponentSchema,index:z.number().int().min(0).optional()}).strict(),
 z.object({op:z.literal('remove'),id:Id}).strict(),
 z.object({op:z.literal('replace'),id:Id,component:ComponentSchema}).strict(),
 z.object({op:z.literal('move'),id:Id,index:z.number().int().min(0)}).strict(),
 z.object({op:z.literal('update'),id:Id,changes:ComponentSchema.omit({id:true,type:true}).partial()}).strict(),
]);
export type PatchOperation=z.infer<typeof PatchOperationSchema>;
export function applyPatches(previous:Workspace,operations:PatchOperation[]):Workspace{
 const next=structuredClone(WorkspaceSchema.parse(previous));
 for(const raw of z.array(PatchOperationSchema).max(40).parse(operations)){
  if(raw.op==='add'){if(next.components.some(c=>c.id===raw.component.id))throw new Error('Component ID already exists');next.components.splice(raw.index??next.components.length,0,raw.component);continue;}
  const index=next.components.findIndex(c=>c.id===raw.id);if(index<0)throw new Error(`Unknown component: ${raw.id}`);
  const old=next.components[index];
  if(raw.op==='remove')next.components.splice(index,1);
  if(raw.op==='move'){next.components.splice(index,1);next.components.splice(raw.index,0,old);}
  if(raw.op==='replace')next.components[index]=preserve(old,raw.component);
  if(raw.op==='update')next.components[index]=preserve(old,{...old,...raw.changes});
 }
 return WorkspaceSchema.parse(next);
}
function preserve(old:UIComponent,next:UIComponent):UIComponent{
 if(old.id!==next.id||old.type!==next.type)return next;
 return preserveInstanceEdits(old,{...next,value:next.value??old.value,text:next.text??old.text,criteria:next.criteria??old.criteria,...(old.custom&&next.custom?{custom:reconcileCustomTool(old.custom,next.custom)}:{}),items:next.items.map(item=>{const saved=old.items.find(i=>i.id===item.id);return saved?{...saved,...item,done:saved.done??item.done,...(old.type==='quiz'?{group:saved.group,value:saved.value}: {})}:item;})});
}
/** Turn a validated candidate into targeted operations keyed by stable IDs. */
export function diffWorkspace(previous:Workspace,candidate:Workspace):PatchOperation[]{
 const operations:PatchOperation[]=[];
 const order=previous.components.map(c=>c.id);
 for(const old of previous.components)if(!candidate.components.some(c=>c.id===old.id)){operations.push({op:'remove',id:old.id});order.splice(order.indexOf(old.id),1);}
 for(const [index,component] of candidate.components.entries()){
  const old=previous.components.find(c=>c.id===component.id);
  if(!old){operations.push({op:'add',component,index});order.splice(index,0,component.id);}
  else {
   if(JSON.stringify(old)!==JSON.stringify(component))operations.push({op:'replace',id:component.id,component});
   const from=order.indexOf(component.id);if(from!==index){operations.push({op:'move',id:component.id,index});order.splice(from,1);order.splice(index,0,component.id);}
  }
 }
 return operations;
}
export function applyCandidate(previous:Workspace,candidate:Workspace):Workspace{
 const validated=WorkspaceSchema.parse(candidate);
 const result=applyPatches(previous,diffWorkspace(previous,validated));
 return WorkspaceSchema.parse({...result,id:previous.id,title:validated.title,description:validated.description,goal:validated.goal,...(validated.taskContract?{taskContract:validated.taskContract}:{}),...(validated.taskReport?{taskReport:validated.taskReport}:{}),...(validated.bindings?{bindings:validated.bindings}:{})});
}

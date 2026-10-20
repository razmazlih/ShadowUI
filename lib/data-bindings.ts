import {z} from 'zod';
import type {Workspace, UIComponent} from './schema';
import {evaluateCustomTool} from './custom-tool';
const PortSchema=z.object({componentId:z.string().min(1).max(100),port:z.enum(['value','text','items','customOutput','customField']),fieldId:z.string().max(64).optional()}).strict();
export const DataBindingSchema=z.object({id:z.string().min(1).max(100),source:PortSchema,target:PortSchema,transform:z.enum(['copy','sum','count','project','filter','group']),field:z.enum(['label','detail','value','date','group']).optional(),match:z.string().max(2000).optional()}).strict();
export type DataBinding=z.infer<typeof DataBindingSchema>;
type Kind='number'|'string'|'items'|'invalid';
function kind(c:UIComponent,port:DataBinding['source'],source:boolean):Kind{
 if(port.port==='value')return ['slider','timer','approval'].includes(c.type)?'number':'invalid';
 if(port.port==='text')return c.type==='notes'?'string':'invalid';
 if(port.port==='items')return !['custom','weekly_schedule','timer','slider','notes','approval'].includes(c.type)?'items':'invalid';
 if(port.port==='customOutput'&&source&&c.custom?.outputs.some(o=>o.id===port.fieldId))return 'number';
 const f=c.custom?.fields.find(f=>f.id===port.fieldId);
 if(port.port==='customField'&&!source&&f)return f.type==='number'?'number':f.type==='text'?'string':'invalid';
 return 'invalid';
}
export function bindingOrder(components:UIComponent[],raw:DataBinding[]):DataBinding[]{
 const bindings=z.array(DataBindingSchema).max(32).parse(raw),nodes=new Map(components.map(c=>[c.id,c]));
 const targets=new Set<string>();
 if(new Set(bindings.map(binding=>binding.id)).size!==bindings.length)throw new Error('Duplicate binding IDs');
 for(const b of bindings){
  const from=nodes.get(b.source.componentId),to=nodes.get(b.target.componentId);
  if(!from||!to)throw new Error('Binding references an unknown component');
  const a=kind(from,b.source,true),target=kind(to,b.target,false);
  const output=b.transform==='count'?(a==='items'?'number':'invalid'):b.transform==='sum'?(a==='items'?'number':'invalid'):['project','filter','group'].includes(b.transform)?(a==='items'&&b.field&&(b.transform!=='filter'||b.match!==undefined)?'items':'invalid'):a;
  if(output==='invalid'||target!==output)throw new Error('Binding input/output schemas are incompatible');
  const key=`${to.id}:${b.target.port}:${b.target.fieldId??''}`;
  if(targets.has(key))throw new Error('Multiple writers for one binding input');targets.add(key);
 }
 const visiting=new Set<string>(),done=new Set<string>(),ordered:DataBinding[]=[];
 const visit=(id:string)=>{if(visiting.has(id))throw new Error('Binding dependency cycle');if(done.has(id))return;visiting.add(id);for(const b of bindings.filter(b=>b.target.componentId===id)){visit(b.source.componentId);ordered.push(b);}visiting.delete(id);done.add(id);};
 for(const id of nodes.keys())visit(id);
 return ordered;
}
export function resolveBindings<T extends Pick<Workspace,'components'>>(workspace:T,bindings:DataBinding[]=[]):{workspace:T;errors:Array<{componentId:string;message:string}>}{
 const next=structuredClone(workspace),errors:Array<{componentId:string;message:string}>=[];
 const ordered=bindingOrder(next.components,bindings);
 for(const b of ordered){try{
  if(errors.some(e=>e.componentId===b.source.componentId))throw new Error('Upstream binding failed');
  const from=next.components.find(c=>c.id===b.source.componentId)!,to=next.components.find(c=>c.id===b.target.componentId)!;
  let value:unknown;
  if(b.source.port==='customOutput'){const result=evaluateCustomTool(from.custom!).find(o=>o.id===b.source.fieldId)!;if(result.error||result.value===null)throw new Error(result.error??'Formula output is unavailable');value=result.value;}
  else value=from[b.source.port as 'value'|'text'|'items'];
  if(b.transform==='count')value=(value as unknown[]).length;
  if(b.transform==='sum'){const rows=value as UIComponent['items'];if(rows.some(row=>!Number.isFinite(row.value)))throw new Error('All summed rows need a finite numeric value');value=rows.reduce((n,row)=>n+row.value!,0);}
  if(b.transform==='project')value=(value as UIComponent['items']).map(row=>{const v=row[b.field!];if(v===undefined)throw new Error('Projected field is missing');return {id:row.id,label:String(v),...(typeof v==='number'?{value:v}:{})};});
  if(b.transform==='filter')value=(value as UIComponent['items']).filter(row=>row[b.field!]!==undefined&&String(row[b.field!])===b.match);
  if(b.transform==='group'){const groups=new Map<string,number>();for(const row of value as UIComponent['items']){const key=row[b.field!];if(key===undefined)throw new Error('Grouped field is missing');const label=String(key);groups.set(label,(groups.get(label)??0)+1);}value=[...groups].map(([label,count],index)=>({id:`group_${index}`,label,value:count}));}
  const targetKind=kind(to,b.target,false);
  if(targetKind==='number'&&(typeof value!=='number'||!Number.isFinite(value)))throw new Error('Binding result is not finite');
  if(targetKind==='string'&&(typeof value!=='string'||value.length>(b.target.port==='customField'?2000:5000)))throw new Error('Binding text does not match the target schema');
  if(targetKind==='items'&&(!Array.isArray(value)||value.length>60))throw new Error('Binding rows do not match the target schema');
  if(b.target.port==='customField'){
   const f=to.custom!.fields.find(f=>f.id===b.target.fieldId)!;
   if(f.type==='number'&&(typeof value!=='number'||f.min!==null&&value<f.min||f.max!==null&&value>f.max))throw new Error('Bound number exceeds target limits');
   f.value=String(value);
  }else if(b.target.port==='value'){
   if(to.type==='timer'&&(!Number.isInteger(value)||Number(value)<1||Number(value)>180))throw new Error('Timer duration must be 1–180 whole minutes');
   if(to.type==='slider'&&Number(value)<0)throw new Error('Slider value must be non-negative');
   if(to.type==='approval'&&![0,1].includes(Number(value)))throw new Error('Approval value must be zero or one');
   to.value=Number(value);
  }else if(b.target.port==='text')to.text=String(value??'');
  else if(b.target.port==='items')to.items=structuredClone(value as UIComponent['items']);
 }catch(error){
  const target=next.components.find(component=>component.id===b.target.componentId)!;
  // A stale derived value is misleading after failure. These changes affect only the
  // resolved display copy; original editable workspace inputs stay intact.
  if(b.target.port==='customField'){const field=target.custom?.fields.find(field=>field.id===b.target.fieldId);if(field)field.value='';}
  else if(b.target.port==='value')delete target.value;
  else if(b.target.port==='text')target.text='';
  else if(b.target.port==='items')target.items=[];
  errors.push({componentId:b.target.componentId,message:error instanceof Error?error.message:'Binding failed'});
 }}
 return {workspace:next,errors};
}

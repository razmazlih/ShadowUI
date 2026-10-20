import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ComponentDefinitionSchema,seedDefinitions,validateDefinition,type ComponentDefinition} from './catalog';
export const ReviewStatusSchema=z.enum(['pending','approved','rejected','changes_requested']);
export const ReviewCandidateSchema=z.object({id:z.string(),version:z.number().int().positive(),status:ReviewStatusSchema,definition:ComponentDefinitionSchema,sourceDefinitionId:z.string(),sourceVersion:z.number().int().positive(),purpose:z.string().max(1500),reason:z.string().max(1500),gap:z.string().max(1500),usage:z.string().max(1500),limitations:z.array(z.string().max(500)).max(20),validation:z.object({valid:z.boolean(),errors:z.array(z.string())}),createdAt:z.string(),updatedAt:z.string(),reviewReason:z.string().optional(),sharedDefinitionId:z.string().optional()}).strict();
export type ReviewCandidate=z.infer<typeof ReviewCandidateSchema>;
function syntheticExpressions(outputs:Array<{expression:string[]}>,mapping:Map<string,string>){
 const parameters=new Map<string,string>();
 const expressions=outputs.map(output=>output.expression.map(token=>{
  if(mapping.has(token))return mapping.get(token)!;
  const value=Number(token);if(!Number.isFinite(value))return token;
  if([-1,0,1].includes(value))return String(value);
  if(!parameters.has(token))parameters.set(token,`parameter_${parameters.size+1}`);
  return parameters.get(token)!;
 }));
 return {expressions,parameters:[...parameters.values()]};
}
/** Reconstruct from trusted primitive examples. Never copy user text, records, labels or defaults. */
export function createReviewCandidate(source:ComponentDefinition):ReviewCandidate{
 const base=seedDefinitions().find(d=>d.template.type===source.template.type)!;
 const id=`review_${createHash('sha256').update(`${source.id}:${source.version}:${source.ownerSession}`).digest('hex').slice(0,32)}`;
 const now=new Date().toISOString();
 let privacyOverflow=false,parameterCount=0;
 const definition=ComponentDefinitionSchema.parse({...structuredClone(base),id:`shared_${id.slice(7)}`,source:'ai',version:1,createdAt:now,updatedAt:now});
 // Preserve the bounded arithmetic structure while replacing every label and value with synthetic data.
 if(source.template.type==='custom'&&source.template.custom){
  const tool=structuredClone(source.template.custom);
  const mapping=new Map(tool.fields.map((field,index)=>[field.id,`field_${index+1}`]));
  tool.purpose='Reusable bounded calculation with synthetic inputs.';
  tool.fields=tool.fields.map((field,index)=>({...field,id:mapping.get(field.id)!,label:`Input ${index+1}`,min:null,max:null,value:field.type==='number'?'1':field.type==='toggle'?'false':field.type==='select'?'Example':'',options:field.type==='select'?['Example']:[]}));
  const sanitized=syntheticExpressions(tool.outputs,mapping);parameterCount=sanitized.parameters.length;
  tool.outputs=tool.outputs.map((output,index)=>({...output,id:`output_${index+1}`,label:`Result ${index+1}`,unit:'',expression:sanitized.expressions[index]}));
  tool.fields.push(...sanitized.parameters.map((id,index)=>({id,label:`Synthetic parameter ${index+1}`,type:'number' as const,value:'1',options:[],min:null,max:null})));
  if(tool.fields.length>16)privacyOverflow=true;else definition.template.custom=tool;
  if(!tool.outputs.length){definition.capabilities=['input.form'];definition.actions=['enter_input'];}
 }
 if(source.template.type==='table'&&source.template.recordTool){
  const tool=structuredClone(source.template.recordTool);
  const mapping=new Map(tool.columns.map((column,index)=>[column.id,`column_${index+1}`]));
  tool.columns=tool.columns.map((column,index)=>({id:mapping.get(column.id)!,label:`Quantity ${index+1}`}));
  const sanitized=syntheticExpressions(tool.outputs,mapping);parameterCount=sanitized.parameters.length;
  tool.outputs=tool.outputs.map((output,index)=>({id:`result_${index+1}`,label:`Result ${index+1}`,unit:'',expression:sanitized.expressions[index]}));
  tool.columns.push(...sanitized.parameters.map((id,index)=>({id,label:`Synthetic parameter ${index+1}`})));
  if(tool.columns.length>8)privacyOverflow=true;
  else{definition.template.recordTool=tool;definition.template.items=[{id:'example',label:'Synthetic example',cells:Object.fromEntries(tool.columns.map(column=>[column.id,1]))}];}
 }
 // Only this fixed simulation taxonomy can cross the private/shared boundary.
 const aliasPrimitives:Record<string,string>={
  'calculate.area':'calculate.formula','calculate.ratio':'calculate.formula','calculate.balance':'calculate.formula',
  'collect.task_input':'input.form','collect.formula_input':'input.form','records.inventory':'data.table.edit',
 };
 const aliases=Object.keys(aliasPrimitives).filter(capability=>source.capabilities.includes(capability)&&(
  capability==='records.inventory'?!!definition.template.recordTool:
  capability.startsWith('calculate.')?definition.template.type==='custom'&&!!definition.template.custom?.outputs.length:
  definition.template.type==='custom'&&!definition.template.custom?.outputs.length));
 definition.capabilities=[...new Set([...definition.capabilities,...aliases])];
 definition.actions=[...new Set([...definition.actions,...aliases])];
 definition.capabilityBindings=aliases.map(capability=>({capability,primitiveCapability:aliasPrimitives[capability]}));
 const custom=definition.template.custom,records=definition.template.recordTool;
 const inputs=custom?.fields.length??records?.columns.length??0,outputs=custom?.outputs??records?.outputs??[];
 const operations=[...new Set(outputs.flatMap(output=>output.expression).filter(token=>['+','-','*','/','min','max','gt','lt','eq','if','days_between'].includes(token)))];
 if(custom||records){
  definition.name=records?'Per-record calculation':outputs.length?'Bounded calculation':'Structured input form';
  definition.description=`${records?'Per-record':'Interactive'} tool with ${inputs} inputs and ${outputs.length} outputs. ${operations.length?`Operations: ${operations.join(', ')}.`:'Collects editable inputs.'} ${parameterCount} synthetic parameters replace private numeric literals; their defaults are illustrative.`;
  definition.template.title=definition.name;definition.template.reason=definition.description;
 }
 const validation=privacyOverflow?{valid:false,errors:['Private numeric literals require more synthetic inputs than the safe field limit. This synthetic placeholder must be reauthored before approval.']}:validateDefinition(definition);
 return {id,version:1,status:'pending',definition,sourceDefinitionId:source.id,sourceVersion:source.version,purpose:definition.description,reason:`A generated ${definition.template.type} definition required a reusable structure with ${inputs} inputs and ${outputs.length} outputs.`,gap:`Review ${outputs.length?'bounded calculation':'input collection'} behavior (${operations.join(', ')||definition.template.type}) beyond the catalog default.`,usage:`Interact with the synthetic example. ${parameterCount} synthetic parameters require public example values before approval.`,limitations:definition.limitations,validation,createdAt:now,updatedAt:now};
}
export function proposeReviewEdit(definition:ComponentDefinition,instruction:string){
 const after=structuredClone(definition);
 if(/compact|קומפקט|צר/.test(instruction))after.template.span='normal';
 else if(/wide|רחב/.test(instruction))after.template.span='wide';
 else if(/hebrew|עברית/.test(instruction)){after.name='כלי עבודה';after.template.title='כלי עבודה';}
 else throw new Error('Simulation supports compact, wide, or Hebrew title changes. Use the form for other edits.');
 return {before:definition,after,simulation:true as const};
}

import {z} from 'zod';
import {zodSchema} from 'ai';
import {ComponentSchema,ItemSchema,WorkspaceSchema} from './schema';

// Structured Outputs requires every property to be required. Use null only on
// the provider boundary; the application's canonical schema remains strict.
function providerShape(shape:z.ZodRawShape){
 return Object.fromEntries(Object.entries(shape).map(([key,field])=>[key,
  field instanceof z.ZodOptional?field.unwrap().nullable():
  field instanceof z.ZodDefault?field.removeDefault():field])) as z.ZodRawShape;
}
const ScoreSchema=z.object({criterionId:z.string(),score:z.number().min(0).max(100)}).strict();
const ProviderItemSchema=z.object({...providerShape(ItemSchema.omit({scores:true,url:true}).shape),url:z.string().max(4000).nullable(),scores:z.array(ScoreSchema).nullable()}).strict();
const ProviderComponentSchema=z.object({...providerShape(ComponentSchema.omit({items:true,catalogRef:true,editedPaths:true}).shape),items:z.array(ProviderItemSchema).max(60)}).strict();
export const ProviderWorkspaceSchema=z.object({workspace:z.object({
 id:z.string().max(100),title:z.string().max(150),description:z.string().max(1000),goal:z.string().max(4000),components:z.array(ProviderComponentSchema).min(1).max(16)
}).strict()}).strict();

export const workspaceResponseFormat={type:'json_schema',json_schema:{name:'shadowui_workspace',strict:true,schema:zodSchema(ProviderWorkspaceSchema).jsonSchema}};

function omitNulls(value:Record<string,unknown>){return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==null));}
export function parseAIWorkspace(data:unknown){
 // Validate before normalization so unknown keys and missing required fields
 // cannot be hidden by the adapter.
 const {workspace}=ProviderWorkspaceSchema.parse(data);
 return WorkspaceSchema.parse({...workspace,components:workspace.components.map(component=>({
  ...omitNulls(component),items:(component.items as Array<Record<string,unknown>>).map(item=>{
   const scores=item.scores as Array<z.infer<typeof ScoreSchema>>|null;
   if(scores&&new Set(scores.map(s=>s.criterionId)).size!==scores.length)throw new Error('Duplicate criterion scores');
   return {...omitNulls(item),...(scores?{scores:Object.fromEntries(scores.map(s=>[s.criterionId,s.score]))}:{})};
  })
 }))});
}

/** Reject attractive but unusable AI components before they reach the renderer. */
export function validateWorkspaceFit(workspace:ReturnType<typeof parseAIWorkspace>,prompt:string){
 const problems:string[]=[];
 const weeklyIntent=/weekly schedule|schedule for (?:the )?week|plan (?:my|the) week|weekly planner|organize my week|לוז|לו[״׳']?ז|לוח זמנים|תכנון שבועי|לתכנן את השבוע|לארגן את השבוע|לסדר.{0,20}שבוע/iu.test(prompt)&&/week|weekly|לוז|לו[״׳']?ז|לוח זמנים|שבוע/iu.test(prompt);
 const workScheduleIntent=/employee|staff|team shifts|workforce|roster|rota|shift schedule|עובדים|משמרות|סידור עבודה|שיבוץ עובדים/iu.test(prompt);
 const explicitAction=/\b(?:add|build|calculate|compare|create|design|draft|find|make|organize|plan|prepare|research|schedule|track|write|manage|learn|study|book|model|analyze)\b|אני רוצה|אני צריך|אני צריכה|תוסיף|הוסף|ליצור|לכתוב|לתכנן|לארגן|לסדר|לעקוב|לחשב|להשוות|לבנות|להכין|ללמוד|לנהל/iu.test(prompt);
 for(const component of workspace.components){
  const fail=(message:string)=>problems.push(`${component.type}: ${message}`);
  if(component.type==='checklist'&&!component.items.length)fail('needs at least one actionable step');
  if(component.type==='timeline'&&!component.items.length)fail('needs at least one dated or sequenced milestone');
  if(component.type==='kanban'&&(!component.items.length||component.items.some(item=>!item.group?.trim())))fail('needs tasks with a workflow lane');
  if(component.type==='table'&&!component.items.length)fail('needs real structured rows for the requested task');
  if(component.type==='notes'&&!component.text?.trim())fail('needs usable content; an empty note is not a task result');
  if(component.type==='calendar'&&(!component.items.length||component.items.some(item=>!item.date||!/^\d{4}-\d{2}-\d{2}$/.test(item.date))))fail('needs dated events that can be edited');
  if(component.type==='flashcards'&&(!component.items.length||component.items.some(item=>!item.answer?.trim()&&!item.detail?.trim())))fail('each card needs an answer');
  if(component.type==='quiz'&&(!component.items.length||component.items.some(item=>!item.options||item.options.length<2||!item.answer?.trim()||!item.options.includes(item.answer))))fail('each question needs choices and a matching answer key');
  if(component.type==='comparison'&&(!component.criteria?.length||component.items.length<2||component.criteria.every(row=>row.weight===0)||component.items.some(item=>component.criteria!.some(row=>row.weight>0&&!Number.isFinite(item.scores?.[row.id])))))fail('needs at least two options with scores for every weighted criterion');
  if(component.type==='chart'&&(!component.items.length||component.items.some(item=>!Number.isFinite(item.value))))fail('needs real numeric data');
  if(component.type==='links'&&(!component.items.length||component.items.some(item=>!item.url||!item.url.startsWith('https://'))))fail('each resource needs a verified-format HTTPS destination');
  if(component.type==='slider'&&(!Number.isFinite(component.value)||component.value! < 0))fail('needs a non-negative starting value');
  if(component.type==='timer'&&(!Number.isInteger(component.value)||component.value! < 1||component.value! > 180))fail('needs a usable duration from 1 to 180 minutes');
  if(component.type==='weekly_schedule'&&(!component.weeklySchedule||component.weeklySchedule.days.length!==7))fail('needs seven dated day columns with editable start and end times for each event');
  if(component.type==='custom'&&/\b(?:calculator|calculate|compute|formula)\b|מחשבון|חישוב|נוסחה/iu.test(prompt)&&!component.custom?.outputs.length)fail('a calculator needs a formula output that updates from its inputs');
 }
 const requireType=(pattern:RegExp,type:string,label:string)=>{if(pattern.test(prompt)&&!workspace.components.some(component=>component.type===type))problems.push(`The request requires a ${label} component.`)};
 requireType(/\b(?:compare|comparison|evaluate options)\b|להשוו(?:ת|ה)|השוואה/iu,'comparison','working comparison');
 requireType(/\b(?:quiz|test me|practice questions)\b|בחן אותי|בוחן|שאלות תרגול/iu,'quiz','answerable quiz');
 requireType(/\b(?:calculator|calculate|compute|formula)\b|מחשבון|חישוב|לחשב|נוסחה/iu,'custom','purpose-built calculator');
 if(weeklyIntent&&!workspace.components.some(component=>component.type==='weekly_schedule'))problems.push('The request requires a structured weekly schedule with dated days and editable time blocks, not a notes list or milestone timeline.');
 if(weeklyIntent&&workspace.components.some(component=>component.type==='weekly_schedule'&&component.weeklySchedule?.days.some(day=>day.events.some(event=>event.start>=event.end))))problems.push('Every scheduled time block must have an end time after its start time.');
 if(workScheduleIntent&&workspace.components.some(component=>component.type==='weekly_schedule'))problems.push('A staff rota must use the employee scheduling interface, not a personal weekly planner.');
 const hasTaskOutput=workspace.components.some(component=>
  (['checklist','timeline','calendar','weekly_schedule','kanban','flashcards','quiz','comparison'].includes(component.type)&&!!(component.weeklySchedule||component.items.length))||
  (component.type==='table'&&component.items.length>0)||(component.type==='notes'&&!!component.text?.trim())||
  (component.type==='custom'&&!!component.custom?.fields.length)||(component.type==='links'&&component.items.length>0)||
  (component.type==='timer'&&Number.isInteger(component.value)&&component.value!>0)||(component.type==='chart'&&component.items.length>0));
 if(explicitAction&&!hasTaskOutput)problems.push('The requested action needs at least one substantive, usable result component; do not return an empty workspace or decorative controls.');
 if(problems.length)throw new Error(`Workspace does not fit the requested task: ${problems.join('; ')}`);
 return workspace;
}

export const InteractionSchema=z.object({
 intent:z.enum(['conversation','workspace_question','workspace_change','clarification','schedule_change']),
 reply:z.string().min(1).max(4000),
 workspace:ProviderWorkspaceSchema.shape.workspace.nullable()
}).strict();
export const interactionResponseFormat={type:'json_schema',json_schema:{name:'shadowui_interaction',strict:true,schema:zodSchema(InteractionSchema).jsonSchema}};

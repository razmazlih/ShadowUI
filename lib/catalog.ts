import {z} from 'zod';
import {zodSchema} from 'ai';
import {ComponentSchema,type UIComponent} from './schema';
import {evaluateCustomTool} from './custom-tool';

const Id=z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
const MetadataSchema=z.record(z.unknown()).refine(value=>JSON.stringify(value).length<20000,'Schema is too large');
export const ComponentDefinitionSchema=z.object({
 id:Id,version:z.number().int().positive(),name:z.string().min(1).max(160),description:z.string().min(1).max(1500),
 categories:z.array(z.string().max(80)).max(12),tags:z.array(z.string().max(80)).max(30),
 capabilities:z.array(z.string().min(1).max(100)).min(1).max(30),actions:z.array(z.string().min(1).max(100)).min(1).max(30),limitations:z.array(z.string().max(500)).max(20),
 inputSchema:MetadataSchema,outputSchema:MetadataSchema,stateSchema:MetadataSchema,template:ComponentSchema,
 examples:z.array(z.string().max(1000)).max(8),nonFitExamples:z.array(z.string().max(1000)).max(8),
 source:z.enum(['seed','ai','admin']),status:z.enum(['draft','active','retired']),scope:z.enum(['shared','private']),ownerSession:z.string().min(1).max(128).optional(),
 support:z.object({hebrew:z.boolean(),rtl:z.boolean(),mobile:z.boolean(),accessibility:z.boolean()}).strict(),
 createdAt:z.string().datetime(),updatedAt:z.string().datetime(),
}).strict().superRefine((definition,ctx)=>{
 if(definition.scope==='private'&&!definition.ownerSession)ctx.addIssue({code:'custom',path:['ownerSession'],message:'Private definitions require an owner'});
 if(definition.scope==='shared'&&definition.ownerSession)ctx.addIssue({code:'custom',path:['ownerSession'],message:'Shared definitions cannot retain a private owner'});
 if(definition.template.type==='custom'&&!definition.template.custom)ctx.addIssue({code:'custom',path:['template'],message:'Custom definitions require a bounded declarative tool'});
});
export type ComponentDefinition=z.infer<typeof ComponentDefinitionSchema>;
export const CatalogRevisionSchema=z.object({definition:ComponentDefinitionSchema,validation:z.object({valid:z.boolean(),errors:z.array(z.string())}),changedAt:z.string().datetime()}).strict();
export type CatalogRevision=z.infer<typeof CatalogRevisionSchema>;

/** Behavior probes run without executing generated JavaScript or performing external actions. */
export function validateDefinition(input:unknown):{valid:boolean;errors:string[]}{
 const parsed=ComponentDefinitionSchema.safeParse(input);
 if(!parsed.success)return {valid:false,errors:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`)};
 const d=parsed.data,c=d.template,errors:string[]=[];
 if(!c.title.trim())errors.push('An accessible component title is required');
 if(new Set(d.actions).size!==d.actions.length||new Set(d.capabilities).size!==d.capabilities.length)errors.push('Duplicate actions or capabilities');
 if(c.type==='custom'&&c.custom){
  const result=evaluateCustomTool(c.custom);if(result.some(output=>output.error))errors.push('Default formula inputs do not produce finite results');
  if(d.capabilities.includes('calculate')&&!c.custom.outputs.length)errors.push('Calculation requires a formula output');
 }
 if(c.type==='comparison'&&(!c.criteria?.length||c.items.length<2))errors.push('Comparison requires criteria and two options');
 if(c.type==='weekly_schedule'&&(!c.weeklySchedule||c.weeklySchedule.days.length!==7))errors.push('Weekly schedule requires seven dated days');
 if(c.type==='quiz'&&(!c.items.length||c.items.some(item=>!item.answer||!item.options?.includes(item.answer))))errors.push('Quiz requires answerable questions');
 if(c.type==='custom'&&!c.custom?.fields.length)errors.push('A generated tool needs real inputs');
 const supported:Record<UIComponent['type'],string[]>={checklist:['tasks.check','task_tracking','checklist'],timeline:['timeline.edit','milestones','timeline'],calendar:['schedule.events.edit','dated_events','calendar'],weekly_schedule:['schedule.events.edit','weekly_schedule','time_blocks'],kanban:['tasks.organize','workflow','kanban'],table:['data.table.edit','structured_data','table','sum'],comparison:['compare.options','comparison','weighted_ranking'],notes:['notes.edit','write','notes'],timer:['time.track','focus','timer'],chart:['data.chart','numeric_visualization','chart'],slider:['input.range','numeric_constraint','budget'],approval:['decision.approve','local_approval'],custom:['calculate.formula','calculate','formula','input.form'],flashcards:['study.flashcards','flashcards'],quiz:['study.quiz','quiz'],links:['links.open','links']};
 for(const capability of d.capabilities)if(!supported[c.type].includes(capability)&&!(c.type==='custom'&&/^(?:calculate|collect)\.[a-z][a-z0-9_]{0,63}$/.test(capability)))errors.push(`Primitive ${c.type} cannot provide capability ${capability}`);
 if(c.type==='custom'&&d.capabilities.some(capability=>capability.startsWith('calculate.')||['calculate','formula'].includes(capability))&&!c.custom?.outputs.length)errors.push('Formula capability requires working outputs');
 if(d.capabilities.some(capability=>/external|send|purchase|booking|deploy/.test(capability)))errors.push('External execution capabilities are unavailable');
 return {valid:!errors.length,errors};
}

export function instantiateDefinition(definition:ComponentDefinition,instanceId:string):UIComponent{
 const validation=validateDefinition(definition);if(!validation.valid||definition.status!=='active')throw new Error('Definition is not active and validated');
 return ComponentSchema.parse({...structuredClone(definition.template),id:instanceId});
}
export function findCatalogCandidates(definitions:ComponentDefinition[],request:{capabilities:string[];query?:string}){
 const terms=(request.query??'').toLowerCase().split(/\s+/).filter(Boolean);
 return definitions.filter(d=>d.status==='active'&&validateDefinition(d).valid).map(definition=>{
  const covered=request.capabilities.filter(action=>definition.capabilities.includes(action)||definition.actions.includes(action));
  const document=[definition.name,definition.description,...definition.tags,...definition.examples].join(' ').toLowerCase();
  const semantic=terms.length?terms.filter(term=>document.includes(term)).length/terms.length:0;
  return {definition,covered,score:covered.length*100+semantic*10};
 }).filter(candidate=>candidate.covered.length||!request.capabilities.length).sort((a,b)=>b.score-a.score||a.definition.id.localeCompare(b.definition.id));
}

const stateSchema=zodSchema(ComponentSchema).jsonSchema as Record<string,unknown>;
export function primitiveStateSchema(type:UIComponent['type']):Record<string,unknown>{return {...stateSchema,properties:{...(stateSchema.properties as Record<string,unknown>),type:{const:type}}};}
export function primitiveInputSchema(type:UIComponent['type']):Record<string,unknown>{
 const fields=type==='custom'?['custom']:type==='weekly_schedule'?['weeklySchedule']:type==='comparison'?['items','criteria']:['slider','timer','approval'].includes(type)?['value']:type==='notes'?['text']:['items'];
 const properties=stateSchema.properties as Record<string,unknown>;
 return {type:'object',properties:Object.fromEntries(fields.map(field=>[field,properties[field]])),required:fields,additionalProperties:false};
}
export function outputSchema(type:UIComponent['type']):Record<string,unknown>{
 if(type==='custom')return {type:'object',properties:{results:{type:'array',items:{type:'object',properties:{id:{type:'string'},value:{type:['number','null']},error:{type:['string','null']}}}}},required:['results'],additionalProperties:false};
 if(type==='comparison')return {type:'object',properties:{ranking:{type:'array',items:{type:'object',properties:{id:{type:'string'},score:{type:'number'}}}}},required:['ranking'],additionalProperties:false};
 return {type:'object',properties:{items:{type:'array'},value:{type:'number'},text:{type:'string'},weeklySchedule:{type:'object'}},additionalProperties:false};
}
const stamp='2026-10-19T00:00:00.000Z';
export function seedDefinitions():ComponentDefinition[]{
 const specs:Array<{id:string;name:string;description:string;type:UIComponent['type'];capabilities:string[];actions:string[];category:string;template?:Partial<UIComponent>}>= [
  {id:'checklist',name:'Action checklist',description:'Editable tasks with completion tracking.',type:'checklist',capabilities:['task_tracking','checklist'],actions:['add_task','complete_task','remove_task'],category:'organization'},
  {id:'timeline',name:'Milestone timeline',description:'Editable sequenced milestones and dates.',type:'timeline',capabilities:['milestones','timeline'],actions:['add_milestone','edit_date'],category:'planning'},
  {id:'calendar',name:'Dated events',description:'Editable dates and assignments. No external calendar sync.',type:'calendar',capabilities:['dated_events','calendar'],actions:['add_event','assign_owner','edit_date'],category:'planning'},
  {id:'weekly_schedule',name:'Weekly time blocks',description:'Seven dated days with editable activity start and end times.',type:'weekly_schedule',capabilities:['weekly_schedule','time_blocks'],actions:['add_event','edit_time','remove_event'],category:'planning',template:{span:'wide',weeklySchedule:{weekStart:'2026-10-18',days:Array.from({length:7},(_,i)=>({date:`2026-10-${18+i}`,events:[]}))}}},
  {id:'kanban',name:'Workflow board',description:'Move tasks between workflow stages.',type:'kanban',capabilities:['workflow','kanban'],actions:['add_task','move_task','complete_task'],category:'organization'},
  {id:'table',name:'Structured working table',description:'Editable names, details and numeric values with a total.',type:'table',capabilities:['structured_data','table','sum'],actions:['add_row','edit_row','sum_values'],category:'data'},
  {id:'comparison',name:'Weighted comparison',description:'Compare options using explicit scores and adjustable criterion weights.',type:'comparison',capabilities:['comparison','weighted_ranking'],actions:['add_option','score_option','weight_criterion','rank_options'],category:'decisions',template:{criteria:[{id:'fit',label:'Fit',weight:100}],items:[{id:'a',label:'Option A',scores:{fit:0}},{id:'b',label:'Option B',scores:{fit:0}}]}},
  {id:'notes',name:'Editable document',description:'Write and revise text in a persistent workspace.',type:'notes',capabilities:['write','notes'],actions:['write_text','edit_text'],category:'writing',template:{text:''}},
  {id:'timer',name:'Focus timer',description:'Run a bounded focus session with pause and reset.',type:'timer',capabilities:['focus','timer'],actions:['start_timer','pause_timer','reset_timer'],category:'learning',template:{value:25}},
  {id:'chart',name:'Numeric breakdown',description:'Edit numeric categories and visualize their proportions.',type:'chart',capabilities:['numeric_visualization','chart'],actions:['edit_value','add_data_point'],category:'data'},
  {id:'slider',name:'Numeric constraint',description:'Adjust a nonnegative budget or other numeric limit.',type:'slider',capabilities:['numeric_constraint','budget'],actions:['set_limit'],category:'data',template:{value:0}},
  {id:'approval',name:'Local confirmation',description:'Record and undo a local confirmation. Does not execute external actions.',type:'approval',capabilities:['local_approval'],actions:['confirm_local','undo_confirmation'],category:'decisions',template:{text:'Confirmation is recorded locally only.',value:0}},
  {id:'calculator',name:'Formula calculator',description:'Compute a quantity times a unit value with bounded deterministic arithmetic.',type:'custom',capabilities:['calculate','formula'],actions:['enter_input','calculate'],category:'calculation',template:{custom:{purpose:'Multiply quantity by unit value. Replace labels to fit your task.',layout:'form',accent:'blue',fields:[{id:'quantity',label:'Quantity',type:'number',value:'1',options:[],min:0,max:null},{id:'unitValue',label:'Unit value',type:'number',value:'0',options:[],min:0,max:null}],outputs:[{id:'total',label:'Total',expression:['quantity','unitValue','*'],unit:''}]}}},
  {id:'flashcards',name:'Recall cards',description:'Flip question and answer cards for retrieval practice.',type:'flashcards',capabilities:['flashcards'],actions:['reveal_answer'],category:'learning',template:{items:[]}},
  {id:'quiz',name:'Answerable practice quiz',description:'Select answers and receive deterministic feedback from a supplied answer key.',type:'quiz',capabilities:['quiz'],actions:['answer_question','check_answer'],category:'learning',template:{items:[{id:'sample',label:'Which action reveals an answer on a recall card?',options:['Flip the card','Reset the timer'],answer:'Flip the card'}]}},
  {id:'links',name:'Resource links',description:'Open user-supplied HTTP or HTTPS resource destinations.',type:'links',capabilities:['links'],actions:['open_link'],category:'research'},
 ];
 const capability:Record<string,string>={checklist:'tasks.check',timeline:'timeline.edit',calendar:'schedule.events.edit',weekly_schedule:'schedule.events.edit',kanban:'tasks.organize',table:'data.table.edit',comparison:'compare.options',notes:'notes.edit',timer:'time.track',chart:'data.chart',slider:'input.range',approval:'decision.approve',calculator:'calculate.formula',flashcards:'study.flashcards',quiz:'study.quiz',links:'links.open'};
 return specs.map(spec=>ComponentDefinitionSchema.parse({id:spec.id,version:1,name:spec.name,description:spec.description,categories:[spec.category],tags:[spec.type],capabilities:[capability[spec.id],...spec.capabilities],actions:[capability[spec.id],...spec.actions],limitations:['No external service execution or verified external data.','Support flags describe renderer design; generated definitions require separate browser accessibility review.'],inputSchema:primitiveInputSchema(spec.type),outputSchema:outputSchema(spec.type),stateSchema:primitiveStateSchema(spec.type),template:{id:spec.id,type:spec.type,title:spec.name,reason:spec.description,span:'normal',items:[],...spec.template},examples:[spec.description],nonFitExamples:['Sending messages, making purchases, or retrieving live private account data.'],source:'seed',status:'active',scope:'shared',support:{hebrew:true,rtl:true,mobile:true,accessibility:false},createdAt:stamp,updatedAt:stamp}));
}

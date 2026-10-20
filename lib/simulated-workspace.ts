import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {planDemo,isNewGoal} from './planner';
import {WorkspaceSchema,type Workspace,type UIComponent} from './schema';
import {demoTaskContract} from './task-engine';
import {runTaskPipeline,type PipelineDependencies} from './task-pipeline';
import {ComponentDefinitionSchema,seedDefinitions,validateDefinition,type ComponentDefinition} from './catalog';
import {listDefinitions,getDefinition,saveGeneratedDefinition} from './catalog-store';
import {classifyMessage} from './message-intent';
import {applyCandidate} from './patch';
import type {TaskContract} from './task-contract';
const budget={spent:0,limit:0,warning:false};
const emulator=()=>!!process.env.FIRESTORE_EMULATOR_HOST&&(process.env.FIREBASE_PROJECT_ID??'').startsWith('demo-');
// This file is an explicitly local fallback, separate from production catalog data.
const localPath=()=>path.join(process.env.SHADOWUI_SIMULATION_DIR??path.join(process.cwd(),'.shadowui','simulation'),'definitions.json');
let writes:Promise<unknown>=Promise.resolve();
async function localDefinitions():Promise<ComponentDefinition[]>{try{return (JSON.parse(await readFile(localPath(),'utf8')) as unknown[]).map(d=>ComponentDefinitionSchema.parse(d));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}}
async function saveLocal(input:ComponentDefinition,session:string){
 const operation=writes.catch(()=>{}).then(async()=>{const all=await localDefinitions(),old=all.find(d=>d.id===input.id);if(old)return {definition:old,validation:validateDefinition(old)};const definition=ComponentDefinitionSchema.parse({...input,ownerSession:session,status:'active'});const validation=validateDefinition(definition);if(!validation.valid)throw new Error(validation.errors.join('; '));await mkdir(path.dirname(localPath()),{recursive:true});const temp=localPath()+'.tmp';await writeFile(temp,JSON.stringify([...all,definition]),{mode:0o600});await rename(temp,localPath());return {definition,validation};});writes=operation;return operation;
}
function tool(id:string,title:string,fields:Array<[string,string,string]>,outputs:Array<[string,string,string[]]>,purpose=title):UIComponent{return {id,type:'custom',title,reason:purpose,span:'normal',items:[],custom:{purpose,layout:'form',accent:'blue',fields:fields.map(([id,label,value])=>({id,label,value,type:'number',options:[],min:null,max:null})),outputs:outputs.map(([id,label,expression])=>({id,label,expression,unit:''}))}};}
function blank(type:UIComponent['type'],id:string,title:string,extra:Partial<UIComponent>={}):UIComponent{return {id,type,title,reason:title,span:'normal',items:[],...extra};}
const english=(prompt:string)=>!/[א-ת]/.test(prompt);
const numeric=(p:string,key:RegExp)=>p.match(key)?.[1];
export function composeSimulation(prompt:string,current?:Workspace):{workspace:Workspace;contract:TaskContract;patch:boolean}{
 const he=!english(prompt);
 if(current&&/learn|study|exam|ללמוד|למידה|לימוד|מבחן/i.test(current.goal)&&/(?:source|material|notes|חומר|מקור)\s*:/i.test(prompt)){const next=composeSimulation(`${current.goal}\n${prompt}`);return {...next,workspace:{...next.workspace,id:current.id,goal:current.goal},patch:true};}
 const patch=!!current&&!isNewGoal(prompt,current);
 const say=(a:string,b:string)=>he?a:b;
 const base=planDemo(prompt,patch?current:undefined);
 let workspace=base.workspace;
 // Never silently claim unsupported follow-up changes took effect.
 if(patch&&current){
  const add=/^(?:add|הוסף|תוסיף|הוסיפי)/i.test(prompt);
  if(add&&/notes|document|מסמך|הערות/i.test(prompt)&&!current.components.some(c=>c.type==='notes'))workspace.components.push(blank('notes','notes',say('מסמך עבודה','Working document'),{text:''}));
  const contract=structuredClone(current.taskContract??demoTaskContract(current.goal,current.components));
  for(const c of workspace.components.filter(c=>!current.components.some(old=>old.id===c.id))){
   const action={...demoTaskContract(current.goal,[c]).actions[0],id:`added_${c.id}`,componentId:c.id};
   contract.actions.push(action);contract.deliverables.push({id:`result_${action.id}`,label:c.title,actionIds:[action.id]});contract.subtasks.push({id:`step_${action.id}`,label:c.title,actionIds:[action.id],dependsOn:[]});
  }
  return {workspace:WorkspaceSchema.parse({...workspace,taskContract:contract}),contract,patch:true};
 }
 let components:UIComponent[]=[],special=false;
 const inventory=/inventory|equipment|supplies|allocation|מלאי|ציוד|חלוקת|הצפה|שיטפון/i.test(prompt);
 if(inventory){special=true;components=[blank('table','stock',say('ציוד וביקוש','Equipment and demand'),{span:'wide',recordTool:{columns:[{id:'available',label:say('זמין','Available')},{id:'needed',label:say('נדרש','Needed')}],outputs:[{id:'shortage',label:say('חסר','Shortage'),expression:['needed','available','-','0','max'],unit:''},{id:'allocated',label:say('ניתן להקצות','Can allocate'),expression:['available','needed','min'],unit:''}]}})];}
 else if(/calculator|calculate|compute|formula|מחשבון|לחשב|חישוב|נוסחה/i.test(prompt)){
  special=true;
  if(/area|rectangle|שטח|מלבן/i.test(prompt))components=[tool('area',say('שטח מלבן','Rectangle area'),[['width',say('רוחב — להזנה','Width — enter value'),numeric(prompt,/(?:width|רוחב)\s*[:=]?\s*(\d+(?:\.\d+)?)/i)??'0'],['height',say('גובה — להזנה','Height — enter value'),numeric(prompt,/(?:height|גובה|אורך)\s*[:=]?\s*(\d+(?:\.\d+)?)/i)??'0']],[['area',say('שטח','Area'),['width','height','*']]])];
  else if(/ratio|divide|division|יחס|חלוקה/i.test(prompt))components=[tool('ratio',say('חישוב יחס','Ratio'),[['numerator',say('מונה — להזנה','Numerator — enter value'),'0'],['denominator',say('מכנה התחלתי — להזנה','Provisional denominator — enter value'),'1']],[['ratio',say('תוצאה','Result'),['numerator','denominator','/']]])];
  else components=[tool('formula_input',say('הגדרת החישוב','Define the calculation'),[['input',say('קלט מספרי','Numeric input'),'0']],[],say('יש להגדיר את הנוסחה; ההדמיה אינה מסיקה נוסחה חופשית.','Provide the formula; simulation cannot infer arbitrary formulas.'))];
 }
 else if(/learn|study|exam|ללמוד|למידה|לימוד|מבחן/i.test(prompt)){
  special=true;const source=prompt.match(/(?:source|material|notes|חומר|מקור)\s*:\s*([\s\S]+)/i)?.[1]?.trim()??'';
  const facts=source.split(/[\n;]/).map(line=>line.split(/\s*[:=]\s*/)).filter(parts=>parts.length===2&&parts.every(p=>p.trim())).slice(0,20);
  components=[blank('notes','source',say('חומר הלימוד','Study source'),{text:source}),blank('timeline','path',say('תוכנית הלימוד','Learning plan'),{items:[{id:'review',label:say('קריאת החומר וסימון מושגים','Read the source and mark concepts')},{id:'recall',label:say('תרגול שליפה ובדיקת טעויות','Practice recall and review mistakes')}]}),blank('checklist','practice',say('התקדמות הלמידה','Learning progress'),{items:[{id:'read',label:say('לקרוא את חומר הלימוד','Read the study material'),done:false},{id:'practice',label:say('לתרגל ולבדוק מול המקור','Practice and check against the source'),done:false}]}),blank('timer','focus',say('זמן ריכוז','Focus time'),{value:25})];
  if(facts.length){components.push(blank('flashcards','recall',say('כרטיסיות מהמקור','Source flashcards'),{dependsOn:'source',items:facts.map(([q,a],i)=>({id:`card_${i}`,label:q.trim(),answer:a.trim()}))}),blank('quiz','quiz',say('תרגול מהמקור','Source practice'),{dependsOn:'source',items:facts.map(([q,a],i)=>({id:`q_${i}`,label:q.trim(),answer:a.trim(),options:[a.trim(),say('אין התאמה למקור','Does not match the source')]}))}));}
  else components.push(blank('notes','source_hint',say('הכנת תרגול','Prepare practice'),{text:say('להפקת כרטיסיות ובוחן בהדמיה, שלחו: חומר: מושג: הסבר; מושג נוסף: הסבר. אפשר לערוך את החומר כאן.','To create cards and a quiz in simulation, send: source: term: definition; another term: definition. You can edit the source here.')}));
 }
 else if(/budget|expense|תקציב|הוצאות/i.test(prompt)&&!/travel|trip|טיול/i.test(prompt)){
  special=true;const ceiling=numeric(prompt,/(?:budget|תקציב)[^\d]{0,20}(\d+(?:\.\d+)?)/i)??'0';
  components=[blank('table','expenses',say('הוצאות','Expenses')),blank('chart','expense_chart',say('פירוט הוצאות','Expense breakdown')),tool('balance',say('יתרה','Remaining budget'),[['budget',say('תקציב — להזנה','Budget — enter value'),ceiling],['spent',say('הוצאות מהטבלה','Expenses from table'),'0']],[['remaining',say('נותר','Remaining'),['budget','spent','-']]])];
  if(/event|אירוע/i.test(prompt))components.push(blank('checklist','event_tasks',say('משימות האירוע','Event tasks')));
 }
 else if(/compare|comparison|השווא|להשוות/i.test(prompt)){
  special=true;components=[blank('comparison','options',say('השוואת אפשרויות','Compare options'),{span:'wide',criteria:[{id:'benefit',label:say('תועלת','Benefit'),weight:50},{id:'fit',label:say('התאמה','Fit'),weight:50}],items:[{id:'a',label:say('אפשרות א — להזנה','Option A — enter name'),scores:{benefit:0,fit:0}},{id:'b',label:say('אפשרות ב — להזנה','Option B — enter name'),scores:{benefit:0,fit:0}}],text:say('הציונים טרם הוזנו; אפס אינו הערכה.','Scores are unentered; zero is not an assessment.')})];
 }
 else if(/manuscript|document|draft|מסמך|כתב יד|טיוטה/i.test(prompt)){
  special=true;components=[blank('notes','document',say('מסמך לעריכה','Editable document'),{span:'wide',text:prompt.match(/(?:text|טקסט)\s*:\s*([\s\S]+)/i)?.[1]??''}),blank('checklist','revision',say('מעקב תיקונים','Revision checklist'))];
 }
 if(!special){
  components=workspace.components;
  if(!workspace.domain&&!components.some(c=>['weekly_schedule','comparison'].includes(c.type))){
   components=[blank('notes','context',say('מטרה ונתונים','Goal and inputs'),{text:prompt}),blank('table','working_data',say('נתוני עבודה','Working data')),blank('checklist','steps',say('צעדים לביצוע','Action steps'))];
   // A genuinely missing private capability exercises creation, validation and reuse.
   components.push(tool('task_input',say('קלט למשימה','Task input'),[['quantity',say('כמות — להזנה','Quantity — enter value'),'0']],[],say('כלי קלט מקומי בהדמיה. אפשר לערוך נתונים ולהגדיר את הצעד הבא.','Simulated local input tool. Edit the data and define your next step.')));
  }
 }
 workspace=WorkspaceSchema.parse({...workspace,components,...(special?{domain:undefined}:{}),description:say('סביבת עבודה מקומית · הבנת שפה בהדמיה','Local workspace · Simulated language understanding'),bindings:[]});
 if(components.some(c=>c.id==='expenses'))workspace.bindings=[{id:'expenses_chart',source:{componentId:'expenses',port:'items'},target:{componentId:'expense_chart',port:'items'},transform:'copy'},{id:'expenses_sum',source:{componentId:'expenses',port:'items'},target:{componentId:'balance',port:'customField',fieldId:'spent'},transform:'sum'}];
 const contract=demoTaskContract(prompt,components);
 contract.constraints=[];contract.successCriteria=[say('בדיקת התוצאה מול מטרת המשימה והנתונים שהוזנו','Review the result against the objective and supplied inputs')];
 for(const action of contract.actions){
  const c=components.find(c=>c.id===action.datasetId)!;action.componentId=c.id;
  if(c.type==='custom')action.capability=c.custom!.outputs.length?`calculate.${c.id}`:`collect.${c.id}`;
  if(c.recordTool){action.capability='records.inventory';action.inputKind='items';}
 }
 for(const c of components){
  if(c.custom)for(const field of c.custom.fields){
   if(workspace.bindings?.some(b=>b.target.componentId===c.id&&b.target.fieldId===field.id))continue;
   const supplied=field.id==='width'?/(?:width|רוחב)\s*[:=]?\s*\d/i.test(prompt):field.id==='height'?/(?:height|גובה|אורך)\s*[:=]?\s*\d/i.test(prompt):field.id==='budget'?/(?:budget|תקציב)[^\d]{0,20}\d/i.test(prompt):false;
   contract.inputs.push({id:`${c.id}_${field.id}`,label:field.label,kind:'number',required:true,available:supplied,value:supplied?field.value:undefined,binding:{componentId:c.id,port:'customField',fieldId:field.id}});
  }
  if(c.type==='notes'&&['source','document'].includes(c.id))contract.inputs.push({id:c.id,label:c.title,kind:'text',required:true,available:!!c.text?.trim(),value:c.text||undefined,binding:{componentId:c.id,port:'text'}});
  if(['table','comparison'].includes(c.type))contract.inputs.push({id:c.id,label:c.title,kind:'items',required:true,available:c.type!=='comparison'&&c.items.length>0,value:c.items.length?c.items:undefined,binding:{componentId:c.id,port:'items'}});
 }
 if(/live|current price|weather|send|pay|book|מחיר עדכני|מזג אוויר|שלח|תשלום|הזמן טיסה/i.test(prompt)){
  const id='external_data';contract.actions.push({id,capability:'external.retrieve',description:say('מידע או פעולה חיצוניים אינם מחוברים','External data or execution is not connected'),external:true});contract.deliverables.push({id:'external_result',label:say('מידע חיצוני לא מאומת','Unverified external information'),actionIds:[id]});
 }
 return {workspace,contract,patch:false};
}
/** Populate a trusted reused definition, including sanitized shared field identities. */
export function populateSimulation(workspace:Workspace,contract:TaskContract,definitions:ComponentDefinition[]):Workspace{
 const next=structuredClone(workspace);
 for(const c of next.components){
  const action=contract.actions.find(a=>a.componentId===c.id||a.datasetId===c.id);
  const selected=definitions.find(d=>d.template.type===c.type&&!!action&&d.capabilities.includes(action.capability));
  if(!selected)continue;
  const renamed=new Map<string,string>();
  if(c.custom&&selected.template.custom){
   const supplied=c.custom,template=structuredClone(selected.template.custom);
   template.fields=template.fields.map((field,index)=>{const old=supplied.fields[index];if(!old)return field;renamed.set(old.id,field.id);return {...field,label:old.label,value:old.value};});
   template.outputs=template.outputs.map((output,index)=>{const old=supplied.outputs[index];if(old)renamed.set(old.id,output.id);return {...output,label:old?.label??output.label,unit:old?.unit??output.unit};});
   c.custom={...template,purpose:supplied.purpose};
  }
  if(c.recordTool&&selected.template.recordTool){
   const supplied=c.recordTool,template=structuredClone(selected.template.recordTool);
   template.columns=template.columns.map((column,index)=>{const old=supplied.columns[index];if(old)renamed.set(old.id,column.id);return {...column,label:old?.label??column.label};});
   template.outputs=template.outputs.map((output,index)=>({...output,label:supplied.outputs[index]?.label??output.label}));
   c.recordTool=template;c.items=c.items.map(row=>({...row,cells:row.cells?Object.fromEntries(Object.entries(row.cells).map(([id,value])=>[renamed.get(id)??id,value])):{}}));
  }
  for(const input of contract.inputs)if(input.binding?.componentId===c.id&&input.binding.fieldId)input.binding.fieldId=renamed.get(input.binding.fieldId)??input.binding.fieldId;
  for(const binding of next.bindings??[])for(const port of [binding.source,binding.target])if(port.componentId===c.id&&port.fieldId)port.fieldId=renamed.get(port.fieldId)??port.fieldId;
 }
 return next;
}
export async function runSimulation(prompt:string,current:Workspace|undefined,session:string,history:unknown[]=[],overrides:Partial<PipelineDependencies>={}){
 const intent=classifyMessage(prompt,current);
 if(intent.kind!=='workspace')return {operation:'reply',intent:intent.kind,explanation:intent.reply,mode:'demo',simulation:true};
 const draft=composeSimulation(prompt,current);
 // Hosted simulation also needs durable definitions; serverless files are ephemeral.
 const fromDB=emulator()||(process.env.NODE_ENV==='production'&&!!process.env.FIREBASE_PROJECT_ID&&!process.env.FIREBASE_PROJECT_ID.startsWith('demo-'));
 const list:PipelineDependencies['list']=async()=>fromDB?listDefinitions({session}):[...seedDefinitions(),...(await localDefinitions()).filter(d=>d.ownerSession===session)];
 const get:PipelineDependencies['get']=async(id,version)=>fromDB?getDefinition(id,version,{session,includeDrafts:true}):(await list({session})).find(d=>d.id===id&&(!version||d.version===version))??null;
 const deps:Partial<PipelineDependencies>={list,get,saveGenerated:fromDB?saveGeneratedDefinition:saveLocal,
  interpret:async()=>({intent:'workspace_change',reply:english(prompt)?'Your local tools are ready. Language understanding is simulated.':'הכלים המקומיים מוכנים. הבנת השפה בהדמיה.',contract:draft.contract,budget,cached:false}),
  populate:async(contract,definitions)=>({workspace:populateSimulation(draft.workspace,contract,definitions),budget,cached:false}),semantics:async()=>({}),...overrides};
 const result=await runTaskPipeline(prompt,current,session,history,deps);
 if('workspace' in result&&result.workspace){
  if(draft.workspace.domain)result.workspace.domain=draft.workspace.domain;
  if(draft.patch&&current){
   result.workspace={...applyCandidate(current,result.workspace),progress:undefined};
   const amount=numeric(prompt,/(?:budget|תקציב)[^\d]{0,20}(\d+(?:\.\d+)?)/i);
   const budgetField=result.workspace.taskContract?.inputs.find(i=>i.id==='balance_budget')?.binding?.fieldId??'budget';
   if(amount)result.workspace.components=result.workspace.components.map(c=>c.id==='balance'&&c.custom?{...c,custom:{...c.custom,fields:c.custom.fields.map(f=>f.id===budgetField?{...f,value:amount}:f)}}:c.type==='slider'?{...c,value:Number(amount)}:c);
   if(/one hour|1 hour|60 min|שעה/i.test(prompt))result.workspace.components=result.workspace.components.map(c=>c.type==='timer'?{...c,value:60}:c);
   result.workspace=WorkspaceSchema.parse(result.workspace);
  }
 }
 return {...result,mode:'demo',simulation:true,catalogStorage:fromDB?(emulator()?'emulator':'firebase'):'local',explanation:draft.patch?(english(prompt)?'Kept your edits. Simulation supports time and budget adjustments; other requests are recorded in context.':'העריכות נשמרו. ההדמיה תומכת בשינוי זמן ותקציב; בקשות אחרות נרשמות בהקשר.'):result.explanation};
}

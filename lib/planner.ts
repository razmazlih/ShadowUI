import { relevantLinks } from './relevant-links';
import { WorkspaceSchema, type Workspace, type UIComponent, type PlanResult, type Item } from './schema';

type Features = { learning:boolean; dates:boolean; team:boolean; schedule:boolean; travel:boolean; decision:boolean; budget:boolean };
const features=(s:string):Features=>({learning:/study|exam|learn|quiz|biology|flashcard|ללמוד|מבחן/i.test(s),dates:/day|week|schedule|deadline|trip|exam|calendar|יום|שבוע/i.test(s),team:/employee|shift|team|staff|volunteer|project|launch|עובד|משמרת|צוות|סידור עבודה/i.test(s),schedule:/shift|roster|employee.*schedul|schedul.*employee|משמרת|סידור עבודה/i.test(s),travel:/trip|travel|flight|fly|hotel|japan|itinerary|טיול|טיס|לטוס|תעופה|מלון|חופשה/i.test(s),decision:/compare|decid|opportunit|option|choose|השוו|להשוות/i.test(s),budget:/budget|cost|money|תקציב/i.test(s)});
const rows=(labels:string[], extras:Partial<Item>={}):Item[]=>labels.map((label,i)=>({id:`item-${i}`,label,...extras}));
function component(type:UIComponent['type'],title:string,reason:string,items:Item[]=[],extra:Partial<UIComponent>={}):UIComponent{return {id:type,type,title,reason,span:'normal',items,...extra};}
export function isNewGoal(prompt:string,current?:Workspace):boolean {
 if(!current)return true;
 if(/^(new workspace|start over|new goal|now help me|now (?:i want|i need)|switch to|מעכשיו|עכשיו עזור)\b/i.test(prompt))return true;
 const next=features(prompt), old=features(current.goal);
 return (Object.keys(next) as (keyof Features)[]).some(k=>!['dates','budget'].includes(k)&&next[k]&&!old[k]);
}
export function planDemo(prompt:string,current?:Workspace):PlanResult {
 const patch=!!current&&!isNewGoal(prompt,current);
 const biology=/biology|cell|mitosis|meiosis|ביולוגיה/i.test(patch?current!.goal:prompt);
 if(patch&&current){
  const workspace:Workspace=structuredClone(current);
  workspace.description=`Demo workspace · Updated locally: ${prompt.slice(0,220)}`;
  if(/one hour|1 hour|60 min|שעה/i.test(prompt)){
   const timer=workspace.components.find(c=>c.type==='timer');if(timer)timer.value=60;
   const timeline=workspace.components.find(c=>c.type==='timeline');if(timeline)timeline.items=rows(['10 min · Review the most difficult topic','35 min · Active recall and practice','15 min · Check mistakes and summarize']);
  }
  const days=duration(prompt);if(days&&features(current.goal).travel){const timeline=workspace.components.find(c=>c.type==='timeline');if(timeline){const generated=tripDays(days,current.goal);timeline.items=generated.map((item,i)=>timeline.items[i]?{...timeline.items[i],label:item.label}:item);}}
  if(/daniel/i.test(prompt)&&/wednesday|wed\b/i.test(prompt)){
   const cal=workspace.components.find(c=>c.type==='calendar');if(cal)cal.items=cal.items.map(i=>i.label.includes('Daniel')&&i.date?.endsWith('-21')?{...i,label:i.label.replace('Daniel','Unassigned'),group:'unassigned',detail:'Daniel unavailable Wednesday; assign an available employee.'}:i);
  }
  if(/two days off|2 days off/i.test(prompt)){
   const notes=workspace.components.find(c=>c.type==='notes');if(notes)notes.text=`${notes.text??''}\nConstraint: each employee must have at least two days off. Calendar checks assignments locally.`;
  }
  const budget=prompt.match(/(?:budget|תקציב)[^\d]{0,15}(\d[\d,]*)/i);if(budget){const slider=workspace.components.find(c=>c.type==='slider');if(slider)slider.value=Number(budget[1].replaceAll(',',''));}
  if(/test me|quiz me/i.test(prompt)&&!workspace.components.some(c=>c.type===(biology?'quiz':'table')))workspace.components.push(quiz(biology));
  if(!/one hour|1 hour|60 min|שעה|daniel|two days off|2 days off|budget|תקציב|test me|quiz me/i.test(prompt)){
   const notes=workspace.components.find(c=>c.type==='notes');if(notes)notes.text=`${notes.text??''}\nRequested adjustment: ${prompt}`;
  }
  const links=relevantLinks(`${current.goal} ${prompt}`);
  if(links && !workspace.components.some(c=>c.type==='links'))workspace.components.unshift(links);
  return {workspace:WorkspaceSchema.parse(workspace),mode:'demo',operation:'patch',explanation:'Updated the relevant local components and retained your existing work. Demo rules support time, budget and availability constraints; other requests are recorded as notes.'};
 }
 const f=features(prompt), components:UIComponent[]=[];
 // Independent capability rules compose primitives; domains never select a fixed page layout.
 components.push(component('checklist',f.learning?'Your learning path':f.travel?'Before you go':'Next moves','The goal benefits from actionable steps.',rows(f.learning?(biology?['Review cell structure','Understand mitosis and meiosis','Practice active recall']:['Add the topics from your syllabus','Identify difficult concepts','Practice active recall']):f.travel?['Choose travel dates','Compare accommodation','Confirm transit and entry requirements']:['Define a successful outcome','List constraints and unknowns','Complete the first small experiment'],{done:false})));
 if(f.dates)components.push(component('timeline','A plan that fits','Time references call for a sequence of milestones.',rows(f.learning?['Day 1 · Understand the foundations','Day 2 · Recall and practice','Day 3 · Review weak points']:f.travel?tripDays(duration(prompt)??5,prompt).map(i=>i.label):['Monday · Set priorities','Wednesday · Check progress','Friday · Review outcomes'])));
 if(f.learning){components.push(component('flashcards','Active recall','Learning benefits from retrieval practice.',biology?[{id:'cell',label:'What does a mitochondrion do?',answer:'Produces ATP through cellular respiration.'},{id:'mitosis',label:'What is the outcome of mitosis?',answer:'Two genetically identical daughter cells.'},{id:'meiosis',label:'How does meiosis differ?',answer:'It produces four genetically varied haploid cells.'}]:[{id:'your-card',label:'Add your first question from your study material',answer:'Edit this answer using your course notes.'}]));if(biology)components.push(quiz(true));else components.push(component('table','Build your question bank','Your subject requires your own source material in Demo mode.',rows(['Add a question from your syllabus'],{detail:'Write the verified answer here'})));components.push(component('timer','Focus session','A bounded session makes the plan actionable.',[],{value:25}));}
 if(f.schedule)components.push(component('calendar','Team schedule','Assignments and dates need editable calendar events.',Array.from({length:10},(_,i)=>({id:`shift-${i}`,label:`${['Daniel','Maya','Noa','Amir','Daniel','Yael','Lior','Maya','Noa','Amir'][i]} · ${i%2?'Late':'Early'}`,date:`2026-10-${19+Math.floor(i/2)}`,group:['Daniel','Maya','Noa','Amir','Daniel','Yael','Lior','Maya','Noa','Amir'][i],detail:'Demo shift · 8 hours'})),{span:'wide'}));
 if(f.team&&!f.schedule)components.push(component('kanban','Move the work forward','Shared work benefits from a visible flow and direct reassignment.',rows(['Define the first deliverable','Assign an owner','Review readiness'],{group:'To do'}),{span:'wide'}));
 if(f.budget)components.push(component('slider','Budget ceiling','A numeric constraint needs a direct adjustment control.',[],{value:parseBudget(prompt)??1500}));
 if(f.travel||f.budget)components.push(component('chart','Cost breakdown','Structured amounts can be inspected and edited.',f.travel?[{id:'stay',label:'Accommodation',value:500},{id:'food',label:'Food',value:200},{id:'transit',label:'Transportation',value:180},{id:'activities',label:'Activities',value:120}]:[{id:'resources',label:'Resources · estimate',value:300},{id:'materials',label:'Materials · estimate',value:200},{id:'reserve',label:'Contingency · estimate',value:100}],{dependsOn:f.budget?'slider':undefined}));
 if(f.decision)components.push(component('comparison','Evaluate the possibilities','Comparisons need explicit scores, assumptions and adjustable weights.',[{id:'option-a',label:'Option A',scores:{demand:70,effort:80,upside:60}},{id:'option-b',label:'Option B',scores:{demand:90,effort:40,upside:85}},{id:'option-c',label:'Option C',scores:{demand:50,effort:95,upside:45}}],{span:'wide',criteria:[{id:'demand',label:/business|opportunit/i.test(prompt)?'Customer demand':'Expected benefit',weight:40},{id:'effort',label:'Ease of execution',weight:35},{id:'upside',label:/business|opportunit/i.test(prompt)?'Potential return':'Long-term value',weight:25}]}));
 if(!f.learning&&!f.travel&&!f.team&&!f.decision)components.push(component('table','Working canvas','An unfamiliar goal benefits from editable structured information.',rows(['Resources available','Key uncertainty','First experiment'],{detail:'Add your own evidence',value:0}),{span:'wide'}));
 if(f.schedule||f.decision)components.push(component('approval','Review & confirm','Consequential proposals should be explicitly confirmed.',[],{text:'Confirmation saves a local decision only. No external service is connected.'}));
 const links=relevantLinks(prompt);if(links)components.push(links);
 components.push(component('notes','Context & assumptions','Keep user context visible and editable.',[],{text:`Goal: ${prompt}\n\nDemo mode: example content and estimates, not verified external data.${f.team?'\nExample roster: Daniel, Maya, Noa, Amir, Lior and Yael.':''}${f.decision?'\nSample options and scores are illustrative. Replace them with your evidence.':''}`}));
 const title=prompt.replace(/^(help me|i (?:want|need) to)\s+/i,'').slice(0,65);
 if(/(?:send|transfer|pay|book|purchase|deploy|publish|email|delete|connect).*(?:money|bank|flight|hotel|email|account|production|external)|(?:hack|steal|bypass)/i.test(prompt))components.unshift(component('notes','Capability boundary','Requested external execution requires an integration this application does not have.',[],{id:'capability-boundary',text:'I cannot execute that external action. No payment, booking, message, deployment or account change has occurred. You can use this workspace to prepare a checklist, compare options or record a decision locally.'}));
 const id=crypto.randomUUID();
 return {workspace:WorkspaceSchema.parse({id,...(f.schedule?{domain:{kind:'schedule',id}}:{}),title:title.charAt(0).toUpperCase()+title.slice(1),description:'An interactive environment composed around your intent · Demo data',goal:prompt,components}),mode:'demo',operation:'create',explanation:'Composed independent capabilities from time, learning, assignments, budget and decision signals. All changes stay local.'};
}
function quiz(biology=true):UIComponent{if(!biology)return component('table','Practice questions','Add verified subject material before testing.',rows(['Your question'],{detail:'Your verified answer'}));return component('quiz','Check your understanding','Immediate feedback reveals gaps.',[{id:'q1',label:'Which process produces two identical daughter cells?',options:['Mitosis','Meiosis','Fertilization'],answer:'Mitosis'},{id:'q2',label:'Where is most cellular ATP produced?',options:['Mitochondria','Nucleus','Cell wall'],answer:'Mitochondria'}]);}

function parseBudget(prompt:string):number|undefined {const match=prompt.match(/(?:budget|תקציב)[^\d]{0,20}(\d[\d,]*)/i);return match?Number(match[1].replaceAll(',','')):undefined;}
function duration(prompt:string):number|undefined {const words:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,ten:10};const match=prompt.match(/(\d+|one|two|three|four|five|six|seven|ten)[ -]*(?:day|days|יום|ימים)/i);if(!match)return;return Math.max(1,Math.min(30,words[match[1].toLowerCase()]??Number(match[1])));}
function tripDays(days:number,prompt:string):Item[]{const japan=/japan|tokyo|kyoto/i.test(prompt);return Array.from({length:days},(_,i)=>({id:`item-${i}`,label:`Day ${i+1} · ${i===days-1?'Return and reflect':japan?['Tokyo neighborhoods','Museums and local food','Kyoto exploration','Explore at your pace'][i%4]:'Choose a destination and one main activity'}`}));}

export const isSchedulingGoal=(prompt:string)=>features(prompt).schedule;

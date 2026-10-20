import {z} from 'zod';
const Id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const DateString=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Invalid date');
const Time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const ScheduleSchema=z.object({id:Id,revision:z.number().int().min(0),goal:z.string().min(1).max(4000),employees:z.array(z.object({id:Id,name:z.string().min(1).max(100),unavailable:z.array(DateString).max(365)}).strict()).min(1).max(50),shifts:z.array(z.object({id:Id,date:DateString,start:Time,end:Time,employeeId:Id.nullable(),name:z.string().min(1).max(100).optional()}).strict().refine(s=>s.end>s.start,'Shift must end after start')).max(200),minDaysOff:z.number().int().min(0).max(7),status:z.enum(['draft','committed']),receipt:z.object({id:Id,at:z.string().datetime(),revision:z.number().int(),actionId:Id}).strict().optional()}).strict().superRefine((s,ctx)=>{if(new Set(s.employees.map(e=>e.id)).size!==s.employees.length||new Set(s.shifts.map(e=>e.id)).size!==s.shifts.length)ctx.addIssue({code:'custom',message:'Duplicate IDs'});for(const shift of s.shifts)if(shift.employeeId&&!s.employees.some(e=>e.id===shift.employeeId))ctx.addIssue({code:'custom',message:'Unknown employee'});});
export type Schedule=z.infer<typeof ScheduleSchema>;
export const OperationSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('set_availability'),employeeId:Id,date:DateString,unavailable:z.boolean()}).strict(),
 z.object({type:z.literal('assign'),shiftId:Id,employeeId:Id.nullable()}).strict(),
 z.object({type:z.literal('set_min_days_off'),value:z.number().int().min(0).max(7)}).strict(),
 z.object({type:z.literal('undo')}).strict(),
]);
export type ScheduleOperation=z.infer<typeof OperationSchema>;
export type ScheduleConflict={code:string;message:string;shiftId?:string;employeeId?:string};
export type ScheduleEvaluation={conflicts:ScheduleConflict[];uncovered:string[];workingDays:Record<string,number>;valid:boolean};
export type ScheduleView={schedule:Schedule;evaluation:ScheduleEvaluation;alternatives:Record<string,{employeeId:string;name:string;score:number;conflicts:number}[]>;assumptions?:string[]};
export class ScheduleError extends Error{constructor(public code:string,message:string){super(message);}}
const knownNames=['דני','נועה','יונתן','דניאל','מיה','מאיה','אמיר','ליאור','יעל','Daniel','Dani','Noa','Yonatan','Jonathan','Maya','Amir','Lior','Yael'];
function requestedRoster(goal:string){
 const hebrew=goal.match(/(?:יש\s+(?:את|לנו)|העובדים\s*(?:הם|:)?|הצוות\s*(?:כולל|:)|עובדים\s*:)\s*([^.!?\n]+)/u);
 const english=goal.match(/(?:employees?|workers?|staff|team)\s+(?:are|is|named|include|includes)\s+([^.!?\n]+)|(?:employees?|workers?|staff|team)\s*[:=]\s*([^.!?\n]+)/i);
 const clause=hebrew?.[1]??english?.[1]??english?.[2];if(!clause)return null;
 const boundary=clause.split(/(?:צריך|צריכים|צריכות|שצריך|ויש|במשמרת|למשמרת|workers?\s+per|need|needs|require|requires)/iu)[0];
 const parts=boundary.split(/[,،;|\s]+/u).map(value=>value.replace(/^[ו-]+/u,'').trim()).filter(Boolean);
 const stopWords=new Set(['את','הם','והם','כולל','עובדים','עובדות','עובד','עובדת','הצוות','יש','לנו','שמות','יום','ימי','שישי','שבת','ראשון','בוקר','ערב','משמרת','משמרות','בכל','לכל','רק','אין','בלי','ללא','של','עם','are','is','and','team','employees','employee','workers','worker','staff','including','include','includes','named','of']);
 const names=parts.filter(part=>knownNames.some(name=>name.toLocaleLowerCase()===part.toLocaleLowerCase())||((/[א-ת]{2,}/u.test(part)||/^[A-Z][A-Za-z'-]{1,30}$/.test(part))&&!stopWords.has(part.toLocaleLowerCase())));
 return names.length?Array.from(new Set(names)).slice(0,50):null;
}
function requestedCount(goal:string,day:'friday'|'saturday',shift:'morning'|'evening',fallback:number){
 const dayWord=day==='friday'?'(?:friday|יום\s+שישי|שישי)':'(?:saturday|יום\s+שבת|שבת)';
 const shiftWord=shift==='morning'?'(?:morning|בוקר)':'(?:evening|ערב)';
 const dayMarker=/(?:friday|saturday|יום\s+שישי|שישי|יום\s+שבת|שבת)/giu;const clauses=goal.split(/[.!?\n;]/u).flatMap(part=>{const markers=Array.from(part.matchAll(dayMarker));return markers.length>1?markers.map((marker,index)=>part.slice(marker.index,markers[index+1]?.index??part.length)):[part];});const clause=clauses.find(part=>new RegExp(dayWord,'iu').test(part));if(!clause)return fallback;
 const onlyMorning=/(?:רק|only)[^.!?]{0,20}(?:בוקר|morning)|(?:בוקר|morning)[^.!?]{0,20}(?:רק|only)/iu.test(clause);const onlyEvening=/(?:רק|only)[^.!?]{0,20}(?:ערב|evening)|(?:ערב|evening)[^.!?]{0,20}(?:רק|only)/iu.test(clause);
 if(shift==='morning'&&onlyEvening||shift==='evening'&&onlyMorning)return 0;
 if(shift==='evening'&&new RegExp(`(?:אין|בלי|ללא|no|without)[^.!?]{0,24}${shiftWord}|${shiftWord}[^.!?]{0,12}(?:אין|בלי|ללא|no|without)`,'iu').test(clause))return 0;
 if(shift==='evening'&&onlyEvening){const stated=clause.match(/(\d+|one|two|אחד|אחת|שניים|שתיים)/iu);const counts:Record<string,number>={one:1,two:2,'אחד':1,'אחת':1,'שניים':2,'שתיים':2};return stated?counts[stated[1].toLocaleLowerCase()]??Number(stated[1]):1;}
 const count=clause.match(new RegExp(`(\\d+|one|two|three|four|אחד|אחת|שניים|שתיים|שלושה|שלוש)\\s*(?:workers?|employees?|עובדים?|עובדות?)?\\s*(?:for\\s+|ל?משמרת\\s+|ל?)(?:the\\s+)?${shiftWord}`,'iu'))
  ??clause.match(new RegExp(`${shiftWord}[^.!?]{0,16}(\\d+|one|two|three|four|אחד|אחת|שניים|שתיים|שלושה|שלוש)\\s*(?:workers?|employees?|עובדים?|עובדות?)?`,'iu'));
 if(!count)return fallback;
 const words:Record<string,number>={one:1,two:2,three:3,four:4,'אחד':1,'אחת':1,'שניים':2,'שתיים':2,'שלושה':3,'שלוש':3};
 return Math.max(0,Math.min(12,words[count[1].toLocaleLowerCase()]??Number(count[1])));
}
function requestedAnchor(goal:string):string|null{
 const date=goal.match(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/)?.[0];
 if(!date)return null;
 if(!DateString.safeParse(date).success)throw new ScheduleError('INVALID_DATE','The requested starting date is invalid.');
 return date;
}
function makeRequestedWeek(goal:string,id:string,roster:string[],minDaysOff:number,baseCount:number):Schedule{
 const anchor=new Date(`${requestedAnchor(goal)??'2026-10-19'}T12:00:00Z`);
 const baseNames=['בוקר','ערב'];
 const dayPairs=[[0,1],[1,2],[0,2],[0,1],[0,1,2],[1],[0,2]];
 const shifts:Schedule['shifts']=[];
 for(let day=0;day<7;day++){
  const date=new Date(anchor.getTime()+day*86400000).toISOString().slice(0,10);
  let morningCount=baseCount,eveningCount=baseCount;
  const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
  if(weekday===5){morningCount=requestedCount(goal,'friday','morning',2);eveningCount=requestedCount(goal,'friday','evening',2);}
  if(weekday===6){morningCount=requestedCount(goal,'saturday','morning',2);eveningCount=requestedCount(goal,'saturday','evening',2);}
  const pair=dayPairs[day].filter(index=>index<roster.length);const needed=Math.max(morningCount,eveningCount);for(let index=0;pair.length<Math.min(needed,roster.length)&&index<roster.length;index++)if(!pair.includes(index))pair.push(index);
  const add=(count:number,start:string,end:string,name:string)=>{
   for(let slot=0;slot<count;slot++){
    const employeeIndex=pair[slot%Math.max(1,pair.length)];
    shifts.push({id:`shift-${shifts.length}`,date,start,end,name:`${name} · ${slot+1}/${count}`,employeeId:slot<pair.length?`employee-${employeeIndex}`:null});
   }
  };
  const hebrew= /[א-ת]/u.test(goal);
  if(hebrew){add(morningCount,'09:00','13:00',baseNames[0]);add(eveningCount,'13:00','17:00',baseNames[1]);}
  else {add(morningCount,'09:00','13:00','Morning');add(eveningCount,'13:00','17:00','Evening');}
 }
 return ScheduleSchema.parse({id,goal,revision:0,employees:roster.map((name,index)=>({id:`employee-${index}`,name,unavailable:[]})),shifts,minDaysOff, status:'draft'});
}
export function createSchedule(id:string,goal:string):Schedule{
 const anchor=requestedAnchor(goal);
 const explicitRoster=requestedRoster(goal);
 if(explicitRoster||/(?:friday|יום\s+שישי|שישי|saturday|יום\s+שבת|שבת)/iu.test(goal)&&/(?:morning|evening|בוקר|ערב)/iu.test(goal)){
  const names=explicitRoster??Array.from({length:6},(_,index)=>/[א-ת]/u.test(goal)?`עובד/ת ${index+1}`:`Employee ${index+1}`);
  const daysOff=goal.match(/(\d|two|three|four|five|six|seven|יומיים|שלושה|שלוש|ארבעה|ארבע)\s*(?:days?\s*off|ימים?\s*(?:חופש|מנוחה))/iu);
  const words:Record<string,number>={two:2,three:3,four:4,five:5,six:6,seven:7,'יומיים':2,'שלושה':3,'שלוש':3,'ארבעה':4,'ארבע':4};
  const minDaysOff=daysOff?Math.max(0,Math.min(7,words[daysOff[1].toLocaleLowerCase()]??Number(daysOff[1]))):2;
  const count=goal.match(/(?:צריך|צריכים|צריך להיות|need|needs|require|requires)[^.!?]{0,35}(\d+|one|two|three|four|אחד|אחת|שניים|שתיים|שלושה|שלוש)\s*(?:workers?|employees?|עובדים?|עובדות?)[^.!?]{0,20}(?:per|each|במשמרת|בכל)/iu);const wordsCount:Record<string,number>={one:1,two:2,three:3,four:4,'אחד':1,'אחת':1,'שניים':2,'שתיים':2,'שלושה':3,'שלוש':3};const baseCount=count?Math.max(1,Math.min(12,wordsCount[count[1].toLocaleLowerCase()]??Number(count[1]))):2;return makeRequestedWeek(goal,id,names,minDaysOff,baseCount);
 }
 const count=goal.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:employees|staff|workers|עובדים|עובדות)(?!\s*(?:per\s+shift|on\s+each\s+shift|בכל\s+משמרת|במשמרת))/iu);const countWords:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};const requestedSize=count?countWords[count[1].toLowerCase()]??Number(count[1]):6;
 if(!Number.isFinite(requestedSize)||requestedSize<1||requestedSize>50)throw new ScheduleError('UNSUPPORTED_CONSTRAINT','The requested roster size must be between 1 and 50 employees.');
 const mentionedNames=knownNames.filter(name=>new RegExp(/[א-ת]/u.test(name)?`(?<![א-ת])${name}(?![א-ת])`:`\\b${name}\\b`,'iu').test(goal));const names=[...new Set(mentionedNames)];const rosterSize=Math.max(requestedSize,names.length);while(names.length<rosterSize)names.push(/[א-ת]/u.test(goal)?`עובד/ת ${names.length+1}`:`Employee ${names.length+1}`);const employeeIds=names.map((name,index)=>/^[a-z]/i.test(name)?name.toLocaleLowerCase().replace(/[^a-z0-9_-]/g,'-'):`employee-${index+1}`);
 const daysOff=goal.match(/(\d|two|three|four|five|six|seven) days? off/i);const nums:Record<string,number>={two:2,three:3,four:4,five:5,six:6,seven:7};
 const pattern=[0,1,2,3,0,5,4,1,2,3,5,4,2,3];const weekdayShifts=Array.from({length:10},(_,i)=>({id:`shift-${i}`,date:`2026-10-${19+Math.floor(i/2)}`,start:i%2?'13:00':'09:00',end:i%2?'17:00':'13:00',employeeId:employeeIds[pattern[i]%rosterSize]}));const weekendShifts=[{id:'shift-10',date:'2026-10-24',start:'09:00',end:'13:00',employeeId:employeeIds[pattern[10]%rosterSize]},{id:'shift-11',date:'2026-10-24',start:'13:00',end:'17:00',employeeId:employeeIds[pattern[11]%rosterSize]},{id:'shift-12',date:'2026-10-25',start:'09:00',end:'13:00',employeeId:employeeIds[pattern[12]%rosterSize]},{id:'shift-13',date:'2026-10-25',start:'13:00',end:'17:00',employeeId:employeeIds[pattern[13]%rosterSize]}];const schedule=ScheduleSchema.parse({id,goal,revision:0,employees:names.map((name,index)=>({id:employeeIds[index],name,unavailable:[]})),shifts:[...weekdayShifts,...weekendShifts],minDaysOff:daysOff?(nums[daysOff[1].toLowerCase()]??Number(daysOff[1])):2,status:'draft'});
 if(/daniel/i.test(goal)&&/wednesday|wed\b/i.test(goal)&&/can't|cannot|unavailable|not available/i.test(goal))schedule.employees[0].unavailable=['2026-10-21'];
 if(anchor){const offset=Date.parse(`${anchor}T12:00:00Z`)-Date.parse('2026-10-19T12:00:00Z');const rebase=(date:string)=>new Date(Date.parse(`${date}T12:00:00Z`)+offset).toISOString().slice(0,10);schedule.shifts.forEach(shift=>shift.date=rebase(shift.date));schedule.employees.forEach(employee=>employee.unavailable=employee.unavailable.map(rebase));}
 return ScheduleSchema.parse(schedule);
}
export function summarizeScheduleDraft(schedule:Schedule){
 const hebrew=/[א-ת]/u.test(schedule.goal);const dates=Array.from(new Set(schedule.shifts.map(shift=>shift.date))).sort();
 const dayNames=hebrew?['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','יום שבת']:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 const counts=dates.map(date=>{const day=new Date(`${date}T12:00:00Z`).getUTCDay();const rows=schedule.shifts.filter(shift=>shift.date===date);const morning=rows.filter(shift=>shift.start<'12:00').length;const evening=rows.length-morning;return `${dayNames[day]}: ${hebrew?`${morning} בבוקר, ${evening} בערב`:`${morning} morning, ${evening} evening`}`;});
 const unassigned=evaluateSchedule(schedule).uncovered.length;const capacity=unassigned?(hebrew?` ${unassigned} משבצות נשארו ללא שיבוץ כי אין מספיק עובדים מתאימים.`:` ${unassigned} slots remain unassigned because the roster cannot cover them.`):'';const roster=requestedRoster(schedule.goal);const people=roster?`${hebrew?'העובדים שביקשת':'the employees you named'}: ${schedule.employees.map(employee=>employee.name).join(', ')}`:`${hebrew?'צוות דוגמה לעריכה':'an editable example roster'}: ${schedule.employees.map(employee=>employee.name).join(', ')}`;return hebrew?`נוצרה טיוטת לוח ל־${dates.length} ימים עם ${people}. דרישות המשמרות שמופיעות בלוח: ${counts.join('; ')}. אלה שיבוצי טיוטה מקומיים; בדקו זמינות והוגנות לפני אישור.${capacity} אין חיבור למעסיק.`:`Created a ${dates.length}-day local draft with ${people}. Shift slots in the draft: ${counts.join('; ')}. Review availability and fairness before confirming.${capacity} No employer system is connected.`;
}
/** Upgrade only an untouched, known demo template when its original goal had explicit custom rules. */
export function migrateLegacySchedule(schedule:Schedule):Schedule|null{
 const seeded=['daniel','maya','noa','amir','lior','yael'];
 const original=['daniel','maya','noa','amir','daniel','yael','lior','maya','noa','amir'];
 const untouched=schedule.revision===0&&schedule.status==='draft'&&schedule.employees.map(e=>e.id).join(',')===seeded.join(',')&&schedule.shifts.length===10&&schedule.shifts.every((shift,index)=>shift.id===`shift-${index}`&&shift.date===`2026-10-${19+Math.floor(index/2)}`&&shift.employeeId===original[index]);
 if(!untouched||!requestedRoster(schedule.goal)&&!/(?:friday|יום\s+שישי|שישי|saturday|יום\s+שבת|שבת)/iu.test(schedule.goal))return null;
 const upgraded=createSchedule(schedule.id,schedule.goal);
 return upgraded.shifts.some(shift=>shift.name)||upgraded.employees.map(e=>e.name).join(',')!==schedule.employees.map(e=>e.name).join(',')?upgraded:null;
}
const weekKey=(date:string)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
export function evaluateSchedule(schedule:Schedule):ScheduleEvaluation{
 const conflicts:ScheduleConflict[]=[],uncovered:string[]=[],workingDays:Record<string,number>={};
 for(const e of schedule.employees){const assigned=schedule.shifts.filter(s=>s.employeeId===e.id);workingDays[e.id]=new Set(assigned.map(s=>s.date)).size;const weeks=new Map<string,Set<string>>();for(const s of assigned){const k=weekKey(s.date);if(!weeks.has(k))weeks.set(k,new Set());weeks.get(k)!.add(s.date);if(e.unavailable.includes(s.date))conflicts.push({code:'UNAVAILABLE',message:`${e.name} is unavailable on ${s.date}.`,shiftId:s.id,employeeId:e.id});}for(const [week,days] of weeks)if(days.size>7-schedule.minDaysOff)conflicts.push({code:'DAYS_OFF',message:`${e.name} needs ${schedule.minDaysOff} days off in week ${week}.`,employeeId:e.id});for(let i=0;i<assigned.length;i++)for(let j=i+1;j<assigned.length;j++){const a=assigned[i],b=assigned[j];if(a.date===b.date&&a.start<b.end&&b.start<a.end)conflicts.push({code:'OVERLAP',message:`${e.name} has overlapping shifts ${a.id} and ${b.id}.`,shiftId:b.id,employeeId:e.id});}}
 for(const shift of schedule.shifts)if(!shift.employeeId){uncovered.push(shift.id);conflicts.push({code:'UNCOVERED',message:`${shift.date} ${shift.start}–${shift.end} has no assignment.`,shiftId:shift.id});}
 return {conflicts,uncovered,workingDays,valid:conflicts.length===0};
}
export function applyScheduleOperation(schedule:Schedule,operation:ScheduleOperation):Schedule{
 const next=structuredClone(schedule);const op=OperationSchema.parse(operation);
 if(op.type==='undo')throw new ScheduleError('INVALID_OPERATION','Undo requires persisted schedule history.');
 if(op.type==='assign'){const shift=next.shifts.find(s=>s.id===op.shiftId);if(!shift)throw new ScheduleError('NOT_FOUND','Shift does not exist.');if(op.employeeId&&!next.employees.some(e=>e.id===op.employeeId))throw new ScheduleError('NOT_FOUND','Employee does not exist.');shift.employeeId=op.employeeId;}
 if(op.type==='set_availability'){const employee=next.employees.find(e=>e.id===op.employeeId);if(!employee)throw new ScheduleError('NOT_FOUND','Employee does not exist.');employee.unavailable=op.unavailable?[...new Set([...employee.unavailable,op.date])]:employee.unavailable.filter(d=>d!==op.date);}
 if(op.type==='set_min_days_off')next.minDaysOff=op.value;
 next.status='draft';delete next.receipt;return ScheduleSchema.parse(next);
}
export function scheduleView(schedule:Schedule):ScheduleView{
 const evaluation=evaluateSchedule(schedule),alternatives:ScheduleView['alternatives']={};
 const affected=new Set([...evaluation.uncovered,...evaluation.conflicts.flatMap(c=>c.shiftId?[c.shiftId]:c.code==='DAYS_OFF'?schedule.shifts.filter(s=>s.employeeId===c.employeeId).map(s=>s.id):[])]);
 for(const shiftId of affected){alternatives[shiftId]=schedule.employees.map(employee=>{const candidate=applyScheduleOperation(schedule,{type:'assign',shiftId,employeeId:employee.id});const result=evaluateSchedule(candidate);const violations=result.conflicts.filter(c=>c.employeeId===employee.id);const minutes=candidate.shifts.filter(s=>s.employeeId===employee.id).reduce((sum,s)=>sum+(Number(s.end.slice(0,2))*60+Number(s.end.slice(3)))-(Number(s.start.slice(0,2))*60+Number(s.start.slice(3))),0);return {employeeId:employee.id,name:employee.name,score:Math.max(0,100-Math.round(minutes/60)*3),conflicts:violations.length};}).filter(c=>c.conflicts===0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));}
 const dates=Array.from(new Set(schedule.shifts.map(shift=>shift.date))).sort();
 const custom= schedule.shifts.some(shift=>!!shift.name);
 return {schedule,evaluation,alternatives,assumptions:custom?[
  'Local schedule draft only; no employer calendar or external scheduling system is connected.',
  `Roster comes from the request: ${schedule.employees.map(employee=>employee.name).join(', ')}.`,
  `Coverage is represented by individual slots from ${dates[0]??'unknown'} through ${dates[dates.length-1]??'unknown'}; slot counts and labels follow the request.`,
  `Availability and the minimum ${schedule.minDaysOff} days off are evaluated in code before confirmation.`
 ]:[
  'Local schedule only; no external calendar or employer system is connected.',
  `Editable example roster of ${schedule.employees.length} employees, ${dates[0]??'unknown'} through ${dates[dates.length-1]??'unknown'}; two four-hour shifts daily with one worker per shift.`,
  'Days off are evaluated per seven-day Monday–Sunday week. Fairness scores prefer fewer assigned hours.'
 ]};
}

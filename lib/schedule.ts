import {z} from 'zod';
const Id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const DateString=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Invalid date');
const Time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const ScheduleSchema=z.object({id:Id,revision:z.number().int().min(0),goal:z.string().min(1).max(4000),employees:z.array(z.object({id:Id,name:z.string().min(1).max(100),unavailable:z.array(DateString).max(365)}).strict()).min(1).max(50),shifts:z.array(z.object({id:Id,date:DateString,start:Time,end:Time,employeeId:Id.nullable()}).strict().refine(s=>s.end>s.start,'Shift must end after start')).max(200),minDaysOff:z.number().int().min(0).max(7),status:z.enum(['draft','committed']),receipt:z.object({id:Id,at:z.string().datetime(),revision:z.number().int(),actionId:Id}).strict().optional()}).strict().superRefine((s,ctx)=>{if(new Set(s.employees.map(e=>e.id)).size!==s.employees.length||new Set(s.shifts.map(e=>e.id)).size!==s.shifts.length)ctx.addIssue({code:'custom',message:'Duplicate IDs'});for(const shift of s.shifts)if(shift.employeeId&&!s.employees.some(e=>e.id===shift.employeeId))ctx.addIssue({code:'custom',message:'Unknown employee'});});
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
export function createSchedule(id:string,goal:string):Schedule{
 const count=goal.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (?:employees|staff|workers)/i);if(count&&!['6','six'].includes(count[1].toLowerCase()))throw new ScheduleError('UNSUPPORTED_CONSTRAINT','This local schedule demo supports six employees. Use six employees or edit the supported roster in code.');
 const names=['Daniel','Maya','Noa','Amir','Lior','Yael'];const roster=['daniel','maya','noa','amir','daniel','yael','lior','maya','noa','amir'];
 const daysOff=goal.match(/(\d|two|three|four|five|six|seven) days? off/i);const nums:Record<string,number>={two:2,three:3,four:4,five:5,six:6,seven:7};
 const schedule=ScheduleSchema.parse({id,goal,revision:0,employees:names.map(name=>({id:name.toLowerCase(),name,unavailable:[]})),shifts:Array.from({length:10},(_,i)=>({id:`shift-${i}`,date:`2026-10-${19+Math.floor(i/2)}`,start:i%2?'13:00':'09:00',end:i%2?'17:00':'13:00',employeeId:roster[i]})),minDaysOff:daysOff?(nums[daysOff[1].toLowerCase()]??Number(daysOff[1])):2,status:'draft'});
 if(/daniel/i.test(goal)&&/wednesday|wed\b/i.test(goal)&&/can't|cannot|unavailable|not available/i.test(goal))schedule.employees[0].unavailable=['2026-10-21'];
 return schedule;
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
 return {schedule,evaluation,alternatives,assumptions:['Local schedule only; no external calendar or employer system is connected.','Example roster of six employees, October 19–23, 2026; two four-hour shifts each weekday.','Days off are evaluated per seven-day Monday–Sunday week. Fairness scores prefer fewer assigned hours.']};
}

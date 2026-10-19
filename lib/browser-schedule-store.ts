import {z} from 'zod';
import {ScheduleSchema,OperationSchema,ScheduleError,createSchedule,migrateLegacySchedule,scheduleView,evaluateSchedule,applyScheduleOperation,type Schedule,type ScheduleView} from './schedule';
const State=z.object({schedule:ScheduleSchema,history:z.array(ScheduleSchema).max(100),actions:z.record(z.object({fingerprint:z.string(),result:ScheduleSchema}))});
const Id=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const browserScheduleTools=['create_schedule','inspect_schedule','update_schedule','preview_schedule_change','commit_schedule'];
export class BrowserScheduleStore{
 constructor(private storage:Pick<Storage,'getItem'|'setItem'>){}
 call(name:string,args:Record<string,unknown>):ScheduleView{
  const id=Id.parse(args.id),key=`shadowui.browser-schedule.v1.${id}`;
  let data:z.infer<typeof State>|undefined;
  try{const raw=this.storage.getItem(key);if(raw)data=State.parse(JSON.parse(raw));}catch{throw new ScheduleError('STORAGE_ERROR','Browser schedule could not be read. Browser storage must be available.');}
  const save=()=>{try{this.storage.setItem(key,JSON.stringify(data));}catch{throw new ScheduleError('STORAGE_ERROR','Browser schedule could not be saved. Browser storage may be full or unavailable.');}};
  const migrate=()=>{if(!data)return;const schedule=migrateLegacySchedule(data.schedule);if(schedule){data={schedule,history:[],actions:{}};save();}};
  if(name==='create_schedule'){if(!data){data={schedule:createSchedule(id,z.string().min(1).max(4000).parse(args.goal)),history:[],actions:{}};save();}else migrate();return scheduleView(data.schedule);}
  if(!data)throw new ScheduleError('NOT_FOUND','Schedule does not exist in this browser.');
  migrate();if(name==='inspect_schedule')return scheduleView(data.schedule);
  const revision=z.number().int().min(0).parse(args.expectedRevision);
  const preview=name==='preview_schedule_change',commit=name==='commit_schedule';
  if(!preview&&!commit&&name!=='update_schedule')throw new ScheduleError('INVALID_INPUT','Unknown browser demo tool.');
  const operation=commit?undefined:OperationSchema.parse(args.operation);
  if(commit&&args.confirmed!==true)throw new ScheduleError('CONFIRMATION_REQUIRED','Explicit confirmation is required.');
  const actionId=preview?'':Id.parse(args.actionId),fingerprint=JSON.stringify({revision,operation,commit});
  const replay=data.actions[actionId];
  if(!preview&&replay){if(replay.fingerprint!==fingerprint)throw new ScheduleError('ACTION_ID_REUSED','Action ID was already used for different input.');if(replay.result.revision!==data.schedule.revision)throw new ScheduleError('ACTION_SUPERSEDED','This action has been superseded. Inspect current state.');return scheduleView(replay.result);}
  if(data.schedule.revision!==revision)throw new ScheduleError('STALE_REVISION','The schedule revision changed. Refresh before retrying.');
  let next:Schedule;
  if(commit){if(!evaluateSchedule(data.schedule).valid)throw new ScheduleError('CONFLICTS','Resolve all conflicts and uncovered shifts before confirming.');next={...data.schedule,status:'committed',receipt:{id:crypto.randomUUID(),at:new Date().toISOString(),revision:revision+1,actionId}};}
  else if(operation?.type==='undo'){const previous=data.history.at(-1);if(!previous)throw new ScheduleError('NO_HISTORY','No previous change to undo.');next={...structuredClone(previous),status:'draft'};delete next.receipt;}
  else next=applyScheduleOperation(data.schedule,operation!);
  if(preview)return scheduleView(next);
  if(Object.keys(data.actions).length>=200)throw new ScheduleError('LIMIT_EXCEEDED','Action history is full; create a new schedule.');
  if(operation?.type==='undo')data.history.pop();else data.history.push(data.schedule);
  if(data.history.length>100)data.history.shift();
  data.schedule={...next,revision:revision+1};data.actions[actionId]={fingerprint,result:structuredClone(data.schedule)};save();return scheduleView(data.schedule);
 }
}

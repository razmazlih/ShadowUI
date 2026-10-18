import {z} from 'zod';
import {OperationSchema,ScheduleError} from '@/lib/schedule';
import {createStoredSchedule,inspectSchedule,updateSchedule,previewSchedule,commitSchedule} from '@/lib/schedule-store';
import { WorkspaceSchema } from '@/lib/schema';
import { planDemo } from '@/lib/planner';

const versions = ['2025-11-25', '2025-03-26'];
const tools = [
  {name:'compose_workspace',description:'Compose or adapt a validated local ShadowUI workspace. Returns a proposal; does not modify external services or browser storage.',inputSchema:{type:'object',properties:{prompt:{type:'string',minLength:1,maxLength:4000},workspace:{type:'object',description:'Optional current workspace returned by a previous call.'}},required:['prompt'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
  {name:'validate_workspace',description:'Validate a ShadowUI workspace against the trusted component grammar.',inputSchema:{type:'object',properties:{workspace:{type:'object'}},required:['workspace'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
];
const ScheduleId=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const Revision=z.number().int().min(0);
const toolSchemas={
 create_schedule:z.object({id:ScheduleId,goal:z.string().min(1).max(4000)}).strict(),
 inspect_schedule:z.object({id:ScheduleId}).strict(),
 update_schedule:z.object({id:ScheduleId,expectedRevision:Revision,actionId:ScheduleId,operation:OperationSchema}).strict(),
 preview_schedule_change:z.object({id:ScheduleId,expectedRevision:Revision,operation:OperationSchema}).strict(),
 commit_schedule:z.object({id:ScheduleId,expectedRevision:Revision,actionId:ScheduleId,confirmed:z.literal(true)}).strict(),
};
const operationJson={oneOf:[{type:'object',properties:{type:{const:'set_availability'},employeeId:{type:'string'},date:{type:'string'},unavailable:{type:'boolean'}},required:['type','employeeId','date','unavailable'],additionalProperties:false},{type:'object',properties:{type:{const:'assign'},shiftId:{type:'string'},employeeId:{type:['string','null']}},required:['type','shiftId','employeeId'],additionalProperties:false},{type:'object',properties:{type:{const:'set_min_days_off'},value:{type:'integer',minimum:0,maximum:7}},required:['type','value'],additionalProperties:false},{type:'object',properties:{type:{const:'undo'}},required:['type'],additionalProperties:false}]};
for(const [name,description,required] of [
 ['create_schedule','Create or retrieve a durable local draft with a clearly labeled six-employee fixture. Supports goal constraints: Daniel unavailable Wednesday and N days off.',['id','goal']],
 ['inspect_schedule','Read a local schedule, deterministic conflicts, available alternatives and assumptions.',['id']],
 ['update_schedule','Persist a validated local schedule operation with revision and idempotency checks; undo restores previous content to draft.',['id','expectedRevision','actionId','operation']],
 ['preview_schedule_change','Evaluate a candidate entire schedule without persistence.',['id','expectedRevision','operation']],
 ['commit_schedule','Commit a conflict-free local schedule only after explicit confirmation, persisting a real receipt. No external service is changed.',['id','expectedRevision','actionId','confirmed']],
] as const){
 const properties:Record<string,unknown>={id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,100}$'}};
 for(const field of required){if(field==='goal')properties.goal={type:'string',minLength:1,maxLength:4000};if(field==='expectedRevision')properties.expectedRevision={type:'integer',minimum:0};if(field==='actionId')properties.actionId={type:'string',pattern:'^[a-zA-Z0-9_-]{1,100}$'};if(field==='confirmed')properties.confirmed={const:true};if(field==='operation')properties.operation=operationJson;}
 tools.push({name,description,inputSchema:{type:'object',properties,required:[...required],additionalProperties:false},annotations:{readOnlyHint:name==='inspect_schedule'||name==='preview_schedule_change',destructiveHint:false,openWorldHint:false}} as typeof tools[number]);
}
function result(id: unknown, value: unknown) { return Response.json({jsonrpc:'2.0',id,result:value}); }
function error(id: unknown, code: number, message: string, status=200) { return Response.json({jsonrpc:'2.0',id,error:{code,message}},{status}); }
export async function GET() { return new Response(null,{status:405,headers:{Allow:'POST'}}); }
export async function POST(request: Request) {
  // Next may normalize request.url to its bind address (0.0.0.0).
  // Validate the actual incoming authority, then use it for Origin checks.
  const incoming=new URL(request.url);
  const authority=request.headers.get('host')??incoming.host;
  let target:URL;
  try{target=new URL(`${incoming.protocol}//${authority}`);}catch{return error(null,-32000,'Invalid Host header.',403);}
  const loopback=(host:string)=>['localhost','127.0.0.1','[::1]'].includes(host);
  if(!loopback(target.hostname))return error(null,-32000,'This unauthenticated demo MCP server accepts loopback hosts only.',403);
  const origin=request.headers.get('origin');
  if(origin){
    let allowed=false;
    try{const source=new URL(origin);allowed=loopback(source.hostname)&&source.port===target.port&&source.protocol===target.protocol;}catch{}
    if(!allowed)return error(null,-32000,'Origin is not allowed',403);
  }
  const version=request.headers.get('mcp-protocol-version');
  if(version&&!versions.includes(version)) return error(null,-32600,'Unsupported MCP protocol version',400);
  if(Number(request.headers.get('content-length')||0)>200000) return error(null,-32600,'Request too large',413);
  let body: Record<string,unknown>;
  try {const raw=await request.text(); if(raw.length>200000)return error(null,-32600,'Request too large',413); body=JSON.parse(raw);} catch {return error(null,-32700,'Parse error',400);}
  if(!body || Array.isArray(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string') return error(null,-32600,'Invalid JSON-RPC request',400);
  const id=body.id;
  if(id===undefined) return new Response(null,{status:202});
  if(typeof id!=='string'&&typeof id!=='number')return error(null,-32600,'Invalid request ID',400);
  if(body.params!==undefined&&(!body.params||typeof body.params!=='object'||Array.isArray(body.params)))return error(id,-32602,'Params must be an object');
  const params=(body.params??{}) as Record<string,unknown>;
  if(body.method==='initialize')return result(id,{protocolVersion:versions.includes(String(params.protocolVersion))?params.protocolVersion:versions[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'raben-shadowui',version:'0.1.0'},instructions:'Local single-process demo server. Schedule tools persist local files, never external services. Inspect conflicts and preview changes before explicit commit.'});
  if(body.method==='ping')return result(id,{});
  if(body.method==='tools/list')return result(id,{tools});
  if(body.method!=='tools/call')return error(id,-32601,'Method not found');
  const args=params.arguments as Record<string,unknown>|undefined;
  if(!args||typeof args!=='object'||Array.isArray(args))return error(id,-32602,'Tool arguments must be an object');
  try {
    let output: unknown;
    if(params.name==='validate_workspace') {
      const parsed=WorkspaceSchema.safeParse(args.workspace);
      output=parsed.success?{valid:true,workspace:parsed.data}:{valid:false,issues:parsed.error.issues.map(i=>({path:i.path,message:i.message}))};
    } else if(params.name==='compose_workspace') {
      if(typeof args.prompt!=='string'||!args.prompt.trim()||args.prompt.length>4000)return error(id,-32602,'A prompt of 1–4000 characters is required');
      const previous=args.workspace===undefined?undefined:WorkspaceSchema.parse(args.workspace);
      output=await planDemo(args.prompt,previous);
    } else if(params.name==='create_schedule'){const a=toolSchemas.create_schedule.parse(args);output=await createStoredSchedule(a.id,a.goal);}
    else if(params.name==='inspect_schedule'){const a=toolSchemas.inspect_schedule.parse(args);output=await inspectSchedule(a.id);}
    else if(params.name==='update_schedule'){const a=toolSchemas.update_schedule.parse(args);output=await updateSchedule(a.id,a.expectedRevision,a.actionId,a.operation);}
    else if(params.name==='preview_schedule_change'){const a=toolSchemas.preview_schedule_change.parse(args);output=await previewSchedule(a.id,a.expectedRevision,a.operation);}
    else if(params.name==='commit_schedule'){const a=toolSchemas.commit_schedule.parse(args);output=await commitSchedule(a.id,a.expectedRevision,a.actionId,a.confirmed);}
    else return error(id,-32602,'Unknown tool');
    return result(id,{content:[{type:'text',text:JSON.stringify(output)}],structuredContent:output,isError:false});
  }catch(e){const failure={code:e instanceof ScheduleError?e.code:e instanceof z.ZodError?'INVALID_INPUT':'INTERNAL_ERROR',message:e instanceof ScheduleError?e.message:e instanceof z.ZodError?e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):'Local tool execution failed.'};return result(id,{content:[{type:'text',text:JSON.stringify(failure)}],structuredContent:failure,isError:true});}
}

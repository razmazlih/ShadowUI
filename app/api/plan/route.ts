import { z } from 'zod';
import { WorkspaceSchema } from '@/lib/schema';
import { planDemo } from '@/lib/planner';
import {applyCandidate} from '@/lib/patch';

import {ScheduleSchema} from '@/lib/schedule';
import {classifyMessage,MessageHistorySchema} from '@/lib/message-intent';
import {liveScheduleIntent} from '@/lib/openai-planner';
import {runTaskPipeline} from '@/lib/task-pipeline';
import {assembleTask,demoTaskContract} from '@/lib/task-engine';
import {listDefinitions} from '@/lib/catalog-store';
import {AIError,limit,transact} from '@/lib/ai-budget';
export const runtime='nodejs';
export const maxDuration=300;
function sameOrigin(request:Request){try{const target=new URL(request.url);target.host=request.headers.get('host')??target.host;return new URL(request.headers.get('origin')??'').origin===target.origin;}catch{return false;}}
function sessionId(request:Request){return request.headers.get('cookie')?.match(/(?:^|; )shadowui_ai=([a-f0-9-]{36})(?:;|$)/)?.[1];}
export async function GET(request:Request){
 const session=sessionId(request)??crypto.randomUUID();
 let state;try{const spent=await transact(l=>l.spent);state={configured:!!process.env.OPENAI_API_KEY,storageReady:true,spent,limit:limit(),warning:spent>=limit()*.8};}catch{state={configured:!!process.env.OPENAI_API_KEY,storageReady:false};}
 return Response.json(state,{headers:{'Cache-Control':'no-store','Set-Cookie':`shadowui_ai=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(request.url).protocol==='https:'?'; Secure':''}`}});
}
const RequestSchema=z.object({prompt:z.string().trim().min(1).max(4000),current:WorkspaceSchema.nullish(),mode:z.enum(['demo','live']).default('demo'),schedule:ScheduleSchema.optional(),history:MessageHistorySchema.optional()}).strict();
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')??0)>150000)return Response.json({error:'Request is too large.'},{status:413});
 let input:z.infer<typeof RequestSchema>;
 try{const body=await request.text();if(body.length>150000)return Response.json({error:'Request is too large.'},{status:413});input=RequestSchema.parse(JSON.parse(body));}catch{return Response.json({error:'Provide a valid prompt and workspace.'},{status:400});}
 const session=sessionId(request);
 if(input.mode==='live'&&(!session||!sameOrigin(request)))return Response.json({error:'Refresh this page before using Live AI. Cross-origin AI requests are blocked.'},{status:403});
 if(input.schedule){if(input.mode!=='live')return Response.json({error:'Natural-language schedule proposals require Live AI; Demo controls remain available.'},{status:400});try{return Response.json(await liveScheduleIntent(input.prompt,input.schedule,session!),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof AIError?e.message:'Could not interpret this schedule request. No change was applied.'},{status:e instanceof AIError?e.status:503});}}
 if(input.mode==='demo'){try{const intent=classifyMessage(input.prompt,input.current??undefined);if(intent.kind!=='workspace')return Response.json({operation:'reply',intent:intent.kind,explanation:intent.reply,mode:'demo'});const result=planDemo(input.prompt,input.current??undefined);if(result.operation==='patch'&&input.current)result.workspace=applyCandidate(input.current,result.workspace);if(result.workspace&&process.env.FIREBASE_PROJECT_ID){const contract=demoTaskContract(input.prompt,result.workspace.components);const assembled=assembleTask(contract,await listDefinitions({session}),{componentData:result.workspace.components});result.workspace=WorkspaceSchema.parse({...result.workspace,components:assembled.components,taskContract:contract,taskReport:{...assembled.coverage,limitations:assembled.limitations}});}return Response.json(result);}catch{return Response.json({error:'The configured component catalog is unavailable. No workspace changes were saved.'},{status:503});}}
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({start(controller){
  const send=(event:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  void runTaskPipeline(input.prompt,input.current??undefined,session!,input.history,{},step=>send('progress',{step})).then(result=>send('result',result)).catch(error=>send('error',{error:error instanceof AIError?error.message:'AI service is unavailable. No workspace changes were applied.'})).finally(()=>controller.close());
 }});
 return new Response(stream,{headers:{'Cache-Control':'no-store, no-transform','Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'}});
}

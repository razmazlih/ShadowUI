import { z } from 'zod';
import {runSimulation} from '@/lib/simulated-workspace';
import {paidAIEnabled} from '@/lib/ai-policy';
import { WorkspaceSchema } from '@/lib/schema';

import {ScheduleSchema} from '@/lib/schedule';
import {MessageHistorySchema} from '@/lib/message-intent';
import {AIError,limit,transact} from '@/lib/ai-budget';
import {catalogDatabase} from '@/lib/firebase-admin';
import {runTaskPipeline} from '@/lib/task-pipeline';
import {liveScheduleIntent} from '@/lib/openai-planner';
export const runtime='nodejs';
export const maxDuration=300;
function sameOrigin(request:Request){try{const target=new URL(request.url);target.host=request.headers.get('host')??target.host;return new URL(request.headers.get('origin')??'').origin===target.origin;}catch{return false;}}
function sessionId(request:Request){return request.headers.get('cookie')?.match(/(?:^|; )shadowui_ai=([a-f0-9-]{36})(?:;|$)/)?.[1];}
export async function GET(request:Request){
 const session=sessionId(request)??crypto.randomUUID();
 const liveEnabled=paidAIEnabled(),configured=liveEnabled&&!!process.env.OPENAI_API_KEY;
 let state={configured,storageReady:!liveEnabled,simulation:!liveEnabled,liveEnabled,spent:0,limit:liveEnabled?limit():0,warning:false};
 if(liveEnabled)try{const [spent]=await Promise.all([transact(l=>l.spent),catalogDatabase().collection('shadowui_component_catalog').limit(1).get()]);state={...state,storageReady:true,spent,warning:spent>=state.limit*.8};}catch{state={...state,storageReady:false};}
 return Response.json(state,{headers:{'Cache-Control':'no-store','Set-Cookie':`shadowui_ai=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(request.url).protocol==='https:'?'; Secure':''}`}});
}
const RequestSchema=z.object({prompt:z.string().trim().min(1).max(4000),current:WorkspaceSchema.nullish(),mode:z.enum(['demo','live']).default('demo'),schedule:ScheduleSchema.optional(),history:MessageHistorySchema.optional()}).strict();
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')??0)>150000)return Response.json({error:'Request is too large.'},{status:413});
 let input:z.infer<typeof RequestSchema>;
 try{const body=await request.text();if(body.length>150000)return Response.json({error:'Request is too large.'},{status:413});input=RequestSchema.parse(JSON.parse(body));}catch{return Response.json({error:'Provide a valid prompt and workspace.'},{status:400});}
 const session=sessionId(request);
 if(input.mode==='live'&&!paidAIEnabled())return Response.json({error:'Paid AI is disabled. Use local simulation; no provider request was sent.'},{status:403});
 if(!session||!sameOrigin(request))return Response.json({error:'Refresh this page before creating a workspace.'},{status:403});
 if(input.schedule){if(input.mode!=='live')return Response.json({error:'Use the local schedule controls to edit assignments; language commands are simulated.'},{status:400});try{return Response.json(await liveScheduleIntent(input.prompt,input.schedule,session),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:error instanceof AIError?error.message:'Could not interpret this schedule request. Your saved work is unchanged.'},{status:error instanceof AIError?error.status:503});}}
 if(input.mode==='live'){
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({start(controller){
   const send=(event:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
   void runTaskPipeline(input.prompt,input.current??undefined,session,input.history,{},step=>send('progress',{step})).then(result=>send('result',result)).catch(error=>{console.error('shadowui_pipeline_failure',{message:error instanceof Error?error.message:'unknown'});send('error',{error:error instanceof AIError?error.message:'Could not prepare this workspace. Your saved work is unchanged.'});}).finally(()=>controller.close());
  }});
  return new Response(stream,{headers:{'Cache-Control':'no-store, no-transform','Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'}});
 }
 try{return Response.json(await runSimulation(input.prompt,input.current??undefined,session,input.history),{headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({error:error instanceof AIError?error.message:'Could not prepare the local workspace. Your saved work is unchanged.'},{status:error instanceof AIError?error.status:503});}
}

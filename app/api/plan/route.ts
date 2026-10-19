import { z } from 'zod';
import { WorkspaceSchema } from '@/lib/schema';
import { planDemo } from '@/lib/planner';
import {applyCandidate} from '@/lib/patch';

import {ScheduleSchema} from '@/lib/schedule';
import {classifyMessage,MessageHistorySchema} from '@/lib/message-intent';
import {liveScheduleIntent,liveInteraction} from '@/lib/openai-planner';
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
 if(input.mode==='demo'){const intent=classifyMessage(input.prompt,input.current??undefined);if(intent.kind!=='workspace')return Response.json({operation:'reply',intent:intent.kind,explanation:intent.reply,mode:'demo'});const result=planDemo(input.prompt,input.current??undefined);if(result.operation==='patch'&&input.current)result.workspace=applyCandidate(input.current,result.workspace);return Response.json(result);}
 try{return Response.json(await liveInteraction(input.prompt,input.current??undefined,session!,input.history),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof AIError?e.message:'AI service is unavailable. No workspace changes were applied.'},{status:e instanceof AIError?e.status:503,headers:{'Cache-Control':'no-store'}});}
}

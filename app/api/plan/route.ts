import { z } from 'zod';
import { WorkspaceSchema } from '@/lib/schema';
import { planDemo, isNewGoal, isSchedulingGoal } from '@/lib/planner';
import {applyCandidate} from '@/lib/patch';

const RequestSchema=z.object({prompt:z.string().trim().min(1).max(4000),current:WorkspaceSchema.nullish(),mode:z.enum(['demo','live']).default('demo')}).strict();
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')??0)>150000)return Response.json({error:'Request is too large.'},{status:413});
 let input:z.infer<typeof RequestSchema>;
 try{const body=await request.text();if(body.length>150000)return Response.json({error:'Request is too large.'},{status:413});input=RequestSchema.parse(JSON.parse(body));}catch{return Response.json({error:'Provide a valid prompt and workspace.'},{status:400});}
 if(input.mode==='demo'){const result=planDemo(input.prompt,input.current??undefined);if(result.operation==='patch'&&input.current)result.workspace=applyCandidate(input.current,result.workspace);return Response.json(result);}
 if(!process.env.AI_GATEWAY_API_KEY||!process.env.SHADOWUI_MODEL)return Response.json({error:'Live AI requires AI_GATEWAY_API_KEY and SHADOWUI_MODEL on the server. Demo mode is available.'},{status:503});
 try{
  const {generateText,Output}=await import('ai');
  const result=await generateText({model:process.env.SHADOWUI_MODEL as `${string}/${string}`,output:Output.object({schema:WorkspaceSchema}),abortSignal:AbortSignal.timeout(45000),system:`You are ShadowUI, an intent-to-interface compiler. Return a workspace JSON using only the provided schema. Never emit code, HTML, or executable expressions. Combine reusable primitives for the user's goal, rather than domain templates. All operations are local; never claim external tools or accounts were updated. Do not fabricate factual data: mark estimates and assumptions in description and notes. Use items as structured records. Quiz items need options and an answer matching an option. Flashcard items need answer. Calendar items use date YYYY-MM-DD and group as employee. Chart items use finite numeric value. Comparison components have criteria [{id,label,weight}] with weights 0..100 and items representing real options with scores keyed by criterion id (0..100); mark unverified scores as examples. Preserve user-edited criteria weights and option scores. Slider is a budget with numeric value. Timer value is minutes. Approval confirmation is local only. Use stable component and item IDs from current workspace when preserving context. Preserve existing user edits, completed items and notes. Patch only components relevant to a constraint change. An unrelated new goal creates a fresh workspace with a new ID. Keep visible text in user's language.`,prompt:JSON.stringify({intent:input.prompt,currentWorkspace:input.current??null}),});
  const workspace=WorkspaceSchema.parse(result.output);
  const operation=input.current&&!isNewGoal(input.prompt,input.current??undefined)?'patch':'create';
  if(operation==='create'){delete workspace.domain;if(isSchedulingGoal(input.prompt))workspace.domain={kind:'schedule',id:crypto.randomUUID()};}else if(input.current?.domain){workspace.domain=input.current.domain;}
  const applied=operation==='patch'&&input.current?applyCandidate(input.current,workspace):workspace;
  return Response.json({workspace:applied,mode:'live',operation,explanation:'AI composed a validated specification. All component actions run locally; no external action was executed.'});
 }catch{return Response.json({error:'Live planning did not produce a valid workspace. Your saved work is unchanged. Retry or explicitly select Demo mode.'},{status:502});}
}

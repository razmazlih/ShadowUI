import {z} from 'zod';
import {zodSchema} from 'ai';
import {ComponentSchema,ItemSchema,WorkspaceSchema} from './schema';

// Structured Outputs requires every property to be required. Use null only on
// the provider boundary; the application's canonical schema remains strict.
function providerShape(shape:z.ZodRawShape){
 return Object.fromEntries(Object.entries(shape).map(([key,field])=>[key,
  field instanceof z.ZodOptional?field.unwrap().nullable():
  field instanceof z.ZodDefault?field.removeDefault():field])) as z.ZodRawShape;
}
const ScoreSchema=z.object({criterionId:z.string(),score:z.number().min(0).max(100)}).strict();
const ProviderItemSchema=z.object({...providerShape(ItemSchema.omit({scores:true,url:true}).shape),url:z.string().max(4000).nullable(),scores:z.array(ScoreSchema).nullable()}).strict();
const ProviderComponentSchema=z.object({...providerShape(ComponentSchema.omit({items:true}).shape),items:z.array(ProviderItemSchema).max(60)}).strict();
export const ProviderWorkspaceSchema=z.object({workspace:z.object({
 id:z.string().max(100),title:z.string().max(150),description:z.string().max(1000),goal:z.string().max(4000),components:z.array(ProviderComponentSchema).min(1).max(16)
}).strict()}).strict();

export const workspaceResponseFormat={type:'json_schema',json_schema:{name:'shadowui_workspace',strict:true,schema:zodSchema(ProviderWorkspaceSchema).jsonSchema}};

function omitNulls(value:Record<string,unknown>){return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==null));}
export function parseAIWorkspace(data:unknown){
 // Validate before normalization so unknown keys and missing required fields
 // cannot be hidden by the adapter.
 const {workspace}=ProviderWorkspaceSchema.parse(data);
 return WorkspaceSchema.parse({...workspace,components:workspace.components.map(component=>({
  ...omitNulls(component),items:(component.items as Array<Record<string,unknown>>).map(item=>{
   const scores=item.scores as Array<z.infer<typeof ScoreSchema>>|null;
   if(scores&&new Set(scores.map(s=>s.criterionId)).size!==scores.length)throw new Error('Duplicate criterion scores');
   return {...omitNulls(item),...(scores?{scores:Object.fromEntries(scores.map(s=>[s.criterionId,s.score]))}:{})};
  })
 }))});
}

export const InteractionSchema=z.object({
 intent:z.enum(['conversation','workspace_question','workspace_change','clarification','schedule_change']),
 reply:z.string().min(1).max(4000),
 workspace:ProviderWorkspaceSchema.shape.workspace.nullable()
}).strict();
export const interactionResponseFormat={type:'json_schema',json_schema:{name:'shadowui_interaction',strict:true,schema:zodSchema(InteractionSchema).jsonSchema}};

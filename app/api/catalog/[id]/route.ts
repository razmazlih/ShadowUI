import {z} from 'zod';
import {getDefinition,getDefinitionHistory,setDefinitionStatus,rollbackDefinition} from '@/lib/catalog-store';
import {isCatalogAdmin,catalogSession} from '@/lib/firebase-admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){
 const {id}=await context.params,admin=await isCatalogAdmin(request),access={admin,session:catalogSession(request),includeDrafts:admin};
 try{const definition=await getDefinition(id,undefined,access);if(!definition)return Response.json({error:'Definition not found.'},{status:404});
 return Response.json({definition,revisions:await getDefinitionHistory(id,access)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Catalog database is unavailable.'},{status:503});}
}
export async function POST(request:Request,context:Context){
 if(!await isCatalogAdmin(request))return Response.json({error:'Firebase administrator authentication is required.'},{status:403});
 try{const {id}=await context.params;const body=z.object({action:z.enum(['activate','retire','rollback']),version:z.number().int().positive().optional(),expectedVersion:z.number().int().positive().optional(),syntheticDataConfirmed:z.boolean().optional()}).strict().parse(await request.json());
 const current=await getDefinition(id,undefined,{admin:true});
 if(current?.scope==='shared'&&body.action!=='retire'&&body.syntheticDataConfirmed!==true)return Response.json({error:'Confirm that shared definitions contain synthetic data only.'},{status:400});
 if(body.action==='rollback'&&!body.version)return Response.json({error:'A rollback version is required.'},{status:400});
 const definition=body.action==='rollback'?await rollbackDefinition(id,body.version!,{admin:true,expectedVersion:body.expectedVersion}):await setDefinitionStatus(id,body.action==='activate'?'active':'retired',{admin:true,expectedVersion:body.expectedVersion});
 return Response.json({definition},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Catalog update failed.'},{status:400});}
}

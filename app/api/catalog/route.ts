import {z} from 'zod';
import {ComponentDefinitionSchema} from '@/lib/catalog';
import {listDefinitions,saveDefinition,getDefinition} from '@/lib/catalog-store';
import {isCatalogAdmin,catalogSession} from '@/lib/firebase-admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const admin=await isCatalogAdmin(request);
 try{return Response.json({definitions:await listDefinitions({session:catalogSession(request),admin,includeDrafts:admin}),storageReady:true,admin},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({definitions:[],storageReady:false,admin,error:'Catalog database is unavailable. Configure Firebase server credentials or the local emulator.'},{status:503});}
}
export async function POST(request:Request){
 if(!await isCatalogAdmin(request))return Response.json({error:'Firebase administrator authentication is required.'},{status:403});
 try{const body=await request.text();if(body.length>100000)return Response.json({error:'Definition is too large.'},{status:413});
  const {definition,syntheticDataConfirmed}=z.object({definition:ComponentDefinitionSchema,syntheticDataConfirmed:z.boolean().optional()}).strict().parse(JSON.parse(body));
  if(definition.scope==='shared'&&syntheticDataConfirmed!==true)return Response.json({error:'Confirm that shared definitions contain synthetic data only.'},{status:400});
  const current=await getDefinition(definition.id,undefined,{admin:true});
  if(current&&definition.version!==current.version)return Response.json({error:'Catalog version conflict. Reload the definition.'},{status:409});
  return Response.json({definition:await saveDefinition({...definition,source:'admin',version:current?current.version+1:1},{admin:true,expectedVersion:current?.version??0})},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not save definition.'},{status:400});}
}

import {isCatalogAdmin} from '@/lib/firebase-admin';
import {ReviewActionSchema,updateComponentReview} from '@/lib/component-review-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 if(!await isCatalogAdmin(request))return Response.json({error:'Firebase administrator authentication is required.'},{status:403});
 try{const text=await request.text();if(text.length>100000)return Response.json({error:'Review request is too large.'},{status:413});const {id}=await context.params;return Response.json(await updateComponentReview(id,ReviewActionSchema.parse(JSON.parse(text))),{headers:{'Cache-Control':'no-store'}});}catch(error){const message=error instanceof Error?error.message:'Review update failed';return Response.json({error:message},{status:message.includes('conflict')?409:message.includes('not found')?404:400});}
}

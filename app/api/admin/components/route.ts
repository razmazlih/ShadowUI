import {isCatalogAdmin} from '@/lib/firebase-admin';
import {listComponentReviews} from '@/lib/component-review-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await isCatalogAdmin(request))return Response.json({error:'Firebase administrator authentication is required.'},{status:403});
 try{return Response.json({candidates:await listComponentReviews()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Review database is unavailable.'},{status:503});}
}

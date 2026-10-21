import {z} from 'zod';
import {getAuth} from 'firebase-admin/auth';
import {catalogDatabase,firebaseApp} from './firebase-admin';
import {readCloudWorkspaces,type CloudWorkspaceState} from './account-cloud-store';

const IdSchema=z.string().min(1).max(200).refine(value=>!value.includes('/')&&!['__proto__','prototype','constructor'].includes(value));
export const ConversationSharingSchema=z.object({
 mode:z.enum(['private','email','link']),
 emails:z.array(z.string().trim().email().max(254).transform(value=>value.toLowerCase())).max(50).default([]),
}).strict().transform(value=>({mode:value.mode,emails:value.mode==='email'?[...new Set(value.emails)]:[]})).refine(value=>value.mode!=='email'||value.emails.length>0,'At least one email is required');
export type ConversationSharing=z.infer<typeof ConversationSharingSchema>;
type Identity={uid:string;email?:string;email_verified?:boolean};
export type ConversationShareRecord={ownerUid:string;sharing:ConversationSharing};
export class ConversationOwnershipConflict extends Error{}
type Dependencies={verifyToken:(token:string)=>Promise<Identity>;readAccount:(uid:string)=>Promise<CloudWorkspaceState>;readShare:(id:string)=>Promise<ConversationShareRecord|null>;writeShare:(id:string,ownerUid:string,sharing:ConversationSharing)=>Promise<void>};
const privateSharing:ConversationSharing={mode:'private',emails:[]};
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
const missing=()=>json({error:'השיחה אינה זמינה או שאין לך גישה אליה.'},404);
function shareRef(id:string){return catalogDatabase().collection('shadowui_conversation_shares').doc(IdSchema.parse(id));}
async function readShare(id:string):Promise<ConversationShareRecord|null>{
 const data=(await shareRef(id).get()).data();if(!data)return null;
 return {ownerUid:z.string().min(1).max(128).refine(uid=>!uid.includes('/')).parse(data.ownerUid),sharing:ConversationSharingSchema.parse(data.sharing)};
}
async function writeShare(id:string,ownerUid:string,sharing:ConversationSharing){
 const ref=shareRef(id);
 await catalogDatabase().runTransaction(async transaction=>{
  const current=(await transaction.get(ref)).data();
  if(current&&current.ownerUid!==ownerUid)throw new ConversationOwnershipConflict();
  transaction.set(ref,{ownerUid,sharing,updatedAt:new Date().toISOString()});
 });
}
async function limitedJson(request:Request){
 const maximum=20_000,declared=request.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>maximum))throw new RangeError();
 if(!request.body)throw new SyntaxError();
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maximum){await reader.cancel();throw new RangeError();}chunks.push(value);}}finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Only this server-side adapter can dereference another account's conversation. */
export function createConversationSharingHandlers(dependencies:Dependencies){
 async function identity(request:Request):Promise<Identity|null|Response>{
  const authorization=request.headers.get('authorization');if(!authorization)return null;
  const token=authorization.match(/^Bearer ([^\s]+)$/)?.[1];if(!token)return json({error:'יש להתחבר מחדש.'},401);
  try{const user=await dependencies.verifyToken(token);if(!user.uid||user.email_verified!==true||!user.email)return json({error:'יש לאמת את כתובת האימייל.'},403);return user;}catch{return json({error:'יש להתחבר מחדש.'},401);}
 }
 async function resolve(request:Request,id:string){
  const authenticated=await identity(request);
  const record=await dependencies.readShare(id);
  if(authenticated instanceof Response&&record?.sharing.mode!=='link')return authenticated;
  const user=authenticated instanceof Response?null:authenticated;
  if(record){
   const owner=user?.uid===record.ownerUid;
   if(!owner&&record.sharing.mode!=='link'&&!(record.sharing.mode==='email'&&user?.email&&record.sharing.emails.includes(user.email.toLowerCase())))return missing();
   const account=await dependencies.readAccount(record.ownerUid),workspace=account.snapshot?.workspaces.find(item=>item.id===id);
   if(!workspace)return missing();
   return {workspace,history:account.snapshot?.conversations[id]??[],sharing:owner?record.sharing:{mode:record.sharing.mode,emails:[]},owner};
  }
  if(!user)return missing();
  const account=await dependencies.readAccount(user.uid),workspace=account.snapshot?.workspaces.find(item=>item.id===id);
  if(!workspace)return missing();
  return {workspace,history:account.snapshot?.conversations[id]??[],sharing:privateSharing,owner:true};
 }
 return {
  async GET(request:Request,id:string){
   if(!IdSchema.safeParse(id).success)return missing();
   try{const result=await resolve(request,id);return result instanceof Response?result:json(result);}catch{return json({error:'לא ניתן לטעון את השיחה כרגע.'},503);}
  },
  async GET_SHARING(request:Request,id:string){
   if(!IdSchema.safeParse(id).success)return missing();
   try{const result=await resolve(request,id);if(result instanceof Response)return result;if(!result.owner)return missing();return json(result.sharing);}catch{return json({error:'לא ניתן לטעון את הגדרות השיתוף.'},503);}
  },
  async PUT_SHARING(request:Request,id:string){
   if(!IdSchema.safeParse(id).success)return missing();
   const origin=request.headers.get('origin'),target=new URL(request.url);
   const host=request.headers.get('host');if(host){target.port='';target.host=host;}
   if(!origin||origin!==target.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Cross-origin updates are not allowed.'},403);
   if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'JSON content is required.'},415);
   const user=await identity(request);if(user instanceof Response)return user;if(!user)return json({error:'יש להתחבר כדי לשתף שיחה.'},401);
   try{
    const sharing=ConversationSharingSchema.parse(await limitedJson(request));
    const existing=await dependencies.readShare(id);if(existing&&existing.ownerUid!==user.uid)return missing();
    const account=await dependencies.readAccount(user.uid);
    if(!account.snapshot?.workspaces.some(workspace=>workspace.id===id))return missing();
    await dependencies.writeShare(id,user.uid,sharing);
    return json(sharing);
   }catch(error){
    if(error instanceof ConversationOwnershipConflict)return missing();
    if(error instanceof RangeError)return json({error:'הגדרות השיתוף גדולות מדי.'},413);
    if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'הגדרות השיתוף אינן תקינות.'},400);
    return json({error:'השיתוף אינו זמין כרגע. לא אושר שינוי בהגדרות.'},503);
   }
  },
 };
}
export const conversationSharingHandlers=createConversationSharingHandlers({verifyToken:token=>getAuth(firebaseApp()).verifyIdToken(token,true),readAccount:readCloudWorkspaces,readShare,writeShare});

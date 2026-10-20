import {z} from 'zod';
import {getAuth} from 'firebase-admin/auth';
import {catalogDatabase,firebaseApp} from './firebase-admin';
import {WorkspaceSchema} from './schema';
import {MessageHistorySchema} from './message-intent';
import type {WorkspaceSnapshot} from './account-workspaces';

const safeKey=(key:string)=>key.length>0&&key.length<=200&&!['__proto__','prototype','constructor'].includes(key);
const safeRecord=<T extends z.ZodTypeAny>(value:T)=>z.record(value).refine(record=>Object.keys(record).every(safeKey),'Invalid record key');
export const AccountSnapshotSchema=z.object({
 workspaces:z.array(WorkspaceSchema).max(250),active:z.string().max(200).nullable(),
 conversations:safeRecord(MessageHistorySchema),undoWorkspaces:safeRecord(WorkspaceSchema),sources:safeRecord(z.string().max(100)),
 deviceData:z.record(z.string().max(300_000)).refine(data=>{
  let bytes=0;for(const [key,value] of Object.entries(data)){if(key.length>300||!(key.startsWith('shadowui.browser-schedule.v1.')||key.startsWith('shadowui.layout.v1:')))return false;bytes+=Buffer.byteLength(value,'utf8');try{if(!(key.startsWith('shadowui.layout.v1:')&&key.endsWith(':density')&&['compact','comfortable'].includes(value)))JSON.parse(value);}catch{return false;}}return bytes<=300_000;
 },'Invalid or oversized device data').optional(),
}).strict().superRefine((snapshot,context)=>{
 const ids=snapshot.workspaces.map(workspace=>workspace.id);
 if(ids.some(id=>!safeKey(id))||new Set(ids).size!==ids.length)context.addIssue({code:'custom',message:'Workspace identities must be unique and valid'});
 if(snapshot.active!==null&&!ids.includes(snapshot.active))context.addIssue({code:'custom',message:'Active workspace does not exist'});
 for(const [id,workspace] of Object.entries(snapshot.undoWorkspaces))if(!ids.includes(id)||workspace.id!==id)context.addIssue({code:'custom',message:'Invalid undo workspace identity'});
});
const WriteSchema=z.object({snapshot:AccountSnapshotSchema,expectedRevision:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-1)}).strict();
const MAX_SNAPSHOT_BYTES=700_000,MAX_REQUEST_BYTES=750_000;
export type CloudWorkspaceState={snapshot:WorkspaceSnapshot|null;revision:number};
export class AccountRevisionConflict extends Error{}
export class AccountPayloadTooLarge extends Error{}
function serializedSnapshot(snapshot:WorkspaceSnapshot){const payload=JSON.stringify(AccountSnapshotSchema.parse(snapshot));if(Buffer.byteLength(payload,'utf8')>MAX_SNAPSHOT_BYTES)throw new AccountPayloadTooLarge('Account history exceeds the cloud storage limit');return payload;}
function accountRef(uid:string){if(!uid||uid.length>128||uid.includes('/'))throw new Error('Invalid account identity');return catalogDatabase().collection('shadowui_account_workspaces').doc(uid);}
function readState(data:Record<string,unknown>|undefined):CloudWorkspaceState{
 if(!data)return {snapshot:null,revision:0};
 const revision=z.number().int().positive().parse(data.revision);
 const payload=z.string().parse(data.payload);
 return {snapshot:AccountSnapshotSchema.parse(JSON.parse(payload)),revision};
}
export async function readCloudWorkspaces(uid:string):Promise<CloudWorkspaceState>{return readState((await accountRef(uid).get()).data());}
export async function writeCloudWorkspaces(uid:string,snapshot:WorkspaceSnapshot,expectedRevision:number):Promise<CloudWorkspaceState>{
 const payload=serializedSnapshot(snapshot),ref=accountRef(uid);
 return catalogDatabase().runTransaction(async transaction=>{
  const current=readState((await transaction.get(ref)).data());
  if(current.revision!==expectedRevision)throw new AccountRevisionConflict('History changed on another device');
  const revision=expectedRevision+1;
  transaction.set(ref,{payload,revision,updatedAt:new Date().toISOString()});
  return {snapshot,revision};
 });
}

type Identity={uid:string;email_verified?:boolean;email?:string};
type Dependencies={verifyToken:(token:string)=>Promise<Identity>;read:(uid:string)=>Promise<CloudWorkspaceState>;write:(uid:string,snapshot:WorkspaceSnapshot,revision:number)=>Promise<CloudWorkspaceState>};
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
async function readLimitedJSON(request:Request){
 const declared=request.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>MAX_REQUEST_BYTES))throw new AccountPayloadTooLarge();
 if(!request.body)throw new SyntaxError('Missing JSON body');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_REQUEST_BYTES){await reader.cancel();throw new AccountPayloadTooLarge();}chunks.push(value);}}finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Injecting dependencies keeps authorization and HTTP behavior testable without live accounts. */
export function createAccountWorkspaceHandlers(dependencies:Dependencies){
 async function identity(request:Request):Promise<Identity|Response>{
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!token)return json({error:'יש להתחבר כדי לסנכרן שיחות.'},401);
  let user:Identity;
  try{user=await dependencies.verifyToken(token);}catch{return json({error:'ההתחברות פגה. יש להתחבר שוב.'},401);}
  if(!user.uid||user.email_verified!==true||!user.email)return json({error:'יש לאמת את כתובת האימייל לפני סנכרון השיחות.'},403);
  return user;
 }
 return {
  async GET(request:Request){
   const user=await identity(request);if(user instanceof Response)return user;
   try{return json(await dependencies.read(user.uid));}catch{return json({error:'סנכרון השיחות אינו זמין כרגע. העותק המקומי נשמר.'},503);}
  },
  async PUT(request:Request){
   const origin=request.headers.get('origin');
   const target=new URL(request.url);target.host=request.headers.get('host')??target.host;
   if(!origin||origin!==target.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Cross-origin account updates are not allowed.'},403);
   if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'JSON content is required.'},415);
   const user=await identity(request);if(user instanceof Response)return user;
   try{
    const body=WriteSchema.parse(await readLimitedJSON(request));
    serializedSnapshot(body.snapshot);
    return json(await dependencies.write(user.uid,body.snapshot,body.expectedRevision));
   }catch(error){
    if(error instanceof AccountRevisionConflict)return json({error:'השיחות השתנו במכשיר אחר. יש לרענן את הסנכרון.',code:'REVISION_CONFLICT'},409);
    if(error instanceof AccountPayloadTooLarge)return json({error:'היסטוריית השיחות גדולה מדי לסנכרון. העותק המקומי נשמר.'},413);
    if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'Invalid account history.'},400);
    return json({error:'סנכרון השיחות אינו זמין כרגע. העותק המקומי נשמר.'},503);
   }
  },
 };
}
export const accountWorkspaceHandlers=createAccountWorkspaceHandlers({verifyToken:token=>getAuth(firebaseApp()).verifyIdToken(token,true),read:readCloudWorkspaces,write:writeCloudWorkspaces});

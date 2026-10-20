import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountRevisionConflict,createAccountWorkspaceHandlers,type CloudWorkspaceState} from '../lib/account-cloud-store';
import {parseWorkspaceSnapshot} from '../lib/account-workspaces';
const empty=parseWorkspaceSnapshot(null);
function setup(){
 const accounts=new Map<string,CloudWorkspaceState>();
 const handlers=createAccountWorkspaceHandlers({verifyToken:async token=>{if(token==='invalid')throw new Error('bad token');return {uid:token,email:'user@example.test',email_verified:token!=='unverified'};},read:async uid=>accounts.get(uid)??{snapshot:null,revision:0},write:async(uid,snapshot,revision)=>{if((accounts.get(uid)?.revision??0)!==revision)throw new AccountRevisionConflict();const next={snapshot,revision:revision+1};accounts.set(uid,next);return next;}});
 const get=(token='alice')=>handlers.GET(new Request('https://shadow.test/api/account/workspaces',{headers:{authorization:`Bearer ${token}`}}));
 const put=(token='alice',expectedRevision=0,snapshot:unknown=empty,extra:Record<string,string>={})=>handlers.PUT(new Request('https://shadow.test/api/account/workspaces',{method:'PUT',headers:{authorization:`Bearer ${token}`,origin:'https://shadow.test','content-type':'application/json',...extra},body:JSON.stringify({snapshot,expectedRevision})}));
 return {get,put,handlers,accounts};
}
test('account API requires authenticated verified email for reads and writes',async()=>{
 const {get,put,handlers}=setup();
 assert.equal((await handlers.GET(new Request('https://shadow.test/api/account/workspaces'))).status,401);
 assert.equal((await get('invalid')).status,401);assert.equal((await get('unverified')).status,403);assert.equal((await put('unverified')).status,403);
});
test('account API isolates identities and uses compare-and-swap to prevent stale overwrites',async()=>{
 const {get,put}=setup();
 assert.deepEqual(await (await get()).json(),{snapshot:null,revision:0});
 const saved=await put();assert.equal(saved.status,200);assert.equal(saved.headers.get('cache-control'),'private, no-store');
 assert.equal((await saved.json()).revision,1);
 assert.deepEqual(await (await get('bob')).json(),{snapshot:null,revision:0});
 const conflict=await put();assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'REVISION_CONFLICT');
 assert.equal((await put('alice',1)).status,200);
});
test('account API rejects cross-origin, malformed, unknown fields and oversized updates',async()=>{
 const {put}=setup();
 assert.equal((await put('alice',0,empty,{origin:'https://evil.test'})).status,403);
 assert.equal((await put('alice',0,empty,{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await put('alice',0,empty,{'content-type':'text/plain'})).status,415);
 assert.equal((await put('alice',0,{...empty,uid:'victim'})).status,400);
 assert.equal((await put('alice',-1)).status,400);
 assert.equal((await put('alice',0,{...empty,deviceData:{'other-account-secret':'{}'}})).status,400);
 assert.equal((await put('alice',0,{...empty,deviceData:{'shadowui.layout.v1:chat':'not json'}})).status,400);
 assert.equal((await put('alice',0,empty,{'content-length':'800000'})).status,413);
 assert.equal((await put('alice',0,{...empty,conversations:{playground:[{role:'user',content:'x'.repeat(800000)}]}})).status,413);
});
test('account API preserves local data on service failures without leaking internal errors',async()=>{
 const handlers=createAccountWorkspaceHandlers({verifyToken:async()=>({uid:'alice',email:'a@example.test',email_verified:true}),read:async()=>{throw new Error('private credentials');},write:async()=>{throw new Error('private credentials');}});
 const result=await handlers.GET(new Request('https://shadow.test/api/account/workspaces',{headers:{authorization:'Bearer alice'}}));
 assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private credentials/);
});

const emulatorEnabled=!!process.env.FIRESTORE_EMULATOR_HOST&&!!process.env.FIREBASE_AUTH_EMULATOR_HOST;
test('Firebase emulators enforce real token ownership and transactional revision conflicts',{skip:!emulatorEnabled},async()=>{
 assert.ok(process.env.FIREBASE_PROJECT_ID?.startsWith('demo-'),'Cloud integration tests require an explicit demo Firebase project');
 const [{getAuth},{firebaseApp,catalogDatabase},{accountWorkspaceHandlers}]=await Promise.all([import('firebase-admin/auth'),import('../lib/firebase-admin'),import('../lib/account-cloud-store')]);
 const auth=getAuth(firebaseApp()),identities:Array<{uid:string;token:string}>=[];
 async function account(verified:boolean){
  const email=`cloud-${crypto.randomUUID()}@example.test`,password='emulator-only-password';
  const user=await auth.createUser({email,emailVerified:verified,password});
  const identity={uid:user.uid,token:''};identities.push(identity);
  const response=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only-key`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  assert.equal(response.status,200);identity.token=(await response.json()).idToken;return identity;
 }
 const request=(token:string,body?:unknown)=>new Request('http://localhost:3000/api/account/workspaces',{method:body?'PUT':'GET',headers:{authorization:`Bearer ${token}`,origin:'http://localhost:3000','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  const [alice,bob,unverified]=await Promise.all([account(true),account(true),account(false)]);
  assert.equal((await accountWorkspaceHandlers.GET(request(unverified.token))).status,403);
  assert.equal((await accountWorkspaceHandlers.PUT(request(unverified.token,{snapshot:empty,expectedRevision:0}))).status,403);
  assert.equal((await accountWorkspaceHandlers.GET(request('forged-token.invalid.signature'))).status,401);
  const snapshot={...empty,conversations:{playground:[{role:'user' as const,content:'A private cloud conversation'}]}};
  const writes=await Promise.all([accountWorkspaceHandlers.PUT(request(alice.token,{snapshot,expectedRevision:0})),accountWorkspaceHandlers.PUT(request(alice.token,{snapshot,expectedRevision:0}))]);
  assert.deepEqual(writes.map(response=>response.status).sort(),[200,409],'Only one concurrent writer can claim the same revision');
  const read=await accountWorkspaceHandlers.GET(request(alice.token));assert.equal(read.status,200);
  assert.deepEqual(await read.json(),{snapshot:JSON.parse(JSON.stringify(snapshot)),revision:1});
  const other=await accountWorkspaceHandlers.GET(request(bob.token));assert.deepEqual(await other.json(),{snapshot:null,revision:0});
  const updated={...snapshot,conversations:{playground:[{role:'user' as const,content:'Latest cloud conversation'}]}};
  assert.equal((await accountWorkspaceHandlers.PUT(request(alice.token,{snapshot:updated,expectedRevision:1}))).status,200);
  assert.deepEqual(await (await accountWorkspaceHandlers.GET(request(alice.token))).json(),{snapshot:JSON.parse(JSON.stringify(updated)),revision:2});
  const document=await catalogDatabase().collection('shadowui_account_workspaces').doc(alice.uid).get();assert.equal(document.data()?.revision,2);assert.equal(typeof document.data()?.payload,'string');
  await auth.updateUser(alice.uid,{disabled:true});assert.equal((await accountWorkspaceHandlers.GET(request(alice.token))).status,401,'Disabled users cannot read using an existing ID token');
 }finally{
  await Promise.all(identities.map(async identity=>{await catalogDatabase().collection('shadowui_account_workspaces').doc(identity.uid).delete();await auth.deleteUser(identity.uid);}));
 }
});
test('same-origin writes use the public Host when Next.js rewrites the internal request URL',async()=>{
 const {handlers}=setup();
 const result=await handlers.PUT(new Request('http://localhost:3100/api/account/workspaces',{method:'PUT',headers:{host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100',authorization:'Bearer alice','content-type':'application/json'},body:JSON.stringify({snapshot:empty,expectedRevision:0})}));
 assert.equal(result.status,200);
});

test('cloud snapshot accepts actual persisted layout density values',async()=>{const {put}=setup();assert.equal((await put('alice',0,{...empty,deviceData:{'shadowui.layout.v1:chat:density':'comfortable'}})).status,200);});

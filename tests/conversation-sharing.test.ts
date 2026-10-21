import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationSharingHandlers,ConversationOwnershipConflict,type ConversationShareRecord} from '../lib/conversation-sharing';
import type {CloudWorkspaceState} from '../lib/account-cloud-store';
import type {Workspace} from '../lib/schema';
const workspace:Workspace={id:'chat-1',title:'Private title',description:'private description',goal:'private goal',components:[]};
function setup(){
 const accounts=new Map<string,CloudWorkspaceState>([['alice',{snapshot:{workspaces:[workspace],active:'chat-1',conversations:{'chat-1':[{role:'user',content:'private text'}]},undoWorkspaces:{},sources:{}},revision:1}]]);
 const shares=new Map<string,ConversationShareRecord>();
 const handlers=createConversationSharingHandlers({verifyToken:async token=>{if(token==='bad')throw new Error('bad token');return {uid:token,email:token==='bob'?'BOB@example.test':`${token}@example.test`,email_verified:token!=='unverified'};},readAccount:async uid=>accounts.get(uid)??{snapshot:null,revision:0},readShare:async id=>shares.get(id)??null,writeShare:async(id,uid,sharing)=>{const current=shares.get(id);if(current&&current.ownerUid!==uid)throw new ConversationOwnershipConflict();shares.set(id,{ownerUid:uid,sharing});}});
 const request=(token?:string,body?:unknown,origin='https://app.test')=>new Request('https://app.test/api/conversations/chat-1/sharing',{method:body===undefined?'GET':'PUT',headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{origin,'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {accounts,shares,handlers,request};
}
test('private owner endpoint works before sharing and denies other users and anonymous readers',async()=>{
 const {handlers,request}=setup();
 const response=await handlers.GET(request('alice'),'chat-1');assert.equal(response.status,200);const body=await response.json();assert.equal(body.owner,true);assert.equal(body.history[0].content,'private text');assert.equal(body.sharing.mode,'private');assert.equal(response.headers.get('cache-control'),'private, no-store');
 for(const token of [undefined,'bob'])assert.equal((await handlers.GET(request(token),'chat-1')).status,404);
});
test('only verified owner can share cloud-owned conversation; forged ownership and missing IDs fail',async()=>{
 const {handlers,request,shares}=setup();
 for(const [token,status] of [[undefined,401],['unverified',403],['bad',401],['bob',404]] as const)assert.equal((await handlers.PUT_SHARING(request(token,{mode:'link',emails:[]}),'chat-1')).status,status);
 assert.equal((await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]}),'missing')).status,404);assert.equal(shares.size,0);
 assert.equal((await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]}),'chat-1')).status,200);assert.equal(shares.get('chat-1')?.ownerUid,'alice');
});
test('link readers receive only the requested conversation without recipient emails or owner UID',async()=>{
 const {handlers,request}=setup();await handlers.PUT_SHARING(request('alice',{mode:'link',emails:['secret@example.test']}),'chat-1');
 const response=await handlers.GET(request(),'chat-1');assert.equal(response.status,200);const body=await response.json();assert.equal(body.owner,false);assert.deepEqual(body.sharing,{mode:'link',emails:[]});assert.equal(body.ownerUid,undefined);assert.equal(body.snapshot,undefined);
 assert.equal((await handlers.GET_SHARING(request(),'chat-1')).status,404);
});
test('email sharing requires verified exact normalized recipient and conceals allowlist',async()=>{
 const {handlers,request}=setup();await handlers.PUT_SHARING(request('alice',{mode:'email',emails:[' BOB@example.test ','bob@example.test','secret@example.test']}),'chat-1');
 assert.equal((await handlers.GET(request(),'chat-1')).status,404);assert.equal((await handlers.GET(request('charlie'),'chat-1')).status,404);
 const response=await handlers.GET(request('bob'),'chat-1');assert.equal(response.status,200);assert.deepEqual((await response.json()).sharing,{mode:'email',emails:[]});
 assert.deepEqual(await (await handlers.GET_SHARING(request('alice'),'chat-1')).json(),{mode:'email',emails:['bob@example.test','secret@example.test']});
});
test('owner can revoke access and current edits and deletion are honored immediately',async()=>{
 const {handlers,request,accounts}=setup();await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]}),'chat-1');
 const account=accounts.get('alice')!;account.snapshot!.workspaces[0]={...workspace,title:'Updated title'};
 assert.equal((await (await handlers.GET(request(),'chat-1')).json()).workspace.title,'Updated title');
 await handlers.PUT_SHARING(request('alice',{mode:'private',emails:[]}),'chat-1');assert.equal((await handlers.GET(request(),'chat-1')).status,404);
 await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]}),'chat-1');account.snapshot!.workspaces=[];assert.equal((await handlers.GET(request(),'chat-1')).status,404);
});
test('colliding workspace IDs cannot claim or mutate an existing share',async()=>{
 const {handlers,request,accounts}=setup();await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]}),'chat-1');accounts.set('bob',structuredClone(accounts.get('alice')!));
 assert.equal((await handlers.PUT_SHARING(request('bob',{mode:'email',emails:['bob@example.test']}),'chat-1')).status,404);
 assert.equal((await handlers.GET_SHARING(request('bob'),'chat-1')).status,404);
});
test('invalid settings, cross-origin requests, invalid IDs and oversized bodies are rejected',async()=>{
 const {handlers,request}=setup();
 for(const body of [{mode:'email',emails:[]},{mode:'email',emails:['bad']},{mode:'link',emails:[],ownerUid:'bob'},{mode:'public',emails:[]}])assert.equal((await handlers.PUT_SHARING(request('alice',body),'chat-1')).status,400);
 assert.equal((await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]},'https://evil.test'),'chat-1')).status,403);
 assert.equal((await handlers.PUT_SHARING(request('alice',{mode:'link',emails:['a'.repeat(21_000)]}),'chat-1')).status,413);
 for(const id of ['../other','__proto__',''])assert.equal((await handlers.GET(request('alice'),id)).status,404);
});
test('same-origin sharing works with a public Host and internal Next.js URL',async()=>{
 const {handlers}=setup();
 const request=new Request('http://localhost:3000/api/conversations/chat-1/sharing',{method:'PUT',headers:{host:'app.test',origin:'http://app.test',authorization:'Bearer alice','content-type':'application/json'},body:JSON.stringify({mode:'link',emails:[]})});
 assert.equal((await handlers.PUT_SHARING(request,'chat-1')).status,200);
});
test('backend errors never disclose service credentials or account data',async()=>{
 const handlers=createConversationSharingHandlers({verifyToken:async()=>({uid:'alice',email:'alice@example.test',email_verified:true}),readAccount:async()=>{throw new Error('secret credentials');},readShare:async()=>null,writeShare:async()=>{throw new Error('secret credentials');}});
 const request=new Request('https://app.test/api/conversations/chat-1',{headers:{authorization:'Bearer alice'}});
 const response=await handlers.GET(request,'chat-1');assert.equal(response.status,503);assert.equal((await response.text()).includes('secret credentials'),false);
});

test('anyone links remain viewable with expired or unverified sessions without granting ownership',async()=>{
 const {handlers,request}=setup();await handlers.PUT_SHARING(request('alice',{mode:'link',emails:[]}),'chat-1');
 for(const token of ['bad','unverified']){const response=await handlers.GET(request(token),'chat-1');assert.equal(response.status,200);assert.equal((await response.json()).owner,false);assert.equal((await handlers.GET_SHARING(request(token),'chat-1')).status,404);}
});

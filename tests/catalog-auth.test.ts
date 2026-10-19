import test from 'node:test';
import assert from 'node:assert/strict';
import {getAuth} from 'firebase-admin/auth';
import {firebaseApp,isCatalogAdmin} from '../lib/firebase-admin';
import {seedDefinitions} from '../lib/catalog';
import {saveGeneratedDefinition} from '../lib/catalog-store';
import {GET as list,POST as save} from '../app/api/catalog/route';
import {GET as detail,POST as update} from '../app/api/catalog/[id]/route';

const enabled=!!process.env.FIRESTORE_EMULATOR_HOST&&!!process.env.FIREBASE_AUTH_EMULATOR_HOST;
function request(path:string,token?:string,body?:unknown,session?:string){return new Request(`http://localhost:3000/api/catalog${path}`,{method:body?'POST':'GET',headers:{...(token?{authorization:`Bearer ${token}`} :{}),...(session?{cookie:`shadowui_ai=${session}`} :{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
async function account(email:string,verified:boolean){
 const auth=getAuth(firebaseApp());const user=await auth.createUser({email,emailVerified:verified,password:'emulator-only-password'});
 const host=process.env.FIREBASE_AUTH_EMULATOR_HOST!;
 const response=await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only-key`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'emulator-only-password',returnSecureToken:true})});
 assert.equal(response.status,200);const body=await response.json();return {uid:user.uid,token:body.idToken as string};
}
test('Firebase Auth emulator verifies administrator identities and protects catalog mutations/history',{skip:!enabled},async()=>{
 assert.ok(process.env.FIREBASE_PROJECT_ID?.startsWith('demo-'),'Auth security tests require an explicit demo Firebase project');
 const originalAllowlist=process.env.FIREBASE_ADMIN_EMAIL,originalBypass=process.env.CATALOG_EMULATOR_ADMIN_TOKEN;
 delete process.env.CATALOG_EMULATOR_ADMIN_TOKEN;
 const unique=crypto.randomUUID(),adminEmail=`admin-${unique}@example.test`,unverifiedEmail=`unverified-${unique}@example.test`;
 process.env.FIREBASE_ADMIN_EMAIL=`${adminEmail},${unverifiedEmail}`;
 const identities=await Promise.all([account(adminEmail,true),account(unverifiedEmail,false),account(`reader-${unique}@example.test`,true)]);
 const [admin,unverified,reader]=identities;
 const [header,payload]=admin.token.split('.');
 const forgedCrossProject=`${header}.${Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url').toString()),aud:'different-project'})).toString('base64url')}.`;
 try{
  assert.equal(await isCatalogAdmin(request('',admin.token)),true);
  for(const token of [undefined,unverified.token,reader.token,'forged-token.invalid.signature',forgedCrossProject])assert.equal(await isCatalogAdmin(request('',token)),false);
  const definition={...seedDefinitions()[0],id:`auth-${unique}`,status:'draft' as const,source:'admin' as const};
  for(const token of [undefined,unverified.token,reader.token,'forged-token.invalid.signature',forgedCrossProject]){
   assert.equal((await save(request('',token,{definition,syntheticDataConfirmed:true}))).status,403);
   assert.equal((await update(request(`/${definition.id}`,token,{action:'activate',syntheticDataConfirmed:true}),{params:Promise.resolve({id:definition.id})})).status,403);
  }
  assert.equal((await save(request('',admin.token,{definition}))).status,400,'Shared publication needs explicit synthetic-data confirmation');
  const saved=await save(request('',admin.token,{definition,syntheticDataConfirmed:true}));assert.equal(saved.status,200);assert.equal((await saved.json()).definition.version,1);
  const activated=await update(request(`/${definition.id}`,admin.token,{action:'activate',expectedVersion:1,syntheticDataConfirmed:true}),{params:Promise.resolve({id:definition.id})});assert.equal(activated.status,200);assert.equal((await activated.json()).definition.version,2);
  const retired=await update(request(`/${definition.id}`,admin.token,{action:'retire',expectedVersion:2}),{params:Promise.resolve({id:definition.id})});assert.equal(retired.status,200);
  const publicDraftHistory=await detail(request(`/${definition.id}`),{params:Promise.resolve({id:definition.id})});assert.equal(publicDraftHistory.status,404);
  const adminHistory=await detail(request(`/${definition.id}`,admin.token),{params:Promise.resolve({id:definition.id})});assert.equal(adminHistory.status,200);assert.equal((await adminHistory.json()).revisions.length,3);
  const owner=crypto.randomUUID(),other=crypto.randomUUID(),privateId=`private-auth-${unique}`;
  await saveGeneratedDefinition({...seedDefinitions()[0],id:privateId},owner);
  for(const session of [undefined,other]){
   const hidden=await detail(request(`/${privateId}`,undefined,undefined,session),{params:Promise.resolve({id:privateId})});assert.equal(hidden.status,404);
   const listing=await list(request('',undefined,undefined,session));assert.equal(listing.status,200);assert.equal((await listing.json()).definitions.some((d:{id:string})=>d.id===privateId),false);
  }
  const owned=await detail(request(`/${privateId}`,undefined,undefined,owner),{params:Promise.resolve({id:privateId})});assert.equal(owned.status,200);assert.equal((await owned.json()).revisions.length,1,'Public owner reads expose active revision only');
  await getAuth(firebaseApp()).updateUser(admin.uid,{disabled:true});assert.equal(await isCatalogAdmin(request('',admin.token)),false,'Disabled administrators lose access even with an existing token');
 }finally{
  await Promise.all(identities.map(identity=>getAuth(firebaseApp()).deleteUser(identity.uid)));
  if(originalAllowlist===undefined)delete process.env.FIREBASE_ADMIN_EMAIL;else process.env.FIREBASE_ADMIN_EMAIL=originalAllowlist;
  if(originalBypass===undefined)delete process.env.CATALOG_EMULATOR_ADMIN_TOKEN;else process.env.CATALOG_EMULATOR_ADMIN_TOKEN=originalBypass;
 }
});

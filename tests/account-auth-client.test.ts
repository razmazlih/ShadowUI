import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the actual client orchestration with an isolated SDK boundary. No live
// Firebase project or browser credentials are used by these regression tests.
function client(){
 const active={name:'main',currentUser:null as any},proof={name:'proof',currentUser:null as any};
 let listener:(()=>void)|undefined,errorListener:((error:Error)=>void)|undefined;
 const calls:string[]=[];
 const state={popupUser:null as any,popupError:null as any,redirectUser:null as any,emailUser:null as any};
 class GoogleAuthProvider{
  setCustomParameters(){}
  static credentialFromResult(){return {providerId:'google.com'};}
  static credentialFromError(){return {providerId:'google.com'};}
 }
 const sdk={
  getRedirectResult:async()=>{if(state.popupError)throw state.popupError;return state.redirectUser?{user:state.redirectUser}:null;},
  signInWithRedirect:async()=>{calls.push('redirect');},
  GoogleAuthProvider,browserLocalPersistence:{},inMemoryPersistence:{},
  applyActionCode:async(_:unknown,code:string)=>{calls.push(`apply:${code}`);if(code==='expired')throw Object.assign(new Error('expired'),{code:'auth/expired-action-code'});},
  getAuth:(app:{name:string})=>app.name==='shadowui-account-link'?proof:active,
  setPersistence:async()=>{},
  onAuthStateChanged:(_:unknown,next:()=>void,error:(error:Error)=>void)=>{listener=next;errorListener=error;next();return ()=>{};},
  signInWithPopup:async(instance:typeof active)=>{if(state.popupError)throw state.popupError;instance.currentUser=state.popupUser;if(instance===active)listener?.();return {user:state.popupUser};},
  signInWithEmailAndPassword:async()=>{active.currentUser=state.emailUser;listener?.();return {user:state.emailUser};},
  linkWithCredential:async(user:any)=>{calls.push(`link:${user.uid}`);return {user};},
  reload:async()=>{calls.push('reload');},
  updateProfile:async(user:any,profile:any)=>{if(state.popupError)throw state.popupError;calls.push('profile');Object.assign(user,profile);},
  signOut:async(instance:typeof active)=>{calls.push(`signOut:${instance.name}`);instance.currentUser=null;},
 };
 const exports:Record<string,any>={};
 const source=ts.transpileModule(readFileSync(new URL('../lib/firebase-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const require=(name:string)=>name==='firebase/auth'?sdk:{getApps:()=>[],initializeApp:(_:unknown,name:string)=>({name})};
 const process={env:{NEXT_PUBLIC_FIREBASE_API_KEY:'fake',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:'test.invalid',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'unit-test-project',NEXT_PUBLIC_FIREBASE_APP_ID:'fake'}};
 new Function('require','exports','process',source)(require,exports,process);
 const user=(uid:string,email='same@example.test',emailVerified=true)=>({uid,email,emailVerified,providerData:[],getIdToken:async()=>{calls.push('token');return 'fake';}});
 return {api:exports,active,state,calls,user,emitError:(error:Error)=>errorListener?.(error)};
}

test('Google proof already using the current UID refreshes without redundant linking',async()=>{
 const c=client();c.active.currentUser=c.user('existing');c.state.popupUser=c.user('existing');
 await c.api.linkAccountGoogle();
 assert.deepEqual(c.calls,['reload','token','signOut:proof']);
 assert.equal(c.active.currentUser.uid,'existing');
});
test('Google proof refuses a different email and cleans up the proof session',async()=>{
 const c=client();c.active.currentUser=c.user('existing');c.state.popupUser=c.user('other','other@example.test');
 await assert.rejects(c.api.linkAccountGoogle(),/אותו אימייל/);
 assert.deepEqual(c.calls,['signOut:proof']);assert.equal(c.active.currentUser.uid,'existing');
});
test('matching verified Google proof links to the original UID',async()=>{
 const c=client();c.active.currentUser=c.user('existing');c.state.popupUser=c.user('proof');
 await c.api.linkAccountGoogle();assert.deepEqual(c.calls,['link:existing','signOut:proof']);
});
test('pending Google credential only links after matching verified password sign-in',async()=>{
 const c=client();c.state.popupError={code:'auth/account-exists-with-different-credential',customData:{email:'same@example.test'}};
 c.api.observeAccountUser(()=>{},()=>{});await new Promise(resolve=>setTimeout(resolve,0));
 c.state.emailUser=c.user('different','other@example.test');await c.api.signInAccountEmail('other@example.test','secret');
 c.state.emailUser=c.user('unverified','same@example.test',false);await c.api.signInAccountEmail('same@example.test','secret');
 assert.deepEqual(c.calls,[]);
 c.state.emailUser=c.user('target');await c.api.signInAccountEmail('same@example.test','secret');assert.deepEqual(c.calls,['link:target']);
});
test('Google sign-in navigates without opening a popup and observer reports errors',async()=>{
 const c=client(),observed:(string|null)[]=[];
 c.api.observeAccountUser((user:any)=>observed.push(user?.uid??null));
 c.state.popupUser=c.user('existing');await c.api.signInAccountGoogle();
 assert.deepEqual(c.calls,['redirect']);assert.equal(c.active.currentUser,null);assert.deepEqual(observed,[null,null]);
 c.emitError(new Error('storage unavailable'));assert.deepEqual(observed,[null,null,null]);
});

test('verification applies a single-use code once across repeated effects and refreshes the session',async()=>{
 const c=client();c.active.currentUser=c.user('existing');
 await Promise.all([c.api.completeAccountVerification('valid'),c.api.completeAccountVerification('valid')]);
 assert.deepEqual(c.calls,['apply:valid','reload','token']);
});
test('verification works without a signed-in session and rejects expired codes',async()=>{
 const c=client();await c.api.completeAccountVerification('valid');
 await assert.rejects(c.api.completeAccountVerification('expired'),{code:'auth/expired-action-code'});
 assert.deepEqual(c.calls,['apply:valid','apply:expired']);
});

test('account name persists trimmed on the same user and publishes after saving',async()=>{
 const c=client();c.active.currentUser=c.user('existing');
 const names:(string|null)[]=[];
 c.api.observeAccountUser((user:any)=>names.push(user?.displayName??null));
 await c.api.updateAccountName('  רז  ');
 assert.equal(c.active.currentUser.displayName,'רז');
 assert.deepEqual(names,[null,'רז']);assert.deepEqual(c.calls,['profile']);
});
test('account name rejects empty, oversized and unauthenticated updates',async()=>{
 const c=client();await assert.rejects(c.api.updateAccountName('Name'),/להתחבר/);
 c.active.currentUser=c.user('existing');
 await assert.rejects(c.api.updateAccountName('   '),/80/);
 await assert.rejects(c.api.updateAccountName('a'.repeat(81)),/80/);
 assert.deepEqual(c.calls,[]);
});
test('failed account name save preserves previous profile and reports failure',async()=>{
 const c=client();c.active.currentUser={...c.user('existing'),displayName:'Original'};
 c.state.popupError=new Error('offline');
 await assert.rejects(c.api.updateAccountName('New'),/offline/);
 assert.equal(c.active.currentUser.displayName,'Original');
});

test('redirect completion survives a new page instance and reports return failures',async()=>{
 const c=client();c.state.redirectUser=c.user('returned');let completed=0;
 c.api.observeAccountUser(()=>{},()=>assert.fail('unexpected error'),()=>completed++);
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(completed,1);
 const failed=client();failed.state.popupError={code:'auth/unauthorized-domain'};let code='';
 failed.api.observeAccountUser(()=>{},(error:any)=>{code=error.code;});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(code,'auth/unauthorized-domain');
});

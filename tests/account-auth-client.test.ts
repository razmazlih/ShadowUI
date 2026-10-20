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
 const state={popupUser:null as any,popupError:null as any,emailUser:null as any};
 class GoogleAuthProvider{
  setCustomParameters(){}
  static credentialFromResult(){return {providerId:'google.com'};}
  static credentialFromError(){return {providerId:'google.com'};}
 }
 const sdk={
  GoogleAuthProvider,browserLocalPersistence:{},inMemoryPersistence:{},
  getAuth:(app:{name:string})=>app.name==='shadowui-account-link'?proof:active,
  setPersistence:async()=>{},
  onAuthStateChanged:(_:unknown,next:()=>void,error:(error:Error)=>void)=>{listener=next;errorListener=error;next();return ()=>{};},
  signInWithPopup:async(instance:typeof active)=>{if(state.popupError)throw state.popupError;instance.currentUser=state.popupUser;if(instance===active)listener?.();return {user:state.popupUser};},
  signInWithEmailAndPassword:async()=>{active.currentUser=state.emailUser;listener?.();return {user:state.emailUser};},
  linkWithCredential:async(user:any)=>{calls.push(`link:${user.uid}`);return {user};},
  reload:async()=>{calls.push('reload');},
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
 await assert.rejects(c.api.signInAccountGoogle());
 c.state.emailUser=c.user('different','other@example.test');await c.api.signInAccountEmail('other@example.test','secret');
 c.state.emailUser=c.user('unverified','same@example.test',false);await c.api.signInAccountEmail('same@example.test','secret');
 assert.deepEqual(c.calls,[]);
 c.state.emailUser=c.user('target');await c.api.signInAccountEmail('same@example.test','secret');assert.deepEqual(c.calls,['link:target']);
});
test('account observer publishes once after sign-in operation and recovers initialization error',async()=>{
 const c=client(),observed:(string|null)[]=[];
 c.api.observeAccountUser((user:any)=>observed.push(user?.uid??null));
 c.state.popupUser=c.user('existing');await c.api.signInAccountGoogle();
 assert.deepEqual(observed,[null,'existing']);
 c.emitError(new Error('storage unavailable'));assert.deepEqual(observed,[null,'existing','existing']);
});

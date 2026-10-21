'use client';
import {getApps,initializeApp} from 'firebase/app';
import {applyActionCode,browserLocalPersistence,connectAuthEmulator,createUserWithEmailAndPassword,EmailAuthProvider,getAuth,getRedirectResult,GoogleAuthProvider,inMemoryPersistence,linkWithCredential,onAuthStateChanged,reload,sendEmailVerification,sendPasswordResetEmail,setPersistence,updateProfile,signInWithEmailAndPassword,signInWithPopup,signInWithRedirect,signOut,type OAuthCredential,type UserCredential,type User} from 'firebase/auth';
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID};
const emulatorHost=process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
function localEmulatorURL(){
 if(!emulatorHost||!config.projectId?.startsWith('demo-'))return null;
 try{const url=new URL(emulatorHost.includes('://')?emulatorHost:`http://${emulatorHost}`);return url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!!url.port&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash?url.origin:null;}catch{return null;}
}
const emulatorURL=localEmulatorURL();
// An invalid emulator setting must never silently fall back to live authentication.
const modeConfigured=emulatorHost?Boolean(emulatorURL):Boolean(config.projectId&&!config.projectId.startsWith('demo-'));
export const firebaseClientConfigured=Boolean(modeConfigured&&config.apiKey&&config.authDomain&&config.projectId&&config.appId);
function auth(){
 if(!firebaseClientConfigured)throw new Error('Firebase Authentication אינו מוגדר כראוי.');
 const app=getApps().find(app=>app.name==='shadowui-catalog-client')??initializeApp({...config,authDomain:!emulatorURL&&typeof window!=='undefined'?window.location.host:config.authDomain},'shadowui-catalog-client');
 const instance=getAuth(app);if(emulatorURL&&!instance.emulatorConfig)connectAuthEmulator(instance,emulatorURL,{disableWarnings:true});return instance;
}
export function observeCatalogUser(callback:(user:User|null)=>void){if(!firebaseClientConfigured){callback(null);return ()=>{};}return onAuthStateChanged(auth(),callback);}
export async function signInCatalog(){return signInWithPopup(auth(),new GoogleAuthProvider());}
export async function signOutCatalog(){return signOut(auth());}

let redirectResult:Promise<UserCredential|null>|undefined;
function rememberGoogleConflict(error:unknown){
 if((error as {code?:string})?.code!=='auth/account-exists-with-different-credential')return;
 const credential=GoogleAuthProvider.credentialFromError(error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]);
 const email=(error as {customData?:{email?:string}}).customData?.email;
 if(credential&&email)pendingGoogle={credential,email};
}
function finishGoogleRedirect(){
 return redirectResult??=getRedirectResult(auth()).catch(error=>{rememberGoogleConflict(error);throw error;});
}
const accountObservers=new Set<(user:User|null)=>void>();
let accountOperations=0;
let pendingGoogle:{email:string;credential:OAuthCredential}|null=null;
function publishAccount(){if(!accountOperations)for(const callback of accountObservers)callback(auth().currentUser);}
async function accountOperation<T>(operation:()=>Promise<T>):Promise<T>{
 accountOperations++;
 try{await setPersistence(auth(),browserLocalPersistence);auth().languageCode='he';return await operation();}
 finally{accountOperations--;publishAccount();}
}
export function observeAccountUser(callback:(user:User|null)=>void,onError?:(error:Error)=>void,onGoogleRedirect?:()=>void){
 if(!firebaseClientConfigured){callback(null);return ()=>{};}
 try{
  const instance=auth();accountObservers.add(callback);
  let subscribed=true;
  void finishGoogleRedirect().then(result=>{if(subscribed&&result?.user.emailVerified)onGoogleRedirect?.();}).catch(error=>{if(subscribed)onError?.(error instanceof Error?error:Object.assign(new Error('Google sign-in failed.'),error));});
  const unsubscribe=onAuthStateChanged(instance,()=>{if(!accountOperations)callback(instance.currentUser);},error=>{onError?.(error);if(!accountOperations)callback(instance.currentUser);});
  return ()=>{subscribed=false;accountObservers.delete(callback);unsubscribe();};
 }catch(error){accountObservers.delete(callback);onError?.(error instanceof Error?error:new Error('לא ניתן לפתוח את שירות ההתחברות.'));callback(null);return ()=>{};}
}
export function accountAuthError(error:unknown,locale:'he'|'en'='he'){
 const code=(error as {code?:string})?.code;
 const messages:Record<string,string>=locale==='en'?{
  'auth/invalid-credential':'The email or password is incorrect. Try signing in with Google or resetting your password.',
  'auth/email-already-in-use':'An account with this email already exists. Sign in with Google or your existing password. After signing in with Google, you can add a password to the same account.',
  'auth/account-exists-with-different-credential':'This email already belongs to an account. Sign in with your existing password to link Google as well.',
  'auth/popup-closed-by-user':'The sign-in window was closed. Please try again.',
  'auth/popup-blocked':'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/weak-password':'Choose a password with at least 6 characters.',
  'auth/invalid-email':'Enter a valid email address.',
  'auth/too-many-requests':'Too many attempts. Please try again later.',
  'auth/network-request-failed':'Unable to connect to the sign-in service. Check your connection and try again.',
  'auth/operation-not-allowed':'This sign-in method is not enabled in the Firebase project.',
  'auth/unauthorized-domain':'This website domain is not authorized for Firebase sign-in.',
  'auth/requires-recent-login':'Sign in again before changing your sign-in details.',
 }:{
  'auth/invalid-credential':'האימייל או הסיסמה אינם נכונים. אפשר לנסות כניסה עם Google או איפוס סיסמה.',
  'auth/email-already-in-use':'כבר קיים חשבון עם האימייל הזה. התחברו אליו עם Google או עם הסיסמה הקיימת. לאחר כניסה עם Google תוכלו להוסיף סיסמה לאותו חשבון.',
  'auth/account-exists-with-different-credential':'האימייל כבר משויך לחשבון. התחברו עם הסיסמה הקיימת כדי לקשר גם את Google.',
  'auth/popup-closed-by-user':'חלון ההתחברות נסגר. אפשר לנסות שוב.',
  'auth/popup-blocked':'הדפדפן חסם את חלון Google. אפשרו חלונות קופצים ונסו שוב.',
  'auth/weak-password':'בחרו סיסמה של לפחות 6 תווים.',
  'auth/invalid-email':'כתובת האימייל אינה תקינה.',
  'auth/too-many-requests':'בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
  'auth/network-request-failed':'אין חיבור לשירות ההתחברות. בדקו את החיבור ונסו שוב.',
  'auth/operation-not-allowed':'שיטת ההתחברות אינה מופעלת בפרויקט Firebase.',
  'auth/unauthorized-domain':'כתובת האתר אינה מורשית להתחברות ב־Firebase.',
  'auth/requires-recent-login':'יש להתחבר שוב לפני שינוי פרטי ההתחברות.',
 };
 if(code&&messages[code])return messages[code];
 if(locale==='en'){
  const localMessages:Record<string,string>={
   'Firebase Authentication אינו מוגדר כראוי.':'Firebase Authentication is not configured correctly.',
   'לא ניתן לפתוח את שירות ההתחברות.':'Unable to open the sign-in service.',
   'יש להתחבר תחילה.':'Please sign in first.',
   'השם חייב להכיל בין 1 ל־80 תווים.':'Your name must contain 1 to 80 characters.',
   'יש להתחבר עם Google ולאמת את האימייל תחילה.':'Sign in with Google and verify your email first.',
   'יש לאמת את האימייל לפני קישור Google.':'Verify your email before linking Google.',
   'בחרו את חשבון Google עם אותו אימייל בדיוק. לא בוצע קישור.':'Choose the Google account with the exact same email address. No account was linked.',
   'לא ניתן לאמת את חשבון Google. נסו שוב.':'Unable to verify the Google account. Please try again.',
  };
  return error instanceof Error&&!code&&localMessages[error.message]||'The action failed. Please try again.';
 }
 return error instanceof Error&&!code?error.message:'הפעולה נכשלה. נסו שוב.';
}
export function signInAccountGoogle(){return accountOperation(async()=>{
 pendingGoogle=null;
 // Full-page navigation works without permission to open popup windows.
 return signInWithRedirect(auth(),new GoogleAuthProvider());
});}
export function signInAccountEmail(email:string,password:string){return accountOperation(async()=>{
 const result=await signInWithEmailAndPassword(auth(),email.trim(),password);
 if(pendingGoogle&&result.user.emailVerified&&result.user.email?.toLowerCase()===pendingGoogle.email.toLowerCase()){
  await linkWithCredential(result.user,pendingGoogle.credential);pendingGoogle=null;
 }
 return result;
});}
export function registerAccount(email:string,password:string){return accountOperation(async()=>{
 const result=await createUserWithEmailAndPassword(auth(),email.trim(),password);
 await sendAccountVerification(result.user);return result;
});}
export function resendAccountVerification(){return accountOperation(async()=>{
 const user=auth().currentUser;if(!user)throw new Error('יש להתחבר תחילה.');await sendAccountVerification(user);
});}
export function refreshAccountVerification(){return accountOperation(async()=>{
 const user=auth().currentUser;if(!user)return null;
 await reload(user);await user.getIdToken(true);
 if(user.emailVerified&&pendingGoogle&&user.email?.toLowerCase()===pendingGoogle.email.toLowerCase()){
  await linkWithCredential(user,pendingGoogle.credential);pendingGoogle=null;
 }
 return user;
});}
export function resetAccountPassword(email:string){return accountOperation(()=>sendPasswordResetEmail(auth(),email.trim()));}
export function addAccountPassword(password:string){return accountOperation(async()=>{
 const user=auth().currentUser;
 if(!user?.email||!user.emailVerified||!user.providerData.some(provider=>provider.providerId==='google.com'))throw new Error('יש להתחבר עם Google ולאמת את האימייל תחילה.');
 return linkWithCredential(user,EmailAuthProvider.credential(user.email,password));
});}
export function linkAccountGoogle(){return accountOperation(async()=>{
 const user=auth().currentUser;
 if(!user?.emailVerified||!user.email)throw new Error('יש לאמת את האימייל לפני קישור Google.');
 // A separate, memory-only session proves ownership without replacing the active UID.
 const app=getApps().find(candidate=>candidate.name==='shadowui-account-link')??initializeApp(config,'shadowui-account-link');
 const proof=getAuth(app);
 if(emulatorURL&&!proof.emulatorConfig)connectAuthEmulator(proof,emulatorURL,{disableWarnings:true});
 await setPersistence(proof,inMemoryPersistence);
 try{
  const provider=new GoogleAuthProvider();provider.setCustomParameters({login_hint:user.email,prompt:'select_account'});
  const result=await signInWithPopup(proof,provider);
  if(!result.user.emailVerified||result.user.email?.toLowerCase()!==user.email.toLowerCase())throw new Error('בחרו את חשבון Google עם אותו אימייל בדיוק. לא בוצע קישור.');
  // Firebase can auto-link a trusted Google provider during the proof sign-in.
  if(result.user.uid===user.uid){await reload(user);await user.getIdToken(true);return;}
  const credential=GoogleAuthProvider.credentialFromResult(result);
  if(!credential)throw new Error('לא ניתן לאמת את חשבון Google. נסו שוב.');
  await linkWithCredential(user,credential);
 }finally{await signOut(proof);}
});}
export function signOutAccount(){return accountOperation(async()=>{await signOut(auth());pendingGoogle=null;});}

async function sendAccountVerification(user:User){
 const response=await fetch('/api/account/verification',{method:'POST',headers:{Authorization:`Bearer ${await user.getIdToken()}`}});
 const result=await response.json();
 if(result.fallback===true&&response.status===503){await sendEmailVerification(user);return;}
 if(!response.ok)throw new Error(result.error||'לא ניתן לשלוח מייל אימות.');
}
const verificationActions=new Map<string,Promise<void>>();
export function completeAccountVerification(code:string){
 // Share the operation across React effect replays; action codes are single-use.
 let action=verificationActions.get(code);
 if(!action){action=(async()=>{await applyActionCode(auth(),code);try{await refreshAccountVerification();}catch{/* Verification succeeded; a stale local session must not block returning home. */}})();verificationActions.set(code,action);}
 return action;
}

export function updateAccountName(name:string){return accountOperation(async()=>{
 const user=auth().currentUser;if(!user)throw new Error('יש להתחבר תחילה.');
 const displayName=name.trim();
 if(!displayName||displayName.length>80)throw new Error('השם חייב להכיל בין 1 ל־80 תווים.');
 await updateProfile(user,{displayName});
});}

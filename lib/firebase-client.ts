'use client';
import {getApps,initializeApp} from 'firebase/app';
import {connectAuthEmulator,getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,type User} from 'firebase/auth';
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
 const app=getApps().find(app=>app.name==='shadowui-catalog-client')??initializeApp(config,'shadowui-catalog-client');
 const instance=getAuth(app);if(emulatorURL&&!instance.emulatorConfig)connectAuthEmulator(instance,emulatorURL,{disableWarnings:true});return instance;
}
export function observeCatalogUser(callback:(user:User|null)=>void){if(!firebaseClientConfigured){callback(null);return ()=>{};}return onAuthStateChanged(auth(),callback);}
export async function signInCatalog(){return signInWithPopup(auth(),new GoogleAuthProvider());}
export async function signOutCatalog(){return signOut(auth());}

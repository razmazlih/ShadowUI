'use client';
import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,type User} from 'firebase/auth';
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID};
export const firebaseClientConfigured=Boolean(config.apiKey&&config.authDomain&&config.projectId&&config.appId);
function auth(){if(!firebaseClientConfigured)throw new Error('חיבור Google אינו מוגדר. יש להגדיר את משתני NEXT_PUBLIC_FIREBASE ולהוסיף את כתובת האתר לדומיינים המורשים ב־Firebase Authentication.');return getAuth(getApps().length?getApp():initializeApp(config));}
export function observeCatalogUser(callback:(user:User|null)=>void){if(!firebaseClientConfigured){callback(null);return ()=>{};}return onAuthStateChanged(auth(),callback);}
export async function signInCatalog(){return signInWithPopup(auth(),new GoogleAuthProvider());}
export async function signOutCatalog(){return signOut(auth());}

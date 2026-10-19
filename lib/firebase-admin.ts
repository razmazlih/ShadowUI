import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

export function firebaseApp(){
 const projectId=process.env.FIREBASE_PROJECT_ID??process.env.GCLOUD_PROJECT;
 if(!projectId)throw new Error('Catalog database is not configured: set FIREBASE_PROJECT_ID and server credentials.');
 return getApps().find(app=>app.name==='shadowui-catalog')??initializeApp({projectId,...(!process.env.FIRESTORE_EMULATOR_HOST?{credential:process.env.FIREBASE_SERVICE_ACCOUNT_JSON?cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)):applicationDefault()}:{})},'shadowui-catalog');
}
export function catalogDatabase(){return getFirestore(firebaseApp());}
export function catalogSession(request:Request){return request.headers.get('cookie')?.match(/(?:^|; )shadowui_ai=([a-f0-9-]{36})(?:;|$)/)?.[1];}
export async function isCatalogAdmin(request:Request):Promise<boolean>{
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return false;
 const local=process.env.NODE_ENV==='test'||process.env.NODE_ENV==='development';
 if(local&&process.env.FIRESTORE_EMULATOR_HOST&&process.env.CATALOG_EMULATOR_ADMIN_TOKEN&&token===process.env.CATALOG_EMULATOR_ADMIN_TOKEN)return true;
 const allowlist=(process.env.FIREBASE_ADMIN_EMAIL??'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean);
 if(!allowlist.length)return false;
 try{const identity=await getAuth(firebaseApp()).verifyIdToken(token,true);return identity.email_verified===true&&!!identity.email&&allowlist.includes(identity.email.toLowerCase());}catch{return false;}
}

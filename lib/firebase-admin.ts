import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

export function validateFirebaseEnvironment(env:Record<string,string|undefined>=process.env){
 const projectId=env.FIREBASE_PROJECT_ID??env.GCLOUD_PROJECT;
 if(!projectId)throw new Error('Catalog database is not configured: set FIREBASE_PROJECT_ID and server credentials.');
 const firestore=env.FIRESTORE_EMULATOR_HOST,auth=env.FIREBASE_AUTH_EMULATOR_HOST;
 const emulator=Boolean(firestore||auth);
 if(emulator){
  if(!projectId.startsWith('demo-')||!firestore||!auth)throw new Error('Firebase emulation requires both emulators and an explicit demo- project.');
  for(const host of [firestore,auth]){
   const url=new URL(`http://${host}`);
   if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Firebase emulators must use loopback hosts with explicit ports.');
  }
 }else if(projectId.startsWith('demo-'))throw new Error('A demo Firebase project requires emulators.');
 if(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID&&env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==projectId)throw new Error('Firebase browser and server project IDs must match.');
 return {projectId,emulator};
}
export function firebaseApp(){
 const {projectId,emulator}=validateFirebaseEnvironment();
 const existing=getApps().find(app=>app.name==='shadowui-catalog');
 if(existing){if(existing.options.projectId!==projectId)throw new Error('Firebase project configuration changed after initialization.');return existing;}
 const account=process.env.FIREBASE_SERVICE_ACCOUNT_JSON?JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON):undefined;
 if(!emulator&&account?.project_id&&account.project_id!==projectId)throw new Error('Firebase service account project does not match configured project.');
 return initializeApp({projectId,...(!emulator?{credential:account?cert(account):applicationDefault()}:{})},'shadowui-catalog');
}
export function catalogDatabase(){return getFirestore(firebaseApp());}
export function catalogSession(request:Request){return request.headers.get('cookie')?.match(/(?:^|; )shadowui_ai=([a-f0-9-]{36})(?:;|$)/)?.[1];}
export async function isCatalogAdmin(request:Request):Promise<boolean>{
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return false;
 const local=process.env.NODE_ENV==='test'||process.env.NODE_ENV==='development';
 if(local&&process.env.CATALOG_EMULATOR_ADMIN_TOKEN&&token===process.env.CATALOG_EMULATOR_ADMIN_TOKEN){try{if(validateFirebaseEnvironment().emulator)return true;}catch{return false;}}
 const allowlist=(process.env.FIREBASE_ADMIN_EMAIL??'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean);
 if(!allowlist.length)return false;
 try{const identity=await getAuth(firebaseApp()).verifyIdToken(token,true);return identity.email_verified===true&&!!identity.email&&allowlist.includes(identity.email.toLowerCase());}catch{return false;}
}

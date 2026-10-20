import {spawn} from 'node:child_process';
// Explicit demo overrides win over .env.local. No saved project or credentials are loaded here.
const project='demo-shadowui-catalog';
const port=process.env.PORT??'3000';
if(!/^\d{4,5}$/.test(port)||Number(port)>65535)throw new Error('PORT must be a valid local development port');
const environment={...process.env,SHADOWUI_DIST_DIR:'.next-simulation',FIREBASE_PROJECT_ID:project,GCLOUD_PROJECT:project,FIREBASE_ADMIN_EMAIL:'admin@shadowui.local',FIREBASE_SERVICE_ACCOUNT_JSON:'',CATALOG_EMULATOR_ADMIN_TOKEN:'',OPENAI_API_KEY:'',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',NEXT_PUBLIC_FIREBASE_API_KEY:'demo-only-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:'localhost',NEXT_PUBLIC_FIREBASE_PROJECT_ID:project,NEXT_PUBLIC_FIREBASE_APP_ID:'demo-shadowui-local',NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'};
const child=spawn('firebase',['emulators:exec','--only','auth,firestore','--project',project,`next dev --hostname 127.0.0.1 --port ${port}`],{stdio:'inherit',env:environment});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));

import {spawnSync} from 'node:child_process';

// Explicit demo project prevents these tests from reaching any live Firebase project.
const project='demo-shadowui-catalog';
const command='node --import tsx --test tests/catalog.test.ts tests/catalog-store.test.ts tests/catalog-auth.test.ts tests/component-review.test.ts tests/account-cloud.test.ts';
const result=spawnSync('firebase',['emulators:exec','--only','auth,firestore','--project',project,command],{
 stdio:'inherit',env:{...process.env,FIREBASE_PROJECT_ID:project,GCLOUD_PROJECT:project,CATALOG_EMULATOR_ADMIN_TOKEN:''},
});
if(result.error){console.error(result.error.message);process.exit(1);}
process.exit(result.status??1);

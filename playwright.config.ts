import {defineConfig} from '@playwright/test';

const ci=!!process.env.CI;
const port=process.env.PLAYWRIGHT_PORT??'3000';
if(!/^\d{4,5}$/.test(port)||Number(port)>65535)throw new Error('Invalid PLAYWRIGHT_PORT');
const serverURL=`http://127.0.0.1:${port}`;
const baseURL=process.env.PLAYWRIGHT_BASE_URL??serverURL;
if(ci&&baseURL!==serverURL)throw new Error('CI must test its own production server; use PLAYWRIGHT_PORT to select a port');

export default defineConfig({
 testDir:'./tests/e2e',
 forbidOnly:ci,
 retries:0,
 workers:1,
 reporter:ci?[['list'],['html',{open:'never'}]]:'list',
 use:{
  baseURL,headless:true,
  ...(ci?{}:{channel:'chrome'}),
  reducedMotion:'reduce',
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
 },
 // Local runs still use the developer's explicitly started server.
 ...(ci?{webServer:{
  command:`npm run start -- --hostname 127.0.0.1 --port ${port}`,
  url:serverURL,
  reuseExistingServer:false,
  timeout:120_000,
  env:{FIREBASE_PROJECT_ID:'',GCLOUD_PROJECT:'',FIRESTORE_EMULATOR_HOST:'',FIREBASE_AUTH_EMULATOR_HOST:'',AI_ENABLED:'false',OPENAI_API_KEY:'',FIREBASE_SERVICE_ACCOUNT_JSON:'',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:''},
 }}:{}),
});

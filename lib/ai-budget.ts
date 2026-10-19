import {z} from 'zod';
import {mkdir,readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {connect as tlsConnect} from 'node:tls';
import path from 'node:path';
export class AIError extends Error {constructor(public status:number,message:string){super(message)}}
export type Ledger={spent:number;entries:Record<string,{at:number;cost:number;result?:unknown}>};
const LedgerSchema=z.object({spent:z.number().finite().nonnegative(),entries:z.record(z.object({at:z.number().finite(),cost:z.number().finite().nonnegative(),result:z.unknown().optional()}))});
const empty=():Ledger=>({spent:0,entries:{}});
export function limit(){const n=Number(process.env.AI_BUDGET_USD??1);if(!Number.isFinite(n)||n<=0||n>5)throw new AIError(503,'AI budget must be greater than zero and at most $5.');return n;}
export async function transact<T>(change:(ledger:Ledger)=>T):Promise<T>{
 const configuredUrl=process.env.UPSTASH_REDIS_REST_URL;
 let url=configuredUrl,token=process.env.UPSTASH_REDIS_REST_TOKEN;
 if(configuredUrl?.startsWith('rediss://')){
  try{
   const parsed=new URL(configuredUrl);
   const username=decodeURIComponent(parsed.username||'default');
   const password=decodeURIComponent(parsed.password);
   const redisCommand=async(args:unknown[])=>new Promise<unknown>((resolve,reject)=>{
    const encode=(values:unknown[])=>values.map(String).reduce((out,arg)=>out+`$${Buffer.byteLength(arg)}\r\n${arg}\r\n`,`*${values.length}\r\n`);
    const socket=tlsConnect({host:parsed.hostname,port:Number(parsed.port||6379),servername:parsed.hostname,rejectUnauthorized:true},()=>socket.write(encode(['AUTH',username,password])+encode(args)));
    let data=Buffer.alloc(0),responses:unknown[]=[];const timer=setTimeout(()=>{socket.destroy();reject(new Error('storage timeout'));},5000);
    socket.on('data',chunk=>{data=Buffer.concat([data,chunk]);while(true){const end=data.indexOf('\r\n');if(end<0)return;const marker=String.fromCharCode(data[0]);let value:unknown,used:number;if(marker==='$'){const length=Number(data.subarray(1,end));if(length===-1){value=null;used=end+2;}else{if(data.length<end+2+length+2)return;value=data.subarray(end+2,end+2+length).toString();used=end+2+length+2;}}else if(marker===':'||marker==='+'||marker==='-'){value=data.subarray(1,end).toString();used=end+2;if(marker==='-'){clearTimeout(timer);socket.destroy();reject(new Error(String(value)));return;}if(marker===':')value=Number(value);}else{return;}data=data.subarray(used);responses.push(value);if(responses.length===2){clearTimeout(timer);socket.end();resolve(responses[1]);return;}}});
    socket.on('error',error=>{clearTimeout(timer);reject(error);});
   });
   for(let i=0;i<8;i++){
    const raw=await redisCommand(['GET','shadowui:ai:ledger:v1']) as string|null;const ledger:Ledger=raw?LedgerSchema.parse(JSON.parse(raw)):empty();const result=change(ledger);
    const ok=await redisCommand(['EVAL',"if (redis.call('GET',KEYS[1]) or '') == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 else return 0 end",1,'shadowui:ai:ledger:v1',raw??'',JSON.stringify(ledger)]);if(ok===1)return result;
   }
   throw new AIError(503,'Budget storage is busy. Retry shortly.');
  }catch{throw new AIError(503,'Budget storage configuration is invalid.');}
 }
 if(url&&token){
  try{
   const command=async(args:unknown[])=>{const r=await fetch(url!,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000),cache:'no-store'});if(!r.ok)throw new Error('storage');const body=await r.json();if(body.error)throw new Error('storage');return body.result;};
   for(let i=0;i<8;i++){const raw=await command(['GET','shadowui:ai:ledger:v1']);const ledger:Ledger=raw?LedgerSchema.parse(JSON.parse(raw)):empty();const result=change(ledger);const ok=await command(['EVAL',"if (redis.call('GET',KEYS[1]) or '') == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 else return 0 end",1,'shadowui:ai:ledger:v1',raw??'',JSON.stringify(ledger)]);if(ok===1)return result;}
   throw new AIError(503,'Budget storage is busy. Retry shortly.');
  }catch(error){
   if(process.env.NODE_ENV!=='development')throw error;
  }
 }
 if(process.env.NODE_ENV==='production'&&!process.env.AI_STATE_DIR)throw new AIError(503,'Live AI requires durable budget storage: configure Upstash Redis, or AI_STATE_DIR on a persistent shared volume.');
 const dir=process.env.AI_STATE_DIR??path.join(process.cwd(),'.shadowui','ai');await mkdir(dir,{recursive:true});const lock=path.join(dir,'budget.lock');let handle;
 try{handle=await open(lock,'wx');}catch{throw new AIError(503,'Budget storage is busy or locked. Retry shortly.');}
 try{const file=path.join(dir,'budget.json');let ledger:Ledger;try{ledger=LedgerSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;ledger=empty();}const result=change(ledger);await writeFile(`${file}.tmp`,JSON.stringify(ledger),{mode:0o600});await rename(`${file}.tmp`,file);return result;}finally{await handle.close();await unlink(lock);}
}
export function reserve(ledger:Ledger,key:string,cost:number){
 const existing=ledger.entries[key];if(existing&&Date.now()-existing.at<600000){if(existing.result)return existing.result;throw new AIError(409,'This AI request is already running or its outcome is uncertain. Wait before retrying.');}
 if(ledger.spent+cost>limit())throw new AIError(402,'AI test budget reached. New paid requests are blocked. Demo remains available.');
 if(Object.values(ledger.entries).filter(e=>Date.now()-e.at<60000).length>=6)throw new AIError(429,'AI request limit reached. Wait one minute.');
 ledger.spent+=cost;ledger.entries[key]={at:Date.now(),cost};
 // Results contain private workspace data: short cache, bounded storage, session-scoped keys.
 for(const [id,e] of Object.entries(ledger.entries))if(Date.now()-e.at>600000)delete ledger.entries[id];
 return null;
}

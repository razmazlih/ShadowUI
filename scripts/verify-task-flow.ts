import {loadEnvConfig} from '@next/env';
import {runTaskPipeline} from '../lib/task-pipeline';
import {transact,limit} from '../lib/ai-budget';
async function main(){
 if(!process.argv.includes('--live'))throw new Error('Pass --live to use the configured AI budget and Firebase database.');
 loadEnvConfig(process.cwd());
 const before=await transact(l=>l.spent);console.log(JSON.stringify({before,limit:limit()}));
 const prompt=process.argv.find(arg=>arg.startsWith('--prompt='))?.slice(9)??'צור לי לוח זמנים לשבוע שמתחיל ב-2026-10-19. ביום שני יש פגישה בין 09:00 ל-10:00. אל תוסיף פעילויות אחרות.';
 const result=await runTaskPipeline(prompt,undefined,'7e7c3774-faf3-47a2-a70e-269b8f009e00');
 console.log(JSON.stringify({operation:result.operation,types:'workspace' in result?result.workspace?.components.map(c=>({type:c.type,id:c.id,pin:c.catalogRef})):[],coverage:'coverage' in result?result.coverage:undefined,explanation:result.explanation,budget:result.budget}));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)}));process.exit(1);});

import {z} from 'zod';
import {CustomToolSchema,evaluateCustomTool} from './custom-tool';
const Id=z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/);
export const RecordToolSchema=z.object({
 columns:z.array(z.object({id:Id,label:z.string().min(1).max(100)}).strict()).min(1).max(8),
 outputs:z.array(z.object({id:Id,label:z.string().min(1).max(100),expression:z.array(z.string().min(1).max(64)).min(1).max(64),unit:z.string().max(40)}).strict()).max(8),
}).strict().superRefine((tool,ctx)=>{
 const probe=CustomToolSchema.safeParse({purpose:'Record calculation',layout:'form',accent:'blue',fields:tool.columns.map(c=>({...c,type:'number',value:'1',options:[],min:null,max:null})),outputs:tool.outputs});
 if(!probe.success)ctx.addIssue({code:'custom',message:'Invalid record columns or bounded formula'});
});
export type RecordTool=z.infer<typeof RecordToolSchema>;
export function evaluateRecord(tool:RecordTool,cells:Record<string,number>|undefined){
 const missing=tool.columns.some(c=>cells?.[c.id]===undefined||!Number.isFinite(cells[c.id]));
 if(missing)return tool.outputs.map(o=>({...o,value:null,error:'יש להשלים את הכמויות / Enter the missing quantities'}));
 return evaluateCustomTool({purpose:'Record calculation',layout:'form',accent:'blue',fields:tool.columns.map(c=>({...c,type:'number',value:String(cells![c.id]),options:[],min:null,max:null})),outputs:tool.outputs});
}

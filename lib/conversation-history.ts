import {MessageHistorySchema,type MessageHistory} from './message-intent';

export type ConversationHistory=Record<string,MessageHistory>;
const safeKey=(key:string)=>key.length>0&&key.length<=200&&!['__proto__','prototype','constructor'].includes(key);

/** Recover valid chats independently so one damaged record cannot erase others. */
export function parseConversationHistory(value:unknown):ConversationHistory {
 const result:ConversationHistory=Object.create(null);
 if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const [key,history] of Object.entries(value)){
  if(!safeKey(key))continue;
  const parsed=MessageHistorySchema.safeParse(history);
  if(parsed.success)result[key]=parsed.data;
 }
 return result;
}

export function appendConversationTurn(history:MessageHistory,user:string,assistant:string):MessageHistory {
 return MessageHistorySchema.parse([...history,{role:'user',content:user},{role:'assistant',content:assistant}].slice(-12));
}

export function updateConversationHistory(histories:ConversationHistory,key:string,user:string,assistant:string):ConversationHistory {
 const result=parseConversationHistory(histories);
 if(!safeKey(key))return result;
 result[key]=appendConversationTurn(result[key]??[],user,assistant);
 return result;
}

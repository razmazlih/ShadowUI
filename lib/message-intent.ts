import {z} from 'zod';
import type {Workspace} from './schema';

export const MessageHistorySchema=z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(4000)}).strict()).max(12);
export type MessageHistory=z.infer<typeof MessageHistorySchema>;
export type MessageIntent={kind:'conversation'|'workspace'|'clarify';reply?:string};

// Demo routing is deliberately conservative. Only explicit requests reach the
// workspace composer; questions and uncertain references never edit saved data.
export function classifyMessage(prompt:string,current?:Workspace):MessageIntent {
 const text=prompt.trim();const he=/[א-ת]/.test(text);
 const clarify=():MessageIntent=>({kind:'clarify',reply:he?'למה התכוונת, ועל איזה רכיב? אפשר לשאול על המסך או לבקש שינוי מפורש.':'What do you mean, and which component? You can ask about the screen or request a specific change.'});
 const screen=/מסך|מוצג|תצוגה|רכיב|טבלה|כרטיס|כפתור|סביבת העבודה|screen|shown|display|component|table|card|button|workspace/i.test(text);
 const question=/^(?:מה|למה|מדוע|איך|כיצד|האם|מי|מתי|כמה|איפה|what|why|how|is|are|does|do|who|when|where|which)\b/i.test(text)||/^(?:מה|למה|מדוע|איך|כיצד|האם|מי|מתי|כמה|איפה)(?:\s|[?？])/u.test(text);
 const politeRequest=/^(?:can|could|would) you\s+(?:please\s+)?(?:add|remove|delete|change|update|create|build|make|plan|organize|set|move|hide|show)\b|^(?:אפשר|תוכל|תוכלי|אתה יכול|את יכולה)\s+(?:בבקשה\s+)?(?:להוסיף|להסיר|למחוק|לשנות|לעדכן|ליצור|לבנות|לתכנן|לארגן|להגדיר|להעביר|להסתיר|להציג)/i.test(text);
 const mutation=/^(?:please\s+)?(?:add|remove|delete|change|update|create|build|make|plan|organize|set|move|hide|show|start|compare|help me|i (?:want|need))\b|^(?:בבקשה\s+)?(?:תוסיף|הוסף|הוסיפי|תסיר|הסר|תמחק|מחק|תשנה|שנה|תעדכן|עדכן|תיצור|צור|תבנה|בנה|תכנן|תארגן|ארגן|תגדיר|הגדר|תעביר|העבר|תסתיר|הסתר|תציג|הצג|תתחיל|התחל|תשווה|השווה|עזור לי|אני רוצה|אני צריך|אני צריכה)(?:\s|$)/i.test(text)||politeRequest;
 const ambiguous=/^(?:do it|change it|fix it|make it better|that|this|yes|ok|okay|תעשה את זה|תשנה את זה|תתקן|שנה את זה|תשפר|זה|כן|בסדר)[.!]?$/i.test(text);
 if(ambiguous)return clarify();
 if(mutation&&!question)return {kind:'workspace'};
 if(question||screen||/^(?:hi|hello|hey|thanks|thank you|שלום|היי|תודה|בוקר טוב|ערב טוב)(?:[\s!,.]|$)/i.test(text)||/^(?:explain|tell me|הסבר|תסביר|ספר לי)(?:\s|$)/i.test(text)){
  if(screen&&!current)return {kind:'clarify',reply:he?'אין כרגע סביבת עבודה פתוחה שאפשר להתייחס אליה. איזה מסך או תוכן התכוונת?':'There is no open workspace to refer to. Which screen or content do you mean?'};
  if(current&&(screen||/זה|זאת|these|this|that/i.test(text)))return {kind:'conversation',reply:he?`בסביבת העבודה ״${current.title}״ מוצגים: ${current.components.map(c=>c.title).join('، ')}. זו תשובת דמו המבוססת על מבנה סביבת העבודה; לא שיניתי דבר. אפשר לציין רכיב ושאלה ממוקדת.`:`The workspace “${current.title}” contains: ${current.components.map(c=>c.title).join(', ')}. This demo response uses the workspace structure; nothing was changed. Name a component and a specific question.`};
  return {kind:'conversation',reply:he?'אפשר להמשיך לדבר כאן בלי לשנות את סביבת העבודה. הבנת השפה בהדמיה; תארו מטרה או בקשו שינוי מפורש בכלים.':'You can continue without changing the workspace. Language understanding is simulated; describe a goal or request a specific tool change.'};
 }
 // A fresh concrete objective retains the original composer behavior. In an
 // existing workspace, unexplained fragments need a target before mutation.
 return current?clarify():{kind:'workspace'};
}

import type {UIComponent} from './schema';

/** Local glossary conversion only: no model, retrieval or invented subject facts. */
export function deriveStudyTools(components:UIComponent[]):UIComponent[]{
 return components.map(c=>{
  if(!['flashcards','quiz'].includes(c.type)||!c.dependsOn)return c;
  const source=components.find(s=>s.id===c.dependsOn&&s.type==='notes');if(!source)return c;
  const facts=(source.text??'').split(/[\n;]/).map(line=>line.split(/\s*[:=]\s*/)).filter(p=>p.length===2&&p.every(v=>v.trim())).slice(0,20);
  const he=/[א-ת]/.test(c.title);
  return {...c,items:facts.map(([question,answer],index)=>{
   const label=question.trim().slice(0,500),key=answer.trim().slice(0,2000),old=c.items[index];
   const unchanged=old?.label===label&&old.answer===key;
   return {id:old?.id??`${c.id}_${index}`,label,answer:key,...(c.type==='quiz'?{options:[key,key===(he?'אין התאמה למקור':'Does not match the source')?(he?'תשובה אחרת':'Another answer'):(he?'אין התאמה למקור':'Does not match the source')]}:{}),...(unchanged?{done:old.done,group:old.group,value:old.value}:{done:false})};
  })};
 });
}

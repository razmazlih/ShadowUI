import {TaskContractSchema,type TaskContract} from './task-contract';
import {isLearningRequest,LEARNING_CONTENT_POLICY} from './response-quality';

export const LEARNING_PLAN_POLICY='Interactive learning plan: structured milestones and checkable practice, with explanations in supporting notes.';
/** A curriculum is executable work: writing its outline in a document cannot cover it. */
export function enforceWorkspaceBehavior(contract:TaskContract,request:string,options:{generalLearningContent?:boolean}={}):TaskContract{
 const intent=`${request}\n${contract.objective}`;
 const curriculum=/(?:תו?כנית\s+(?:ה?לימוד|למידה)|תוכנית\s+לימוד|מסלול\s+לימוד|learning\s+(?:plan|path)|study\s+plan|curriculum|(?:learning|study)\s+roadmap)/i.test(intent);
 if(!curriculum&&!isLearningRequest(intent))return contract;
 const next=structuredClone(contract);
 const contentRequired=options.generalLearningContent!==false;
 const required=[...(contentRequired?[{capability:'notes.edit',id:'learning_explanations',description:'הסברים ממוקדים ודוגמה פתורה צעד אחר צעד'},{capability:'study.quiz',id:'learning_questions',description:'שאלות תרגול קונקרטיות עם תשובות והסבר לפתרון'}]:[]),{capability:'timeline.edit',id:'learning_path',description:'שלבי לימוד מסודרים עם יעדים ותוצר לכל שלב'},{capability:'tasks.check',id:'learning_practice',description:'תרגילים ופרויקטים מעשיים עם סימון התקדמות'}];
 for(const requirement of required){
  if(next.actions.some(action=>action.capability===requirement.capability&&!action.external))continue;
  let id=requirement.id;while(next.actions.some(action=>action.id===id))id+='_next';
  next.actions.push({id,capability:requirement.capability,description:requirement.description,inputKind:requirement.capability==='notes.edit'?'text':'items',external:false});
  let deliverableId=`deliverable_${id}`;while(next.deliverables.some(d=>d.id===deliverableId))deliverableId+='_next';
  next.deliverables.push({id:deliverableId,label:requirement.description,actionIds:[id]});
 }
 if(!next.constraints.includes(LEARNING_PLAN_POLICY))next.constraints.push(LEARNING_PLAN_POLICY);
 if(contentRequired&&!next.constraints.includes(LEARNING_CONTENT_POLICY))next.constraints.push(LEARNING_CONTENT_POLICY);
 return TaskContractSchema.parse(next);
}

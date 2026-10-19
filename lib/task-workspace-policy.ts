import {TaskContractSchema,type TaskContract} from './task-contract';

export const LEARNING_PLAN_POLICY='Interactive learning plan: structured milestones and checkable practice, with explanations in supporting notes.';
/** A curriculum is executable work: writing its outline in a document cannot cover it. */
export function enforceWorkspaceBehavior(contract:TaskContract,request:string):TaskContract{
 const intent=`${request}\n${contract.objective}`;
 const curriculum=/(?:תו?כנית\s+(?:ה?לימוד|למידה)|תוכנית\s+לימוד|מסלול\s+לימוד|learning\s+(?:plan|path)|study\s+plan|curriculum|(?:learning|study)\s+roadmap)/i.test(intent);
 if(!curriculum)return contract;
 const next=structuredClone(contract);
 const required=[{capability:'timeline.edit',id:'learning_path',description:'שלבי לימוד מסודרים עם יעדים ותוצר לכל שלב'},{capability:'tasks.check',id:'learning_practice',description:'תרגילים ופרויקטים מעשיים עם סימון התקדמות'}];
 for(const requirement of required){
  if(next.actions.some(action=>action.capability===requirement.capability&&!action.external))continue;
  let id=requirement.id;while(next.actions.some(action=>action.id===id))id+='_next';
  next.actions.push({id,capability:requirement.capability,description:requirement.description,inputKind:'items',external:false});
  let deliverableId=`deliverable_${id}`;while(next.deliverables.some(d=>d.id===deliverableId))deliverableId+='_next';
  next.deliverables.push({id:deliverableId,label:requirement.description,actionIds:[id]});
 }
 if(!next.constraints.includes(LEARNING_PLAN_POLICY))next.constraints.push(LEARNING_PLAN_POLICY);
 return TaskContractSchema.parse(next);
}

'use client';
import {Workflow} from 'lucide-react';
import type {Workspace} from '@/lib/schema';
import {workspaceReadiness} from '@/lib/workspace-progress';
import './task-contract-summary.css';
export default function TaskContractSummary({workspace,locale='he',onChange}:{workspace:Workspace;locale?:'he'|'en';onChange?:(workspace:Workspace)=>void}){
 const contract=workspace.taskContract;if(!contract)return null;
 const he=locale==='he',report=workspace.taskReport??{complete:false,covered:[],missing:[],limitations:[]};
 const progress=workspace.progress??{completedActionIds:[],constraintsSatisfied:false,successCriteriaSatisfied:false};
 const state=workspaceReadiness(workspace)!;
 const update=(patch:Partial<typeof progress>)=>onChange?.({...workspace,progress:{...progress,...patch}});
 const changeInput=(id:string,value:string)=>onChange?.({...workspace,progress:undefined,taskContract:{...contract,inputs:contract.inputs.map(i=>i.id===id?{...i,value,available:!!value.trim()}:i)}});
 return <section className="task-contract-summary" dir={he?'rtl':'ltr'} aria-label={he?'מצב המשימה':'Task status'}>
  <div className="task-contract-heading"><Workflow size={17} aria-hidden="true"/><span>{he?'התוצאה הרצויה':'Desired result'}</span></div>
  <p className="task-contract-objective" dir="auto">{contract.objective}</p>
  <div className="task-contract-states" aria-live="polite"><span>{he?'כלים מתאימים: ':'Tools available: '}{report.complete?(he?'כן':'Yes'):(he?'חלקית':'Partial')}</span><span>{he?'מידע לעבודה: ':'Inputs ready: '}{state.ready?(he?'מוכן':'Ready'):(he?'נדרשת השלמה':'Needs input')}</span><span>{he?'תוצאה נבדקה: ':'Result reviewed: '}{state.complete?(he?'כן, באישור שלך':'Yes, confirmed by you'):(he?'טרם אושרה':'Not confirmed')}</span></div>
  {report.limitations.length>0&&<ul className="task-contract-limitations">{report.limitations.map((message,index)=><li key={index} dir="auto">{message}</li>)}</ul>}
  {contract.inputs.filter(i=>i.required&&!i.binding).map(input=><label className="task-input" key={input.id}>{input.label}<textarea disabled={!onChange} maxLength={4000} value={typeof input.value==='string'?input.value:''} onChange={e=>changeInput(input.id,e.target.value)} placeholder={he?'להשלמה':'Enter the missing information'}/></label>)}
  {state.missingInputs.length>0&&<p>{he?'להשלמה בכלים: ':'Complete in the tools: '}{contract.inputs.filter(i=>state.missingInputs.includes(i.id)).map(i=>i.label).join(' · ')}</p>}
  <details><summary>{he?'בדיקת התוצאה':'Review the result'}</summary><div className="task-contract-details">
   {contract.actions.map(action=><label className="task-review-check" key={action.id}><input type="checkbox" disabled={!onChange||action.external||!report.covered.some(c=>c.actionId===action.id)} checked={progress.completedActionIds.includes(action.id)} onChange={e=>update({completedActionIds:e.target.checked?[...progress.completedActionIds,action.id]:progress.completedActionIds.filter(id=>id!==action.id)})}/><span>{action.description}{action.external&&<small>{he?' — השירות אינו מחובר':' — Service not connected'}</small>}</span></label>)}
   {contract.constraints.length>0&&<label className="task-review-check"><input type="checkbox" disabled={!onChange} checked={progress.constraintsSatisfied} onChange={e=>update({constraintsSatisfied:e.target.checked})}/><span>{he?'בדקתי את האילוצים: ':'I checked the constraints: '}{contract.constraints.join(' · ')}</span></label>}
   <label className="task-review-check"><input type="checkbox" disabled={!onChange||!state.ready} checked={progress.successCriteriaSatisfied} onChange={e=>update({successCriteriaSatisfied:e.target.checked})}/><span>{he?'בדקתי את התוצאה: ':'I reviewed the result: '}{contract.successCriteria.join(' · ')}</span></label>
  </div></details>
 </section>;
}

'use client';
import {CheckCircle2,AlertCircle,Workflow} from 'lucide-react';
import type {Workspace} from '@/lib/schema';
import './task-contract-summary.css';

/** The contract describes capability coverage, never successful external execution. */
export default function TaskContractSummary({workspace,locale='he'}:{workspace:Workspace;locale?:'he'|'en'}){
 const contract=workspace.taskContract;if(!contract)return null;
 const he=locale==='he',report=workspace.taskReport;
 const covered=new Set(report?.covered.map(entry=>entry.actionId)??[]),missingInputs=contract.inputs.filter(input=>input.required&&!input.available);
 const limitations=[...new Set([...(report?.limitations??[]),...(report?.missing.map(entry=>entry.reason)??[])])];
 return <section className="task-contract-summary" dir={he?'rtl':'ltr'} aria-label={he?'חוזה המשימה וכיסוי היכולות':'Task contract and capability coverage'}>
  <div className="task-contract-heading"><Workflow size={17} aria-hidden="true"/><span>{he?'התוצאה הרצויה':'Desired result'}</span>{report&&<span className={`task-contract-status ${report.complete?'is-covered':'is-partial'}`}>{report.complete?<CheckCircle2 size={13} aria-hidden="true"/>:<AlertCircle size={13} aria-hidden="true"/>}{he?`${covered.size}/${contract.actions.length} פעולות מכוסות בכלים`:`${covered.size}/${contract.actions.length} actions covered by tools`}</span>}</div>
  <p className="task-contract-objective" dir="auto">{contract.objective}</p>
  {limitations.length>0&&<ul className="task-contract-limitations" aria-label={he?'יכולות חסרות ומגבלות':'Missing capabilities and limitations'}>{limitations.map((message,index)=><li key={index} dir="auto">{message}</li>)}</ul>}
  {missingInputs.length>0&&<p className="task-contract-inputs">{he?'להשלמה בתוך הכלים: ':'Inputs to complete in the tools: '}{missingInputs.map(input=>input.label).join(' · ')}</p>}
  <details><summary>{he?'פעולות, אילוצים ותנאי הצלחה':'Actions, constraints and success criteria'}</summary><div className="task-contract-details">
   <ul className="task-contract-actions">{contract.actions.map(action=>{const instanceId=report?.covered.find(entry=>entry.actionId===action.id)?.instanceId;const component=workspace.components.find(c=>c.id===instanceId);return <li key={action.id}><span className={covered.has(action.id)?'task-action-covered':'task-action-missing'}>{covered.has(action.id)?<CheckCircle2 size={14} aria-hidden="true"/>:<AlertCircle size={14} aria-hidden="true"/>}{covered.has(action.id)?(he?'מכוסה':'Covered'):(he?'לא מכוסה':'Not covered')}</span><div><strong dir="auto">{action.description}</strong>{component&&<small dir="auto">{component.title}</small>}{action.external&&<small>{he?'נדרשת אינטגרציה חיצונית. הפעולה לא בוצעה.':'An external integration is required. This action has not been performed.'}</small>}</div></li>;})}</ul>
   {contract.constraints.length>0&&<div><h3>{he?'אילוצים':'Constraints'}</h3><ul>{contract.constraints.map((constraint,index)=><li key={index} dir="auto">{constraint}</li>)}</ul></div>}
   <div><h3>{he?'תנאי הצלחה לבדיקה':'Success criteria to verify'}</h3><ul>{contract.successCriteria.map((criterion,index)=><li key={index} dir="auto">{criterion}</li>)}</ul></div>
  </div></details>
 </section>;
}

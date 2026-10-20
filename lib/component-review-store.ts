import {z} from 'zod';
import {ComponentDefinitionSchema,validateDefinition} from './catalog';
import {catalogDatabase} from './firebase-admin';
import {createReviewCandidate,proposeReviewEdit,ReviewCandidateSchema,type ReviewCandidate} from './component-review';
import type {ComponentDefinition} from './catalog';
import {paidAIEnabled} from './ai-policy';
import {proposeLiveReviewEdit} from './component-review-ai';
const reviews=()=>catalogDatabase().collection('shadowui_component_reviews');
export async function enqueueComponentReview(definition:ComponentDefinition){
 const candidate=createReviewCandidate(definition);const ref=reviews().doc(candidate.id);
 await catalogDatabase().runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.create(ref,candidate);});return candidate;
}
export async function listComponentReviews(){const snapshot=await reviews().get();return snapshot.docs.map(doc=>ReviewCandidateSchema.parse(doc.data())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export const ReviewActionSchema=z.object({action:z.enum(['approve','reject','changes_requested','edit','propose']),expectedVersion:z.number().int().positive(),reason:z.string().max(1500).optional(),definition:ComponentDefinitionSchema.optional(),instruction:z.string().min(1).max(1500).optional(),syntheticDataConfirmed:z.boolean().optional(),purpose:z.string().min(1).max(1500).optional(),gap:z.string().min(1).max(1500).optional(),usage:z.string().min(1).max(1500).optional(),limitations:z.array(z.string().max(500)).max(20).optional()}).strict();
export async function updateComponentReview(id:string,input:z.infer<typeof ReviewActionSchema>){
 if(!/^review_[a-f0-9]{32}$/.test(id))throw new Error('Review not found');
 const body=ReviewActionSchema.parse(input);const ref=reviews().doc(id);
 // Provider calls must be outside transactions: Firestore can retry a callback.
 if(body.action==='propose'){
  const snapshot=await ref.get();if(!snapshot.exists)throw new Error('Review not found');
  const current=ReviewCandidateSchema.parse(snapshot.data());if(current.version!==body.expectedVersion)throw new Error('Review version conflict');
  if(!body.instruction)throw new Error('An instruction is required');
  return paidAIEnabled()?proposeLiveReviewEdit(current.definition,body.instruction,`review:${id}:${body.expectedVersion}`):proposeReviewEdit(current.definition,body.instruction);
 }
 return catalogDatabase().runTransaction(async tx=>{
  const snapshot=await tx.get(ref);if(!snapshot.exists)throw new Error('Review not found');
  const current=ReviewCandidateSchema.parse(snapshot.data());
  if(current.version!==body.expectedVersion)throw new Error('Review version conflict');
  if(['reject','changes_requested'].includes(body.action)&&!body.reason?.trim())throw new Error('A review reason is required');
  if(['approve','edit'].includes(body.action)&&body.syntheticDataConfirmed!==true)throw new Error('Confirm synthetic data before saving or publishing');
  const next:ReviewCandidate={...current,version:current.version+1,updatedAt:new Date().toISOString()};
  if(body.action==='edit'){
   const definition=ComponentDefinitionSchema.parse(body.definition??current.definition);
   if(definition.id!==current.definition.id||definition.scope!=='shared'||definition.ownerSession||definition.version!==current.definition.version)throw new Error('Definition identity and version are immutable');
   next.definition=definition;next.validation=validateDefinition(definition);next.status='pending';delete next.reviewReason;
   for(const key of ['purpose','gap','usage','limitations'] as const)if(body[key]!==undefined)Object.assign(next,{[key]:body[key]});
  }else if(body.action==='approve'){
   if(!current.validation.valid)throw new Error('Definition requires an explicit valid edit before approval');
   next.validation=validateDefinition(next.definition);if(!next.validation.valid)throw new Error('Definition validation failed');
   if(current.status==='approved')throw new Error('Review is already approved');
   const sharedRef=catalogDatabase().collection('shadowui_component_catalog').doc(current.definition.id);
   const shared=await tx.get(sharedRef);const previous=shared.exists?ComponentDefinitionSchema.parse(shared.data()!.definition):undefined;
   const definition={...current.definition,version:(previous?.version??0)+1,status:'active' as const,updatedAt:next.updatedAt};
   tx.set(sharedRef,{definition,reviewSource:{candidateId:id,sourceDefinitionId:current.sourceDefinitionId,sourceVersion:current.sourceVersion}});
   tx.create(sharedRef.collection('revisions').doc(String(definition.version)),{definition,validation:next.validation,changedAt:next.updatedAt});
   next.status='approved';next.sharedDefinitionId=definition.id;
  }else{next.status=body.action==='reject'?'rejected':'changes_requested';next.reviewReason=body.reason!.trim();}
  tx.set(ref,next);return {candidate:next};
 });
}

/** Interaction model selection for observable facts. No LLM calls for routine state changes. */
export type InteractionModel='planning'|'resolution'|'review'|'outcome';
export type AdaptationDecision={objective:string;detectedChange:string;why:string;model:InteractionModel;preserve:string[];allowedActions:string[]};
export function chooseInteractionModel(input:{objective:string;issueCount:number;hasPreview:boolean;committed:boolean}):AdaptationDecision{
 const base={objective:input.objective,preserve:['Employee availability','All shift assignments','User constraints','Previous decisions and server revision']};
 if(input.hasPreview)return {...base,model:'review',detectedChange:'A candidate reassignment is ready to inspect.',why:'A before-and-after comparison is more useful than editing the entire roster while reviewing one proposed change.',allowedActions:['apply_preview','reject_preview']};
 if(input.issueCount>0)return {...base,model:'resolution',detectedChange:`${input.issueCount} schedule constraint${input.issueCount===1?' is':'s are'} unmet.`,why:'The planning grid cannot show the consequences of each alternative at a glance. Focus on eligible replacements while preserving the rest of the roster.',allowedActions:['compare_alternatives','preview_change','edit_constraints','undo']};
 if(input.committed)return {...base,model:'outcome',detectedChange:'The server confirmed a validated schedule commit.',why:'The useful next interaction is inspecting the saved result and receipt, rather than continuing to edit an already confirmed plan.',allowedActions:['inspect_receipt','reopen_draft','undo']};
 return {...base,model:'planning',detectedChange:'The current schedule has no blocking constraint violations.',why:'Direct editing is sufficient until the data creates a conflict or the user is ready to confirm.',allowedActions:['assign','set_availability','set_min_days_off','review_commit']};
}

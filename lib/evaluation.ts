import { WorkspaceSchema, type Workspace, type UIComponent } from './schema';

/** Capability probes, not planner fixtures: no response or domain dispatch lives here. */
export const evaluationCases = [
 {id:'schedule',prompt:'Organize next week shifts for six employees',capabilities:['calendar','approval']},
 {id:'constraints',prompt:'Daniel cannot work Wednesday; require six days off per week',capabilities:['calendar']},
 {id:'learning',prompt:'I have a biology exam in three days. Help me prepare.',capabilities:['flashcards','quiz','timer']},
 {id:'mixed',prompt:'Compare three community garden projects with volunteers next week and a budget of 900',capabilities:['comparison','kanban','timeline','slider','chart']},
 {id:'unsupported',prompt:'Transfer money from my bank account and book a flight for me',capabilities:['notes','checklist']},
] as const;

export function inspectCapabilities(input: unknown, required: readonly string[]) {
 const parsed=WorkspaceSchema.safeParse(input);
 if(!parsed.success)return {valid:false,missing:[...required],interactive:0,dependenciesValid:false};
 const components=parsed.data.components;
 const types=new Set(components.map(c=>c.type));
 return {valid:true,missing:required.filter(type=>!types.has(type as UIComponent['type'])),interactive:components.filter(c=>!['notes','timeline'].includes(c.type)).length,dependenciesValid:components.every(c=>!c.dependsOn||components.some(source=>source.id===c.dependsOn))};
}
export function localCapabilityBoundary(workspace: Workspace): boolean {
 return workspace.components.some(c=>c.type==='notes'&&/cannot execute/i.test(c.text??'')&&/No .*has occurred/i.test(c.text??''));
}

import { ComponentSchema, type UIComponent } from './schema';
import { validateDefinition, type ComponentDefinition } from './catalog';
import {reconcileCustomTool} from './custom-tool';
import { TaskContractSchema, type TaskContract, type TaskAction } from './task-contract';

export type SelectableDefinition = ComponentDefinition;
export type TaskSelection = { definitionId: string; definitionVersion: number; instanceId: string; actionIds: string[]; score: number };
export type TaskCoverage = { complete: boolean; covered: { actionId: string; instanceId: string; capability: string }[]; missing: { actionId: string; capability: string; reason: string }[] };
export type TaskAssembly = { components: UIComponent[]; selections: TaskSelection[]; coverage: TaskCoverage; limitations: string[] };
const kindTypes: Record<string, UIComponent['type'][]> = {
  items: ['checklist', 'kanban', 'table', 'timeline', 'calendar', 'flashcards', 'quiz', 'chart', 'links', 'approval'],
  schedule: ['weekly_schedule'], comparison: ['comparison'], number: ['custom', 'slider', 'timer', 'chart'], text: ['notes', 'custom'], custom: ['custom'],
};
function supports(definition: SelectableDefinition, action: TaskAction): boolean {
  if (action.external || ![...definition.capabilities, ...definition.actions].includes(action.capability)) return false;
  if (action.inputKind && !kindTypes[action.inputKind].includes(definition.template.type)) return false;
  if (action.inputKind) {
    const properties = definition.inputSchema.properties as Record<string, {type?: string | string[]}> | undefined;
    const requiredFields = action.inputKind === 'comparison' ? ['items','criteria'] : action.inputKind === 'schedule' ? [definition.template.type === 'weekly_schedule' ? 'weeklySchedule' : 'items'] : action.inputKind === 'items' ? ['items'] : action.inputKind === 'custom' || definition.template.type === 'custom' ? ['custom'] : action.inputKind === 'text' ? ['text'] : ['value'];
    if (definition.inputSchema.type !== 'object' || !properties || requiredFields.some(field => !properties[field])) return false;
    const types: Record<string,string> = {items:'array',criteria:'array',weeklySchedule:'object',custom:'object',text:'string',value:'number'};
    if (requiredFields.some(field => { const declared=properties[field].type; return Array.isArray(declared) ? !declared.includes(types[field]) : declared !== types[field]; })) return false;
  }
  return true;
}
/** Capability and input behavior are hard constraints; semantic score only breaks useful ties. */
export function rankTaskCandidates(contract: TaskContract, definitions: SelectableDefinition[], semanticScores: Record<string, number> = {}) {
  return definitions.filter(def => def.status === 'active' && validateDefinition(def).valid).map(definition => {
    const actionIds = contract.actions.filter(action => supports(definition, action)).map(action => action.id);
    const semantic = Math.max(-1, Math.min(1, semanticScores[`${definition.id}@${definition.version}`] ?? semanticScores[definition.id] ?? 0));
    return { definition, actionIds, score: actionIds.length * 100 + semantic };
  }).filter(candidate => candidate.actionIds.length > 0).sort((a, b) => b.score - a.score || a.definition.id.localeCompare(b.definition.id));
}
function formulaSignature(component:UIComponent):string {
  return JSON.stringify({fields:component.custom?.fields.map(field=>({id:field.id,type:field.type})).sort((a,b)=>a.id.localeCompare(b.id)),outputs:component.custom?.outputs.map(output=>({id:output.id,expression:output.expression})).sort((a,b)=>a.id.localeCompare(b.id))});
}
function instanceData(definition:SelectableDefinition,data:UIComponent[],used:UIComponent[]):UIComponent|undefined {
  const candidates=data.filter(component=>component.type===definition.template.type&&!used.some(instance=>instance.id===component.id));
  const sameFormula=(component:UIComponent)=>component.type!=='custom'||formulaSignature(component)===formulaSignature(definition.template);
  return candidates.find(component=>component.catalogRef?.definitionId===definition.id&&component.catalogRef.version===definition.version)
    ??candidates.find(component=>component.id===definition.template.id)
    ??candidates.find(sameFormula);
}
export function assembleTask(raw: TaskContract, definitions: SelectableDefinition[], options: { semanticScores?: Record<string, number>; componentData?: UIComponent[] } = {}): TaskAssembly {
  const contract = TaskContractSchema.parse(raw), remaining = new Set(contract.actions.map(action => action.id));
  const candidates = rankTaskCandidates(contract, definitions, options.semanticScores);
  const selections: TaskSelection[] = [], components: UIComponent[] = [], covered: TaskCoverage['covered'] = [];
  while (remaining.size && selections.length < 16) {
    const next = candidates.map(candidate => ({ ...candidate, actionIds: candidate.actionIds.filter(id => remaining.has(id)) })).filter(candidate => candidate.actionIds.length).sort((a, b) => b.actionIds.length - a.actionIds.length || b.score - a.score)[0];
    if (!next) break;
    const source = instanceData(next.definition,options.componentData??[],components);
    const instanceId = source?.id ?? `task_${next.definition.id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${selections.length + 1}`;
    const trustedCustom=source?.custom&&next.definition.template.custom?reconcileCustomTool(source.custom,next.definition.template.custom):next.definition.template.custom;
    const component = ComponentSchema.parse({ ...structuredClone(next.definition.template), ...source, ...(trustedCustom?{custom:trustedCustom}:{}), id: instanceId, catalogRef: {definitionId:next.definition.id,version:next.definition.version} });
    components.push(component);
    selections.push({ definitionId: next.definition.id, definitionVersion: next.definition.version, instanceId, actionIds: next.actionIds, score: next.score });
    for (const actionId of next.actionIds) { remaining.delete(actionId); covered.push({ actionId, instanceId, capability: contract.actions.find(action => action.id === actionId)!.capability }); }
  }
  const missing = contract.actions.filter(action => remaining.has(action.id)).map(action => ({ actionId: action.id, capability: action.capability, reason: action.external ? 'נדרשת אינטגרציה חיצונית שאינה מחוברת; הפעולה לא בוצעה' : 'אין רכיב מאומת עם היכולת וסכמת הקלט הנדרשות' }));
  return { components, selections, coverage: { complete: missing.length === 0, covered, missing }, limitations: [...new Set(missing.map(entry => entry.reason))] };
}
/** Explicitly a fallback derived from existing local UI behavior, never a claim of AI interpretation. */
export function demoTaskContract(objective: string, components: UIComponent[]): TaskContract {
  const capabilities: Record<UIComponent['type'], string> = { checklist:'tasks.check', kanban:'tasks.organize', comparison:'compare.options', custom:'calculate.formula', table:'data.table.edit', notes:'notes.edit', flashcards:'study.flashcards', quiz:'study.quiz', chart:'data.chart', links:'links.open', timer:'time.track', approval:'decision.approve', slider:'input.range', timeline:'timeline.edit', calendar:'schedule.events.edit', weekly_schedule:'schedule.events.edit' };
  const actions = components.map((component, i) => ({ id:`action_${i + 1}`, capability:capabilities[component.type], description:component.reason || component.title, external:false }));
  return TaskContractSchema.parse({ objective, actions, deliverables: actions.map(action => ({ id:`deliverable_${action.id}`, label:action.description, actionIds:[action.id] })), inputs:[], constraints:['פירוש הדגמה דטרמיניסטי המבוסס על הרכיבים הקיימים'], successCriteria:['כל פעולה נדרשת מכוסה ברכיב אינטראקטיבי מאומת'], subtasks:actions.map(action => ({ id:`subtask_${action.id}`, label:action.description, actionIds:[action.id], dependsOn:[] })) });
}

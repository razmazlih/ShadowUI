import { z } from 'zod';

export const TaskInputKindSchema = z.enum(['items', 'number', 'text', 'schedule', 'comparison', 'custom']);
const Id = z.string().min(1).max(100);
export const TaskActionSchema = z.object({ id: Id, capability: z.string().min(1).max(100), description: z.string().min(1).max(1000), inputKind: TaskInputKindSchema.optional(), external: z.boolean().default(false) }).strict();
export const TaskContractSchema = z.object({
  objective: z.string().min(1).max(4000),
  deliverables: z.array(z.object({ id: Id, label: z.string().min(1).max(500), actionIds: z.array(Id).min(1).max(32) }).strict()).min(1).max(32),
  actions: z.array(TaskActionSchema).min(1).max(32),
  inputs: z.array(z.object({ id: Id, label: z.string().min(1).max(300), kind: TaskInputKindSchema, required: z.boolean(), available: z.boolean(), value: z.unknown().optional() }).strict()).max(60),
  constraints: z.array(z.string().max(1000)).max(30), successCriteria: z.array(z.string().min(1).max(1000)).min(1).max(30),
  subtasks: z.array(z.object({ id: Id, label: z.string().min(1).max(500), actionIds: z.array(Id).max(32), dependsOn: z.array(Id).max(32) }).strict()).max(32),
  clarification: z.string().min(1).max(1000).optional(),
}).strict().superRefine((task, ctx) => {
  for (const key of ['actions', 'inputs', 'deliverables', 'subtasks'] as const) {
    if (new Set(task[key].map(x => x.id)).size !== task[key].length) ctx.addIssue({ code: 'custom', path: [key], message: `Duplicate ${key} IDs` });
  }
  const actions = new Set(task.actions.map(action => action.id));
  for (const entry of [...task.deliverables, ...task.subtasks]) for (const id of entry.actionIds) if (!actions.has(id)) ctx.addIssue({ code: 'custom', message: `Unknown action: ${id}` });
  const nodes = new Map(task.subtasks.map(subtask => [subtask.id, subtask]));
  const visited = new Set<string>(), visiting = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) { ctx.addIssue({ code: 'custom', path: ['subtasks'], message: 'Cyclic subtask dependency' }); return; }
    if (visited.has(id)) return;
    const node = nodes.get(id); if (!node) { ctx.addIssue({ code: 'custom', path: ['subtasks'], message: `Unknown subtask: ${id}` }); return; }
    visiting.add(id); for (const dependency of node.dependsOn) visit(dependency); visiting.delete(id); visited.add(id);
  }
  for (const id of nodes.keys()) visit(id);
  for (const action of task.actions) if (!task.deliverables.some(d => d.actionIds.includes(action.id))) ctx.addIssue({ code: 'custom', path: ['deliverables'], message: `Action has no deliverable: ${action.id}` });
});
export type TaskContract = z.infer<typeof TaskContractSchema>;
export type TaskAction = z.infer<typeof TaskActionSchema>;

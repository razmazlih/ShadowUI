import { z } from 'zod';

const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/);
const operators = new Set(['+', '-', '*', '/', 'min', 'max', 'gt', 'lt', 'eq', 'if', 'days_between']);
const numericToken = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const FieldSchema = z.object({
  id: identifier, label: z.string().min(1).max(160),
  type: z.enum(['number', 'text', 'select', 'toggle']),
  value: z.string().max(2000), options: z.array(z.string().min(1).max(160)).max(20),
  min: z.number().finite().nullable(), max: z.number().finite().nullable(),
}).strict();
const OutputSchema = z.object({
  id: identifier, label: z.string().min(1).max(160),
  expression: z.array(z.string().min(1).max(64)).min(1).max(64), unit: z.string().max(40),
}).strict();

/** A bounded data contract: no executable source, HTML, network requests, or side effects. */
export const CustomToolSchema = z.object({
  purpose: z.string().min(1).max(1000), layout: z.enum(['form', 'metrics', 'steps']),
  accent: z.enum(['blue', 'green', 'amber', 'violet']),
  fields: z.array(FieldSchema).min(1).max(16), outputs: z.array(OutputSchema).max(12),
}).strict().superRefine((tool, ctx) => {
  const ids = [...tool.fields, ...tool.outputs].map(entry => entry.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Custom tool IDs must be unique' });
  const numericFields = new Set(tool.fields.filter(field => field.type === 'number' || field.type === 'toggle').map(field => field.id));
  for (const [index, field] of tool.fields.entries()) {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['fields', index], message });
    if (operators.has(field.id)) issue('Field ID is reserved');
    if (field.min !== null && field.max !== null && field.min > field.max) issue('Minimum must not exceed maximum');
    if (field.type === 'number' && (field.value.trim() === '' || !Number.isFinite(Number(field.value)) || (field.min !== null && Number(field.value) < field.min) || (field.max !== null && Number(field.value) > field.max))) issue('Number value must be finite and within bounds');
    if (field.type === 'toggle' && !['true', 'false'].includes(field.value)) issue('Toggle value must be true or false');
    if (field.type === 'select' && (!field.options.length || !field.options.includes(field.value) || new Set(field.options).size !== field.options.length)) issue('Select value must match a unique option');
  }
  for (const [index, output] of tool.outputs.entries()) {
    let depth = 0;
    for (const token of output.expression) {
      if (operators.has(token)) { const arity=token==='if'?3:2; if (depth < arity) { depth = -1; break; } depth-=arity-1; }
      else if (numericFields.has(token) || (numericToken.test(token) && Number.isFinite(Number(token)))) depth++;
      else { depth = -1; break; }
    }
    if (depth !== 1) ctx.addIssue({ code: 'custom', path: ['outputs', index, 'expression'], message: 'Expression must be valid RPN using numeric fields and supported operators' });
  }
});

export type CustomTool = z.infer<typeof CustomToolSchema>;
export type CustomToolField = CustomTool['fields'][number];
export type CustomToolOutput = CustomTool['outputs'][number];
export type CustomToolResult = { id: string; label: string; unit: string; value: number | null; error: string | null };

export function evaluateCustomTool(tool: CustomTool): CustomToolResult[] {
  // Validate again at the execution boundary, including locally edited input.
  const parsed = CustomToolSchema.safeParse(tool);
  if (!parsed.success) return tool.outputs.map(output => ({ id: output.id, label: output.label, unit: output.unit, value: null, error: 'יש לבדוק את ערכי הקלט ואת הנוסחה' }));
  const values = new Map(parsed.data.fields.map(field => [field.id, field.type === 'toggle' ? (field.value === 'true' ? 1 : 0) : Number(field.value)]));
  return parsed.data.outputs.map(output => {
    const stack: number[] = [];
    let error: string | null = null;
    for (const token of output.expression) {
      if (!operators.has(token)) { stack.push(values.has(token) ? values.get(token)! : Number(token)); continue; }
      if(token==='if'){const otherwise=stack.pop()!,whenTrue=stack.pop()!,condition=stack.pop()!;stack.push(condition!==0?whenTrue:otherwise);continue;}
      const right = stack.pop()!, left = stack.pop()!;
      if (token === '/' && right === 0) { error = 'לא ניתן לחלק באפס'; break; }
      const value = token === '+' ? left + right : token === '-' ? left - right : token === '*' ? left * right : token === '/' ? left / right : token==='gt' ? Number(left>right) : token==='lt' ? Number(left<right) : token==='eq' ? Number(left===right) : token==='days_between' ? (right-left)/86400000 : token === 'min' ? Math.min(left, right) : Math.max(left, right);
      if (!Number.isFinite(value)) { error = 'התוצאה מחוץ לטווח המספרי'; break; }
      stack.push(value);
    }
    return { id: output.id, label: output.label, unit: output.unit, value: error ? null : stack[0], error };
  });
}

export function reconcileCustomTool(previous: CustomTool, next: CustomTool): CustomTool {
  return { ...next, fields: next.fields.map(field => {
    const saved = previous.fields.find(old => old.id === field.id && old.type === field.type);
    if (!saved) return field;
    const candidate = { ...field, value: saved.value };
    // Changed choices and bounds must take precedence over stale local values.
    return CustomToolSchema.safeParse({ ...next, fields: next.fields.map(entry => entry.id === field.id ? candidate : entry) }).success ? candidate : field;
  }) };
}

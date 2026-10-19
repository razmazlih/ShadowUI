import test from 'node:test';
import assert from 'node:assert/strict';
import { CustomToolSchema, evaluateCustomTool, reconcileCustomTool, type CustomTool } from '../lib/custom-tool';
const tool: CustomTool = { purpose: 'Budget', layout: 'metrics', accent: 'blue', fields: [{ id: 'cost', label: 'Cost', type: 'number', value: '12', options: [], min: 0, max: 100 }], outputs: [{ id: 'total', label: 'Total', expression: ['cost', '2', '*'], unit: '₪' }] };
test('evaluates bounded arithmetic and toggle input deterministically', () => {
  assert.equal(evaluateCustomTool(tool)[0].value, 24);
  const toggled: CustomTool = { ...tool, fields: [...tool.fields, { id: 'enabled', label: 'Enabled', type: 'toggle', value: 'false', options: [], min: null, max: null }], outputs: [{ ...tool.outputs[0], expression: ['cost', 'enabled', '*'] }] };
  assert.equal(evaluateCustomTool(toggled)[0].value, 0);
});
test('rejects unknown references, invalid stacks, duplicate IDs and executable strings', () => {
  for (const expression of [['missing'], ['cost', '+'], ['1', '2'], ['globalThis.process.exit()'], ['1e999']]) assert.equal(CustomToolSchema.safeParse({ ...tool, outputs: [{ ...tool.outputs[0], expression }] }).success, false);
  assert.equal(CustomToolSchema.safeParse({ ...tool, fields: [...tool.fields, tool.fields[0]] }).success, false);
});
test('reports division by zero and overflow without non-finite output', () => {
  for (const expression of [['cost', '0', '/'], ['1e308', '1e308', '*']]) {
    const result = evaluateCustomTool({ ...tool, outputs: [{ ...tool.outputs[0], expression }] })[0];
    assert.equal(result.value, null); assert.ok(result.error);
  }
});
test('bounds and choices are enforced and reconciliation keeps only compatible values', () => {
  assert.equal(CustomToolSchema.safeParse({ ...tool, fields: [{ ...tool.fields[0], value: '101' }] }).success, false);
  assert.equal(CustomToolSchema.safeParse({ ...tool, fields: [{ ...tool.fields[0], value: ' ' }] }).success, false);
  assert.equal(reconcileCustomTool(tool, { ...tool, fields: [{ ...tool.fields[0], value: '30' }] }).fields[0].value, '12');
  assert.equal(reconcileCustomTool(tool, { ...tool, fields: [{ ...tool.fields[0], value: '30', min: 20 }] }).fields[0].value, '30');
});

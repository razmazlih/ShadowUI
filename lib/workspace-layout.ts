import type { UIComponent } from './schema';

export type LayoutState = {
  mode: 'auto' | 'fixed';
  order: string[];
  sizes: Record<string, { columns: number; minHeight: number }>;
};

const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const safeId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100 && !forbiddenKeys.has(id);
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** Geometry depends only on component identity, type and declared span, never edited data. */
export function automaticLayout(components: UIComponent[], availableWidth = Infinity): LayoutState {
  const sizes: LayoutState['sizes'] = Object.create(null);
  const order = components.map(component => component.id);
  for (const component of components) {
    let columns = 6;
    if (['calendar', 'weekly_schedule', 'kanban', 'table', 'comparison'].includes(component.type) || (component.type === 'timeline' && component.span === 'wide')) columns = 12;
    else if (component.type === 'notes') columns = 8;
    else if (['checklist', 'slider', 'timer', 'approval'].includes(component.type)) columns = 4;
    if (availableWidth < 680) columns = 12;
    else if (availableWidth < 1050 && columns < 12) columns = 6;
    sizes[component.id] = { columns, minHeight: 160 };
  }
  // Compact multi-card rows without stretching a solitary tool across the canvas.
  let used = 0;
  let rowCount = 0;
  let lastId: string | undefined;
  const closeRow = () => {
    if (lastId && rowCount > 1) sizes[lastId].columns += Math.min(12 - used, Math.max(0, 8 - sizes[lastId].columns));
  };
  for (const id of order) {
    const columns = sizes[id].columns;
    if (used + columns > 12) {
      closeRow();
      used = 0;
      rowCount = 0;
    }
    used += columns;
    rowCount += 1;
    lastId = id;
    if (used === 12) { used = 0; rowCount = 0; lastId = undefined; }
  }
  closeRow();
  return { mode: 'auto', order, sizes };
}

export function reconcileLayout(state: LayoutState, components: UIComponent[]): LayoutState {
  const automatic = automaticLayout(components);
  if (state.mode === 'auto') return automatic;
  const available = new Set(automatic.order);
  const order = [...new Set(state.order.filter(id => available.has(id)))];
  for (const id of automatic.order) if (!order.includes(id)) order.push(id);
  const sizes: LayoutState['sizes'] = Object.create(null);
  for (const id of order) {
    const saved = Object.hasOwn(state.sizes, id) ? state.sizes[id] : undefined;
    sizes[id] = {
      columns: saved && Number.isFinite(saved.columns) ? clamp(Math.round(saved.columns), 4, 12) : automatic.sizes[id].columns,
      minHeight: saved && Number.isFinite(saved.minHeight) ? clamp(Math.round(saved.minHeight), 160, 900) : automatic.sizes[id].minHeight,
    };
  }
  return { mode: 'fixed', order, sizes };
}

/** Reject malformed persisted data rather than partially restoring surprising layouts. */
export function parseLayout(value: unknown): LayoutState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !['mode', 'order', 'sizes'].includes(key))) return null;
  if (candidate.mode !== 'auto' && candidate.mode !== 'fixed') return null;
  if (!Array.isArray(candidate.order) || candidate.order.length > 16 || !candidate.order.every(safeId)) return null;
  const order = candidate.order as string[];
  if (new Set(order).size !== order.length) return null;
  if (!candidate.sizes || typeof candidate.sizes !== 'object' || Array.isArray(candidate.sizes)) return null;
  const source = candidate.sizes as Record<string, unknown>;
  if (Object.keys(source).length !== order.length || Object.keys(source).some(id => !safeId(id) || !order.includes(id))) return null;
  const sizes: LayoutState['sizes'] = Object.create(null);
  for (const id of order) {
    if (!Object.hasOwn(source, id)) return null;
    const size = source[id];
    if (!size || typeof size !== 'object' || Array.isArray(size)) return null;
    const fields = size as Record<string, unknown>;
    if (Object.keys(fields).length !== 2 || !Object.hasOwn(fields, 'columns') || !Object.hasOwn(fields, 'minHeight')) return null;
    const { columns, minHeight } = fields;
    if (typeof columns !== 'number' || !Number.isInteger(columns) || columns < 4 || columns > 12 || typeof minHeight !== 'number' || !Number.isFinite(minHeight) || minHeight < 160 || minHeight > 900) return null;
    sizes[id] = { columns, minHeight };
  }
  return { mode: candidate.mode, order: [...order], sizes };
}

/** Handle explicit presentation-only commands locally, before contacting the planner. */
export function isLayoutRequest(prompt: string): boolean {
  const text = prompt.trim().replace(/[.!?]+$/u, '').trim();
  // Mixed data/content edits still belong to the planner.
  if (/\b(?:add|remove|delete|create|build)\b|(?:תוסיף|להוסיף|תמחק|למחוק|תסיר|להסיר)/iu.test(text)) return false;
  const target = /(?:מסך|תצוגה|פריסה|רכיבים|קומפוננטות|קופוננטות|כרטיסים|סביבת העבודה)|\b(?:screen|layout|components?|cards?|workspace)\b/iu;
  const action = /(?:^|\s)(?:ש?תסדר|סדר|סדרי|לסדר|ש?תארגן|ארגן|לארגן|תסדרי|תארגני)(?:\s|$)|\b(?:arrange|rearrange|organize|reorganize|tidy)\b/iu;
  const question = /^(?:למה|מדוע|איך|כיצד|מה|האם)(?:\s|$)|^(?:why|how|what|does|is)\b/iu;
  return target.test(text) && action.test(text) && !question.test(text);
}

/** Put the main structured tools first and give reading-heavy tools a full row.
 * A fixed result is intentional: it replaces any previously saved manual geometry.
 * Tool objects and their editable data are never changed.
 */
export function requestedLayout(components: UIComponent[], availableWidth = Infinity): LayoutState {
  const priority = (component: UIComponent) => ['timeline', 'calendar', 'weekly_schedule', 'kanban'].includes(component.type) ? 0 : ['table', 'comparison'].includes(component.type) ? 1 : 2;
  const ordered = components.map((component, index) => ({ component, index }))
    .sort((a, b) => priority(a.component) - priority(b.component) || a.index - b.index)
    .map(entry => entry.component);
  const layout = automaticLayout(ordered, availableWidth);
  for (const component of ordered) {
    if (['timeline', 'notes'].includes(component.type)) layout.sizes[component.id].columns = 12;
  }
  return { ...layout, mode: 'fixed' };
}

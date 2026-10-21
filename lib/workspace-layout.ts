import type { UIComponent } from './schema';

export type LayoutState = {
  mode: 'auto' | 'fixed';
  order: string[];
  sizes: Record<string, { columns: number; minHeight: number }>;
};

const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const safeId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100 && !forbiddenKeys.has(id);
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export type ViewportLayout = {
  columns: number;
  groups: Array<{
    ids: string[];
    placements: Record<string, { column: number; row: number; span: number }>;
    rows: number;
  }>;
};

/** One-based CSS grid positions, packed in reading order without inspecting editable content.
 * Dimensions describe the card area after the toolbar and tool selector are reserved.
 * Undersized viewports still expose one card; the renderer supplies accessible scrolling.
 */
export function viewportLayout(components: UIComponent[], order: string[], width: number, height: number, preferredPages?: string[][]): ViewportLayout {
  if (preferredPages?.length) {
    const available = new Map(components.map(component => [component.id, component]));
    const seen = new Set<string>();
    const pages = preferredPages.map(page => page.filter(id => {
      if (!available.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }));
    const remaining = [...new Set([...order, ...components.map(component => component.id)])].filter(id => available.has(id) && !seen.has(id));
    if (remaining.length) pages.push(remaining);
    const packed = pages.filter(page => page.length).map(page => viewportLayout(page.map(id => available.get(id)!), page, width, height));
    return { columns: packed[0]?.columns ?? viewportLayout([], [], width, height).columns, groups: packed.flatMap(page => page.groups) };
  }
  const availableWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const availableHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const mobile = availableWidth < 680;
  const columns = mobile ? 1 : Math.max(1, Math.floor((availableWidth + 12) / (280 + 12)));
  const capacityRows = mobile ? 1 : Math.max(1, Math.floor((availableHeight + 12) / (220 + 12)));
  const byId = new Map(components.map(component => [component.id, component]));
  const ids = [...new Set([...order.filter(id => byId.has(id)), ...components.map(component => component.id)])];
  const groups: ViewportLayout['groups'] = [];
  const wideTypes = new Set(['table', 'calendar', 'weekly_schedule', 'kanban', 'comparison']);
  const expandableTypes = new Set([...wideTypes, 'notes', 'timeline']);
  let group: ViewportLayout['groups'][number] | undefined;
  let column = 1;
  let row = 1;
  const closeRow = () => {
    if (!group || column > columns) return;
    const rowIds = group.ids.filter(id => group!.placements[id].row === row);
    const expandable = rowIds.findLastIndex(id => expandableTypes.has(byId.get(id)!.type));
    if (expandable < 0) return;
    const spare = columns - column + 1;
    group.placements[rowIds[expandable]].span += spare;
    // Give reading content the free space while keeping following controls compact.
    for (const id of rowIds.slice(expandable + 1)) group.placements[id].column += spare;
  };
  for (const id of ids) {
    const component = byId.get(id)!;
    const fullRow = component.type === 'timeline' && component.span === 'wide';
    const wide = wideTypes.has(component.type) || (component.type === 'notes' && component.span === 'wide');
    const span = fullRow ? columns : Math.min(columns, wide ? 2 : 1);
    if (column + span - 1 > columns) { closeRow(); column = 1; row += 1; }
    if (!group || row > capacityRows) {
      group = { ids: [], placements: Object.create(null), rows: 0 };
      groups.push(group);
      column = 1;
      row = 1;
    }
    group.ids.push(id);
    group.placements[id] = { column, row, span };
    group.rows = row;
    column += span;
  }
  closeRow();
  // A solitary card is the current main tool rather than a narrow dashboard tile.
  for (const packed of groups) if (packed.ids.length === 1) packed.placements[packed.ids[0]].span = columns;
  return { columns, groups };
}

/** Optional page choices contain only tool identities; geometry remains automatic. */
export function moveViewportTool(pages: string[][], id: string, targetPage: number): string[][] {
  if (!pages.some(page => page.includes(id)) || !Number.isInteger(targetPage) || targetPage < 0 || targetPage > pages.length) return pages.map(page => [...page]);
  const next = pages.map(page => page.filter(item => item !== id));
  if (!next[targetPage]) next[targetPage] = [];
  next[targetPage].push(id);
  return next.filter(page => page.length);
}

export function parseViewportPages(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  const seen = new Set<string>();
  for (const page of value) {
    if (!Array.isArray(page) || !page.length || page.length > 16) return null;
    for (const id of page) {
      if (!safeId(id) || seen.has(id) || seen.size >= 16) return null;
      seen.add(id);
    }
  }
  return value.map(page => [...page]);
}

/** Reading and practice form a lesson, rather than independent dashboard panels. */
export function isLessonLayout(components: UIComponent[]): boolean {
  return components.some(component => component.type === 'notes')
    && components.some(component => ['quiz', 'flashcards'].includes(component.type))
    && components.every(component => ['notes', 'timeline', 'checklist', 'quiz', 'flashcards', 'links', 'timer'].includes(component.type));
}

/** Geometry depends only on component identity, type and declared span, never edited data. */
export function automaticLayout(components: UIComponent[], availableWidth = Infinity): LayoutState {
  const sizes: LayoutState['sizes'] = Object.create(null);
  const order = components.map(component => component.id);
  const lesson = isLessonLayout(components);
  for (const component of components) {
    let columns = 6;
    if (['calendar', 'weekly_schedule', 'kanban', 'table', 'comparison'].includes(component.type) || (component.type === 'timeline' && component.span === 'wide')) columns = 12;
    else if (component.type === 'notes') columns = 8;
    else if (['checklist', 'slider', 'timer', 'approval'].includes(component.type)) columns = 4;
    if (lesson) columns = ['notes', 'timeline', 'links'].includes(component.type) || availableWidth < 880 ? 12 : 6;
    if (availableWidth < 680) columns = 12;
    else if (availableWidth < 1050 && columns < 12) columns = 6;
    sizes[component.id] = { columns, minHeight: 160 };
  }
  // Compact multi-card rows without stretching a solitary tool across the canvas.
  let used = 0;
  let rowCount = 0;
  let lastId: string | undefined;
  const closeRow = () => {
    if (lastId && lesson) sizes[lastId].columns += 12 - used;
    else if (lastId && rowCount > 1) sizes[lastId].columns += Math.min(12 - used, Math.max(0, 8 - sizes[lastId].columns));
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

export function columnLayout(components: UIComponent[], columns: 1 | 2 | 3): LayoutState {
  const layout = automaticLayout(components);
  for (const id of layout.order) layout.sizes[id] = { columns: 12 / columns, minHeight: 160 };
  return { ...layout, mode: 'fixed' };
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

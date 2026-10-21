import test from 'node:test';
import assert from 'node:assert/strict';
import type { UIComponent } from '../lib/schema';
import { automaticLayout, columnLayout, parseLayout, reconcileLayout, viewportLayout } from '../lib/workspace-layout';

const component = (id: string, type: UIComponent['type'] = 'chart'): UIComponent => ({ id, type, title: id, reason: '', span: 'normal', items: [] });

test('viewport packing obeys exact width and height capacity boundaries', () => {
  const components = Array.from({ length: 16 }, (_, index) => component(String(index)));
  const order = components.map(item => item.id);
  assert.deepEqual(viewportLayout(components, order, 863, 451).groups.map(group => group.ids.length), Array(8).fill(2));
  const layout = viewportLayout(components, order, 864, 452);
  assert.equal(layout.columns, 3);
  assert.deepEqual(layout.groups.map(group => group.ids.length), [6, 6, 4]);
  assert.deepEqual(layout.groups.flatMap(group => group.ids), order);
  assert.deepEqual(layout.groups[0].placements['5'], { column: 3, row: 2, span: 1 });
  assert.deepEqual(layout.groups.map(group => group.rows), [2, 2, 2]);
});

test('wide tools receive two columns without moving tools ahead of their reading order', () => {
  const components = [component('a'), component('table', 'table'), component('b'), component('week', 'weekly_schedule')];
  const layout = viewportLayout(components, components.map(item => item.id), 864, 452);
  assert.deepEqual(layout.groups.map(group => group.ids), [['a', 'table', 'b', 'week']]);
  assert.deepEqual(layout.groups[0].placements.table, { column: 2, row: 1, span: 2 });
  assert.deepEqual(layout.groups[0].placements.week, { column: 2, row: 2, span: 2 });
  const narrow = viewportLayout(components, components.map(item => item.id), 680, 220);
  assert.deepEqual(narrow.groups.map(group => group.ids), [['a'], ['table'], ['b'], ['week']]);
});

test('five lesson tools fit three readable rows and wide timeline fills its own row', () => {
  const components = [component('intro', 'notes'), component('example', 'notes'), { ...component('path', 'timeline'), span: 'wide' as const }, component('quiz', 'quiz'), component('practice', 'checklist')];
  const order = components.map(item => item.id);
  const layout = viewportLayout(components, order, 900, 700);
  assert.equal(layout.groups.length, 1);
  assert.equal(layout.groups[0].rows, 3);
  assert.deepEqual(layout.groups[0].ids, order);
  assert.deepEqual(layout.groups[0].placements.example, { column: 2, row: 1, span: 2 });
  assert.deepEqual(layout.groups[0].placements.path, { column: 1, row: 2, span: 3 });
  assert.deepEqual(layout.groups[0].placements.quiz, { column: 1, row: 3, span: 1 });
  assert.ok(viewportLayout(components, order, 900, 452).groups.length > layout.groups.length);
});

test('reading tools fill spare row width while short controls stay compact', () => {
  const components = [component('timer', 'timer'), component('notes', 'notes'), { ...component('path', 'timeline'), span: 'wide' as const }, component('slider', 'slider'), component('approval', 'approval')];
  const layout = viewportLayout(components, components.map(item => item.id), 900, 700);
  assert.deepEqual(layout.groups[0].placements.notes, { column: 2, row: 1, span: 2 });
  assert.equal(layout.groups[0].placements.timer.span, 1);
  assert.equal(layout.groups[0].placements.slider.span, 1);
  assert.equal(layout.groups[0].placements.approval.span, 1);
  assert.equal(viewportLayout([component('timer', 'timer')], ['timer'], 900, 700).groups[0].placements.timer.span, 3);
  const wideNotes = viewportLayout([{ ...component('notes', 'notes'), span: 'wide' }, component('timer', 'timer')], ['notes', 'timer'], 900, 220);
  assert.equal(wideNotes.groups[0].placements.notes.span, 2);
  assert.equal(wideNotes.groups[0].placements.timer.column, 3);
});

test('spare width expands reading tools before trailing controls without changing their order', () => {
  const components = [component('notes', 'notes'), component('timer', 'timer'), { ...component('wide', 'timeline'), span: 'wide' as const }, component('timeline', 'timeline'), component('slider', 'slider')];
  const layout = viewportLayout(components, components.map(item => item.id), 900, 700);
  assert.deepEqual(layout.groups[0].ids, components.map(item => item.id));
  assert.deepEqual(layout.groups[0].placements.notes, { column: 1, row: 1, span: 2 });
  assert.deepEqual(layout.groups[0].placements.timer, { column: 3, row: 1, span: 1 });
  assert.deepEqual(layout.groups[0].placements.timeline, { column: 1, row: 3, span: 2 });
  assert.deepEqual(layout.groups[0].placements.slider, { column: 3, row: 3, span: 1 });
  const controls = [component('a', 'timer'), component('b', 'slider')];
  const compact = viewportLayout(controls, ['a', 'b'], 900, 700);
  assert.deepEqual(compact.groups[0].placements.a, { column: 1, row: 1, span: 1 });
  assert.deepEqual(compact.groups[0].placements.b, { column: 2, row: 1, span: 1 });
});

test('mobile shows one tool regardless of available height and reconciles changed composition', () => {
  const components = [component('a'), component('new', 'table'), component('b')];
  const layout = viewportLayout(components, ['b', 'removed', 'b', 'a'], 679, 2000);
  assert.equal(layout.columns, 1);
  assert.deepEqual(layout.groups.map(group => group.ids), [['b'], ['a'], ['new']]);
  for (const group of layout.groups) {
    assert.equal(group.rows, 1);
    assert.deepEqual(group.placements[group.ids[0]], { column: 1, row: 1, span: 1 });
  }
});

test('viewport geometry ignores edited values and leaves inputs unchanged', () => {
  const components = [component('notes', 'notes'), component('timer', 'timer'), component('table', 'table')];
  const order = ['table', 'notes', 'timer'];
  const before = JSON.stringify({ components, order });
  const layout = viewportLayout(components, order, 1156, 452);
  assert.deepEqual(viewportLayout(components.map(item => ({ ...item, text: 'edited'.repeat(500), value: 90, items: [{ id: 'x', label: 'Edited' }] })), order, 1156, 452), layout);
  assert.equal(JSON.stringify({ components, order }), before);
});

test('viewport packing has no overlaps and never loses tools across screen sizes', () => {
  const components = Array.from({ length: 16 }, (_, index) => component(String(index), index % 3 === 0 ? 'table' : 'timer'));
  const order = components.map(item => item.id).reverse();
  for (const [width, height] of [[320, 200], [680, 220], [864, 452], [1366, 684], [1600, 916]]) {
    const layout = viewportLayout(components, order, width, height);
    assert.deepEqual(layout.groups.flatMap(group => group.ids), order);
    for (const group of layout.groups) {
      const occupied = new Set<string>();
      for (const id of group.ids) {
        const placement = group.placements[id];
        assert.ok(placement.column + placement.span - 1 <= layout.columns);
        assert.ok(placement.row * 220 + (placement.row - 1) * 12 <= height || height < 220);
        for (let column = placement.column; column < placement.column + placement.span; column++) {
          const cell = `${placement.row}:${column}`;
          assert.equal(occupied.has(cell), false);
          occupied.add(cell);
        }
      }
    }
  }
});

test('empty and transient unavailable viewport dimensions remain well-defined', () => {
  assert.deepEqual(viewportLayout([], [], 0, 0), { columns: 1, groups: [] });
  for (const dimension of [0, -20, NaN, Infinity]) {
    const layout = viewportLayout([component('table', 'table')], ['table'], dimension, dimension);
    assert.equal(layout.columns, 1);
    assert.deepEqual(layout.groups[0].placements.table, { column: 1, row: 1, span: 1 });
  }
});

for (const count of [1, 2, 6, 16]) {
  test(`automatic layout keeps all ${count} components in reading order`, () => {
    const components = Array.from({ length: count }, (_, index) => component(String(index)));
    const layout = automaticLayout(components);
    assert.deepEqual(layout.order, components.map(item => item.id));
    assert.equal(Object.keys(layout.sizes).length, count);
    assert.equal(layout.sizes['0'].columns, 6);
    assert.ok(parseLayout(JSON.parse(JSON.stringify(layout))));
  });
}

test('automatic geometry respects content types and explicit wide spans', () => {
  const components = ['calendar', 'kanban', 'table', 'comparison', 'notes', 'checklist', 'slider', 'timer', 'approval', 'chart'].map(type => component(type, type as UIComponent['type']));
  const sizes = automaticLayout([...components, { ...component('wide'), span: 'wide' }]).sizes;
  for (const type of ['calendar', 'kanban', 'table', 'comparison']) assert.equal(sizes[type].columns, 12);
  assert.equal(sizes.notes.columns, 8);
  for (const type of ['checklist', 'slider', 'timer', 'approval']) assert.equal(sizes[type].columns, 4);
  assert.equal(sizes.chart.columns, 6);
  assert.equal(sizes.wide.columns, 6);
});

test('editing content and values does not alter automatic geometry or input data', () => {
  const components = [component('notes', 'notes'), component('timer', 'timer')];
  const before = JSON.stringify(components);
  const layout = automaticLayout(components);
  assert.deepEqual(reconcileLayout(layout, components.map(item => ({ ...item, value: 45, text: 'long edited text', items: [{ id: 'task', label: 'Task', done: true }] }))), layout);
  assert.equal(JSON.stringify(components), before);
});

test('fixed layout retains manual order and geometry, drops removed tools and appends new tools', () => {
  const state = automaticLayout([component('a'), component('b'), component('removed')]);
  state.mode = 'fixed';
  state.order = ['b', 'removed', 'a'];
  state.sizes.b = { columns: 8, minHeight: 420 };
  const original = JSON.stringify(state);
  const next = reconcileLayout(state, [component('a'), component('new', 'table'), component('b')]);
  assert.deepEqual(next.order, ['b', 'a', 'new']);
  assert.deepEqual(next.sizes.b, { columns: 8, minHeight: 420 });
  assert.equal(next.sizes.new.columns, 12);
  assert.equal(Object.hasOwn(next.sizes, 'removed'), false);
  assert.equal(JSON.stringify(state), original);
});

test('reconciliation clamps manual dimensions and recovers invalid numbers', () => {
  const state = automaticLayout([component('a'), component('b')]);
  state.mode = 'fixed';
  state.sizes.a = { columns: 100, minHeight: -50 };
  state.sizes.b = { columns: NaN, minHeight: Infinity };
  const next = reconcileLayout(state, [component('a'), component('b')]);
  assert.deepEqual(next.sizes.a, { columns: 12, minHeight: 160 });
  assert.deepEqual(next.sizes.b, { columns: 6, minHeight: 160 });
});

test('stored layout rejects corruption and unsafe keys', () => {
  const good = JSON.parse(JSON.stringify(automaticLayout([component('a')])));
  for (const bad of [null, [], {}, { ...good, mode: 'other' }, { ...good, order: ['a', 'a'] }, { ...good, order: Array(17).fill('a') }, { ...good, sizes: {} }, { ...good, sizes: { a: { columns: Infinity, minHeight: 160 } } }, { ...good, sizes: { a: { columns: 12, minHeight: 901 } } }, { ...good, extra: true }, JSON.parse('{"mode":"fixed","order":["__proto__"],"sizes":{"__proto__":{"columns":12,"minHeight":160}}}')]) assert.equal(parseLayout(bad), null);
  const parsed = parseLayout(good)!;
  parsed.order.push('b');
  parsed.sizes.a.columns = 4;
  assert.deepEqual(good.order, ['a']);
  assert.equal(good.sizes.a.columns, 6);
});

for (const width of [320, 679, 680, 1049, 1050, 1600]) {
  test(`automatic rows retain sensible widths at ${width}px without reordering`, () => {
    const components = ['notes', 'timer', 'chart', 'checklist', 'slider', 'table', 'approval'].map((type, index) => component(String(index), type as UIComponent['type']));
    const layout = automaticLayout(components, width);
    assert.deepEqual(layout.order, components.map(item => item.id));
    let used = 0;
    for (const id of layout.order) {
      const columns = layout.sizes[id].columns;
      if (used + columns > 12) used = 0;
      assert.ok(columns >= 4 && columns <= 12);
      if (width < 680) assert.equal(columns, 12);
      else if (width < 1050) assert.ok(columns >= 6);
      used += columns;
      if (used === 12) used = 0;
    }
    // Natural widths may deliberately leave space rather than stretch a solitary tool.
    assert.deepEqual(automaticLayout(components.map(item => ({ ...item, text: 'edited', value: 55 })), width), layout);
  });
}

test('breakpoints change compact tools from a stack to pairs to thirds', () => {
  const components = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => component(id, 'timer'));
  assert.deepEqual(Object.values(automaticLayout(components, 679).sizes).map(size => size.columns), [12, 12, 12, 12, 12, 12]);
  assert.deepEqual(Object.values(automaticLayout(components, 680).sizes).map(size => size.columns), [6, 6, 6, 6, 6, 6]);
  assert.deepEqual(Object.values(automaticLayout(components, 1049).sizes).map(size => size.columns), [6, 6, 6, 6, 6, 6]);
  assert.deepEqual(Object.values(automaticLayout(components, 1050).sizes).map(size => size.columns), [4, 4, 4, 4, 4, 4]);
});

 test('desktop single tools retain natural widths and demo notes share a row with checklist', () => {
   assert.equal(automaticLayout([component('timer', 'timer')], 1400).sizes.timer.columns, 4);
   assert.equal(automaticLayout([{ ...component('notes', 'notes'), span: 'wide' }], 1400).sizes.notes.columns, 8);
   const demo = automaticLayout([{ ...component('notes', 'notes'), span: 'wide' }, component('tasks', 'checklist')], 1400);
   assert.deepEqual(demo.order.map(id => demo.sizes[id].columns), [8, 4]);
   assert.equal(automaticLayout([component('comparison', 'comparison')], 1400).sizes.comparison.columns, 12);
   assert.equal(automaticLayout([component('timer', 'timer')], 320).sizes.timer.columns, 12);
 });

test('explicit layout commands are recognized without swallowing questions or mixed edits', async () => {
  const { isLayoutRequest } = await import('../lib/workspace-layout');
  for (const prompt of ['תסדר לי את המסך', 'אני רוצה שתסדר לי את המסך', 'סדר את הקומפוננטות', 'אפשר לסדר את המסך?', 'Arrange the layout', 'Could you please rearrange my cards?', 'Organize this workspace']) assert.equal(isLayoutRequest(prompt), true, prompt);
  for (const prompt of ['איך לסדר את המסך?', 'Why rearrange the layout?', 'Add a table and arrange the layout', 'תסדר את המסך ותוסיף טבלה', 'תכנן סידור עבודה', 'Change the budget']) assert.equal(isLayoutRequest(prompt), false, prompt);
});

test('requested arrangement prioritizes the itinerary, applies real geometry, and preserves all data', async () => {
  const { requestedLayout } = await import('../lib/workspace-layout');
  const components = [component('links', 'links'), { ...component('budget', 'table'), items: [{ id: 'cost', label: 'Hotel', value: 270 }] }, component('itinerary', 'timeline'), component('notes', 'notes')];
  const before = JSON.stringify(components);
  const next = requestedLayout(components, 1400);
  assert.equal(next.mode, 'fixed');
  assert.deepEqual(next.order, ['itinerary', 'budget', 'links', 'notes']);
  assert.equal(next.sizes.itinerary.columns, 12);
  assert.equal(next.sizes.budget.columns, 12);
  assert.equal(next.sizes.notes.columns, 12);
  assert.ok(parseLayout(next));
  assert.equal(JSON.stringify(components), before);
  assert.deepEqual(reconcileLayout(next, components), next);
  assert.ok(Object.values(requestedLayout(components, 320).sizes).every(size => size.columns === 12));
});

test('lessons use a continuous reading column without dashboard gaps at every breakpoint',()=>{
 const components=[component('path','timeline'),component('explanation','notes'),component('cards','flashcards'),component('practice','checklist'),component('quiz','quiz')];
 const original=JSON.stringify(components);
 for(const width of [320,768,1050,1600]){
  const layout=automaticLayout(components,width);
  assert.deepEqual(layout.order,components.map(c=>c.id));
  if(width<880)assert.ok(Object.values(layout.sizes).every(size=>size.columns===12));
  else {assert.equal(layout.sizes.explanation.columns,12);assert.equal(layout.sizes.cards.columns,6);assert.equal(layout.sizes.practice.columns,6);assert.equal(layout.sizes.quiz.columns,12);}
  assert.ok(parseLayout(layout));
 }
 assert.equal(JSON.stringify(components),original);
 const fixed=automaticLayout(components);fixed.mode='fixed';fixed.sizes.quiz={columns:6,minHeight:320};
 assert.deepEqual(reconcileLayout(fixed,components).sizes.quiz,{columns:6,minHeight:320});
});

test('column presets change geometry and survive saved-layout reconciliation',()=>{
 const components=[component('a','notes'),component('b','quiz'),component('c','checklist')];
 for(const columns of [1,2,3] as const){
  const layout=columnLayout(components,columns);
  assert.ok(Object.values(layout.sizes).every(size=>size.columns===12/columns));
  assert.equal(layout.mode,'fixed');
  assert.deepEqual(reconcileLayout(parseLayout(JSON.parse(JSON.stringify(layout)))!,components),layout);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type { UIComponent } from '../lib/schema';
import { automaticLayout, columnLayout, parseLayout, reconcileLayout } from '../lib/workspace-layout';

const component = (id: string, type: UIComponent['type'] = 'chart'): UIComponent => ({ id, type, title: id, reason: '', span: 'normal', items: [] });

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

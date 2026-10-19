import {test,expect,type Page} from '@playwright/test';

const mode=(page:Page)=>page.getByRole('combobox',{name:/Layout mode|מצב סידור/,includeHidden:true});
const card=(page:Page,title:string)=>page.locator('.r-card').filter({has:page.getByRole('heading',{name:title,exact:true})});
async function action(page:Page,title:string,name:string){const target=card(page,title);if(!await target.locator('.card-layout-options').evaluate(el=>el.hasAttribute('open')))await target.getByLabel(`Layout options for ${title}`).click();await target.getByRole('button',{name,exact:true}).click();}
async function setMode(page:Page,value:string){const settings=page.locator('.layout-settings');if(!await settings.evaluate(el=>el.hasAttribute('open')))await settings.locator('summary').click();await mode(page).selectOption(value);}
async function saved(page:Page){return page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('shadowui.v1')!);return JSON.parse(localStorage.getItem(`shadowui.layout.v1:${state.active}`)!);});}
async function geometry(page:Page){await expect.poll(async()=>{if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))return false;const boxes=await page.locator('.r-card:visible').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(!(a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1))return false;}return true;}).toBe(true);}

test('all learning tools are open and edits survive return and reload without layout changes',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();
 await expect(page.getByRole('navigation',{name:/Choose a tool|בחירת כלי/})).toHaveCount(0);await expect(page.locator('.adaptive-next')).toHaveCount(0);
 for(const title of ['Your learning path','Focus session','Active recall','Check your understanding'])await expect(card(page,title)).toBeVisible();
 const before=await page.locator('.r-card').evaluateAll(els=>els.map(el=>el.querySelector('h3')?.textContent));
 await page.getByRole('checkbox').first().check();
 expect(await page.locator('.r-card').evaluateAll(els=>els.map(el=>el.querySelector('h3')?.textContent))).toEqual(before);
 const title=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('shadowui.v1')!);return s.workspaces.find((w:{id:string})=>w.id===s.active).title;});
 await page.reload();await expect(page.getByRole('checkbox').first()).toBeChecked();await page.getByRole('button',{name:/New workspace/}).click();await page.getByRole('button',{name:title,exact:true}).click();await expect(page.getByRole('checkbox').first()).toBeChecked();await expect(card(page,'Focus session')).toBeVisible();
});

test('manual ordering and dimensions persist and automatic reset restores planned order',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();await expect(mode(page)).toHaveValue('auto');
 const original=await page.locator('.r-card').evaluateAll(els=>els.map(el=>el.querySelector('h3')?.textContent));
 await action(page,'Your learning path','Move later');await expect(mode(page)).toHaveValue('fixed');
 await action(page,'Your learning path','Wider');await action(page,'Your learning path','Taller');const layout=await saved(page);expect(layout.mode).toBe('fixed');
 const order=await page.locator('.r-card').evaluateAll(els=>els.map(el=>el.querySelector('h3')?.textContent));expect(order).not.toEqual(original);
 await page.reload();expect(await saved(page)).toEqual(layout);expect(await page.locator('.r-card').evaluateAll(els=>els.map(el=>el.querySelector('h3')?.textContent))).toEqual(order);
 await setMode(page,'auto');expect(await page.locator('.r-card').evaluateAll(els=>els.map(el=>el.querySelector('h3')?.textContent))).toEqual(original);
 await setMode(page,'fixed');await page.getByRole('button',{name:/Reset layout|איפוס סידור/}).click();await expect(mode(page)).toHaveValue('auto');await geometry(page);
});

test('running timer retains activity during reorder and resize',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();await page.getByLabel('Focus duration').fill('1');await page.getByRole('button',{name:'Start focus'}).click();await action(page,'Focus session','Move earlier');await action(page,'Focus session','Taller');await expect(page.locator('.r-timer strong')).not.toHaveText('01:00',{timeout:4000});await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
});

test('budget feedback lives in related tools without an extra next-step panel',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Go somewhere new/}).click();await page.getByRole('spinbutton',{name:'Budget ceiling exact value'}).fill('900');await page.getByLabel('Accommodation',{exact:true}).fill('450');await expect(page.locator('.r-dependency:visible')).toContainText('50 over budget');await expect(page.locator('.adaptive-next')).toHaveCount(0);await expect(card(page,'Budget ceiling')).toBeVisible();await expect(card(page,'Cost breakdown')).toBeVisible();
});

test('legacy selection is ignored and conditional tools appear and disappear directly',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('shadowui.v1',JSON.stringify({active:'conditional',workspaces:[{id:'conditional',title:'Conditional tools',goal:'Review a proposal',description:'Test conditional tools',components:[{id:'approval',type:'approval',title:'Review proposal',reason:'Confirm first',items:[],value:0},{id:'details',type:'notes',title:'Approved details',reason:'Shown after confirmation',items:[],text:'Approved context',visibleWhen:{componentId:'approval',completed:true}}]}]}));localStorage.setItem('shadowui.view.v1:conditional','removed-tool');localStorage.setItem('shadowui.layout.v1:conditional','invalid JSON');});
 await page.goto('/');await expect(mode(page)).toHaveValue('auto');await expect(page.locator('.r-card:visible')).toHaveCount(1);await page.getByRole('button',{name:'Confirm local plan'}).click();await expect(page.getByRole('textbox',{name:'Approved details'})).toBeVisible();await expect(page.locator('.r-card:visible')).toHaveCount(2);await page.getByRole('button',{name:'Confirmed locally · Undo'}).click();await expect(page.locator('.r-card:visible')).toHaveCount(1);
});

for(const count of [1,2,6,16])test(`${count} dynamic tools fit desktop and 320px RTL in both themes`,async({page})=>{
 await page.addInitScript(n=>{localStorage.setItem('shadowui.v1',JSON.stringify({active:'many',workspaces:[{id:'many',title:'Many tools',goal:'Organize all my work',description:'A responsive dynamic workspace',components:Array.from({length:n},(_,i)=>({id:`tool-${i}`,type:i%3===0?'table':'notes',title:`Useful tool ${i+1}`,reason:'Relevant context',span:i%3===0?'wide':'normal',text:'Long useful content '.repeat(30),items:i%3===0?[{id:'row',label:'A long descriptive table item that should stay inside its own card',detail:'Table detail '.repeat(12),value:20}]:[]}))}]}));},count);
 await page.goto('/');await expect(page.locator('.r-card:visible')).toHaveCount(count);await geometry(page);await page.setViewportSize({width:320,height:800});await page.getByRole('button',{name:'Toggle language direction'}).click();await expect(page.locator('.shell')).toHaveAttribute('dir','rtl');
 for(let theme=0;theme<2;theme++){await geometry(page);const options=page.getByLabel(/(?:Layout options for|אפשרויות סידור עבור) Useful tool 1$/);await options.focus();await page.keyboard.press('Enter');await expect(card(page,'Useful tool 1').getByRole('button',{name:/^(Move later|הזזה קדימה)$/})).toBeVisible();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Toggle color theme'}).click();}
});

test('pointer handles reorder and resize cards without losing entered work',async({page})=>{
 await page.setViewportSize({width:1440,height:1400});await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();await page.getByRole('checkbox').first().check();
 const handle=page.getByRole('button',{name:'Move Your learning path',exact:true});const target=await card(page,'A plan that fits').boundingBox();const from=await handle.boundingBox();expect(from).not.toBeNull();expect(target).not.toBeNull();
 await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(target!.x+target!.width/2,target!.y+target!.height/2,{steps:12});await page.mouse.up();await expect(mode(page)).toHaveValue('fixed');
 const before=await saved(page);const resize=await page.getByRole('button',{name:'Resize Your learning path',exact:true}).boundingBox();expect(resize).not.toBeNull();await page.mouse.move(resize!.x+resize!.width/2,resize!.y+resize!.height/2);await page.mouse.down();await page.mouse.move(resize!.x+resize!.width/2+180,resize!.y+resize!.height/2+100,{steps:12});await page.mouse.up();expect(await saved(page)).not.toEqual(before);await expect(page.getByRole('checkbox').first()).toBeChecked();await geometry(page);
});

for(const width of [1024,1440])test(`dynamic layout uses readable card widths at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1200});await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();await geometry(page);const widths=await page.locator('.r-card:visible').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));expect(Math.min(...widths)).toBeGreaterThanOrEqual(270);
});

for(const type of ['notes','timer','table'])test(`a lone ${type} uses its natural desktop width`,async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.addInitScript(kind=>{localStorage.setItem('shadowui.v1',JSON.stringify({active:'single',workspaces:[{id:'single',title:'Single tool',description:'One relevant tool',goal:'Work on one thing',components:[{id:'single-tool',type:kind,title:'My tool',reason:'Useful work',items:[],text:'A short note',value:25,span:'wide'}]}]}));},type);await page.goto('/');await expect(page.locator('.r-card')).toHaveCount(1);await geometry(page);const width=await page.locator('.r-card').evaluate(el=>el.getBoundingClientRect().width);const available=await page.locator('.r-grid').evaluate(el=>el.getBoundingClientRect().width);if(type==='table')expect(width).toBeGreaterThan(available*.95);else expect(width).toBeLessThan(available*.9);
});

test('demo notes and checklist share a desktop row when their content fits',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.goto('/');const history=page.getByLabel('היסטוריית שיחות דמו');await history.getByRole('button').last().click();await expect(page.locator('.demo-conversation .r-card')).not.toHaveCount(0);await geometry(page);const notes=page.locator('.demo-conversation .r-card.tool-notes');const checklist=page.locator('.demo-conversation .r-card.tool-checklist');await expect(notes).toHaveCount(1);await expect(checklist).toHaveCount(1);await expect.poll(async()=>{const n=await notes.boundingBox(),c=await checklist.boundingBox();return !!n&&!!c&&Math.abs(n.y-c.y)<2;}).toBe(true);
});

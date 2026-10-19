import {test,expect,type Page} from '@playwright/test';

const views=(page:Page)=>page.getByRole('navigation',{name:/Choose a tool|בחירת כלי/});
const tool=async(page:Page,title:string)=>views(page).getByRole('button',{name:new RegExp(title)}).click();

test('one tool stays selected while edits update suggestions; selection and work survive return and reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();
 await expect(page.locator('.r-card:visible')).toHaveCount(1);
 const next=page.locator('.adaptive-next');await expect(next).toContainText('Review cell structure');
 await page.getByRole('checkbox').first().check();await expect(next).toContainText('Understand mitosis and meiosis');
 await expect(views(page).getByRole('button',{name:/Your learning path/})).toHaveAttribute('aria-pressed','true');
 await tool(page,'Focus session');
 await expect(page.getByRole('button',{name:'Start focus'})).toBeVisible();await expect(page.getByRole('checkbox').first()).not.toBeVisible();
 const saved=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('shadowui.v1')!);return {id:state.active,title:state.workspaces.find((w:{id:string})=>w.id===state.active).title,focus:localStorage.getItem(`shadowui.view.v1:${state.active}`)}});
 expect(saved.focus).toBe('timer');
 await page.reload();await expect(views(page).getByRole('button',{name:/Focus session/})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:/New workspace/}).click();await page.getByRole('button',{name:saved.title,exact:true}).click();
 await expect(page.getByRole('button',{name:'Start focus'})).toBeVisible();
 await tool(page,'Your learning path');await expect(page.getByRole('checkbox').first()).toBeChecked();
 await expect(page.locator('.r-card:visible')).toHaveCount(1);
});

test('running timer retains elapsed time while another tool is open',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();await tool(page,'Focus session');
 await page.getByLabel('Focus duration').fill('1');await page.getByRole('button',{name:'Start focus'}).click();
 await tool(page,'Your learning path');await expect(page.locator('.r-timer strong')).not.toHaveText('01:00',{timeout:4000});
 await tool(page,'Focus session');await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await expect(page.locator('.r-timer strong')).not.toHaveText('01:00');
});

test('budget suggestions update without switching the active tool',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Go somewhere new/}).click();await tool(page,'Budget ceiling');
 await page.getByRole('spinbutton',{name:'Budget ceiling exact value'}).fill('900');
 await expect(page.locator('.adaptive-next')).toContainText('Costs exceed your budget');
 await tool(page,'Cost breakdown');await page.getByLabel('Accommodation',{exact:true}).fill('450');
 await expect(page.locator('.r-dependency:visible')).toContainText('50 over budget');
 await expect(views(page).getByRole('button',{name:/Cost breakdown/})).toHaveAttribute('aria-pressed','true');
 await page.locator('.adaptive-next').getByRole('button').click();
 await page.getByRole('spinbutton',{name:'Budget ceiling exact value'}).fill('1500');
 await expect(page.locator('.adaptive-next')).not.toContainText('Costs exceed your budget');
});

test('hidden or removed selection falls back to the first available tool',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('shadowui.v1',JSON.stringify({active:'conditional',workspaces:[{id:'conditional',title:'Conditional tools',goal:'Review a proposal',description:'Test conditional tools',components:[{id:'approval',type:'approval',title:'Review proposal',reason:'Confirm first',items:[],value:0},{id:'details',type:'notes',title:'Approved details',reason:'Shown after confirmation',items:[],text:'Approved context',visibleWhen:{componentId:'approval',completed:true}}]}]}));
  localStorage.setItem('shadowui.view.v1:conditional','removed-tool');
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'Confirm local plan'})).toBeVisible();
 await expect(page.locator('.r-card:visible')).toHaveCount(1);
 await page.getByRole('button',{name:'Confirm local plan'}).click();await tool(page,'Approved details');
 await expect(page.getByRole('textbox',{name:'Approved details'})).toBeVisible();
 await tool(page,'Review proposal');await page.getByRole('button',{name:'Confirmed locally · Undo'}).click();
 await expect(views(page).getByRole('button',{name:/Approved details/})).toHaveCount(0);
 await expect(page.locator('.r-card:visible')).toHaveCount(1);
});

test('tool navigation works by keyboard at 320px in both themes and RTL',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();
 await page.getByRole('button',{name:'Toggle language direction'}).click();await expect(page.locator('.shell')).toHaveAttribute('dir','rtl');
 for(let theme=0;theme<2;theme++){
  const timer=views(page).getByRole('button',{name:/Focus session/});await timer.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Start focus'})).toBeVisible();await expect(timer).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await views(page).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Toggle color theme'}).click();
 }
});

import {test,expect} from '@playwright/test';

test('invalid model specification stays behind validation boundary',async({page})=>{
 await page.goto('/');
 await page.route('**/api/plan',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'live',operation:'create',workspace:{id:'bad',title:'Bad response',goal:'test',description:'test',components:[{id:'execute',type:'javascript',title:'Execute',reason:'unsafe',items:[]}]}})}));
 await page.getByLabel('What do you want to accomplish?').fill('Organize a neighborhood seed exchange');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('.error[role=alert]')).toBeVisible();
 await expect(page.getByRole('heading',{name:/Work changes/})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shadowui.v1')!).workspaces.length)).toBe(0);
});

test('unsupported execution offers functional local alternative without receipt',async({page})=>{
 await page.goto('/');await page.getByLabel('What do you want to accomplish?').fill('Transfer money from my bank account and book a flight');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.getByRole('heading',{name:'Capability boundary'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Capability boundary'})).toHaveValue(/I cannot execute that external action/);
 await expect(page.getByText('Verified backend receipt')).not.toBeVisible();
 await page.getByRole('checkbox').first().check();await expect(page.getByRole('checkbox').first()).toBeChecked();
});

test('stale user session refreshes authoritative data instead of overwriting',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Build a conflict-free week/}).click();await expect(page.getByRole('heading',{name:'Give every shift the right person.'})).toBeVisible();
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('shadowui.v1')!).active);
 const response=await page.request.post('/api/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'update_schedule',arguments:{id,expectedRevision:0,actionId:crypto.randomUUID(),operation:{type:'set_min_days_off',value:4}}}}});
 expect((await response.json()).result.isError).toBe(false);
 await page.getByLabel('Minimum days off').selectOption('3');
 await expect(page.getByText('The schedule changed in another session. Latest revision loaded; review before trying again.')).toBeVisible();
 await expect(page.getByLabel('Minimum days off')).toHaveValue('4');
 await expect(page.locator('.sx-revision')).toContainText('REV 1');
});

test('hero stays usable on a narrow viewport and in RTL direction',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:/Build a conflict-free week/}).click();await expect(page.getByRole('heading',{name:'Give every shift the right person.'})).toBeVisible();
 await page.getByRole('button',{name:'Toggle language direction'}).click();await expect(page.locator('.shell')).toHaveAttribute('dir','rtl');
 await page.getByLabel('Availability date').fill('2026-10-21');await page.getByRole('button',{name:'Mark unavailable',exact:true}).click();
 await expect(page.locator('.sx-experience')).toHaveAttribute('data-interaction-model','resolution');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.sx-alternative button').first()).toBeInViewport();
});

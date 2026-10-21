import {activeWorkspace,guestWorkspaces} from './helpers/storage';
import {test,expect} from '@playwright/test';
import type {Schedule} from '../../lib/schedule';

test('invalid model specification stays behind validation boundary',async({page})=>{
 let posts=0;
 await page.route('**/api/plan',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,liveEnabled:true,simulation:false}});
  posts++;return route.fulfill({json:{mode:'live',operation:'create',workspace:{id:'bad',title:'Bad response',goal:'test',description:'test',components:[{id:'execute',type:'javascript',title:'Execute',reason:'unsafe',items:[]}]}}});
 });
 await page.goto('/');
 await page.getByLabel('What do you want to accomplish?').fill('Organize a neighborhood seed exchange');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('.error[role=alert]')).toBeVisible();
 await expect(page.getByRole('heading',{name:/Work changes/})).toBeVisible();
 expect(await guestWorkspaces(page).then(workspaces=>workspaces.length)).toBe(0);expect(posts).toBe(1);
});

test('unsupported execution offers functional local alternative without receipt',async({page})=>{
 await page.goto('/');await page.getByLabel('What do you want to accomplish?').fill('Transfer money from my bank account and book a flight');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.getByRole('status').filter({hasText:'No paid AI calls'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Goal and inputs',exact:true})).toHaveValue('Transfer money from my bank account and book a flight');
 await expect(page.getByText('Verified backend receipt')).not.toBeVisible();
 await page.getByRole('textbox',{name:'Add item',exact:true}).fill('Prepare a manual review without sending a payment');
 await page.getByRole('button',{name:'Add item',exact:true}).click();
 await page.getByRole('checkbox').first().check();await expect(page.getByRole('checkbox').first()).toBeChecked();
 await page.reload();await expect(page.getByRole('checkbox').first()).toBeChecked();
});

test('stale user session refreshes authoritative data instead of overwriting',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Organize a working week/}).click();await expect(page.getByRole('heading',{name:/^Shifts ·/})).toBeVisible();
 const id=(await activeWorkspace(page)).domain!.id;
 const response=await page.request.post('/api/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'update_schedule',arguments:{id,expectedRevision:0,actionId:crypto.randomUUID(),operation:{type:'set_min_days_off',value:4}}}}});
 expect((await response.json()).result.isError).toBe(false);
 await page.getByLabel('Minimum days off').selectOption('3');
 await expect(page.getByText('The schedule changed in another session. Latest revision loaded; review before trying again.')).toBeVisible();
 await expect(page.getByLabel('Minimum days off')).toHaveValue('4');
 await expect(page.locator('.sx-revision')).toContainText('REV 1');
});

test('hero stays usable on a narrow viewport and in RTL direction',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:/Organize a working week/}).click();await expect(page.getByRole('heading',{name:/^Shifts ·/})).toBeVisible();
 await page.getByRole('button',{name:'Toggle language direction'}).click();await expect(page.locator('.shell')).toHaveAttribute('dir','rtl');
 const id=(await activeWorkspace(page)).domain!.id;
 const response=await page.request.post('/api/mcp',{data:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'inspect_schedule',arguments:{id}}}});
 const schedule:Schedule=(await response.json()).result.structuredContent.schedule;
 const shift=schedule.shifts.find(item=>item.employeeId)!;
 await page.getByLabel('Availability employee').selectOption(shift.employeeId!);
 await page.getByLabel('Availability date').fill(shift.date);await page.getByRole('button',{name:'Mark unavailable',exact:true}).click();
 await expect(page.locator('.sx-experience')).toHaveAttribute('data-interaction-model','resolution');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.sx-alternative button').first()).toBeInViewport();
});

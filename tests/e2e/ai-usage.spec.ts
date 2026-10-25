import {test,expect} from '@playwright/test';

test('budget metadata stays out of the interface while replies work at 320px RTL',async({page})=>{
 await page.setViewportSize({width:320,height:900});let posts=0;
 await page.route('**/api/plan',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{liveEnabled:true,simulation:false,configured:true,storageReady:true,spent:.56446778,limit:1}});
  posts++;return route.fulfill({json:{operation:'reply',intent:'conversation',explanation:'Mocked reply without any provider call',mode:'live',budget:{spent:.6,limit:1,warning:false}}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Toggle language direction'}).click();
 await page.getByLabel('What do you want to accomplish?').fill('שלום');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('#request-status')).toContainText('Mocked reply without any provider call');expect(posts).toBe(1);
 await expect(page.locator('.home-usage,.ai-usage')).toHaveCount(0);await expect(page.getByText('$0.6000',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unavailable budget storage blocks requests without displaying invented usage',async({page})=>{
 let posts=0;
 await page.route('**/api/plan',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{liveEnabled:true,simulation:false,configured:true,storageReady:false,spent:0,limit:1}});
  posts++;return route.abort();
 });
 await page.goto('/');await page.getByRole('button',{name:'Toggle language direction'}).click();
 await page.getByLabel('What do you want to accomplish?').fill('שלום');await expect(page.getByRole('button',{name:'Build workspace'})).toBeDisabled();
 await page.getByLabel('What do you want to accomplish?').press('Enter');await expect(page.locator('.error[role=alert]')).toContainText('אינו זמין');expect(posts).toBe(0);
 await expect(page.locator('.home-usage,.ai-usage')).toHaveCount(0);await expect(page.getByText('$0.0000',{exact:true})).toHaveCount(0);
});

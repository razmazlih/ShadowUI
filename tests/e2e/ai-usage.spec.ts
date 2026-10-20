import {test,expect} from '@playwright/test';

test('app-wide usage shows spent and remaining, updates after a reply, and refreshes at 320px RTL',async({page})=>{
 await page.setViewportSize({width:320,height:900});let spent=.56446778;
 await page.route('**/api/plan',route=>route.request().method()==='GET'?route.fulfill({json:{liveEnabled:true,simulation:false,configured:true,storageReady:true,spent,limit:1}}):route.fulfill({json:{operation:'reply',intent:'conversation',explanation:'Mocked reply without any provider call',mode:'live',budget:{spent:.6,limit:1,warning:false}}}));
 await page.goto('/');const usage=page.getByRole('region',{name:'שימוש ב־OpenAI API'});
 await expect(usage).toContainText('$0.5645');await expect(usage).toContainText('$0.4355');await expect(usage).toContainText('$1.00');await expect(usage).toContainText('לכל האפליקציה');
 await page.getByLabel('What do you want to accomplish?').fill('שלום');await page.getByRole('button',{name:'Build workspace'}).click();await expect(usage).toContainText('$0.6000');await expect(usage).toContainText('$0.4000');
 spent=1.02;await usage.getByRole('button',{name:'רענון שימוש'}).click();await expect(usage).toContainText('$1.0200');await expect(usage).toContainText('$0.0000');await expect(usage.getByRole('status')).toContainText('תקרת התקציב הושגה');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unavailable budget data does not claim zero usage',async({page})=>{
 await page.route('**/api/plan',route=>route.fulfill({json:{liveEnabled:true,simulation:false,configured:true,storageReady:false,spent:0,limit:1}}));
 await page.goto('/');const usage=page.getByRole('region',{name:'שימוש ב־OpenAI API'});await expect(usage).toContainText('נתוני השימוש אינם זמינים');await expect(usage).not.toContainText('$0.0000');
});

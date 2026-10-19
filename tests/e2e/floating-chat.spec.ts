import {test,expect,type Page} from '@playwright/test';

async function openWorkspace(page:Page){
 await page.addInitScript(()=>localStorage.setItem('shadowui.v1',JSON.stringify({active:'floating-chat',workspaces:[{id:'floating-chat',title:'Assistant workspace',goal:'Keep my notes',description:'A workspace with a conversation',components:[{id:'notes',type:'notes',title:'Working notes',reason:'Keep working while chatting',items:[],text:'Original notes'}]}],conversations:{'floating-chat':[{role:'user',content:'Keep this earlier request'},{role:'assistant',content:'Your earlier answer is still here.'}]}})));
 await page.route('**/api/plan',route=>route.fulfill({json:route.request().method()==='GET'?{configured:true,storageReady:true,spent:0,limit:1}:{operation:'reply',intent:'workspace_question',explanation:'Your new answer appears in this assistant.',mode:'live'}}));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Assistant workspace'})).toBeVisible();
 const launcher=page.getByRole('button',{name:'Open assistant',exact:true});
 if(await launcher.isVisible())await launcher.click();
 return page.getByRole('region',{name:'ShadowUI assistant'});
}

test('floating assistant keeps conversation and draft through expand, compact, and minimize',async({page})=>{
 const assistant=await openWorkspace(page);
 await expect(assistant).toBeVisible();
 await expect(assistant).toContainText('Keep this earlier request');
 await expect(assistant).toContainText('Your earlier answer is still here.');
 const input=page.getByLabel('What do you want to accomplish?');
 await input.fill('A draft that should stay here');
 const compact=await assistant.boundingBox();
 await page.getByRole('button',{name:'Expand assistant',exact:true}).click();
 await expect(page.getByRole('button',{name:'Compact assistant',exact:true})).toBeVisible();
 await expect.poll(async()=>{const expanded=await assistant.boundingBox();return !!expanded&&!!compact&&expanded.height>compact.height;}).toBe(true);
 await page.getByRole('button',{name:'Compact assistant',exact:true}).click();
 await page.getByRole('button',{name:'Minimize assistant',exact:true}).click();
 await expect(input).not.toBeVisible();
 await page.getByRole('textbox',{name:'Working notes',exact:true}).fill('Notes remain usable with the assistant minimized');
 await page.getByRole('button',{name:'Open assistant',exact:true}).click();
 await expect(input).toHaveValue('A draft that should stay here');
 await expect(assistant).toContainText('Your earlier answer is still here.');
 await expect(page.getByRole('textbox',{name:'Working notes',exact:true})).toHaveValue('Notes remain usable with the assistant minimized');
 await page.getByRole('button',{name:'Build workspace',exact:true}).click();
 await expect(assistant.getByRole('log')).toContainText('Your new answer appears in this assistant.');
 await expect(assistant.getByRole('log')).toContainText('Keep this earlier request');
 await expect(input).toHaveValue('');
 await page.screenshot({path:'output/playwright/floating-assistant-desktop.png'});
});

test('assistant fits 320px in compact, expanded, minimized and RTL states',async({page})=>{
 await page.setViewportSize({width:320,height:800});
 const assistant=await openWorkspace(page);
 const fits=async()=>{
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const box=await assistant.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(321);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(801);
 };
 await fits();
 await page.getByRole('button',{name:'Expand assistant',exact:true}).click();await fits();
 await page.screenshot({path:'output/playwright/floating-assistant-mobile-expanded.png'});
 await page.getByRole('button',{name:'Compact assistant',exact:true}).click();
 await page.getByRole('button',{name:'Toggle language direction'}).click();await fits();
 await page.getByRole('button',{name:'Minimize assistant',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open assistant',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

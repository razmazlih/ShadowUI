import {test,expect} from '@playwright/test';

test('all demo transcripts open without network actions or touching saved work',async({page})=>{
 const requests:string[]=[];
 page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url())});
 await page.addInitScript(()=>localStorage.setItem('shadowui.v1',JSON.stringify({workspaces:[{id:'existing-user-work',title:'Existing work',description:'Keep this',goal:'Keep my notes',components:[{id:'notes',type:'notes',title:'Notes',reason:'User content',span:'wide',items:[],text:'Do not change'}]}],active:'existing-user-work'})));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Existing work'})).toBeVisible();
 const before=await page.evaluate(()=>localStorage.getItem('shadowui.v1'));
 const history=page.getByLabel('היסטוריית שיחות דמו');
 await expect(history.getByRole('button')).toHaveCount(10);
 for(let i=0;i<10;i++){
  await history.getByRole('button').nth(i).click();
  await expect(page.getByRole('heading',{name:'התוצר שלכם'})).toBeVisible();
  await expect(page.locator('.demo-transcript')).not.toHaveAttribute('open','');
  await expect(page.locator('.r-card:visible')).toHaveCount(1);
  expect(await page.locator('.demo-transcript').evaluate(el=>!!el.previousElementSibling?.querySelector('.r-card'))).toBe(true);
  await page.locator('.demo-transcript > summary').click();
  await expect(page.locator('.demo-message').first()).toContainText('אתם');
  await expect(page.locator('.demo-message').last()).toContainText('ShadowUI');
  await expect(page.locator('.demo-end')).toBeVisible();
 }
 expect(requests).toEqual([]);
 expect(await page.evaluate(()=>localStorage.getItem('shadowui.v1'))).toBe(before);
 await page.screenshot({path:'work/demo-desktop.png'});
 await page.getByLabel('AI planning mode').selectOption('live');
 await expect(history).toHaveCount(0);
 await expect(page.locator('.demo-conversation')).toHaveCount(0);
 await page.getByLabel('AI planning mode').selectOption('demo');
 await expect(history.getByRole('button')).toHaveCount(10);
});

test('mobile history closes on selection and transcript fits viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByLabel('Toggle navigation').click();
 await page.getByLabel('היסטוריית שיחות דמו').getByRole('button').last().click();
 await expect(page.locator('.sidebar')).not.toBeVisible();
 await expect(page.getByRole('heading',{name:'מפגישה לחבילת עבודה'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await expect(page.locator('.demo-message')).toHaveCount(6);
 await expect(page.locator('.demo-message').first()).not.toBeVisible();
 await page.locator('.demo-transcript > summary').click();
 await expect(page.locator('.demo-message').first()).toBeVisible();
 await page.screenshot({path:'work/demo-mobile.png'});
});

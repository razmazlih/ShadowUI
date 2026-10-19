import {test,expect} from '@playwright/test';

test('real configured database serves catalog and blocks unauthenticated writes',async({page,request})=>{
 test.skip(process.env.CATALOG_LIVE_DB_TEST!=='1','Explicitly opt in to reading the configured real catalog.');
 const response=await request.get('/api/catalog');expect(response.status()).toBe(200);const data=await response.json();expect(data.storageReady).toBe(true);expect(data.definitions.length).toBeGreaterThanOrEqual(16);expect(data.definitions.every((d:{scope:string})=>d.scope==='shared')).toBeTruthy();
 expect((await request.post('/api/catalog',{data:{}})).status()).toBe(403);
 await page.goto('/catalog');await expect(page.getByRole('article')).toHaveCount(data.definitions.length);
 await page.getByRole('searchbox',{name:'חיפוש במאגר'}).fill('calculator');await expect(page.getByRole('article')).toHaveCount(1);await page.getByRole('button',{name:'בדיקה ותצוגה מקדימה'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('spinbutton',{name:'Quantity'}).fill('3');await dialog.getByRole('spinbutton',{name:'Unit value'}).fill('7');await expect(dialog.getByText('21',{exact:true})).toBeVisible();await page.screenshot({path:'output/playwright/catalog-verified-calculation.png'});
 await page.keyboard.press('Escape');await page.getByRole('searchbox',{name:'חיפוש במאגר'}).fill('');await page.screenshot({path:'output/playwright/catalog-firestore-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:780});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'output/playwright/catalog-firestore-mobile.png',fullPage:true});
});

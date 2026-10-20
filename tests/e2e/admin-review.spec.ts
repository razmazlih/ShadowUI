import {test,expect} from '@playwright/test';

test('review dashboard explains authentication and remains usable at 320px RTL',async({page})=>{
 const paidRequests:string[]=[];
 page.on('request',request=>{if(request.method()==='POST'&&(/api\.openai\.com|\/api\/(?:plan|embed|generate)(?:[/?]|$)/.test(request.url())))paidRequests.push(request.url());});
 await page.setViewportSize({width:320,height:900});
 await page.goto('/admin/components');
 const main=page.getByRole('main');
 await expect(main).toHaveAttribute('dir','rtl');
 await expect(main).toHaveAttribute('lang','he');
 await expect(page.getByRole('heading',{name:'כניסת מנהל',exact:true})).toBeVisible();
 await expect(page.getByText('הצגת התור ושמירת החלטות דורשות חשבון מנהל מאומת בשרת.')).toBeVisible();
 await expect(page.getByText('עריכת שפה טבעית פועלת בהדמיה · ללא קריאת מודל')).toBeVisible();
 await expect(page.getByRole('button',{name:'אישור ושיתוף הגרסה השמורה'})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const header=await page.locator('.review-header').boundingBox(),intro=await page.locator('.review-intro').boundingBox();
 expect(header&&intro&&header.y+header.height<=intro.y+1).toBe(true);
 await page.screenshot({path:'/tmp/shadowui-admin-review-mobile.png',fullPage:true,animations:'disabled'});
 const catalog=page.getByRole('link',{name:'מאגר הרכיבים'});
 await catalog.focus();
 await expect(catalog).toBeFocused();
 await catalog.press('Enter');
 await expect(page).toHaveURL(/\/catalog$/);
 expect(paidRequests).toEqual([]);
});

test('review API rejects unauthenticated listing and every mutation',async({request})=>{
 const listing=await request.get('/api/admin/components');
 expect(listing.status()).toBe(403);
 const listBody=await listing.json();
 expect(listBody).not.toHaveProperty('candidates');
 for(const action of ['approve','reject','changes_requested','edit','propose']){
  const response=await request.post('/api/admin/components/not-a-real-candidate',{data:{action,expectedVersion:1,reason:'Synthetic unauthorized test',instruction:'compact',syntheticDataConfirmed:true}});
  expect(response.status()).toBe(403);
  expect(await response.json()).not.toHaveProperty('candidate');
 }
});

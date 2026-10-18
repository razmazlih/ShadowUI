import {test,expect} from '@playwright/test';
test('adaptive views preserve edits and suggest the next incomplete task',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Learn something deeply/}).click();
 const next=page.locator('.adaptive-next');await expect(next).toContainText('Review cell structure');
 await page.getByRole('checkbox').first().check();await expect(next).toContainText('Understand mitosis and meiosis');
 const views=page.getByRole('navigation',{name:'Workspace views'});await views.getByRole('button',{name:'Focus timer',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start focus'})).toBeVisible();await expect(page.getByRole('checkbox').first()).not.toBeVisible();
 await views.getByRole('button',{name:'All tools',exact:true}).click();await expect(page.getByRole('checkbox').first()).toBeChecked();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Toggle language direction'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('budget warnings adapt to directly edited amounts',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Go somewhere new/}).click();
 await page.getByRole('spinbutton',{name:'Budget ceiling exact value'}).fill('900');
 await expect(page.locator('.adaptive-next')).toContainText('100 over your budget');
 await page.locator('.adaptive-next').getByRole('button').click();
 await expect(page.getByRole('spinbutton',{name:'Budget ceiling exact value'})).toBeVisible();
 await page.getByRole('spinbutton',{name:'Budget ceiling exact value'}).fill('1500');
 await expect(page.locator('.adaptive-next')).not.toContainText('over your budget');
});

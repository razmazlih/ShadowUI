import {test,expect} from '@playwright/test';
import {seedDefinitions} from '../../lib/catalog';
const definitions=seedDefinitions();
test('catalog browses persisted definitions, filters, and previews real editable controls',async({page})=>{
 await page.route('**/api/catalog',route=>route.fulfill({json:{definitions,storageReady:true,admin:false}}));
 await page.route('**/api/catalog/*',route=>{const definition=definitions.find(d=>route.request().url().endsWith(`/${d.id}`));return route.fulfill({json:{definition,revisions:[{definition,validation:{valid:true,errors:[]},changedAt:definition?.updatedAt}]}});});
 await page.goto('/catalog');
 await expect(page.getByRole('heading',{level:1})).toContainText('הכלי הנכון');
 await expect(page.getByRole('article')).toHaveCount(definitions.length);
 await page.getByRole('searchbox',{name:'חיפוש במאגר'}).fill('weighted');
 await expect(page.getByRole('article')).toHaveCount(1);
 await page.getByRole('button',{name:'בדיקה ותצוגה מקדימה'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('table')).toBeVisible();
 await dialog.getByRole('spinbutton',{name:'Option A score for Fit'}).fill('75');
 await expect(dialog.getByText('75.0/100')).toBeVisible();
 await page.getByRole('tab',{name:'היסטוריית גרסאות'}).click();
 await expect(dialog.getByText('גרסה 1 · פעיל',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'חזרה לגרסה זו'})).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('button',{name:'בדיקה ותצוגה מקדימה'})).toBeFocused();
 await page.setViewportSize({width:320,height:720});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('catalog reports unavailable database without showing fictional seed data',async({page})=>{
 await page.route('**/api/catalog',route=>route.fulfill({status:503,json:{error:'Catalog storage unavailable: configure Firebase server credentials.'}}));
 await page.goto('/catalog');await expect(page.locator('.cat-error[role=alert]')).toContainText('Catalog storage unavailable');await expect(page.getByRole('article')).toHaveCount(0);
 await expect(page.getByText('המאגר אינו זמין כרגע.')).toBeVisible();
});

import {expect,type Page} from '@playwright/test';

export async function openDisplay(page:Page){
 const settings=page.locator('.layout-settings');
 if(!await settings.evaluate(element=>(element as HTMLDetailsElement).open))await settings.locator('summary').click();
 await expect(settings.locator('.layout-settings-panel')).toBeVisible();
 return settings;
}

export async function selectPresentation(page:Page,mode:'fit'|'vertical'){
 const settings=await openDisplay(page);
 await settings.getByRole('button',{name:mode==='fit'?/^(Fit to screen|התאמה למסך)$/:/^(Vertical view|תצוגה אנכית)$/,exact:true}).click();
 await settings.locator('summary').press('Escape');
 await expect(page.locator('.workspace-stage')).toHaveAttribute('data-presentation',mode);
}

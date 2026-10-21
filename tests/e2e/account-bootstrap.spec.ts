import {test,expect} from '@playwright/test';
import {planDemo} from '../../lib/planner';

test('refresh opens the saved guest conversation without rendering an empty home',async({page})=>{
 const workspace=planDemo('Help me study biology').workspace;
 await page.addInitScript(workspace=>{
  if(!localStorage.getItem('shadowui.device.v1.guest'))localStorage.setItem('shadowui.v1',JSON.stringify({workspaces:[workspace],active:workspace.id,conversations:{},undoWorkspaces:{},sources:{}}));
  (window as any).emptyHomePainted=false;
  const observe=()=>{if(document.querySelector('.home-flow')||(document.querySelector('.empty-history')))(window as any).emptyHomePainted=true;};
  new MutationObserver(observe).observe(document,{childList:true,subtree:true});
 },workspace);
 await page.goto('/');
 await expect(page.locator('.workspace-history-open')).toContainText(workspace.title);
 await expect(page.locator('.workspace')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).emptyHomePainted)).toBe(false);
 await page.reload();
 await expect(page.locator('.workspace-history-open')).toContainText(workspace.title);
 await expect(page.locator('.workspace')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).emptyHomePainted)).toBe(false);
});

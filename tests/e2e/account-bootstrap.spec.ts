import {test,expect} from '@playwright/test';
import {planDemo} from '../../lib/planner';

test('bare home opens without a conversation while explicit conversation links survive refresh',async({page})=>{
 const workspace=planDemo('Help me study biology').workspace;
 await page.addInitScript(workspace=>{
  if(!localStorage.getItem('shadowui.device.v1.guest'))localStorage.setItem('shadowui.v1',JSON.stringify({workspaces:[workspace],active:workspace.id,conversations:{},undoWorkspaces:{},sources:{}}));
 },workspace);
 await page.goto('/');
 await expect(page.locator('.workspace-history-open')).toContainText(workspace.title);
 await expect(page.locator('.home-flow')).toBeVisible();
 await expect(page).toHaveURL('/');
 await page.goto(`/conversations/${encodeURIComponent(workspace.id)}`);
 await expect(page.locator('.workspace')).toBeVisible();
 await page.reload();
 await expect(page.locator('.workspace')).toBeVisible();
 await page.goto('/');
 await expect(page.locator('.home-flow')).toBeVisible();
 await expect(page.locator('.workspace-history-open')).toContainText(workspace.title);
 await expect(page).toHaveURL('/');
});

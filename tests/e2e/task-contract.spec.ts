import {activeWorkspace,activeWorkspaceId} from './helpers/storage';
import {test,expect} from '@playwright/test';
import {seedDefinitions} from '../../lib/catalog';
import {assembleTask,demoTaskContract} from '../../lib/task-engine';
import {WorkspaceSchema} from '../../lib/schema';
import type {DataBinding} from '../../lib/data-bindings';

function fixture(){
 const definitions=seedDefinitions();const table=structuredClone(definitions.find(d=>d.id==='table')!.template);table.id='cost-input';table.title='נתוני עלות';table.items=[{id:'cost-row',label:'עלות',value:120}];
 const chart=structuredClone(definitions.find(d=>d.id==='chart')!.template);chart.id='cost-chart';chart.title='תצוגת עלות';
 const external=structuredClone(definitions.find(d=>d.id==='approval')!.template);const contract=demoTaskContract('ארגון עלויות ושליחת תשלום',[table,chart,external]);contract.actions[2]={...contract.actions[2],external:true,capability:'payments.send',description:'שליחת תשלום בפועל'};
 const assembly=assembleTask(contract,definitions,{componentData:[table,chart]});const bindings:DataBinding[]=[{id:'cost-copy',source:{componentId:table.id,port:'items'},target:{componentId:chart.id,port:'items'},transform:'copy'}];
 return WorkspaceSchema.parse({id:'bound-workspace',title:'סביבת עלויות',description:'נתונים סינתטיים לבדיקת דפדפן',goal:contract.objective,components:assembly.components,taskContract:contract,taskReport:{...assembly.coverage,limitations:assembly.limitations},bindings});
}
test('task contract and local bindings persist without a prominent status panel or more AI requests',async({page})=>{
 let calls=0;const workspace=fixture();
 await page.route('**/api/plan',route=>{if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,liveEnabled:true,simulation:false,spent:0,limit:1}});calls++;return route.fulfill({json:{workspace,mode:'live',operation:'create',explanation:'כלים מקומיים מוכנים; שליחת תשלום אינה מחוברת.',budget:{spent:0,limit:1,warning:false}}});});
 await page.goto('/');await page.getByLabel('What do you want to accomplish?').fill(workspace.goal);await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.getByRole('heading',{name:'נתוני עלות',exact:true})).toBeVisible();
 await expect.poll(()=>activeWorkspaceId(page)).toBe(workspace.id);
 await expect(page.locator('.task-contract-summary')).toHaveCount(0);
 const stored=await activeWorkspace(page);
 expect(stored.taskContract!.objective).toBe(workspace.taskContract!.objective);
 expect(stored.taskReport!.complete).toBe(false);
 expect(stored.taskReport!.limitations.join(' ')).toContain('לא בוצעה');
 const input=page.getByRole('spinbutton',{name:'Value עלות'}),chart=page.locator('.r-chart input[type="number"]');await expect(chart).toHaveValue('120');await expect(chart).toBeDisabled();await input.fill('275');await expect(chart).toHaveValue('275');expect(calls).toBe(1);
 await page.reload();await expect(page.getByRole('spinbutton',{name:'Value עלות'})).toHaveValue('275');await expect(page.locator('.r-chart input[type="number"]')).toHaveValue('275');await expect(page.locator('.task-contract-summary .task-status-panel')).toBeHidden();expect(calls).toBe(1);
 await page.setViewportSize({width:320,height:780});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

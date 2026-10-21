import {activeWorkspace} from './helpers/storage';
import {test,expect} from '@playwright/test';
import {planDemo} from '../../lib/planner';
import type {Schedule} from '../../lib/schedule';

// Mock composition only; every schedule operation and receipt uses the real MCP server.
test.beforeEach(async({page})=>{await page.route('**/api/plan',route=>{if(route.request().method()==='GET')return route.fulfill({json:{configured:false,storageReady:true,simulation:true,liveEnabled:false}});const input=route.request().postDataJSON();expect(input.mode).toBe('demo');return route.fulfill({json:planDemo(input.prompt,input.current??undefined)});});});

for(let run=1;run<=3;run++)test(`hero repeat ${run}: direct constraint → adaptive comparison → MCP commit → recovery → undo`,async({page})=>{
 const tools:string[]=[];page.on('request',request=>{if(request.url().endsWith('/api/mcp')){const body=request.postDataJSON();if(body.method==='tools/call')tools.push(body.params.name)}});
 await page.goto('/');
 await page.getByRole('button',{name:/Organize a working week/}).click();
 await expect(page.getByRole('heading',{name:/^Shifts ·/})).toBeVisible();
 const workspace=await activeWorkspace(page),goalId=workspace.domain!.id;
 const initial=await page.request.post('/api/mcp',{data:{jsonrpc:'2.0',id:776,method:'tools/call',params:{name:'inspect_schedule',arguments:{id:goalId}}}});
 const schedule:Schedule=(await initial.json()).result.structuredContent.schedule;
 const employee=schedule.employees.find(item=>item.name==='Daniel')!;
 const shift=schedule.shifts.find(item=>item.employeeId===employee.id&&schedule.shifts.filter(other=>other.employeeId===employee.id&&other.date===item.date).length===1)!;
 expect(shift).toBeTruthy();
 await page.getByLabel('Availability employee').selectOption(employee.id);
 await page.getByLabel('Availability date').fill(shift.date);
 await page.getByRole('button',{name:'Mark unavailable',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Resolve schedule constraints'})).toBeVisible();
 await expect(page.getByText(`${employee.name} is unavailable on ${shift.date}.`,{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Review & confirm',exact:true})).toBeDisabled();
 await page.locator('.sx-alternative button').first().click();
 await expect(page.getByRole('heading',{name:'Proposed change · not applied'})).toBeVisible();
 await expect(page.locator('.sx-revision')).toContainText('REV 1');
 await page.getByRole('button',{name:'Reject proposal',exact:true}).click();
 await expect(page.getByText('Proposal rejected. Authoritative schedule unchanged.')).toBeVisible();
 await page.locator('.sx-alternative button').first().click();
 await page.getByRole('button',{name:'Apply proposal',exact:true}).click();
 await expect(page.getByRole('heading',{name:/^Shifts ·/})).toBeVisible();
 await page.getByRole('button',{name:'Review & confirm',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Confirm internal schedule'})).toBeVisible();
 await page.getByRole('button',{name:'Confirm internal schedule',exact:true}).click();
 await expect(page.getByText('Verified backend receipt',{exact:true})).toBeVisible();
 const receipt=await page.locator('.sx-receipt small').innerText();
 await page.reload();
 await expect(page.locator('.sx-receipt small')).toHaveText(receipt);
 await page.getByRole('button',{name:/New workspace/}).click();
 await page.getByRole('button',{name:/Learn something deeply/}).click();
 await page.getByRole('checkbox').first().check();
 await page.locator('.workspace-history-open').filter({hasText:workspace.title}).click();
 await expect(page.locator('.sx-receipt small')).toHaveText(receipt);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByText('Verified backend receipt',{exact:true})).not.toBeVisible();
 await expect(page.locator('.sx-revision')).toContainText('DRAFT');
 expect(tools).toEqual(expect.arrayContaining(['create_schedule','inspect_schedule','update_schedule','preview_schedule_change','commit_schedule']));
 const inspected=await page.request.post('/api/mcp',{data:{jsonrpc:'2.0',id:777,method:'tools/call',params:{name:'inspect_schedule',arguments:{id:goalId}}}});
 expect((await inspected.json()).result.structuredContent.schedule.status).toBe('draft');
});

test('tool failure is visible and retry does not fabricate a commit',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Organize a working week/}).click();
 await expect(page.getByRole('heading',{name:/^Shifts ·/})).toBeVisible();
 await page.getByRole('button',{name:'Review & confirm',exact:true}).click();
 await page.route('**/api/mcp',async route=>{const body=route.request().postDataJSON();if(body.params?.name==='commit_schedule')await route.abort('failed');else await route.continue()});
 await page.getByRole('button',{name:'Confirm internal schedule',exact:true}).click();
 await expect(page.locator('.sx-error')).toBeVisible();
 await expect(page.getByText('Verified backend receipt',{exact:true})).not.toBeVisible();
 await page.unroute('**/api/mcp');
 await page.getByRole('button',{name:'Retry same action',exact:true}).click();
 await expect(page.getByText('Verified backend receipt',{exact:true})).toBeVisible();
});

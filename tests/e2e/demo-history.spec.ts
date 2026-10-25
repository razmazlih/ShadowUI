import {test,expect,type Page} from '@playwright/test';
import {planDemo} from '../../lib/planner';
import {activeWorkspace,guestWorkspaces} from './helpers/storage';

async function localPlanning(page:Page){
 const requests:string[]=[];
 page.on('request',request=>{if(/api\.openai\.com|\/v1\/(responses|embeddings|chat\/completions)/.test(request.url()))requests.push(request.url());});
 let compositions=0;
 await page.route('**/api/plan',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{configured:false,storageReady:true,simulation:true,liveEnabled:false}});
  const body=route.request().postDataJSON();expect(body.mode).toBe('demo');compositions++;
  return route.fulfill({json:{...planDemo(body.prompt,body.current??undefined),mode:'demo',simulation:true}});
 });
 return {requests,count:()=>compositions};
}

test('all starting points create distinct history entries and preserve existing saved work',async({page})=>{
 const planning=await localPlanning(page);
 await page.addInitScript(()=>{
  if(localStorage.getItem('shadowui.device.v1.guest'))return;
  localStorage.setItem('shadowui.device.v1.guest',JSON.stringify({generation:'history-test',importedGuests:[],snapshot:{workspaces:[{id:'existing-user-work',title:'Existing work',description:'Keep this',goal:'Keep my notes',components:[{id:'notes',type:'notes',title:'Notes',reason:'User content',span:'wide',items:[],text:'Do not change'}]}],active:'existing-user-work'}}));
 });
 await page.goto('/?conversation=existing-user-work');await expect(page.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Do not change');
 const original=(await guestWorkspaces(page))[0];const created:string[]=[];
 for(const label of ['Learn something deeply','Organize a working week','Go somewhere new','Make a better decision']){
  await page.getByRole('button',{name:/New workspace/}).click();
  await expect(page.locator('.examples > button')).toHaveCount(4);
  await page.getByRole('button',{name:new RegExp(label)}).click();
  await expect(page.locator('.r-card').first()).toBeVisible();
  const workspace=await activeWorkspace(page);expect(created).not.toContain(workspace.id);created.push(workspace.id);
  expect((await guestWorkspaces(page)).find(item=>item.id===original.id)).toEqual(original);
 }
 expect(planning.count()).toBe(4);
 await page.locator('.workspace-history-open').filter({hasText:'Existing work'}).click();
 await expect(page.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Do not change');
 await page.reload();await expect(page.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Do not change');
 await expect(page.locator('.workspace-history-open')).toHaveCount(5);
 expect((await guestWorkspaces(page)).find(item=>item.id===original.id)).toEqual(original);
 expect(planning.count()).toBe(4);expect(planning.requests).toEqual([]);
});

test('mobile recent history closes on selection and restores editable work within the viewport',async({page})=>{
 const planning=await localPlanning(page);await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:/Learn something deeply/}).click();
 await page.getByRole('checkbox').first().check();const learning=await activeWorkspace(page);
 await page.getByLabel('Toggle navigation').click();await page.getByRole('button',{name:/New workspace/}).click();
 await expect(page.locator('.sidebar')).not.toBeVisible();
 await page.getByRole('button',{name:/Go somewhere new/}).click();
 await page.locator('.viewport-tool-nav').getByRole('button',{name:/Budget ceiling/}).click();
 await expect(page.getByRole('heading',{name:'Budget ceiling'})).toBeVisible();
 await page.getByLabel('Toggle navigation').click();
 await page.locator('.workspace-history-open').filter({hasText:learning.title}).click();
 await expect(page.locator('.sidebar')).not.toBeVisible();await expect(page.getByRole('checkbox').first()).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await expect(page.getByRole('checkbox').first()).toBeChecked();
 expect(planning.count()).toBe(2);expect(planning.requests).toEqual([]);
});

import {test,expect} from '@playwright/test';
import {planDemo} from '../../lib/planner';

test('missing API key is explicit and cross-origin paid requests are rejected',async({page})=>{
 await page.goto('/');const status=await page.request.get('/api/plan');expect(status.headers()['cache-control']).toBe('no-store');
 const state=await status.json();
 const cross=await page.request.post('/api/plan',{headers:{origin:'https://untrusted.example'},data:{mode:'live',prompt:'test'}});expect(cross.status()).toBe(403);
 if(!state.configured){await expect(page.getByRole('status').filter({hasText:'OPENAI_API_KEY'})).toBeVisible();await page.getByLabel('What do you want to accomplish?').fill('Help me study');await page.getByRole('button',{name:'Build workspace'}).click();await expect(page.locator('.error[role=alert]')).toContainText('OPENAI_API_KEY');}
});

for(const [name,prompt] of [['learning','Help me study biology for an exam'],['travel','Plan a five-day trip to Japan with a budget of 1200'],['comparison','Compare three business opportunities'],['general','Organize a neighborhood seed exchange']]){
 test(`live ${name} composition renders validated output, preserves context, and saves provenance`,async({page})=>{
  let posts=0;let previous:unknown;const first=planDemo(prompt).workspace;
  await page.route('**/api/plan',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,spent:0,limit:1}});posts++;const body=route.request().postDataJSON();expect(body.mode).toBe('live');previous=body.current;await route.fulfill({json:{workspace:first,mode:'live',operation:posts===1?'create':'patch',explanation:'Mocked provider for UI test',budget:{spent:.002,limit:1,warning:false}}});});
  await page.goto('/');await page.getByLabel('What do you want to accomplish?').fill(prompt);await page.getByRole('button',{name:'Build workspace'}).click();await expect(page.locator('.workspace-notice').filter({hasText:'AI composition'})).toBeVisible();
  await page.getByLabel('What do you want to accomplish?').fill('Make the plan shorter');await page.getByRole('button',{name:'Build workspace'}).click();await expect.poll(()=>posts).toBe(2);expect(previous).toMatchObject({id:first.id});await expect(page.getByLabel('What do you want to accomplish?')).toHaveValue('');
  await page.reload();await expect(page.locator('.workspace-notice').filter({hasText:'AI composition'})).toBeVisible();
 });
}
test('natural-language schedule AI proposes a real local preview before applying',async({page})=>{
 let calls=0;await page.route('**/api/plan',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,spent:0,limit:1}});const body=route.request().postDataJSON();if(!body.current&&!body.schedule)return route.fulfill({json:{...planDemo('Organize next week shifts for six employees including Daniel'),mode:'live'}});if(!body.schedule)return route.fulfill({json:{operation:'schedule',intent:'schedule_change',explanation:'Interpret the schedule proposal.',mode:'live'}});expect(body.schedule.employees).toHaveLength(6);calls++;return route.fulfill({json:{operation:{type:'set_min_days_off',value:3},explanation:'Propose three days off.',mode:'live',budget:{spent:.0005,limit:1,warning:false}}});});
 await page.goto('/');await page.getByRole('button',{name:/Build a conflict-free week/}).click();await expect(page.getByLabel('Minimum days off')).toBeVisible();await page.getByLabel('What do you want to accomplish?').fill('Set the minimum days off to three');await page.getByRole('button',{name:'Build workspace'}).click();await expect(page.getByText('Proposed change · not applied')).toBeVisible();expect(calls).toBe(1);await expect(page.getByLabel('Minimum days off')).toHaveValue('2');await page.getByRole('button',{name:'Apply proposal'}).click();await expect(page.getByLabel('Minimum days off')).toHaveValue('3');
});


test('refresh restores each conversation and sends its previous turns with the visible workspace',async({page})=>{
 const first=planDemo('Help me study biology').workspace;
 let posts=0;
 await page.route('**/api/plan',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true}});
  const body=route.request().postDataJSON();expect(body.mode).toBe('live');posts++;
  if(posts===1)return route.fulfill({json:{workspace:first,operation:'create',explanation:'Created your biology plan.',mode:'live'}});
  expect(body.current.id).toBe(first.id);
  expect(body.history).toContainEqual({role:'user',content:'Help me study biology'});
  if(posts===3)expect(body.history).toContainEqual({role:'assistant',content:'This screen shows your biology plan.'});
  return route.fulfill({json:{operation:'reply',intent:'workspace_question',explanation:'This screen shows your biology plan.',mode:'live'}});
 });
 await page.goto('/');
 await expect(page.getByLabel('AI planning mode')).toHaveCount(0);
 await expect(page.getByText('Local demo',{exact:true})).toHaveCount(0);
 const input=page.getByLabel('What do you want to accomplish?');
 await input.fill('Help me study biology');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('.workspace-title h1')).toBeVisible();
 await page.reload();
 await expect(page.getByLabel('Conversation')).toContainText('Help me study biology');
 await input.fill('מה מוצג על המסך?');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('#request-status')).toContainText('This screen shows your biology plan.');
 await page.reload();
 await expect(page.getByLabel('Conversation')).toContainText('מה מוצג על המסך?');
 await input.fill('Continue our conversation');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('#request-status')).toContainText('This screen shows your biology plan.');
 expect(posts).toBe(3);
});

test('conversation without a workspace also survives refresh',async({page})=>{
 let posts=0;
 await page.route('**/api/plan',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true}});
  const body=route.request().postDataJSON();posts++;
  if(posts===2){expect(body.current).toBeNull();expect(body.history).toContainEqual({role:'user',content:'שלום'});}
  return route.fulfill({json:{operation:'reply',intent:'conversation',explanation:'שלום, אפשר להמשיך בשיחה.',mode:'live'}});
 });
 await page.goto('/');const input=page.getByLabel('What do you want to accomplish?');
 await input.fill('שלום');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(page.locator('.conversation-history')).toContainText('שלום');
 await page.reload();await expect(page.locator('.conversation-history')).toContainText('שלום');
 await input.fill('נמשיך');await page.getByRole('button',{name:'Build workspace'}).click();
 await expect(input).toHaveValue('');expect(posts).toBe(2);
});

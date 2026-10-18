import {test,expect} from '@playwright/test';
import {planDemo} from '../../lib/planner';

test('missing API key is explicit and cross-origin paid requests are rejected',async({page})=>{
 await page.goto('/');const status=await page.request.get('/api/plan');expect(status.headers()['cache-control']).toBe('no-store');
 const state=await status.json();
 const cross=await page.request.post('/api/plan',{headers:{origin:'https://untrusted.example'},data:{mode:'live',prompt:'test'}});expect(cross.status()).toBe(403);
 if(!state.configured){await page.getByLabel('AI planning mode').selectOption('live');await expect(page.getByRole('status').filter({hasText:'OPENAI_API_KEY'})).toBeVisible();await page.getByLabel('What do you want to accomplish?').fill('Help me study');await page.getByRole('button',{name:'Build workspace'}).click();await expect(page.locator('.error')).toContainText('OPENAI_API_KEY');}
});

for(const [name,prompt] of [['learning','Help me study biology for an exam'],['travel','Plan a five-day trip to Japan with a budget of 1200'],['comparison','Compare three business opportunities'],['general','Organize a neighborhood seed exchange']]){
 test(`live ${name} composition renders validated output, preserves context, and saves provenance`,async({page})=>{
  let posts=0;let previous:unknown;const first=planDemo(prompt).workspace;
  await page.route('**/api/plan',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,spent:0,limit:4.5}});posts++;const body=route.request().postDataJSON();expect(body.mode).toBe('live');previous=body.current;await route.fulfill({json:{workspace:first,mode:'live',operation:posts===1?'create':'patch',explanation:'Mocked provider for UI test',budget:{spent:.002,limit:4.5,warning:false}}});});
  await page.goto('/');await page.getByLabel('AI planning mode').selectOption('live');await page.getByLabel('What do you want to accomplish?').fill(prompt);await page.getByRole('button',{name:'Build workspace'}).click();await expect(page.locator('.workspace-notice').filter({hasText:'AI composition'})).toBeVisible();
  await page.getByLabel('What do you want to accomplish?').fill('Make the plan shorter');await page.getByRole('button',{name:'Build workspace'}).click();await expect.poll(()=>posts).toBe(2);expect(previous).toMatchObject({id:first.id});await expect(page.getByLabel('What do you want to accomplish?')).toHaveValue('');
  await page.reload();await expect(page.locator('.workspace-notice').filter({hasText:'AI composition'})).toBeVisible();
 });
}
test('natural-language schedule AI proposes a real local preview before applying',async({page})=>{
 let calls=0;await page.route('**/api/plan',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,spent:0,limit:4.5}});const body=route.request().postDataJSON();if(body.mode==='demo')return route.continue();expect(body.schedule.employees).toHaveLength(6);calls++;return route.fulfill({json:{operation:{type:'set_min_days_off',value:3},explanation:'Propose three days off.',mode:'live',budget:{spent:.0005,limit:4.5,warning:false}}});});
 await page.goto('/');await page.getByRole('button',{name:/Build a conflict-free week/}).click();await expect(page.getByLabel('Minimum days off')).toBeVisible();await page.getByLabel('AI planning mode').selectOption('live');await page.getByLabel('What do you want to accomplish?').fill('Set the minimum days off to three');await page.getByRole('button',{name:'Build workspace'}).click();await expect(page.getByText('Proposed change · not applied')).toBeVisible();expect(calls).toBe(1);await expect(page.getByLabel('Minimum days off')).toHaveValue('2');await page.getByRole('button',{name:'Apply proposal'}).click();await expect(page.getByLabel('Minimum days off')).toHaveValue('3');
});

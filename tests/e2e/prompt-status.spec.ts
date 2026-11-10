import {guestWorkspaces} from './helpers/storage';
import {test,expect} from '@playwright/test';
import {planDemo} from '../../lib/planner';

test('prompt shows pending, completion and failure beside the input',async({page})=>{
 let finish:()=>void=()=>{};
 let fail=false;let posts=0;
 await page.route('**/api/plan',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,liveEnabled:true,simulation:false}});
  posts++;await new Promise<void>(resolve=>{finish=resolve});
  if(fail)return route.fulfill({status:500,json:{error:'Provider unavailable'}});
  return route.fulfill({json:{...planDemo('Help me study biology'),explanation:'Created your study plan.'}});
 });
 await page.goto('/');
 const input=page.getByRole('textbox',{name:/^(What do you want to accomplish\?|מה תרצו להשיג\?)$/});
 await input.fill('Help me study biology');
 await page.getByRole('button',{name:/^(Build workspace|בניית סביבת עבודה)$/}).click();
 await expect(page.locator('#request-status')).toContainText('Understanding your request');
 await expect(input).toBeDisabled();
 await expect.poll(()=>posts).toBe(1);
 finish();
 await expect(page.locator('.workspace .r-card').first()).toBeVisible();
 const launcher=page.getByRole('button',{name:/^(Open assistant|פתיחת העוזר)$/});
 if(await launcher.isVisible())await launcher.click();
 await expect(page.locator('#request-status')).toContainText('Response ready');
 await expect(page.locator('#request-status')).toContainText('Created your study plan.');
 await expect(input).toBeEnabled();
 await expect(page.getByRole('log')).toContainText('Created your study plan.');
 await page.getByRole('button',{name:'Dismiss notification'}).click();
 await expect(page.locator('#request-status')).toHaveCount(0);
 await page.getByRole('button',{name:'Toggle language direction'}).click();
 if(await launcher.isVisible())await launcher.click();
 const before=await guestWorkspaces(page);
 await input.fill('אני רוצה שתסדר לי את המסך');
 await page.getByRole('button',{name:/^(Build workspace|בניית סביבת עבודה)$/}).click();
 await expect(page.locator('#request-status')).toContainText('סידרתי את הרכיבים');
 const id=before[0].id;
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').mode,`shadowui.layout.v1:${id}`)).toBe('fixed');
 expect(await guestWorkspaces(page)).toEqual(before);
 expect(['static','relative']).toContain(await page.locator('.layout-toolbar').evaluate(el=>getComputedStyle(el).position));
 await page.getByRole('button',{name:/^(Dismiss notification|סגירת הודעה)$/}).click();
 await expect(page.locator('#request-status')).toHaveCount(0);
 fail=true;
 await input.fill('עזור לי ללמוד');
 await page.getByRole('button',{name:/^(Build workspace|בניית סביבת עבודה)$/}).click();
 await expect(page.locator('.assistant-activity')).toContainText('מבין את הבקשה');
 await expect.poll(()=>posts).toBe(2);
 finish();
 await expect(page.locator('#request-status')).toContainText('הבקשה נכשלה');
 await expect(page.getByRole('alert').filter({hasText:'Provider unavailable'})).toContainText('Provider unavailable');
 await expect(input).toHaveValue('עזור לי ללמוד');
});

test('response notices and errors belong only to their conversation',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('shadowui.device.v1.guest',JSON.stringify({generation:'notice-isolation',importedGuests:[],snapshot:{workspaces:['Alpha','Beta'].map(title=>({id:title.toLowerCase(),title,description:'Conversation isolation',goal:`Work on ${title}`,components:[{id:`${title}-notes`,type:'notes',title:`${title} notes`,reason:'Saved content',span:'wide',items:[],text:''}]})),active:'alpha'}}));
 });
 let finishDeferred:()=>void=()=>{};
 let deferredStarted=false;
 await page.route('**/api/plan',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{configured:true,storageReady:true,liveEnabled:true,simulation:false}});
  const {prompt}=route.request().postDataJSON();
  if(prompt==='Deferred Alpha'){deferredStarted=true;await new Promise<void>(resolve=>{finishDeferred=resolve});}
  if(prompt==='Fail Beta')return route.fulfill({status:500,json:{error:'Only Beta failed'}});
  return route.fulfill({json:{operation:'reply',explanation:`Reply for ${prompt}`,mode:'live'}});
 });
 await page.goto('/?conversation=alpha');
 const feedback=page.locator('#request-status');
 const input=page.getByRole('textbox',{name:/^(What do you want to accomplish\?|מה תרצו להשיג\?)$/});
 const openAssistant=async()=>{
  const launcher=page.getByRole('button',{name:'Open assistant',exact:true});
  // Each conversation mounts its own minimized assistant after the scene transition.
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(input).toBeVisible();
 };
 const select=async(title:string)=>{
  await page.locator('.workspace-history-open').filter({hasText:title}).click();
  await expect(page.getByRole('textbox',{name:`${title} notes`,exact:true})).toBeVisible();
  await openAssistant();
 };
 const send=async(prompt:string)=>{
  await input.fill(prompt);
  await page.getByRole('button',{name:/^(Build workspace|בניית סביבת עבודה)$/}).click();
 };
 await expect(page.getByRole('textbox',{name:'Alpha notes',exact:true})).toBeVisible();
 await openAssistant();
 await send('Alpha');
 await expect(feedback).toContainText('Reply for Alpha');
 await input.fill('Unsent Alpha draft');
 await select('Beta');
 await expect(input).toHaveValue('');
 await expect(feedback).toHaveCount(0);
 await send('Fail Beta');
 await expect(feedback).toContainText('Request failed');
 await expect(page.getByRole('alert').filter({hasText:'Only Beta failed'})).toBeVisible();
 await page.getByRole('button',{name:'Playground',exact:true}).click();
 await expect(feedback).toHaveCount(0);
 await expect(page.getByRole('alert').filter({hasText:'Only Beta failed'})).toHaveCount(0);
 await send('Playground');
 await expect(feedback).toContainText('Reply for Playground');
 await select('Alpha');
 await expect(feedback).toContainText('Reply for Alpha');
 await expect(feedback).not.toContainText('Playground');
 await expect(input).toHaveValue('Unsent Alpha draft');
 await page.screenshot({path:'/tmp/shadowui-chat-isolation.png',fullPage:true});
 await expect(page.getByRole('alert').filter({hasText:'Only Beta failed'})).toHaveCount(0);
 await page.getByRole('button',{name:'Dismiss notification'}).click();
 await expect(feedback).toHaveCount(0);
 await select('Beta');
 await expect(feedback).toContainText('Request failed');
 await expect(page.getByRole('alert').filter({hasText:'Only Beta failed'})).toBeVisible();
 await page.getByRole('button',{name:'Playground',exact:true}).click();
 await expect(feedback).toContainText('Reply for Playground');
 await select('Alpha');
 await expect(feedback).toHaveCount(0);
 await send('Deferred Alpha');
 await expect.poll(()=>deferredStarted).toBe(true);
 await select('Beta');
 await expect(feedback).toContainText('Request failed');
 await expect(page.getByRole('button',{name:/^(Build workspace|בניית סביבת עבודה)$/})).toBeDisabled();
 finishDeferred();
 await expect(page.getByRole('button',{name:/^(Build workspace|בניית סביבת עבודה)$/})).toBeEnabled();
 await expect(page.locator('form[aria-busy="true"]')).toHaveCount(0);
 await expect(feedback).toContainText('Request failed');
 await expect(feedback).not.toContainText('Deferred Alpha');
 await select('Alpha');
 await expect(feedback).toContainText('Reply for Deferred Alpha');
});

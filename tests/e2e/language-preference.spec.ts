import {test,expect} from '@playwright/test';

test('language selection survives conversation changes, new chats and reloads',async({page})=>{
 await page.addInitScript(()=>{
  if(localStorage.getItem('language-regression-seeded'))return;
  const workspace=(id:string,title:string,goal:string)=>({id,title,goal,description:title,components:[{id:'notes',type:'notes',title:'Notes',reason:'Saved content',span:'wide',items:[],text:'Keep this content'}]});
  localStorage.setItem('shadowui.device.v1.guest',JSON.stringify({generation:'language-regression',importedGuests:[],snapshot:{
   workspaces:[workspace('english-chat','English conversation','Help me study biology'),workspace('hebrew-chat','שיחה בעברית','עזור לי ללמוד ביולוגיה')],
   active:'english-chat',conversations:{},undoWorkspaces:{},sources:{},deviceData:{}
  }}));
  localStorage.setItem('language-regression-seeded','true');
 });
 await page.route('**/api/plan',route=>route.fulfill({json:{configured:false,storageReady:true,simulation:true,liveEnabled:false}}));
 await page.goto('/');
 const shell=page.locator('.shell');
 const language=page.getByRole('button',{name:'Toggle language direction'});
 const input=page.getByLabel('What do you want to accomplish?');
 const openChat=(title:string)=>page.locator('.workspace-history-open').filter({hasText:title}).click();
 await expect(page.locator('.workspace-history-open')).toHaveCount(2);
 if(await shell.getAttribute('lang')!=='he')await language.click();
 await expect(shell).toHaveAttribute('dir','rtl');
 await openChat('שיחה בעברית');
 await openChat('English conversation');
 await expect(shell).toHaveAttribute('lang','he');
 await page.getByRole('button',{name:/New workspace/}).click();
 await input.fill('An English request must not switch the interface');
 await expect(input).toHaveAttribute('placeholder','מה תרצו להשיג?');
 await expect(shell).toHaveAttribute('dir','rtl');
 await page.reload();
 await expect(input).toHaveAttribute('placeholder','מה תרצו להשיג?');
 await expect(shell).toHaveAttribute('lang','he');
 await language.click();
 await expect(shell).toHaveAttribute('lang','en');
 await openChat('שיחה בעברית');
 await expect(shell).toHaveAttribute('dir','ltr');
 await page.getByRole('button',{name:/New workspace/}).click();
 await input.fill('בקשה בעברית אינה משנה את שפת הממשק');
 await expect(input).toHaveAttribute('placeholder','What do you want to accomplish?');
 await page.reload();
 await expect(shell).toHaveAttribute('lang','en');
 await expect(input).toHaveAttribute('placeholder','What do you want to accomplish?');
});

import {test,expect} from '@playwright/test';
test('local administrator reviews synthetic candidate and publishes immutable shared copy',async({page,context})=>{
 test.skip(process.env.SHADOWUI_ADMIN_E2E!=='1','Requires PORT=3001 npm run dev:simulation and SHADOWUI_ADMIN_E2E=1');
 const external:string[]=[];context.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&!['127.0.0.1','localhost'].includes(url.hostname))external.push(url.origin);});
 await page.goto('/admin/components');await page.request.get('/api/plan');
 const created=await page.request.post('/api/plan',{headers:{Origin:new URL(page.url()).origin},data:{prompt:'Organize an unusual neighborhood seed exchange',mode:'demo'}});expect(created.status()).toBe(200);const result=await created.json();expect(result.catalogStorage).toBe('emulator');
 await page.goto('/admin/components');
 const popupEvent=page.waitForEvent('popup');await page.getByRole('button',{name:'כניסה עם Google'}).click();const popup=await popupEvent;await popup.waitForLoadState();
 const listed=page.waitForResponse(response=>response.url().endsWith('/api/admin/components')&&response.request().method()==='GET');
 const existing=popup.getByText('admin@shadowui.local',{exact:true});
 if(await existing.isVisible())await existing.click();
 else{await popup.getByText('Add new account',{exact:true}).click();await popup.locator('#email-input').fill('admin@shadowui.local');await popup.locator('#display-name-input').fill('Local Review Administrator');await popup.getByRole('button',{name:'Sign in with Google.com',exact:true}).click();}
 const listing=await listed;expect(listing.status()).toBe(200);const {candidates}=await listing.json();
 const privateIds=new Set(result.workspace.components.map((component:{catalogRef?:{definitionId:string}})=>component.catalogRef?.definitionId));
 const candidate=candidates.find((item:{sourceDefinitionId:string})=>privateIds.has(item.sourceDefinitionId));expect(candidate).toBeTruthy();
 const pending=candidates.filter((item:{status:string})=>item.status==='pending');const index=pending.findIndex((item:{id:string})=>item.id===candidate.id);
 await page.locator('.review-card').nth(index).getByRole('button',{name:'פתיחה לבדיקה'}).click();
 await expect(page.getByRole('heading',{name:'תצוגה אינטראקטיבית'})).toBeVisible();
 await page.getByRole('checkbox',{name:/בדקתי שכל השדות/}).check();
 await page.getByLabel('השינוי המבוקש',{exact:true}).fill('רחב');
 const proposed=page.waitForResponse(response=>response.url().endsWith(`/api/admin/components/${candidate.id}`)&&response.request().method()==='POST');
 await page.getByRole('button',{name:'הכנת הצעה בהדמיה',exact:true}).click();const proposalResponse=await proposed;expect(proposalResponse.status()).toBe(200);const proposal=await proposalResponse.json();expect(proposal.simulation).toBe(true);expect(proposal.before.template.span).toBe('normal');expect(proposal.after.template.span).toBe('wide');
 expect((await page.request.get(`/api/catalog/${candidate.definition.id}`)).status()).toBe(404);
 const saved=page.waitForResponse(response=>response.url().endsWith(`/api/admin/components/${candidate.id}`)&&response.request().method()==='POST');await page.getByRole('button',{name:'שמירת ההצעה כגרסה חדשה',exact:true}).click();const edited=(await (await saved).json()).candidate;expect(edited.status).toBe('pending');expect(edited.version).toBe(2);expect(edited.definition.template.span).toBe('wide');
 await page.getByRole('checkbox',{name:/בדקתי שכל השדות/}).check();
 const approved=page.waitForResponse(response=>response.url().endsWith(`/api/admin/components/${candidate.id}`)&&response.request().method()==='POST');
 await page.getByRole('button',{name:'אישור ושיתוף הגרסה השמורה',exact:true}).click();const approval=await approved;expect(approval.status()).toBe(200);const approvedCandidate=(await approval.json()).candidate;expect(approvedCandidate.status).toBe('approved');expect(approvedCandidate.sharedDefinitionId).not.toBe(candidate.sourceDefinitionId);
 await expect(page.getByText('נוצרה הגדרה משותפת נפרדת. הרכיב הפרטי נשאר בבעלות היוצר.')).toBeVisible();
 const privateResponse=await page.request.get(`/api/catalog/${candidate.sourceDefinitionId}`);expect(privateResponse.status()).toBe(200);const original=(await privateResponse.json()).definition;expect(original.scope).toBe('private');expect(original.status).toBe('active');expect(original.template.span).toBe('normal');
 const sharedResponse=await page.request.get(`/api/catalog/${approvedCandidate.sharedDefinitionId}`);expect(sharedResponse.status()).toBe(200);const shared=(await sharedResponse.json()).definition;expect(shared.scope).toBe('shared');expect(shared.template.span).toBe('wide');
 await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 // Firebase's emulator popup downloads its own public JS/fonts; auth and model APIs stay local/off.
 expect(external.filter(origin=>!['https://apis.google.com','https://unpkg.com','https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(origin))).toEqual([]);
});

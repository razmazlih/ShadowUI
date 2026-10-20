import {test,expect,type Page} from '@playwright/test';

const tool=(page:Page,title:string)=>page.locator('.r-card').filter({has:page.getByRole('heading',{name:title,exact:true})});
async function compose(page:Page,prompt:string){
 await page.goto('/');
 await page.getByLabel('What do you want to accomplish?').fill(prompt);
 await expect(page.getByRole('button',{name:'Build workspace'})).toBeEnabled();
 const response=page.waitForResponse(response=>response.url().endsWith('/api/plan')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Build workspace'}).click();
 const result=await response;
 expect(result.status(),await result.text()).toBe(200);
 expect(await result.json()).toMatchObject({mode:'demo',simulation:true});
 await expect(page.locator('.r-card').first()).toBeVisible();
 const minimize=page.getByRole('button',{name:/^(Minimize assistant|מזעור העוזר)$/});
 if(await minimize.isVisible())await minimize.click();
}
function paidTraffic(page:Page){
 const requests:string[]=[];
 page.on('request',request=>{
  if(/api\.openai\.com|\/v1\/(?:responses|embeddings|chat\/completions)/.test(request.url()))requests.push(request.url());
  if(request.url().endsWith('/api/plan')&&request.method()==='POST')expect(request.postDataJSON().mode).toBe('demo');
 });
 return requests;
}

test('real simulation inventory computes per-item shortage, restores edits, and undoes changes at 320px RTL',async({page})=>{
 const paid=paidTraffic(page);
 await compose(page,'ניהול מלאי ציוד למתנדבים');
 const stock=tool(page,'ציוד וביקוש');
 await stock.getByRole('textbox',{name:'פריט חדש',exact:true}).fill('מסכות');
 await stock.getByRole('button',{name:'הוספה',exact:true}).click();
 const available=stock.getByRole('spinbutton',{name:'מסכות זמין',exact:true});
 const needed=stock.getByRole('spinbutton',{name:'מסכות נדרש',exact:true});
 const shortage=stock.locator('output[aria-label="מסכות חסר"]');
 await available.fill('3');await needed.fill('8');
 await expect(shortage).toHaveText('5');
 await available.fill('10');await expect(shortage).toHaveText('0');
 await page.reload();
 await expect(available).toHaveValue('10');await expect(needed).toHaveValue('8');await expect(shortage).toHaveText('0');
 await available.fill('6');await expect(shortage).toHaveText('2');
 await page.getByRole('button',{name:/Undo change|ביטול שינוי/}).click();
 await expect(available).toHaveValue('10');await expect(shortage).toHaveText('0');
 await page.setViewportSize({width:320,height:900});
 if(await page.locator('.shell').getAttribute('dir')!=='rtl')await page.getByRole('button',{name:'Toggle language direction'}).click();
 await expect(page.locator('.shell')).toHaveAttribute('dir','rtl');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(stock.getByRole('textbox',{name:'פריט חדש',exact:true})).toBeVisible();
 expect(paid).toEqual([]);
});

test('real simulation expense edits update the table total, linked chart and remaining budget',async({page})=>{
 const paid=paidTraffic(page);
 await compose(page,'תכנון אירוע עם תקציב 1000 והוצאות');
 const expenses=tool(page,'הוצאות');
 await expenses.getByRole('textbox',{name:'Add row',exact:true}).fill('אולם');
 await expenses.getByRole('button',{name:'Add row',exact:true}).click();
 const amount=expenses.getByRole('spinbutton',{name:'Value אולם',exact:true});
 await amount.fill('125');
 await expect(expenses.locator('tfoot')).toContainText('125');
 const chart=tool(page,'פירוט הוצאות').locator('.r-chart input[type="number"]');
 await expect(chart).toHaveValue('125');await expect(chart).toBeDisabled();
 const remaining=tool(page,'יתרה');
 await expect(remaining.getByRole('spinbutton',{name:'הוצאות מהטבלה',exact:true})).toHaveValue('125');
 await expect(remaining.locator('.custom-tool-result output strong')).toHaveText('875');
 await amount.fill('325');
 await expect(expenses.locator('tfoot')).toContainText('325');await expect(chart).toHaveValue('325');
 await expect(remaining.locator('.custom-tool-result output strong')).toHaveText('675');
 await page.reload();await expect(amount).toHaveValue('325');await expect(remaining.locator('.custom-tool-result output strong')).toHaveText('675');
 const identity=await page.evaluate(()=>JSON.parse(localStorage.getItem('shadowui.v1')!).active);
 await page.getByRole('button',{name:/^(Open assistant|פתיחת העוזר)$/}).click();
 await page.getByLabel('What do you want to accomplish?').fill('עדכן תקציב ל-1200');
 const followup=page.waitForResponse(response=>response.url().endsWith('/api/plan')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Build workspace'}).click();expect((await followup).status()).toBe(200);
 await expect(remaining.locator('.custom-tool-result output strong')).toHaveText('875');
 await expect(amount).toHaveValue('325');await expect(chart).toHaveValue('325');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shadowui.v1')!).active)).toBe(identity);
 expect(paid).toEqual([]);
});

test('real simulation calculator recomputes valid input and reports an empty numeric input',async({page})=>{
 const paid=paidTraffic(page);
 await compose(page,'מחשבון שטח מלבן רוחב 4 גובה 3');
 const calculator=tool(page,'שטח מלבן');
 const width=calculator.getByRole('spinbutton',{name:'רוחב — להזנה',exact:true});
 await expect(calculator.locator('.custom-tool-result output strong')).toHaveText('12');
 await width.fill('5');await expect(calculator.locator('.custom-tool-result output strong')).toHaveText('15');
 await width.fill('');await expect(width).toHaveAttribute('aria-invalid','true');
 await expect(calculator.getByText('יש להזין מספר תקין בטווח המותר.')).toBeVisible();
 await expect(calculator.locator('.custom-tool-result output')).toHaveCount(0);
 await width.fill('2');await expect(calculator.locator('.custom-tool-result output strong')).toHaveText('6');
 expect(paid).toEqual([]);
});

test('source edits regenerate study cards and clear obsolete quiz grading without model calls',async({page})=>{
 const paid=paidTraffic(page);
 await compose(page,'Help me study for exam source: ATP: energy; nucleus: DNA');
 const cards=tool(page,'Source flashcards'),quiz=tool(page,'Source practice');
 await cards.getByRole('button',{name:'ATP: reveal answer',exact:true}).click();
 await expect(cards.getByRole('button',{name:'ATP: show question',exact:true})).toContainText('energy');
 const firstQuestion=quiz.locator('.r-quiz > fieldset').first();
 await firstQuestion.getByRole('radio',{name:'energy',exact:true}).check();
 await firstQuestion.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(firstQuestion.getByRole('status')).toHaveText('Correct. Well done!');
 await page.getByRole('textbox',{name:'Study source',exact:true}).fill('ATP: revised source; nucleus: DNA');
 await expect(firstQuestion.getByRole('status')).toHaveCount(0);
 await expect(firstQuestion.getByRole('button',{name:'Check answer',exact:true})).toBeDisabled();
 await expect(firstQuestion.getByRole('radio',{name:'energy',exact:true})).toHaveCount(0);
 await cards.getByRole('button',{name:'ATP: reveal answer',exact:true}).click();
 await expect(cards.getByRole('button',{name:'ATP: show question',exact:true})).toContainText('revised source');
 await firstQuestion.getByRole('radio',{name:'revised source',exact:true}).check();
 await firstQuestion.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(firstQuestion.getByRole('status')).toHaveText('Correct. Well done!');
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Study source',exact:true})).toHaveValue('ATP: revised source; nucleus: DNA');
 await expect(cards.getByRole('button',{name:'ATP: show question',exact:true})).toContainText('revised source');
 await expect(firstQuestion.getByRole('status')).toHaveText('Correct. Well done!');
 await page.setViewportSize({width:320,height:1000});
 await expect(page.locator('.shell')).toHaveAttribute('dir','rtl');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await cards.scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/shadowui-workspace-mobile.png',animations:'disabled'});
 expect(paid).toEqual([]);
});

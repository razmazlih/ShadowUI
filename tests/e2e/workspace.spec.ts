import {test,expect,type Page} from '@playwright/test';

async function fillPrompt(page:Page,text:string){
 const launcher=page.getByRole('button',{name:/^(Open assistant|פתיחת העוזר)$/});
 if(await launcher.isVisible())await launcher.click();
 await page.getByLabel('What do you want to accomplish?').fill(text);
}
async function submit(page:Page,text:string){await fillPrompt(page,text);await page.getByRole('button',{name:'Build workspace'}).click();}
async function minimize(page:Page){const button=page.getByRole('button',{name:/^(Minimize assistant|מזעור העוזר)$/});if(await button.isVisible())await button.click();}

test('intent creates interactive persisted workspace; constraint patches retain work',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/Work changes/})).toBeVisible();
 await page.getByRole('button',{name:/Learn something deeply/}).click();
 await expect(page.getByRole('heading',{name:'Learning progress'})).toBeVisible();
 await page.getByRole('checkbox').first().check();
 await submit(page,'Set focus time to one hour tonight');
 await expect(page.getByLabel('Focus duration')).toHaveValue('60');
 await minimize(page);await expect(page.getByRole('checkbox').first()).toBeChecked();
 await page.reload();await expect(page.getByRole('checkbox').first()).toBeChecked();
 await submit(page,'Create a new workspace to organize next week shifts for six employees');
 await expect(page.getByRole('region',{name:'Adaptive team scheduling'})).toBeVisible();
 await expect(page.getByText('RECENT WORKSPACES')).toBeVisible();
});

test('unfamiliar goal, mobile, MCP discovery and invocation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await submit(page,'Organize a neighborhood seed exchange');
 await expect(page.getByRole('heading',{name:'Working data'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.goto('/mcp-host');await page.getByRole('button',{name:/Run discovery/}).click();
 await expect(page.getByText('compose_workspace',{exact:false}).first()).toBeVisible();
 await expect(page.locator('pre')).toHaveCount(4);
 await expect(page.locator('pre').last()).not.toContainText('"isError": true');
});

test('source quiz and flashcards preserve direct practice and comparison stays editable',async({page})=>{
 await page.goto('/');await submit(page,'Help me study for exam source: ATP: energy; nucleus: DNA');
 await page.getByRole('button',{name:'ATP: reveal answer',exact:true}).click();
 await expect(page.getByRole('button',{name:'ATP: show question',exact:true})).toContainText('energy');
 const question=page.locator('.r-quiz > fieldset').first();
 await question.getByLabel('energy',{exact:true}).check();await question.getByRole('button',{name:'Check answer'}).click();
 await expect(question).toContainText('Correct. Well done!');
 await page.reload();await expect(page.locator('.r-quiz > fieldset').first()).toContainText('Correct. Well done!');
 await page.getByRole('button',{name:/New workspace/}).click();
 await page.getByRole('button',{name:/Make a better decision/}).click();
 await expect(page.getByRole('heading',{name:'Compare options'})).toBeVisible();
 const score=page.getByRole('spinbutton').first();await score.fill('8');
 await page.reload();await expect(page.getByRole('spinbutton').first()).toHaveValue('8');
});

test('schedule availability controls and linked budget calculation are real local changes',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Organize a working week/}).click();
 await expect(page.getByRole('region',{name:'Adaptive team scheduling'})).toBeVisible();
 const assigned=page.locator('.sx-shift select').filter({has:page.locator('option:checked').filter({hasText:'Daniel'})}).first();
 const date=(await assigned.getAttribute('aria-label'))!.match(/\d{4}-\d{2}-\d{2}/)![0];
 await page.getByLabel('Availability employee').selectOption({label:'Daniel'});
 await page.getByLabel('Availability date').fill(date);
 await page.getByRole('button',{name:'Mark unavailable',exact:true}).click();
 await expect(page.locator('.sx-experience')).toHaveAttribute('data-interaction-model','resolution');
 await expect(page.getByText(`Daniel is unavailable on ${date}.`,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/New workspace/}).click();
 await submit(page,'Plan event budget 1000 and expenses');
 const expenses=page.locator('.r-card').filter({has:page.getByRole('heading',{name:'Expenses',exact:true})});
 await expenses.getByRole('textbox',{name:'Add row',exact:true}).fill('Venue');
 await expenses.getByRole('button',{name:'Add row',exact:true}).click();
 await expenses.getByRole('spinbutton',{name:'Value Venue',exact:true}).fill('1100');
 await expect(page.locator('.custom-tool-result output strong')).toHaveText('-100');
});

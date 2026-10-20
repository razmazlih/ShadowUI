import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`lesson cards fill the reading column without gaps at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/api/plan',route=>route.fulfill({json:{configured:false,storageReady:true,simulation:true,liveEnabled:false}}));
 await page.addInitScript(()=>{
  if(localStorage.getItem('shadowui.v1'))return;
  const components=[
   {id:'intro',type:'notes',title:'מה זה API?',text:'API הוא דרך מוסכמת שבה תוכנות מתקשרות זו עם זו. הלקוח שולח בקשה והשרת מחזיר תשובה.\n\nבדוגמה לימודית, אפליקציית מזג אוויר מבקשת תחזית מהשרת ומציגה את התוצאה.'},
   {id:'example',type:'notes',title:'בקשה ותגובה לדוגמה',text:'דוגמה בדיונית ללימוד:\nGET /weather?city=TelAviv\n\nתגובה לדוגמה:\n{"temperature": 24, "unit": "C"}\n\nהנתיב מציין איזה מידע מבקשים, והפרמטר city מציין עבור איזו עיר.'},
   {id:'cards',type:'flashcards',title:'מושגים לחזרה',items:[{id:'client',label:'מה תפקיד הלקוח?',answer:'לשלוח בקשה לשירות ולקרוא את התגובה.'},{id:'server',label:'מה תפקיד השרת?',answer:'לעבד את הבקשה ולהחזיר נתונים.'}]},
   {id:'practice',type:'checklist',title:'תרגול מעשי',items:[{id:'city',label:'שנו את העיר בבקשת הדוגמה והסבירו איזה חלק השתנה.',done:false}]},
   {id:'quiz',type:'quiz',title:'בדיקת הבנה',items:[{id:'get',label:'איזו פעולה מיועדת לקריאת מידע?',options:['GET','POST'],answer:'GET',detail:'GET מבקש לקרוא משאב מהשרת בלי ליצור משאב חדש.'}]},
  ].map(c=>({reason:'לימוד מודרך על API',span:'normal',items:[],...c}));
  const workspace={id:'lesson-layout-test',title:'לומדים מה זה API',description:'הסבר, דוגמה ותרגול',goal:'תלמד אותי מה זה api',components};
  localStorage.setItem('shadowui.v1',JSON.stringify({workspaces:[workspace],active:workspace.id}));
 });
 await page.goto('/');
 await expect(page.locator('.workspace-stage .r-card')).toHaveCount(5);
 await expect.poll(()=>page.locator('.workspace-stage .r-card').evaluateAll((cards,width)=>{
  const bounds=cards.map(card=>card.getBoundingClientRect());
  if(bounds[1].top-bounds[0].bottom<10||bounds[1].top-bounds[0].bottom>20)return false;
  return width<880?bounds.every(box=>Math.abs(box.width-bounds[0].width)<2):bounds[2].width<bounds[0].width*.6;
 },width)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390)await expect(page.locator('.layout-toolbar')).toBeHidden();
 await page.screenshot({path:`/tmp/shadowui-lesson-${width}.png`,fullPage:true});
 if(width===1440){
  const settings=page.locator('.layout-settings');
  await settings.locator('summary').first().click();
  await expect(page.getByRole('button',{name:'סידור קומפקטי',exact:true})).toHaveCount(0);
  const columns=page.getByRole('group',{name:'מספר עמודות',exact:true});
  await columns.getByRole('button',{name:'שתי עמודות',exact:true}).click();
  await expect.poll(()=>page.locator('.r-card').evaluateAll(cards=>Math.abs(cards[0].getBoundingClientRect().top-cards[1].getBoundingClientRect().top))).toBeLessThan(2);
  await columns.getByRole('button',{name:'שלוש עמודות',exact:true}).click();
  await expect.poll(()=>page.locator('.r-card').evaluateAll(cards=>new Set(cards.slice(0,3).map(card=>Math.round(card.getBoundingClientRect().left))).size)).toBe(3);
  await page.getByRole('button',{name:'מרווח',exact:true}).click();
  await expect.poll(()=>page.locator('.r-card').first().evaluate(card=>getComputedStyle(card).paddingTop)).toBe('22px');
  await page.screenshot({path:'/tmp/shadowui-display-options.png'});
  await page.reload();
  await settings.locator('summary').first().click();
  await expect(columns.getByRole('button',{name:'שלוש עמודות',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'מרווח',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('סידור ידני',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'חזרה להתאמה אוטומטית',exact:true})).toHaveCount(0);
  await columns.getByRole('button',{name:'אוטומטי',exact:true}).click();
  await expect(columns.getByRole('button',{name:'אוטומטי',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'סגירת הגדרות תצוגה'}).click();
  await expect(settings).not.toHaveAttribute('open','');
  await page.setViewportSize({width:1024,height:1000});
  await settings.locator('summary').first().click();
  await expect(columns.getByRole('button',{name:'שלוש עמודות',exact:true})).toHaveCount(0);
  await expect(columns.getByRole('button',{name:'שתי עמודות',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'סגירת הגדרות תצוגה'}).click();
  await page.setViewportSize({width:700,height:1000});
  await expect.poll(()=>page.locator('.r-card').evaluateAll(cards=>new Set(cards.map(card=>Math.round(card.getBoundingClientRect().width))).size)).toBe(1);
  await expect(page.locator('.layout-toolbar')).toBeHidden();
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('shadowui.v1')!);state.workspaces[0].components=state.workspaces[0].components.slice(0,1);localStorage.setItem('shadowui.v1',JSON.stringify(state));});
  await page.reload();
  await expect(page.locator('.r-card')).toHaveCount(1);
  await expect(page.locator('.layout-toolbar')).toHaveCount(0);

 }

});

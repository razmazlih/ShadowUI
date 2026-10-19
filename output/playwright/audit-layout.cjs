const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:3001';await page.goto(base);
 const prompt='Help me learn biology with a checklist, flashcards, quiz, focus timer and notes';
 const response=await page.request.post(base+'/api/plan',{data:{prompt,mode:'demo'}});assert(response.ok());const {workspace}=await response.json();assert(workspace);
 await page.evaluate(w=>localStorage.setItem('shadowui.v1',JSON.stringify({active:w.id,workspaces:[w]})),workspace);await page.reload();
 const cards=page.locator('.r-grid > .r-card');await cards.first().waitFor();
 await page.getByRole('button',{name:'Minimize assistant',exact:true}).click();
 const ids=()=>cards.evaluateAll(es=>es.map(e=>e.dataset.componentId));const original=await ids();
 const first=cards.first();await first.locator('.card-layout-options summary').click();await first.getByRole('button',{name:'Move later',exact:true}).click();assert.equal((await ids())[1],original[0]);
 const moved=cards.nth(1);await moved.getByRole('button',{name:'Move earlier',exact:true}).click();assert.deepEqual(await ids(),original);
 await page.getByRole('checkbox').first().check();
 async function drag(source,dest,gap=false){await source.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await dest.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,gap?b.y-8:b.y+40,{steps:15});await page.mouse.up();}
 await drag(cards.first().locator('.drag-handle'),cards.nth(1));assert.equal((await ids())[1],original[0]);
 await cards.nth(1).locator('.drag-handle').press('ArrowUp');assert.deepEqual(await ids(),original);
 await cards.first().locator('.drag-handle').press('End');assert.equal((await ids()).at(-1),original[0]);
 await cards.last().locator('.drag-handle').press('Home');assert.deepEqual(await ids(),original);
 await drag(cards.first().locator('.drag-handle'),cards.nth(2),true);assert.equal((await ids())[2],original[0]);
 const final=await ids();await page.reload();await cards.first().waitFor();assert.deepEqual(await ids(),final);assert(await page.getByRole('checkbox').first().isChecked());
 await page.setViewportSize({width:390,height:844});
 const mobile={...workspace,id:'mobile-drag',components:[{id:'a',type:'checklist',title:'Short A',reason:'',items:[]},{id:'b',type:'checklist',title:'Short B',reason:'',items:[]}]};
 await page.evaluate(w=>localStorage.setItem('shadowui.v1',JSON.stringify({active:w.id,workspaces:[w]})),mobile);await page.reload();await cards.nth(1).waitFor();await page.getByRole('button',{name:'Minimize assistant',exact:true}).click();await drag(cards.first().locator('.drag-handle'),cards.nth(1));assert.deepEqual(await ids(),['b','a']);
 async function geometry(label){await page.waitForTimeout(250);const data=await cards.evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {id:e.dataset.componentId,x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow');for(let i=0;i<data.length;i++)for(let j=i+1;j<data.length;j++){let a=data[i],b=data[j];assert(a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1,label+' overlap '+a.id+' '+b.id);}return data.length;}
 const types=['checklist','timeline','calendar','kanban','flashcards','quiz','slider','table','comparison','notes','timer','approval','chart','links'];
 const all={id:'audit-all',title:'Component audit',goal:'Inspect every supported tool',description:'QA fixture with all 14 supported components',components:types.map((type,i)=>({id:type,type,title:type,reason:'Audit',span:'normal',items:['notes','slider','timer','approval'].includes(type)?[]:type==='links'?[{id:'link',label:'Reference',url:'https://example.com'}]:[{id:'one',label:'First sample',detail:'Useful details',value:30,answer:'A',options:['A','B'],date:'2026-10-19'},{id:'two',label:'Second sample',value:45,answer:'B',options:['A','B']}],value:type==='timer'?25:50,text:'Useful working context for this tool'}))};
 await page.evaluate(w=>localStorage.setItem('shadowui.v1',JSON.stringify({active:w.id,workspaces:[w]})),all);await page.reload();await cards.nth(13).waitFor();
 const checks=[];
 for(const width of [1440,1024,740,390,320]){await page.setViewportSize({width,height:1100});for(const rtl of [false,true]){const actual=await page.locator('.shell').getAttribute('dir');if((actual==='rtl')!==rtl)await page.getByRole('button',{name:'Toggle language direction'}).click();for(const theme of ['dark','light']){const dark=await page.locator('.shell').evaluate(e=>e.classList.contains('dark'));if(dark!==(theme==='dark'))await page.getByRole('button',{name:'Toggle color theme'}).click();checks.push({width,rtl,theme,cards:await geometry(`${width}/${rtl}/${theme}`)});
 const chat=page.locator('.floating-assistant');assert.equal(await chat.getAttribute('dir'),rtl?'rtl':'ltr');const chatBounds=await chat.boundingBox();assert(chatBounds.x>=0&&chatBounds.x+chatBounds.width<=width+1);if(rtl)assert(Math.abs(chatBounds.x-(width>700?24:12))<2);else assert(Math.abs(width-chatBounds.x-chatBounds.width-(width>700?24:12))<2);
 const input=page.getByLabel('What do you want to accomplish?');assert.equal(await input.getAttribute('placeholder'),rtl?'שנו אילוץ, הוסיפו כלי או התחילו מטרה חדשה…':'Change a constraint, add a tool, or start a new goal…');}}
 await page.screenshot({path:`output/playwright/audit-${width}.png`,fullPage:true});}
 // Exercise a real presentation-only prompt through the assistant, without AI or a mock response.
 await page.getByRole('button',{name:/Expand assistant|הרחבת העוזר/,exact:true}).click();await page.getByLabel('What do you want to accomplish?').fill('תסדר לי את המסך');await page.getByRole('button',{name:'Build workspace',exact:true}).click();await page.getByText('התשובה מוכנה',{exact:true}).waitFor();assert(await cards.count()===14);
 await page.screenshot({path:'output/playwright/assistant-hebrew.png',fullPage:true});
 const assistantBody=page.locator('.assistant-message.from-assistant p').last();assert.equal(await assistantBody.getAttribute('dir'),'auto');assert.equal(await assistantBody.evaluate(e=>getComputedStyle(e).direction),'rtl');
 await page.getByRole('button',{name:'מזעור העוזר',exact:true}).click();assert(await page.getByRole('button',{name:'פתיחת העוזר',exact:true}).isVisible());
 assert.deepEqual(errors,[]);console.log(JSON.stringify({prompt,plannerMode:'demo',ordering:'menu earlier/later, pointer, gutter drop, keyboard, mobile, reload and edited data passed',presentationPrompt:'תסדר לי את המסך',checks,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

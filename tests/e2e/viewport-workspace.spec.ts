import {openDisplay,selectPresentation} from './helpers/display';
import {chromium,test,expect,type Locator,type Page} from '@playwright/test';
import {WorkspaceSchema,type UIComponent} from '../../lib/schema';

const browserErrors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{
 const errors:string[]=[];browserErrors.set(page,errors);
 page.on('pageerror',error=>errors.push(`Page error: ${error.message}`));
 page.on('console',message=>{if(message.type()==='error')errors.push(`Console: ${message.text()}`);});
});
test.afterEach(async({page})=>{expect(browserErrors.get(page)??[],'Browser runtime and console errors').toEqual([]);});

const makeTool=(id:string,type:UIComponent['type'],title:string,extra:Partial<UIComponent>={}):UIComponent=>({id,type,title,reason:'Viewport layout verification',span:'normal',items:[],...extra});
const tools:UIComponent[]=[
 makeTool('reading','notes','Reading',{text:Array.from({length:45},(_,i)=>`Paragraph ${i+1}: readable text remains available inside the card.`).join('\n\n')}),
 makeTool('focus','timer','Focus',{value:25}),
 makeTool('tasks','checklist','Tasks',{items:Array.from({length:30},(_,i)=>({id:`task-${i}`,label:`Task ${i+1}`,done:false}))}),
 makeTool('records','table','Records',{items:Array.from({length:25},(_,i)=>({id:`row-${i}`,label:`Record ${i+1}`,detail:'Editable details',value:i}))}),
 makeTool('week','weekly_schedule','Week',{weeklySchedule:{weekStart:'2026-10-19',days:Array.from({length:7},(_,i)=>({date:`2026-10-${19+i}`,events:[{id:`event-${i}`,title:'Planning session',start:'09:00',end:'10:00'}]}))}}),
 makeTool('calculator','custom','Calculator',{custom:{purpose:'Double the cost',layout:'metrics',accent:'amber',fields:[{id:'cost',label:'Cost',type:'number',value:'12',min:0,max:100,options:[]}],outputs:[{id:'total',label:'Total',expression:['cost','2','*'],unit:'₪'}]}}),
 makeTool('practice','quiz','Practice',{items:[{id:'question',label:'Two plus two?',answer:'4',options:['3','4']}]}),
 makeTool('cards','flashcards','Cards',{items:[{id:'card',label:'Question',answer:'Answer'}]}),
 ...Array.from({length:8},(_,i)=>makeTool(`extra-${i}`,'notes',`Notes ${i+1}`,{text:'Additional tool content.'})),
];

async function openWorkspace(page:Page,{he=false,count=16,live=false,components=tools.slice(0,count)}:{he?:boolean;count?:number;live?:boolean;components?:UIComponent[]}={}){
 const workspace=WorkspaceSchema.parse({id:'viewport-e2e',title:'A workspace that fits',description:'Persistent interactive tools',goal:'Work without scrolling the page',components});
 await page.route('**/api/plan',route=>route.fulfill({json:{configured:live,storageReady:true,simulation:!live,liveEnabled:live,spent:.05,limit:1}}));
 await page.addInitScript(({workspace,he})=>{
  if(!localStorage.getItem('shadowui.device.v1.guest'))localStorage.setItem('shadowui.device.v1.guest',JSON.stringify({generation:'e2e-fixture',importedGuests:[],snapshot:{workspaces:[workspace],active:workspace.id}}));
  localStorage.setItem('shadowui.ui-language.v1',he?'he':'en');
 },{workspace,he});
 await page.goto(`/?conversation=${encodeURIComponent(workspace.id)}`);
 await expect(page.locator('.workspace-stage')).toHaveClass(/viewport-fit/);
 expect(await page.locator('.viewport-tool-nav button').count()).toBeGreaterThan(0);
 await expect(page.locator('.viewport-tool-nav [aria-current=page]')).toHaveCount(1);
}

async function chooseTool(page:Page,title:string){
 const card=page.locator('.r-card').filter({has:page.getByRole('heading',{name:title,exact:true,includeHidden:true})});
 const id=await card.getAttribute('data-component-id');
 await page.locator(`.viewport-tool-nav button[data-page-tools~=${JSON.stringify(id)}]`).click();
 await expect(page.locator('.r-card').filter({has:page.getByRole('heading',{name:title,exact:true})})).toBeVisible();
}

async function expectBounded(page:Page){
 await expect.poll(()=>page.evaluate(()=>{
  const scroll=document.querySelector<HTMLElement>('.main-scroll')!;
  const cards=[...document.querySelectorAll<HTMLElement>('.viewport-fit .r-card')].filter(card=>getComputedStyle(card).display!=='none');
  return !!cards.length&&document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1
   &&scroll.scrollHeight<=scroll.clientHeight+2&&cards.every(card=>{const r=card.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1&&r.height>=219;});
 })).toBe(true);
}

async function expectInViewport(locator:Locator){
 await expect(locator).toBeVisible();
 await expect.poll(()=>locator.evaluate(element=>{const box=element.getBoundingClientRect();return box.left>=0&&box.top>=0&&box.right<=innerWidth+1&&box.bottom<=innerHeight+1;})).toBe(true);
}

async function switchWithHeightSamples(page:Page,mode:'fit'|'vertical'){
 const settings=await openDisplay(page);
 const reading=page.locator('#tool-reading');
 const toggle=settings.getByRole('button',{name:mode==='fit'?'Fit to screen':'Vertical view',exact:true});
 // Capture on the actual click, before React changes layout. Starting after
 // await click() can miss the entire transition under CI/video-recording load.
 await toggle.evaluate(button=>{
  const card=document.getElementById('tool-reading') as HTMLElement&{heightSamples?:Promise<number[]>};
  card.heightSamples=new Promise<number[]>(resolve=>{
   button.addEventListener('click',()=>{
    const values:number[]=[];const start=performance.now();
    function sample(){values.push(card.getBoundingClientRect().height);if(performance.now()-start<700)requestAnimationFrame(sample);else resolve(values);}
    sample();
   },{capture:true,once:true});
  });
 });
 await toggle.click();
 const heights=await reading.evaluate(element=>(element as HTMLElement&{heightSamples:Promise<number[]>}).heightSamples);
 await reading.evaluate(element=>{delete (element as HTMLElement&{heightSamples?:Promise<number[]>}).heightSamples;});
 const before=heights[0],after=heights.at(-1)!;
 expect(Math.abs(after-before)).toBeGreaterThan(20);
 const lower=Math.min(before,after)+2,upper=Math.max(before,after)-2;
 expect(heights.some(height=>height>lower&&height<upper),'height changes through intermediate bounds').toBe(true);
 expect(Math.max(...heights.slice(-3))-Math.min(...heights.slice(-3)),'height settles after transition').toBeLessThan(2);
 await settings.locator('summary').press('Escape');
 return heights;
}

for(const [width,height] of [[1440,900],[1366,768],[1024,768],[390,844],[320,568]]){
 for(const he of [false,true])test(`viewport tools stay reachable at ${width}×${height}, ${he?'RTL':'LTR'}`,async({page})=>{
  await page.setViewportSize({width,height});
  await openWorkspace(page,{he});
  await expectBounded(page);
  if(width===1440&&he)await page.screenshot({path:'output/playwright/viewport-fit-desktop-initial-rtl.png'});
  if(width<680&&he)await page.screenshot({path:`output/playwright/viewport-fit-mobile-${width}-initial-rtl.png`});
  if(width<680)await expect(page.locator('.viewport-fit .r-card:visible')).toHaveCount(1);
  for(const title of ['Records','Week','Calculator','Notes 8']){
   await chooseTool(page,title);
   await expectBounded(page);
  }
  const hidden=page.locator('.viewport-card-hidden');
  expect(await hidden.count()).toBeGreaterThan(0);
  expect(await hidden.evaluateAll(cards=>cards.every(card=>(card as HTMLElement).inert))).toBe(true);
  const navButton=page.locator('.viewport-tool-nav button[aria-current=page]');
  await expect(navButton).toHaveAttribute('aria-current','page');
  const button=await navButton.boundingBox();
  const nav=await page.locator('.viewport-tool-nav').boundingBox();
  expect(button!.x).toBeGreaterThanOrEqual(nav!.x-1);
  expect(button!.x+button!.width).toBeLessThanOrEqual(nav!.x+nav!.width+1);
  if([1440,390,320].includes(width)&&he)await page.screenshot({path:`output/playwright/viewport-fit-${width}-rtl.png`});
 });
}

test('group switches, expansion and responsive changes preserve live tool state',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page);
 await chooseTool(page,'Tasks');
 const tasks=page.locator('#tool-tasks');
 const draft=tasks.getByRole('textbox',{name:'Add item',exact:true});
 await draft.fill('An unfinished draft');
 await tasks.getByRole('checkbox').first().check();
 await tasks.locator('.r-card-content').evaluate(element=>element.scrollTop=150);
 await chooseTool(page,'Focus');
 await page.getByRole('button',{name:'Start focus',exact:true}).click();
 const timer=page.locator('#tool-focus .r-timer');
 await expect(timer).toHaveAttribute('data-running','true');
 await chooseTool(page,'Reading');
 await chooseTool(page,'Focus');
 await expect(timer).toHaveAttribute('data-running','true');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await chooseTool(page,'Tasks');
 await expect(draft).toHaveValue('An unfinished draft');
 await expect(tasks.getByRole('checkbox').first()).toBeChecked();
 expect(await tasks.locator('.r-card-content').evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
 await page.setViewportSize({width:1440,height:900});
 await chooseTool(page,'Tasks');
 await page.getByRole('button',{name:'Expand Tasks',exact:true}).click();
 await expect(page.locator('.viewport-fit .r-card:visible')).toHaveCount(1);
 await expect(draft).toHaveValue('An unfinished draft');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Expand Tasks',exact:true})).toBeFocused();
 await expect(draft).toHaveValue('An unfinished draft');
 await page.reload();
 await chooseTool(page,'Tasks');
 await expect(tasks.getByRole('checkbox').first()).toBeChecked();
});

test('vertical preference persists and single-tool expansion stays accessible',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await openWorkspace(page,{count:1});
 await expectBounded(page);
 await page.getByRole('button',{name:'Expand Reading',exact:true}).click();
 await expect(page.getByRole('button',{name:'Restore Reading',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await selectPresentation(page,'vertical');
 await expect(page.locator('.workspace-stage')).not.toHaveClass(/viewport-fit/);
 await page.reload();
 await openDisplay(page);
 await expect(page.getByRole('button',{name:'Vertical view',exact:true})).toHaveAttribute('aria-pressed','true');
 await selectPresentation(page,'fit');
 await expectBounded(page);
});

test('normal and reduced motion keep fast navigation stable',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:900});
 await openWorkspace(page);
 for(const title of ['Focus','Calculator','Tasks','Reading'])await chooseTool(page,title);
 await expectBounded(page);
 await page.getByRole('button',{name:'Expand Reading',exact:true}).click();
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 await chooseTool(page,'Week');
 await expectBounded(page);
 await page.screenshot({path:'output/playwright/viewport-fit-week-reduced-motion.png'});
});

test('fit and vertical views animate card height continuously in both directions',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:900});
 await openWorkspace(page);
 await expectBounded(page);
 const vertical=await switchWithHeightSamples(page,'vertical');
 const fit=await switchWithHeightSamples(page,'fit');
 await test.info().attach('presentation-height-samples',{body:JSON.stringify({vertical,fit}),contentType:'application/json'});
 await expectBounded(page);
});

for(const width of [1440,390])test(`card menus stay within viewport and Escape returns focus at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:768});
 await openWorkspace(page,{he:width===390});
 const visible=page.locator('.viewport-fit .r-card:visible');
 const bottomId=await visible.evaluateAll(cards=>cards.reduce((lowest,card)=>card.getBoundingClientRect().bottom>lowest.getBoundingClientRect().bottom?card:lowest).id);
 const card=page.locator(`#${bottomId}`);
 const trigger=card.locator('.card-layout-options>summary');
 await trigger.click();
 const menu=card.locator('.card-menu');
 await expectInViewport(menu);
 await expect(menu.getByRole('button').first()).toBeVisible();
 await trigger.press('Escape');
 await expect(card.locator('.card-layout-options')).not.toHaveAttribute('open','');
 await expect(trigger).toBeFocused();
 await expectBounded(page);
});

test('manual column choices retain their vertical layout and menus fit',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await openWorkspace(page,{count:3});
 const settings=page.locator('.layout-settings');
 await settings.locator('summary').click();
 await expectInViewport(settings.locator('.layout-settings-panel'));
 await settings.getByRole('button',{name:'Two columns',exact:true}).click();
 await expect(page.locator('.workspace-stage')).not.toHaveClass(/viewport-fit/);
 await openDisplay(page);
 await expect(page.getByRole('button',{name:'Vertical view',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await settings.locator('summary').click();
 await expect(settings.getByRole('button',{name:'Two columns',exact:true})).toHaveAttribute('aria-pressed','true');
 await settings.getByRole('button',{name:'Close display settings',exact:true}).click();
 await selectPresentation(page,'fit');
 await expectBounded(page);
});

test('assistant leaves tool navigation usable and keeps its draft through outside dismissal',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page);
 await page.getByRole('button',{name:'Open assistant',exact:true}).click();
 const prompt=page.getByRole('textbox',{name:'What do you want to accomplish?',exact:true});
 await prompt.fill('Keep this assistant draft');
 await expectInViewport(page.locator('.viewport-tool-nav'));
 await chooseTool(page,'Tasks');
 await expect(page.getByRole('button',{name:'Open assistant',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open assistant',exact:true}).click();
 await expect(prompt).toHaveValue('Keep this assistant draft');
 await page.getByRole('button',{name:'Minimize assistant',exact:true}).click();
 await expectBounded(page);
});

test('short viewport fallback and keyboard-sized resize keep content accessible',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page);
 await chooseTool(page,'Tasks');
 const draft=page.locator('#tool-tasks').getByRole('textbox',{name:'Add item',exact:true});
 await draft.fill('Retain during keyboard-sized resize');
 // A resized viewport approximates keyboard space; this is not physical-device keyboard proof.
 await page.setViewportSize({width:390,height:480});
 await expect.poll(()=>page.locator('.main-scroll').evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
 await draft.scrollIntoViewIfNeeded();
 await expect(draft).toHaveValue('Retain during keyboard-sized resize');
 await draft.fill('Still editable in a short viewport');
 await expect(draft).toBeFocused();
 await page.setViewportSize({width:390,height:844});
 await expectBounded(page);
 await expect(draft).toHaveValue('Still editable in a short viewport');
});

test('responsive narrowing keeps the currently edited desktop tool active',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await openWorkspace(page);
 // Tasks is in the first desktop group; focus, rather than a nav click, selects it.
 const draft=page.locator('#tool-tasks').getByRole('textbox',{name:'Add item',exact:true});
 await expect(draft).toBeVisible();
 await draft.fill('Editing this tool should survive narrowing');
 await expect(draft).toBeFocused();
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#tool-tasks')).toBeVisible();
 await expect(draft).toHaveValue('Editing this tool should survive narrowing');
 await expect(page.locator('.viewport-tool-nav button[aria-current=page]')).toHaveAttribute('aria-current','page');
 await expectBounded(page);
});

for(const width of [1440,320])test(`one Display panel contains view, columns and density at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:900});
 await openWorkspace(page,{count:3});
 await expect(page.locator('.layout-settings>summary')).toHaveCount(1);
 await expect(page.locator('.viewport-controls>.viewport-view-toggle')).toHaveCount(0);
 const settings=await openDisplay(page);
 await expectInViewport(settings.locator('.layout-settings-panel'));
 await expect(settings.getByRole('group',{name:'Workspace view',exact:true})).toBeVisible();
 await expect(settings.getByRole('group',{name:'Column count',exact:true})).toBeVisible();
 await expect(settings.getByRole('group',{name:'Density',exact:true})).toBeVisible();
 await settings.getByRole('button',{name:'Vertical view',exact:true}).click();
 await expect(settings.getByRole('button',{name:'Vertical view',exact:true})).toHaveAttribute('aria-pressed','true');
 await settings.getByRole('button',{name:'Fit to screen',exact:true}).click();
 await expect(settings.getByRole('button',{name:'Fit to screen',exact:true})).toHaveAttribute('aria-pressed','true');
 if(width===1440)await page.screenshot({path:'output/playwright/viewport-display-unified.png'});
 await settings.locator('summary').press('Escape');
 await expect(settings).not.toHaveAttribute('open','');
 await expect(settings.locator('summary')).toBeFocused();
 await expectBounded(page);
});

test('five lesson tools use available rows before creating another group',async({page})=>{
 await page.setViewportSize({width:1200,height:1000});
 await openWorkspace(page,{components:[
  makeTool('lesson-one','notes','Lesson one',{text:'An explanation'}),
  makeTool('lesson-two','notes','Lesson two',{text:'An example'}),
  makeTool('lesson-check','checklist','Lesson tasks',{items:[{id:'task',label:'Practice',done:false}]}),
  makeTool('lesson-plan','timeline','Lesson timeline',{items:[{id:'event',label:'Read',date:'2026-10-21'}]}),
  makeTool('lesson-timer','timer','Lesson timer',{value:25}),
 ]});
 await expect(page.locator('.viewport-fit .r-card:visible')).toHaveCount(5);
 await expect.poll(()=>page.locator('.viewport-fit .r-card:visible').evaluateAll(cards=>new Set(cards.map(card=>Math.round(card.getBoundingClientRect().top))).size)).toBeGreaterThan(1);
 await expectBounded(page);
 await page.screenshot({path:'output/playwright/viewport-fit-five-lesson-tools.png'});
});

test('records a normal-motion tour of grouping, expansion and navigation resize',async()=>{
 // A dedicated browser avoids macOS recording failures after many reused contexts.
 const recordingBrowser=await chromium.launch({channel:'chrome'});
 const context=await recordingBrowser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:1440,height:900},reducedMotion:'no-preference',recordVideo:{dir:'output/playwright/viewport-recording',size:{width:1440,height:900}}});
 const page=await context.newPage();
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 try{
  await openWorkspace(page);
  await page.waitForTimeout(500);
  // Sample from the first frame so an outgoing card cannot overlay the next page.
  const visibilityPromise=page.locator('#tool-reading').evaluate(element=>new Promise<Array<{opacity:number;visible:boolean;inert:boolean}>>(resolve=>{
   const samples:Array<{opacity:number;visible:boolean;inert:boolean}>=[];
   let started:number|undefined;
   function sample(){
    const style=getComputedStyle(element),inert=(element as HTMLElement).inert;
    if(inert){started??=performance.now();samples.push({opacity:Number(style.opacity),visible:style.display!=='none',inert});}
    if(started!==undefined&&performance.now()-started>=280)resolve(samples);else requestAnimationFrame(sample);
   }
   element.setAttribute('data-motion-sampling','ready');
   sample();
  }));
  await expect(page.locator('#tool-reading')).toHaveAttribute('data-motion-sampling','ready');
  await chooseTool(page,'Calculator');
  const visibility=await visibilityPromise;
  await page.locator('#tool-reading').evaluate(element=>element.removeAttribute('data-motion-sampling'));
  expect(visibility.every(sample=>sample.inert)).toBe(true);
  expect(visibility.every(sample=>!sample.visible),'outgoing cards leave immediately; only the page surface moves').toBe(true);
  expect(visibility.at(-1)?.visible).toBe(false);
  await page.getByRole('button',{name:'Expand Calculator',exact:true}).click();
  await expect.poll(()=>page.locator('#tool-calculator').evaluate(element=>{const card=element.getBoundingClientRect(),grid=element.parentElement!.getBoundingClientRect();return Math.abs(card.width-grid.width)<2&&Math.abs(card.height-grid.height)<2;})).toBe(true);
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Toggle navigation',exact:true}).click();
  await page.waitForTimeout(600);
  await chooseTool(page,'Reading');
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Toggle navigation',exact:true}).click();
  await page.waitForTimeout(600);
  for(const title of ['Calculator','Tasks','Week','Reading'])await chooseTool(page,title);
  await expectBounded(page);
  await switchWithHeightSamples(page,'vertical');
  await switchWithHeightSamples(page,'fit');
  await expectBounded(page);
  await page.screenshot({path:'output/playwright/viewport-fit-desktop-final.png'});
  expect(errors).toEqual([]);
 }finally{
  await page.close();
  await page.video()?.saveAs('output/playwright/viewport-transitions.webm');
  await context.close();
  await recordingBrowser.close();
 }
});

test('page navigation, horizontal gestures and optional assignments preserve drafts',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await openWorkspace(page);
 const tabs=page.locator('.page-tabs button');
 await expect(page.locator('.page-tabs [aria-current=page]')).toHaveCount(1);
 const firstLabel=await tabs.first().getAttribute('aria-label');
 await page.locator('#tool-reading textarea').fill('Draft remains across pages');
 const surface=page.locator('.workspace-surface');
 // Both samples belong to one momentum burst. Separate driver commands can
 // exceed the deliberate-gesture quiet window on a loaded CI runner.
 await surface.evaluate(element=>{for(let sample=0;sample<2;sample++)element.dispatchEvent(new WheelEvent('wheel',{deltaX:150,deltaY:0,bubbles:true,cancelable:true}));});
 await expect(tabs.nth(1)).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'Previous page',exact:true}).click();
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await expect(page.locator('#tool-reading textarea')).toHaveValue('Draft remains across pages');
 await page.locator('#tool-reading textarea').dispatchEvent('wheel',{deltaX:0,deltaY:200});
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'Next page',exact:true}).click();
 await page.getByRole('button',{name:'Edit page',exact:true}).click();
 const editor=page.getByRole('dialog');
 const selectedTools=editor.locator('input:checked');
 while(await selectedTools.count())await selectedTools.first().uncheck();
 await editor.getByRole('checkbox',{name:'Reading',exact:true}).check();
 await editor.getByRole('button',{name:'Apply to page',exact:true}).click();
 await expect(editor).toBeHidden();
 await expect(page.locator('#tool-reading')).toBeVisible();
 await expect(page.locator('.page-tabs [aria-current=page]')).toHaveCount(1);
 await page.reload();
 await chooseTool(page,'Reading');
 await expect(page.locator('#tool-reading textarea')).toHaveValue('Draft remains across pages');
 await page.getByRole('button',{name:'Edit page',exact:true}).click();
 await page.getByRole('button',{name:'Reset to automatic'}).click();
 await expect(tabs.first()).toHaveAttribute('aria-label',firstLabel!);
 await expect(page.getByRole('dialog')).toBeHidden();
 await page.screenshot({path:'output/playwright/workspace-pages-desktop.png'});
 await expectBounded(page);
});

for(const he of [false,true])test(`touch paging follows reading direction and ignores editors, ${he?'RTL':'LTR'}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page,{he});
 const surface=page.locator('.workspace-surface'),tabs=page.locator('.page-tabs button');
 const swipe=async(target:Locator,forward:boolean)=>{
  const start=he?70:300,end=he?300:70;
  await target.dispatchEvent('touchstart',{touches:[{identifier:0,clientX:forward?start:end,clientY:300}]});
  await target.dispatchEvent('touchmove',{touches:[{identifier:0,clientX:forward?end:start,clientY:305}]});
  await target.dispatchEvent('touchend',{touches:[],changedTouches:[{identifier:0,clientX:forward?end:start,clientY:305}]});
 };
 await swipe(page.locator('#tool-reading textarea'),true);
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await swipe(surface,true);
 await expect(tabs.nth(1)).toHaveAttribute('aria-current','page');
 await swipe(surface,false);
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await tabs.first().press(he?'ArrowLeft':'ArrowRight');
 await expect(tabs.nth(1)).toHaveAttribute('aria-current','page');
 await surface.dispatchEvent('wheel',{deltaX:0,deltaY:he?150:-150,shiftKey:true});
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await page.screenshot({path:`output/playwright/workspace-pages-mobile-${he?'rtl':'ltr'}.png`});
});

test('horizontal gestures stay inside the workspace and never alter browser history',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await openWorkspace(page);
 await page.route('**/api/catalog',route=>route.fulfill({json:{definitions:[],admin:false}}));
 await page.goto('/catalog');await page.goBack();
 await expect(page.locator('.workspace-stage')).toBeVisible();
 await page.evaluate(()=>{
  (window as Window&{wheelPrevented?:boolean[]}).wheelPrevented=[];
  document.addEventListener('wheel',event=>(window as Window&{wheelPrevented?:boolean[]}).wheelPrevented!.push(event.defaultPrevented));
 });
 const original=page.url(),length=await page.evaluate(()=>history.length);
 await page.locator('#tool-reading textarea').dispatchEvent('wheel',{deltaX:150,deltaY:0,cancelable:true});
 await expect(page.locator('.page-tabs button').nth(1)).toHaveAttribute('aria-current','page');
 await page.locator('.viewport-controls').dispatchEvent('wheel',{deltaX:-150,deltaY:0,cancelable:true});
 expect(await page.evaluate(()=>(window as Window&{wheelPrevented?:boolean[]}).wheelPrevented)).toEqual([true,true]);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overscrollBehaviorX)).toBe('none');
 expect(page.url()).toBe(original);expect(await page.evaluate(()=>history.length)).toBe(length);
});

test('paging follows the gesture immediately and reverses without ghost cards or cooldown',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await openWorkspace(page);
 const surface=page.locator('.workspace-surface'),grid=surface.locator('.r-grid'),tabs=page.locator('.page-tabs button');
 await surface.dispatchEvent('wheel',{deltaX:16,deltaY:0});
 await expect.poll(()=>grid.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41)).toBeLessThan(-1);
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await surface.dispatchEvent('wheel',{deltaX:40,deltaY:0});
 await expect(tabs.nth(1)).toHaveAttribute('aria-current','page');
 await expect(page.locator('.viewport-card-leaving')).toHaveCount(0);
 await surface.dispatchEvent('wheel',{deltaX:-80,deltaY:0});
 await expect(tabs.first()).toHaveAttribute('aria-current','page');
 await expect(page.locator('.viewport-card-leaving')).toHaveCount(0);
 await expect.poll(()=>grid.evaluate(element=>Math.abs(new DOMMatrix(getComputedStyle(element).transform).m41))).toBeLessThan(.1);
 await expectBounded(page);
});

test('a page moves as one surface without crossfading or resizing its cards',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await openWorkspace(page);
 await page.locator('.workspace-surface').dispatchEvent('wheel',{deltaX:80,deltaY:0});
 const samples=await page.locator('.r-grid').evaluate(grid=>new Promise<Array<{bounds:number[][];opacity:number[]}>>(resolve=>{
  const samples:Array<{bounds:number[][];opacity:number[]}>=[];const start=performance.now();
  const sample=()=>{
   const origin=grid.getBoundingClientRect();
   const cards=[...grid.querySelectorAll<HTMLElement>(':scope > .r-card')].filter(card=>getComputedStyle(card).display!=='none');
   samples.push({bounds:cards.map(card=>{const r=card.getBoundingClientRect();return [r.left-origin.left,r.top-origin.top,r.width,r.height]}),opacity:cards.map(card=>Number(getComputedStyle(card).opacity))});
   if(performance.now()-start<260)requestAnimationFrame(sample);else resolve(samples);
  };requestAnimationFrame(sample);
 }));
 const final=samples.at(-1)!;
 for(const sample of samples){
  expect(sample.bounds.length).toBe(final.bounds.length);
  expect(sample.opacity.every(value=>value===1)).toBe(true);
  sample.bounds.forEach((rect,index)=>rect.forEach((value,axis)=>expect(Math.abs(value-final.bounds[index][axis])).toBeLessThan(1.5)));
 }
});

for(const [width,height,he] of [[1440,900,false],[1366,768,true],[390,844,false],[320,568,true]] as const)test(`page editor shows 16 tools without sideways scrolling at ${width}px, ${he?'RTL':'LTR'}`,async({page})=>{
 await page.setViewportSize({width,height});
 await openWorkspace(page,{he});
 if(width===1440)await page.getByRole('button',{name:'Toggle color theme'}).click();
 const before=await page.locator('.page-tabs button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')));
 await page.getByRole('button',{name:he?'עריכת דף':'Edit page',exact:true}).click();
 const editor=page.getByRole('dialog');
 await expect(editor).toBeVisible();
 await expect(editor.getByRole('checkbox')).toHaveCount(16);
 await expect(editor.getByRole('combobox')).toHaveCount(0);
 expect(await editor.evaluate(element=>[element,...element.querySelectorAll('.page-editor-tools,label,.page-editor-actions')].every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
 await expectInViewport(editor);
 const close=editor.getByRole('button',{name:he?'סגירת עריכת דף':'Close page editor'});
 await close.focus();await page.keyboard.press('Shift+Tab');
 await expect(editor.getByRole('button',{name:he?'עדכון הדף':'Apply to page'})).toBeFocused();
 await page.screenshot({path:`output/playwright/page-editor-grid-${width}-${he?'rtl':'ltr'}.png`});
 await page.keyboard.press('Escape');await expect(editor).toBeHidden();
 await expect(page.getByRole('button',{name:he?'עריכת דף':'Edit page',exact:true})).toBeFocused();
 expect(await page.locator('.page-tabs button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')))).toEqual(before);
});

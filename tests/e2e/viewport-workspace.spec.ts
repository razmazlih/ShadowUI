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
 await page.goto('/');
 await expect(page.locator('.workspace-stage')).toHaveClass(/viewport-fit/);
 await expect(page.locator('.viewport-tool-nav button')).toHaveCount(components.length);
}

async function chooseTool(page:Page,title:string){
 await page.locator('.viewport-tool-nav').getByRole('button',{name:title,exact:true}).click();
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
 const before=await reading.evaluate(element=>element.getBoundingClientRect().height);
 await settings.getByRole('button',{name:mode==='fit'?'Fit to screen':'Vertical view',exact:true}).click();
 const heights=await reading.evaluate(element=>new Promise<number[]>(resolve=>{
  const values:number[]=[];const start=performance.now();
  function sample(){values.push(element.getBoundingClientRect().height);if(performance.now()-start<700)requestAnimationFrame(sample);else resolve(values);}sample();
 }));
 const after=heights.at(-1)!;
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
  const navButton=page.locator('.viewport-tool-nav').getByRole('button',{name:'Notes 8',exact:true});
  await expect(navButton).toHaveAttribute('aria-pressed','true');
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
 await expect(page.locator('.viewport-tool-nav').getByRole('button',{name:'Tasks',exact:true})).toHaveAttribute('aria-pressed','true');
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
  // Install the sampler before the click: CI may finish the fade while a
  // separate browser command is being scheduled after navigation.
  const fadePromise=page.locator('#tool-reading').evaluate(element=>new Promise<Array<{opacity:number;visible:boolean;inert:boolean}>>(resolve=>{
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
  const fade=await fadePromise;
  await page.locator('#tool-reading').evaluate(element=>element.removeAttribute('data-motion-sampling'));
  expect(fade.every(sample=>sample.inert)).toBe(true);
  expect(fade.some(sample=>sample.visible&&sample.opacity>0&&sample.opacity<1)).toBe(true);
  expect(fade.at(-1)?.visible).toBe(false);
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

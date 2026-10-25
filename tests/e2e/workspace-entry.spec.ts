import {test,expect,type Page} from '@playwright/test';

type EntryFrame={ids:string[];rects:number[][]};
type EntryWindow=Window&{entryFrames?:Promise<EntryFrame[]>};

// Install before navigation, so the first painted arrangement is included.
function captureEntry(){
 (window as EntryWindow).entryFrames=new Promise(resolve=>{
  const frames:EntryFrame[]=[];let start:number|undefined;
  const sample=()=>{
   const stage=document.querySelector<HTMLElement>('.workspace-stage');
   const grid=stage?.querySelector<HTMLElement>('.r-grid');
   if(stage&&grid&&getComputedStyle(stage).visibility==='visible'){
    const cards=[...grid.querySelectorAll<HTMLElement>(':scope > .r-card')].filter(card=>getComputedStyle(card).display!=='none');
    if(cards.length){
     start??=performance.now();const origin=grid.getBoundingClientRect();
     frames.push({ids:cards.map(card=>card.dataset.componentId!),rects:cards.map(card=>{const box=card.getBoundingClientRect();return [box.left-origin.left,box.top-origin.top,box.width,box.height];})});
    }
   }
   if(start!==undefined&&performance.now()-start>=650)resolve(frames);else requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
 });
}

async function expectStableEntry(page:Page){
 const frames=await page.evaluate(()=>(window as EntryWindow).entryFrames!);
 expect(frames.length).toBeGreaterThan(4);
 const final=frames.at(-1)!;
 for(const frame of frames){
  expect(frame.ids,'visible tools are final from the first frame').toEqual(final.ids);
  frame.rects.forEach((rect,index)=>rect.forEach((value,axis)=>{
   expect(Math.abs(value-final.rects[index][axis]),'cards do not rearrange after becoming visible').toBeLessThan(1.5);
  }));
 }
 return final;
}

for(const {width,height,vertical} of [
 {width:1440,height:1000,vertical:false},
 {width:390,height:844,vertical:false},
 {width:1440,height:1000,vertical:true},
])test(`saved workspace is already arranged on entry at ${width}px, ${vertical?'vertical':'fit'}`,async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width,height});
 await page.route('**/api/plan',route=>route.fulfill({json:{configured:false,storageReady:true,simulation:true,liveEnabled:false}}));
 await page.addInitScript(({vertical})=>{
  const components=[
   {id:'source',type:'notes',title:'Source',text:Array.from({length:20},(_,i)=>`Paragraph ${i}: read this saved material before practicing.`).join('\n\n')},
   {id:'tasks',type:'checklist',title:'Tasks',items:[{id:'task',label:'Review the material',done:true}]},
   {id:'timer',type:'timer',title:'Focus',value:25},
   {id:'notes',type:'notes',title:'Notes',text:'A saved draft'},
   {id:'plan',type:'timeline',title:'Plan',items:[{id:'step',label:'Practice',date:'2026-10-21'}]},
   {id:'links',type:'notes',title:'References',text:'Additional reading'},
  ].map(component=>({span:'normal',reason:'Saved workspace',items:[],...component}));
  const workspace={id:'entry-workspace',title:'Saved lesson',goal:'Keep my work',description:'A saved lesson',components};
  localStorage.setItem('shadowui.device.v1.guest',JSON.stringify({generation:'entry-fixture',importedGuests:[],snapshot:{workspaces:[workspace],active:workspace.id}}));
  localStorage.setItem('shadowui.layout.v1:entry-workspace:density','comfortable');
  localStorage.setItem('shadowui.layout.v1:entry-workspace:presentation',vertical?'vertical':'fit');
  localStorage.setItem('shadowui.layout.v1:entry-workspace',JSON.stringify({mode:'fixed',order:['timer','source','tasks','notes','plan','links'],sizes:Object.fromEntries(components.map(component=>[component.id,{columns:6,minHeight:360}]))}));
 },{vertical});
 await page.addInitScript(captureEntry);
 await page.goto('/?conversation=entry-workspace');
 const first=await expectStableEntry(page);
 expect(first.ids[0]).toBe('timer');
 expect(first.ids.length).toBe(width<680?1:6);
 await expect(page.locator('.workspace-stage')).toHaveAttribute('data-presentation',vertical?'vertical':'fit');
 await expect(page.locator('.workspace-stage')).not.toHaveClass(/layout-compact/);
 for(let visit=0;visit<2;visit++){
  if(width<680)await page.getByRole('button',{name:'Toggle navigation',exact:true}).click();
  await page.locator('.nav-item').filter({hasText:'Playground'}).click();
  await expect(page.getByRole('heading',{name:/Work changes/})).toBeVisible();
  await page.evaluate(captureEntry);
  if(width<680)await page.getByRole('button',{name:'Toggle navigation',exact:true}).click();
  await page.locator('.workspace-history-open').filter({hasText:'Saved lesson'}).click();
  const revisited=await expectStableEntry(page);
  expect(revisited.ids).toEqual(first.ids);
 }
});

'use client';

import {useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode} from 'react';
import {AnimatePresence, motion, useIsPresent, useReducedMotion, type HTMLMotionProps} from 'motion/react';
import {GripVertical, MoreHorizontal, MoveDiagonal2, SlidersHorizontal, X} from 'lucide-react';
import type {UIComponent} from '@/lib/schema';
import {automaticLayout, columnLayout, isLessonLayout, parseLayout, reconcileLayout, requestedLayout, type LayoutState} from '@/lib/workspace-layout';
import {deviceDataStorage} from '@/lib/account-device-data';
import {toolIcons, toolLabel} from './tool-metadata';

type Size = LayoutState['sizes'][string];
type Gesture = {kind:'move'|'resize';id:string;pointerId:number;x:number;y:number;lastX:number;lastY:number;columns:number;height:number;unit:number;rtl:boolean;changed:boolean;target:string|null;size:Size|null};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

// Keep exiting controls out of keyboard and screen-reader navigation.
function AnimatedCard(props:HTMLMotionProps<'section'>){
 const present=useIsPresent();
 return <motion.section {...props} inert={!present} aria-hidden={present?undefined:true}/>;
}

export default function WorkspaceLayout({workspaceId,components,locale,children}:{workspaceId:string;components:UIComponent[];locale:'he'|'en';children:(component:UIComponent)=>ReactNode}) {
 const he=locale==='he';
 const reducedMotion=useReducedMotion();
 const [manipulating,setManipulating]=useState(false);
 const [saved,setSaved]=useState<{workspaceId:string;layout:LayoutState;ready:boolean}>(()=>({workspaceId,layout:automaticLayout(components),ready:false}));
 const [preview,setPreview]=useState<{id:string;size:Size}|null>(null);
 const [target,setTarget]=useState<string|null>(null);
 const [dragging,setDragging]=useState<string|null>(null);
 const [announcement,setAnnouncement]=useState('');
 const [storageWarning,setStorageWarning]=useState(false);
 const [density,setDensity]=useState<'compact'|'comfortable'>('compact');
 const grid=useRef<HTMLDivElement>(null);
 const gesture=useRef<Gesture|null>(null);
 const storageKey=`shadowui.layout.v1:${workspaceId}`;
 const [availableWidth,setAvailableWidth]=useState(1050);
 const [rowSpans,setRowSpans]=useState<Record<string,number>>({});
 const reconciled=reconcileLayout(saved.workspaceId===workspaceId?saved.layout:automaticLayout(components),components);
 const layout=reconciled.mode==='auto'?automaticLayout(components,availableWidth):reconciled;
 const singleColumn=layout.order.every(id=>layout.sizes[id].columns===12);
 const reading=isLessonLayout(components)&&singleColumn;
 const flowing=reading||singleColumn;
 const uniform=layout.order.length?layout.sizes[layout.order[0]].columns:12;
 const preset=layout.mode==='auto'?'auto':layout.order.every(id=>layout.sizes[id].columns===uniform)&&[4,6,12].includes(uniform)?String(12/uniform):'custom';
 const current=useRef(layout);current.current=layout;
 const composition=components.map(c=>`${c.id}:${c.type}:${c.span}`).join('|');
 // Content typing does not trigger card layout animations.
 const layoutMotionKey=`${workspaceId}:${composition}:${layout.order.join(',')}:${availableWidth}:${density}:${JSON.stringify(layout.sizes)}`;
 useEffect(()=>{
  const element=grid.current;if(!element)return;
  const measure=()=>{
   setAvailableWidth(Math.round(element.clientWidth));
   const styles=getComputedStyle(element);
   const gap=parseFloat(styles.rowGap)||12;
   const rowHeight=parseFloat(styles.gridAutoRows)||1;
   const next:Record<string,number>=Object.create(null);
   element.querySelectorAll<HTMLElement>(':scope > [data-component-id]').forEach(card=>{next[card.dataset.componentId!]=Math.max(1,Math.ceil((card.getBoundingClientRect().height+gap)/(rowHeight+gap)));});
   setRowSpans(previous=>Object.keys(previous).length===Object.keys(next).length&&Object.keys(next).every(id=>previous[id]===next[id])?previous:next);
  };
  const observer=new ResizeObserver(measure);observer.observe(element);
  element.querySelectorAll(':scope > [data-component-id]').forEach(card=>observer.observe(card));
  measure();return ()=>observer.disconnect();
 },[workspaceId,composition]);
 useEffect(()=>{
  setSaved(previous=>{if(!previous.ready||previous.workspaceId!==workspaceId)return previous;const next=reconcileLayout(previous.layout,components);return JSON.stringify(next)===JSON.stringify(previous.layout)?previous:{...previous,layout:next};});
 },[workspaceId,composition]);
 useEffect(()=>{
  let restored:LayoutState|null=null;
  try{const raw=deviceDataStorage().getItem(storageKey);if(raw)restored=parseLayout(JSON.parse(raw));setDensity(deviceDataStorage().getItem(`${storageKey}:density`)==='comfortable'?'comfortable':'compact');}catch{}
  setSaved({workspaceId,layout:restored??automaticLayout(components),ready:true});
  setPreview(null);setTarget(null);setDragging(null);setManipulating(false);gesture.current=null;setStorageWarning(false);
  // Restore once per workspace; content edits are reconciled without resetting the layout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[workspaceId,storageKey]);
 useEffect(()=>{
  if(!saved.ready||saved.workspaceId!==workspaceId)return;
  try{deviceDataStorage().setItem(storageKey,JSON.stringify(reconcileLayout(saved.layout,components)));setStorageWarning(false);}catch{setStorageWarning(true);}
 },[saved,workspaceId,storageKey,composition]);
 useEffect(()=>{
  const arrange=(event:Event)=>{
   if(!(event instanceof CustomEvent)||event.detail?.workspaceId!==workspaceId)return;
   const width=grid.current?.clientWidth??availableWidth;
   setSaved({workspaceId,layout:requestedLayout(components,width),ready:true});
   setPreview(null);setTarget(null);setDragging(null);setManipulating(false);gesture.current=null;
   setAnnouncement(he?'סידור הרכיבים עודכן':'Component layout updated');
  };
  window.addEventListener('shadowui:arrange-layout',arrange);
  return ()=>window.removeEventListener('shadowui:arrange-layout',arrange);
 },[workspaceId,components,availableWidth,he]);
 // Clicking a menu button must not depend on focus transfer (Safari can blur with no relatedTarget).
 useEffect(()=>{
  const closeOutside=(event:globalThis.PointerEvent)=>{
   grid.current?.closest('.workspace-stage')?.querySelectorAll<HTMLDetailsElement>('.card-layout-options[open], .layout-settings[open]').forEach(menu=>{
    if(event.target instanceof Node&&!menu.contains(event.target))menu.open=false;
   });
  };
  document.addEventListener('pointerdown',closeOutside);
  return ()=>document.removeEventListener('pointerdown',closeOutside);
 },[]);
 function commit(next:LayoutState){setSaved({workspaceId,layout:next,ready:true});setAnnouncement(he?'הסידור עודכן':'Layout updated');}
 function changeDensity(value:'compact'|'comfortable'){setDensity(value);try{deviceDataStorage().setItem(`${storageKey}:density`,value)}catch{setStorageWarning(true)}setAnnouncement(he?'צפיפות התצוגה עודכנה':'Display density updated');}
 function fixed(){return {...current.current,mode:'fixed' as const,order:[...current.current.order],sizes:Object.assign(Object.create(null),current.current.sizes)};}
 function move(id:string,to:number){const next=fixed();const from=next.order.indexOf(id);if(from<0)return;next.order.splice(from,1);next.order.splice(clamp(to,0,next.order.length),0,id);commit(next);setAnnouncement(he?'מיקום הקומפוננטה עודכן':'Component position updated');}
 function resize(id:string,size:Size){const next=fixed();next.sizes[id]={columns:clamp(size.columns,4,12),minHeight:clamp(size.minHeight,160,900)};commit(next);setAnnouncement(he?'גודל הקומפוננטה עודכן':'Component size updated');}
 function begin(event:PointerEvent<HTMLButtonElement>,id:string,kind:Gesture['kind']){
  if(event.button!==0||!grid.current||(kind==='resize'&&matchMedia('(max-width: 740px)').matches))return;
  const card=event.currentTarget.closest<HTMLElement>('[data-component-id]');if(!card)return;
  const size=current.current.sizes[id];if(!size)return;
  setManipulating(true);
  event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
  const styles=getComputedStyle(grid.current);
  gesture.current={kind,id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,columns:size.columns,height:card.getBoundingClientRect().height,unit:(grid.current.clientWidth+parseFloat(styles.columnGap||'0'))/12,rtl:styles.direction==='rtl',changed:false,target:null,size:null};
  const active=gesture.current;
  const tick=()=>{
   if(gesture.current!==active)return;
   if(active.kind==='move'&&active.changed){
    const scroll=grid.current?.closest<HTMLElement>('.main-scroll');
    if(scroll){
     const rect=scroll.getBoundingClientRect();
     const delta=active.lastY>rect.bottom-60?14:active.lastY<rect.top+60?-14:0;
     if(delta){scroll.scrollBy({top:delta,behavior:'instant'});findTarget(active,active.lastX,active.lastY);}
    }
   }
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 }
 function update(event:PointerEvent<HTMLButtonElement>){
  const active=gesture.current;if(!active||active.pointerId!==event.pointerId)return;
  const dx=event.clientX-active.x,dy=event.clientY-active.y;
  if(!active.changed&&Math.hypot(dx,dy)<6)return;
  active.changed=true;
  if(active.kind==='move')setDragging(active.id);
  if(active.kind==='resize'){
   const size={columns:clamp(active.columns+Math.round((active.rtl?-dx:dx)/active.unit),4,12),minHeight:clamp(Math.round(active.height+dy),160,900)};
   active.size=size;setPreview({id:active.id,size});
  }else{
   active.lastX=event.clientX;active.lastY=event.clientY;findTarget(active,event.clientX,event.clientY);
  }
 }
 function findTarget(active:Gesture,x:number,y:number){
   const hit=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-component-id]');
   let destination=hit&&grid.current?.contains(hit)?hit:null;
   // Grid gutters and the space below shorter cards are valid drop zones too.
   if(!destination&&grid.current){
    const bounds=grid.current.getBoundingClientRect();
    if(x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom){
     let nearest=Infinity;
     grid.current.querySelectorAll<HTMLElement>(':scope > [data-component-id]').forEach(card=>{
      const rect=card.getBoundingClientRect();
      const distance=Math.hypot(Math.max(rect.left-x,0,x-rect.right),Math.max(rect.top-y,0,y-rect.bottom));
      if(distance<nearest){nearest=distance;destination=card;}
     });
    }
   }
   active.target=destination?.dataset.componentId??null;setTarget(active.target);

 }
 function finish(event:PointerEvent<HTMLButtonElement>,cancel=false){
  const active=gesture.current;if(!active||active.pointerId!==event.pointerId)return;
  gesture.current=null;setPreview(null);setTarget(null);setDragging(null);setManipulating(false);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(cancel||!active.changed)return;
  if(active.kind==='resize'&&active.size)resize(active.id,active.size);
  if(active.kind==='move'&&active.target&&active.target!==active.id)move(active.id,current.current.order.indexOf(active.target));
 }
 function cancel(){gesture.current=null;setPreview(null);setTarget(null);setDragging(null);setManipulating(false);}
 useEffect(()=>()=>{gesture.current=null;},[]);
 const pointerHandlers={onPointerMove:update,onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>finish(e),onPointerCancel:(e:PointerEvent<HTMLButtonElement>)=>finish(e,true),onLostPointerCapture:cancel,onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(e.key==='Escape')cancel();}};
 const byId=new Map(components.map(c=>[c.id,c]));
 return <div className={`workspace-stage${reading?' lesson-layout':''}${density==='compact'?' layout-compact':''}`} dir={he?'rtl':'ltr'}>
  {components.length>1&&availableWidth>=680&&<div className="layout-toolbar"><details className="layout-settings" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary><SlidersHorizontal size={17} aria-hidden="true"/><span className="layout-trigger-label">{he?'תצוגה ועמודות':'Display & columns'}</span><span>{layout.mode==='auto'?(he?'התאמה אוטומטית':'Automatic'):(he?'מותאם אישית':'Custom')}</span></summary><div className="layout-settings-panel">
   <div className="layout-panel-heading"><strong>{he?'איך להציג את סביבת העבודה?':'How should this workspace look?'}</strong><button type="button" className="layout-close" aria-label={he?'סגירת הגדרות תצוגה':'Close display settings'} onClick={event=>{const details=event.currentTarget.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus();}}}><X size={16}/></button></div>
   <p className="layout-help">{he?'בחרו פריסה — השינוי מוצג מיד ונשמר לסביבת העבודה הזו.':'Choose an arrangement. Changes appear immediately and are saved for this workspace.'}</p>
   <div className="layout-presets" role="group" aria-label={he?'מספר עמודות':'Column count'}>{(['auto','1','2','3'] as const).filter(value=>value!=='3'||availableWidth>=1050).map(value=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>commit(value==='auto'?automaticLayout(components,availableWidth):columnLayout(components,Number(value) as 1|2|3))}><span className={`layout-preview preview-columns-${value}`} aria-hidden="true">{Array.from({length:value==='auto'?3:Number(value)},(_,index)=><i key={index}/>)}</span><span>{value==='auto'?(he?'אוטומטי':'Automatic'):value==='1'?(he?'עמודה אחת':'One column'):value==='2'?(he?'שתי עמודות':'Two columns'):(he?'שלוש עמודות':'Three columns')}</span></button>)}</div>
   <p className="layout-help">{he?'באוטומטי: הסברים מקבלים רוחב לקריאה; כלי תרגול מוצגים זה לצד זה כשיש מקום. במסך צר העמודות מצטמצמות.':'Automatic gives explanations room to read and places practice tools side by side when space allows. Narrow screens use fewer columns.'}</p>
   <span className="layout-field-label">{he?'מרווחים בין התכנים':'Content spacing'}</span><div className="layout-density" role="group" aria-label={he?'צפיפות':'Density'}>{(['compact','comfortable'] as const).map(value=><button type="button" key={value} aria-pressed={density===value} onClick={()=>changeDensity(value)}>{value==='compact'?(he?'צפוף':'Compact'):(he?'מרווח':'Comfortable')}</button>)}</div>
  </div></details></div>}
  {announcement&&<p className="layout-feedback" role="status">{announcement}</p>}
  {storageWarning&&<p className="r-feedback r-small" role="status">{he?'לא ניתן לשמור את הסידור בדפדפן הזה. הוא יישמר כל עוד העמוד פתוח.':'This browser could not save the layout. It will last while this page stays open.'}</p>}
  <div className="workspace-surface"><div className={`r-grid${!flowing&&components.every(c=>rowSpans[c.id])?' masonry-ready':''}`} ref={grid}><AnimatePresence initial={false}>{layout.order.map((id,index)=>{
   const c=byId.get(id);if(!c)return null;
   const Icon=toolIcons[c.type];const size=preview?.id===id?preview.size:layout.sizes[id];
   return <AnimatedCard key={id} layout={reducedMotion||manipulating||dragging?false:'position'} layoutDependency={layoutMotionKey} initial={reducedMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={reducedMotion?{opacity:1}:{opacity:0}} transition={{layout:{type:'spring',duration:0.3,bounce:0.1},opacity:{duration:reducedMotion?0:0.15},y:{duration:reducedMotion?0:0.2}}} id={`tool-${id}`} data-component-id={id} aria-label={c.title} className={`r-card tool-${c.type}${target===id&&dragging!==id?' is-drag-target':''}${dragging===id?' is-dragging':''}`} style={{'--card-columns':Math.max(availableWidth<680?12:availableWidth<1050?6:4,size.columns),'--card-min-height':`${size.minHeight}px`,gridRowEnd:!flowing&&rowSpans[id]?`span ${rowSpans[id]}`:undefined} as CSSProperties}>
    <header className="r-card-header"><div className="r-card-mark"><Icon size={18} aria-hidden="true"/></div><h3>{c.title}</h3><div className="card-controls"><button className="drag-handle" type="button" aria-label={`${he?'הזזת':'Move'} ${c.title}`} title={he?'גרירה לשינוי מיקום':'Drag to move'} aria-keyshortcuts="ArrowUp ArrowDown Home End" onPointerDown={event=>begin(event,id,'move')} {...pointerHandlers} onKeyDown={event=>{
      if(event.key==='Escape'){cancel();return;}
      const position=event.key==='ArrowUp'?index-1:event.key==='ArrowDown'?index+1:event.key==='Home'?0:event.key==='End'?layout.order.length-1:null;
      if(position!==null){event.preventDefault();move(id,position);}
     }}><GripVertical size={16}/></button><details className="card-layout-options" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label={`${he?'אפשרויות סידור עבור':'Layout options for'} ${c.title}`}><MoreHorizontal size={18}/></summary><div className="card-menu">
     <button type="button" disabled={index===0} onClick={()=>move(id,index-1)}>{he?'הזזה אחורה':'Move earlier'}</button><button type="button" disabled={index===layout.order.length-1} onClick={()=>move(id,index+1)}>{he?'הזזה קדימה':'Move later'}</button>
     <button className="desktop-layout-control" type="button" disabled={size.columns>=12} onClick={()=>resize(id,{...size,columns:size.columns+2})}>{he?'הרחבה':'Wider'}</button><button className="desktop-layout-control" type="button" disabled={size.columns<=4} onClick={()=>resize(id,{...size,columns:size.columns-2})}>{he?'הצרה':'Narrower'}</button>
     <button className="desktop-layout-control" type="button" disabled={size.minHeight>=900} onClick={()=>resize(id,{...size,minHeight:Math.max(size.minHeight,Array.from(grid.current?.children??[]).find(card=>(card as HTMLElement).dataset.componentId===id)?.getBoundingClientRect().height??0)+80})}>{he?'הגדלת גובה':'Taller'}</button><button className="desktop-layout-control" type="button" disabled={size.minHeight<=160} onClick={()=>resize(id,{...size,minHeight:size.minHeight-80})}>{he?'הקטנת גובה':'Shorter'}</button>
    </div></details></div></header><div className="r-card-content">{children(c)}</div><button className="resize-handle desktop-layout-control" type="button" aria-label={`${he?'שינוי גודל':'Resize'} ${c.title}`} title={`${he?'שינוי גודל':'Resize'} · ${toolLabel(c.type,locale)}`} onPointerDown={event=>begin(event,id,'resize')} {...pointerHandlers}><MoveDiagonal2 size={15}/></button>
   </AnimatedCard>;
  })}</AnimatePresence></div>{!components.length&&<p className="workspace-empty" role="status">{he?'אין כרגע כלים זמינים להצגה. אפשר לעדכן את הבקשה למטה.':'No tools are currently available. Update your request below.'}</p>}</div>

 </div>;
}

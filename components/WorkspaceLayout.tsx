'use client';

import {useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence, animate, motion, useMotionValue, useIsPresent, useReducedMotion, type HTMLMotionProps, type MotionStyle} from 'motion/react';
import {GripVertical, MoreHorizontal, MoveDiagonal2, Maximize2, Minimize2, SlidersHorizontal, ChevronLeft, ChevronRight, X} from 'lucide-react';
import type {UIComponent} from '@/lib/schema';
import {viewportLayout, setViewportPageTools, parseViewportPages, automaticLayout, columnLayout, isLessonLayout, parseLayout, reconcileLayout, requestedLayout, type LayoutState} from '@/lib/workspace-layout';
import {createPageWheelGesture, updatePageWheelGesture} from '@/lib/workspace-page-gesture';
import {deviceDataStorage} from '@/lib/account-device-data';
import {toolIcons, toolLabel} from './tool-metadata';
import './viewport-workspace.css';

type Size = LayoutState['sizes'][string];
type Gesture = {kind:'move'|'resize';id:string;pointerId:number;x:number;y:number;lastX:number;lastY:number;columns:number;height:number;unit:number;rtl:boolean;changed:boolean;target:string|null;size:Size|null};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

// Keep exiting controls out of keyboard and screen-reader navigation.
function AnimatedCard(props:HTMLMotionProps<'section'>){
 const present=useIsPresent();
 return <motion.section {...props} inert={!present||props.inert} aria-hidden={!present||props.inert?true:undefined}/>;
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
 const [presentation,setPresentation]=useState<'fit'|'vertical'>('fit');
 const [availableHeight,setAvailableHeight]=useState(220);
 const [measuredWorkspace,setMeasuredWorkspace]=useState<string|null>(null);
 const [motionWorkspace,setMotionWorkspace]=useState<string|null>(null);
 const [pagePreferences,setPagePreferences]=useState<Record<string,string[][]>>({});
 const [pageEditor,setPageEditor]=useState(false);
 const [pageDraft,setPageDraft]=useState<string[]>([]);
 const editorDialog=useRef<HTMLDivElement>(null);
 const swipe=useRef<{x:number;y:number;blocked:boolean}|null>(null);
 const wheelGesture=useRef(createPageWheelGesture());
 const pageOffset=useMotionValue(0);
 const pageAnimation=useRef<{stop:()=>void}|null>(null);
 const wheelSettle=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [expandedId,setExpandedId]=useState<string|null>(null);
 const stage=useRef<HTMLDivElement>(null);
 const expansionTrigger=useRef<HTMLButtonElement|null>(null);
 const grid=useRef<HTMLDivElement>(null);
 const gesture=useRef<Gesture|null>(null);
 const storageKey=`shadowui.layout.v1:${workspaceId}`;
 const [availableWidth,setAvailableWidth]=useState(1050);
 const [rowSpans,setRowSpans]=useState<Record<string,number>>({});
 const reconciled=reconcileLayout(saved.workspaceId===workspaceId?saved.layout:automaticLayout(components),components);
 const layout=reconciled.mode==='auto'?automaticLayout(components,availableWidth):reconciled;
 const fit=presentation==='fit';
 const initialized=saved.ready&&saved.workspaceId===workspaceId&&measuredWorkspace===workspaceId;
 const animateLayout=initialized&&motionWorkspace===workspaceId;
 const automaticViewport=viewportLayout(components,layout.order,availableWidth,availableHeight);
 const pageProfile=`${automaticViewport.columns}:${Math.max(1,Math.floor((availableHeight+12)/232))}`;
 const viewport=viewportLayout(components,layout.order,availableWidth,availableHeight,pagePreferences[pageProfile]);
 const selected=selectedId&&layout.order.includes(selectedId)?selectedId:layout.order[0];
 const expanded=expandedId&&layout.order.includes(expandedId)?expandedId:null;
 const groupIndex=Math.max(0,viewport.groups.findIndex(group=>group.ids.includes(selected)));
 const group=viewport.groups[groupIndex];
 const visibleIds=new Set(expanded?[expanded]:group?.ids??[]);
 const singleColumn=layout.order.every(id=>layout.sizes[id].columns===12);
 const reading=isLessonLayout(components)&&singleColumn;
 const flowing=reading||singleColumn;
 const uniform=layout.order.length?layout.sizes[layout.order[0]].columns:12;
 const preset=layout.mode==='auto'?'auto':layout.order.every(id=>layout.sizes[id].columns===uniform)&&[4,6,12].includes(uniform)?String(12/uniform):'custom';
 const current=useRef(layout);current.current=layout;
 const composition=components.map(c=>`${c.id}:${c.type}:${c.span}`).join('|');
 // Content typing does not trigger card layout animations.
 const layoutMotionKey=`${workspaceId}:${composition}:${layout.order.join(',')}:${availableWidth}:${fit?availableHeight:0}:${presentation}:${expanded}:${density}:${JSON.stringify(layout.sizes)}`;
 // Initial measurement is not a layout change to animate. Keep Motion's
 // dependency stable through initialization and arming; later edits use it normally.
 const initialGeometry=useRef(layoutMotionKey);
 if(!animateLayout)initialGeometry.current=layoutMotionKey;
 const motionDependency=layoutMotionKey===initialGeometry.current?`${workspaceId}:initial`:layoutMotionKey;
 const measure=useCallback(()=>{
  const element=grid.current;if(!element)return;
  const canvas=element.closest<HTMLElement>('.workspace')??element.parentElement!;
   const surface=element.parentElement!;
   if(canvas.clientWidth<=0||(fit&&surface.clientHeight<=0&&components.length>0))return;
   const style=getComputedStyle(canvas);
   setAvailableWidth(Math.round(canvas.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)));
   setMeasuredWorkspace(workspaceId);
   setAvailableHeight(Math.round(fit?surface.clientHeight:element.clientHeight));
   if(fit)canvas.closest<HTMLElement>('.shell')?.style.setProperty('--workspace-tools-bottom',`${Math.ceil(surface.getBoundingClientRect().top)}px`);
   if(fit)return;
   const styles=getComputedStyle(element);
   // Use the final masonry metrics even before its class is enabled.
   const gap=parseFloat(styles.getPropertyValue('--masonry-row-gap'))||12;
   const rowHeight=parseFloat(styles.getPropertyValue('--masonry-row-height'))||1;
   const next:Record<string,number>=Object.create(null);
   element.querySelectorAll<HTMLElement>(':scope > [data-component-id]').forEach(card=>{next[card.dataset.componentId!]=Math.max(1,Math.ceil((card.offsetHeight+gap)/(rowHeight+gap)));});
   setRowSpans(previous=>Object.keys(previous).length===Object.keys(next).length&&Object.keys(next).every(id=>previous[id]===next[id])?previous:next);
 },[workspaceId,composition,fit]);
 useLayoutEffect(()=>{if(!animateLayout)measure();},[measure,animateLayout]);
 useEffect(()=>{
  const element=grid.current;if(!element)return;
  const canvas=element.closest<HTMLElement>('.workspace')??element.parentElement!;
  const observer=new ResizeObserver(measure);observer.observe(element);observer.observe(canvas);observer.observe(element.parentElement!);
  element.querySelectorAll(':scope > [data-component-id]').forEach(card=>observer.observe(card));
  measure();return ()=>observer.disconnect();
 },[measure]);
 useEffect(()=>{
  setSaved(previous=>{if(!previous.ready||previous.workspaceId!==workspaceId)return previous;const next=reconcileLayout(previous.layout,components);return JSON.stringify(next)===JSON.stringify(previous.layout)?previous:{...previous,layout:next};});
 },[workspaceId,composition]);
 useLayoutEffect(()=>{
  let restored:LayoutState|null=null;
  try{const raw=deviceDataStorage().getItem(storageKey);if(raw)restored=parseLayout(JSON.parse(raw));setDensity(deviceDataStorage().getItem(`${storageKey}:density`)==='comfortable'?'comfortable':'compact');setPresentation(deviceDataStorage().getItem(`${storageKey}:presentation`)==='vertical'?'vertical':'fit');}catch{}
  const preferences:Record<string,string[][]>={};
  try{const raw=JSON.parse(deviceDataStorage().getItem(`${storageKey}:pages`)??'{}');if(raw&&typeof raw==='object')for(const [key,value] of Object.entries(raw)){const pages=parseViewportPages(value);if(pages&&/^\d+:\d+$/.test(key))preferences[key]=pages;}}catch{}
  pageAnimation.current?.stop();pageOffset.set(0);wheelGesture.current=createPageWheelGesture();if(wheelSettle.current)clearTimeout(wheelSettle.current);
  setPagePreferences(preferences);setPageEditor(false);
  setSaved({workspaceId,layout:restored??automaticLayout(components),ready:true});
  setSelectedId(null);setExpandedId(null);setPreview(null);setTarget(null);setDragging(null);setManipulating(false);gesture.current=null;setStorageWarning(false);
  // Restore once per workspace; content edits are reconciled without resetting the layout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[workspaceId,storageKey]);
 // The first visible frame already has measured geometry and restored settings.
 // Arm subsequent layout transitions after it is painted, without delaying display.
 useEffect(()=>{
  if(!initialized)return;
  let paint=0;
  const frame=requestAnimationFrame(()=>{paint=requestAnimationFrame(()=>setMotionWorkspace(workspaceId));});
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(paint);};
 },[workspaceId,initialized]);
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
 useEffect(()=>{stage.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(positionMenu);},[availableWidth,availableHeight,he]);
 useEffect(()=>{stage.current?.querySelectorAll<HTMLDetailsElement>('.card-layout-options[open]').forEach(menu=>{menu.open=false;});},[groupIndex,expanded,presentation]);
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
 // Keep the active page selector visible without moving editor focus.
 useEffect(()=>{
  const button=stage.current?.querySelector<HTMLElement>('[data-active-page="true"]');
  if(button){const nav=button.parentElement!;const box=button.getBoundingClientRect(),bounds=nav.getBoundingClientRect();if(box.left<bounds.left||box.right>bounds.right)nav.scrollBy({left:box.left-bounds.left-(bounds.width-box.width)/2,behavior:reducedMotion?'instant':'smooth'});}
  if(document.activeElement instanceof HTMLElement&&document.activeElement.closest('.r-card[inert]'))button?.focus({preventScroll:true});
 },[groupIndex,availableWidth,reducedMotion]);
 function settlePage(from?:number){
  pageAnimation.current?.stop();
  if(wheelSettle.current)clearTimeout(wheelSettle.current);
  if(reducedMotion){pageOffset.set(0);return;}
  if(from!==undefined)pageOffset.set(from);
  pageAnimation.current=animate(pageOffset,0,{duration:.2,ease:[.22,1,.36,1]});
 }
 function goPage(index:number){
  if(index<0||index>=viewport.groups.length||index===groupIndex){settlePage();return;}
  const direction=(index>groupIndex?1:-1)*(he?-1:1);
  selectTool(viewport.groups[index].ids[0]);
  settlePage(direction*28);
 }
 function blocksPaging(target:EventTarget|null){
  if(!(target instanceof Element))return true;
  if(target.closest('input,textarea,select,button,a,summary,[contenteditable=true],.card-menu,.layout-settings-panel,[role=slider]'))return true;
  for(let node:Element|null=target;node&&node!==stage.current;node=node.parentElement){
   if(node instanceof HTMLElement&&node.scrollWidth>node.clientWidth+2&&/auto|scroll/.test(getComputedStyle(node).overflowX))return true;
  }
  return false;
 }
 useEffect(()=>{
  const surface=stage.current;
  if(!fit||!surface)return;
  const wheel=(event:WheelEvent)=>{
   const horizontal=event.deltaX||(event.shiftKey?event.deltaY:0);
   if(event.ctrlKey||!horizontal||(!event.shiftKey&&Math.abs(event.deltaX)<=Math.abs(event.deltaY)*1.4))return;
   // Let real horizontal scrollers consume the gesture; never chain it to history.
   let localScroll:HTMLElement|null=null;
   for(let node=event.target instanceof Element?event.target:null;node&&node!==surface;node=node.parentElement){if(node instanceof HTMLElement&&node.scrollWidth>node.clientWidth+2&&/auto|scroll/.test(getComputedStyle(node).overflowX)){localScroll=node;break;}}
   event.preventDefault();
   if(localScroll){localScroll.scrollBy({left:horizontal*(event.deltaMode===1?16:1),behavior:'instant'});return;}
   if(expanded||pageEditor||!(event.target instanceof Element)||!event.target.closest('.workspace-surface')||event.target.closest('select,input[type=range],[role=slider]'))return;
   const movement=updatePageWheelGesture(wheelGesture.current,horizontal*(event.deltaMode===1?16:1),performance.now());
   if(movement.step){goPage(groupIndex+movement.step*(he?-1:1));return;}
   if(movement.offset&&!reducedMotion){
    pageAnimation.current?.stop();pageOffset.set(-movement.offset);
    if(wheelSettle.current)clearTimeout(wheelSettle.current);
    wheelSettle.current=setTimeout(()=>settlePage(),100);
   }
  };
  const touchMove=(event:TouchEvent)=>{
   const start=swipe.current;if(!start||start.blocked||event.touches.length!==1)return;
   const touch=event.touches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
   if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.7){
    if(event.cancelable)event.preventDefault();
    if(!reducedMotion){pageAnimation.current?.stop();pageOffset.set(clamp(dx*.45,-48,48));}
   }
  };
  surface.addEventListener('wheel',wheel,{passive:false});surface.addEventListener('touchmove',touchMove,{passive:false});
  return()=>{surface.removeEventListener('wheel',wheel);surface.removeEventListener('touchmove',touchMove);};
 });
 useEffect(()=>{
  if(!expanded||pageEditor)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();setExpandedId(null);requestAnimationFrame(()=>expansionTrigger.current?.focus({preventScroll:true}));}};
  document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
 },[expanded,pageEditor]);
 useEffect(()=>{
  if(!pageEditor)return;
  const frame=requestAnimationFrame(()=>editorDialog.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true}));
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setPageEditor(false);return;}
   if(event.key!=='Tab')return;
   const controls=[...editorDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]];
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  const backdrop=editorDialog.current?.parentElement;
  const wheel=(event:WheelEvent)=>{if(!event.ctrlKey&&Math.abs(event.deltaX)>Math.abs(event.deltaY))event.preventDefault();};
  backdrop?.addEventListener('wheel',wheel,{passive:false});
  document.addEventListener('keydown',keyboard);
  return()=>{cancelAnimationFrame(frame);backdrop?.removeEventListener('wheel',wheel);document.removeEventListener('keydown',keyboard);requestAnimationFrame(()=>stage.current?.querySelector<HTMLButtonElement>('.page-edit-toggle')?.focus({preventScroll:true}));};
 },[pageEditor]);
 // Place menus against the viewport, so scrollable card bodies cannot clip them.
 function positionMenu(details:HTMLDetailsElement){
  if(!details.open)return;
  const panel=details.querySelector<HTMLElement>('.card-menu, .layout-settings-panel');if(!panel)return;
  const anchor=details.querySelector('summary')!.getBoundingClientRect();
  const width=Math.min(panel.classList.contains('card-menu')?210:360,window.innerWidth-24);
  panel.style.position='fixed';panel.style.width=`${width}px`;panel.style.maxWidth='none';panel.style.insetInlineEnd='auto';panel.style.right='auto';
  panel.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,he?anchor.right-width:anchor.left))}px`;
  const height=Math.min(panel.scrollHeight,window.innerHeight-24);
  panel.style.top=`${Math.max(12,Math.min(anchor.bottom+6,window.innerHeight-height-12))}px`;
  panel.style.maxHeight=`${window.innerHeight-24}px`;panel.style.overflowY='auto';panel.style.zIndex='60';
 }
 function changePresentation(value:'fit'|'vertical'){
  pageAnimation.current?.stop();pageOffset.set(0);if(wheelSettle.current)clearTimeout(wheelSettle.current);
  setPresentation(value);setExpandedId(null);cancel();
  try{deviceDataStorage().setItem(`${storageKey}:presentation`,value);}catch{setStorageWarning(true);}
 }
 function savePages(next:Record<string,string[][]>){setPagePreferences(next);try{deviceDataStorage().setItem(`${storageKey}:pages`,JSON.stringify(next));}catch{setStorageWarning(true);}}
 function openPageEditor(){setPageDraft([...(group?.ids??[])]);setPageEditor(true);}
 function applyPageDraft(){
  const ids=layout.order.filter(id=>pageDraft.includes(id));if(!ids.length)return;
  savePages({...pagePreferences,[pageProfile]:setViewportPageTools(viewport.groups.map(page=>page.ids),groupIndex,ids)});
  setSelectedId(ids[0]);setExpandedId(null);setPageEditor(false);setAnnouncement(he?'הדף עודכן ושאר הכלים סודרו אוטומטית':'Page updated; remaining tools arranged automatically');
 }
 function resetPages(){const next={...pagePreferences};delete next[pageProfile];savePages(next);setAnnouncement(he?'החלוקה האוטומטית חזרה':'Automatic pages restored');}
 function selectTool(id:string){setSelectedId(id);setExpandedId(null);stage.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu=>{menu.open=false;});}
 function expandTool(id:string,button:HTMLButtonElement){
  if(expanded===id){setExpandedId(null);expansionTrigger.current?.focus({preventScroll:true});}
  else{expansionTrigger.current=button;setSelectedId(id);setExpandedId(id);}
 }
 function commit(next:LayoutState){setSaved({workspaceId,layout:next,ready:true});setAnnouncement(he?'הסידור עודכן':'Layout updated');}
 function changeDensity(value:'compact'|'comfortable'){setDensity(value);try{deviceDataStorage().setItem(`${storageKey}:density`,value)}catch{setStorageWarning(true)}setAnnouncement(he?'צפיפות התצוגה עודכנה':'Display density updated');}
 function fixed(){return {...current.current,mode:'fixed' as const,order:[...current.current.order],sizes:Object.assign(Object.create(null),current.current.sizes)};}
 function move(id:string,to:number){const next=fixed();const from=next.order.indexOf(id);if(from<0)return;next.order.splice(from,1);next.order.splice(clamp(to,0,next.order.length),0,id);commit(next);setAnnouncement(he?'מיקום הקומפוננטה עודכן':'Component position updated');}
 function resize(id:string,size:Size){if(fit)changePresentation('vertical');const next=fixed();next.sizes[id]={columns:clamp(size.columns,4,12),minHeight:clamp(size.minHeight,160,900)};commit(next);setAnnouncement(he?'גודל הקומפוננטה עודכן':'Component size updated');}
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
 useEffect(()=>()=>{gesture.current=null;pageAnimation.current?.stop();if(wheelSettle.current)clearTimeout(wheelSettle.current);},[]);
 const pointerHandlers={onPointerMove:update,onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>finish(e),onPointerCancel:(e:PointerEvent<HTMLButtonElement>)=>finish(e,true),onLostPointerCapture:cancel,onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(e.key==='Escape')cancel();}};
 const byId=new Map(components.map(c=>[c.id,c]));
 const draftTools=layout.order.filter(id=>pageDraft.includes(id));
 const draftFits=viewportLayout(components.filter(component=>draftTools.includes(component.id)),draftTools,availableWidth,availableHeight).groups[0]?.ids.length??0;
 return <div ref={stage} data-layout-ready={initialized} aria-busy={!initialized} inert={!initialized||pageEditor} style={{visibility:initialized?'visible':'hidden'}} data-presentation={presentation} className={`workspace-stage${fit?' viewport-fit':''}${reading&&!fit?' lesson-layout':''}${density==='compact'?' layout-compact':''}`} dir={he?'rtl':'ltr'}>
  <div className="viewport-controls">

  {<div className="layout-toolbar"><details className="layout-settings" onToggle={event=>positionMenu(event.currentTarget)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary><SlidersHorizontal size={17} aria-hidden="true"/><span className="layout-trigger-label">{he?'תצוגה':'Display'}</span><span>{fit?(he?'התאמה למסך':'Fit to screen'):layout.mode==='auto'?(he?'אנכית · אוטומטי':'Vertical · Automatic'):(he?'אנכית · מותאם אישית':'Vertical · Custom')}</span></summary><div className="layout-settings-panel">
   <div className="layout-panel-heading"><strong>{he?'איך להציג את סביבת העבודה?':'How should this workspace look?'}</strong><button type="button" className="layout-close" aria-label={he?'סגירת הגדרות תצוגה':'Close display settings'} onClick={event=>{const details=event.currentTarget.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus();}}}><X size={16}/></button></div>
   <span className="layout-field-label">{he?'סביבת העבודה':'Workspace view'}</span><div className="viewport-view-toggle" role="group" aria-label={he?'סוג תצוגה':'Workspace view'}>{(['fit','vertical'] as const).map(value=><button type="button" key={value} aria-pressed={presentation===value} onClick={()=>changePresentation(value)}>{presentation===value&&<motion.span className="viewport-selection" layoutId={`display-mode-${workspaceId}`} transition={{duration:reducedMotion?0:.28,ease:[.22,1,.36,1]}} aria-hidden="true"/>}{value==='fit'?(he?'התאמה למסך':'Fit to screen'):(he?'תצוגה אנכית':'Vertical view')}</button>)}</div>
   <p className="layout-help">{fit?(he?'העמודות מותאמות למסך אוטומטית. בחירת עמודות ידנית תעביר לתצוגה אנכית.':'Columns fit the screen automatically. Choosing columns switches to vertical view.'):(he?'בחרו פריסה — השינוי מוצג מיד ונשמר לסביבת העבודה הזו.':'Choose an arrangement. Changes appear immediately and are saved for this workspace.')}</p>
   <span className="layout-field-label">{he?'עמודות בתצוגה אנכית':'Columns in vertical view'}</span><div className="layout-presets" role="group" aria-label={he?'מספר עמודות':'Column count'}>{(['auto','1','2','3'] as const).filter(value=>value!=='3'||availableWidth>=1050).map(value=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>{if(fit)changePresentation('vertical');commit(value==='auto'?automaticLayout(components,availableWidth):columnLayout(components,Number(value) as 1|2|3));}}><span className={`layout-preview preview-columns-${value}`} aria-hidden="true">{Array.from({length:value==='auto'?3:Number(value)},(_,index)=><i key={index}/>)}</span><span>{value==='auto'?(he?'אוטומטי':'Automatic'):value==='1'?(he?'עמודה אחת':'One column'):value==='2'?(he?'שתי עמודות':'Two columns'):(he?'שלוש עמודות':'Three columns')}</span></button>)}</div>
   <p className="layout-help">{he?'באוטומטי: הסברים מקבלים רוחב לקריאה; כלי תרגול מוצגים זה לצד זה כשיש מקום. במסך צר העמודות מצטמצמות.':'Automatic gives explanations room to read and places practice tools side by side when space allows. Narrow screens use fewer columns.'}</p>
   <span className="layout-field-label">{he?'מרווחים בין התכנים':'Content spacing'}</span><div className="layout-density" role="group" aria-label={he?'צפיפות':'Density'}>{(['compact','comfortable'] as const).map(value=><button type="button" key={value} aria-pressed={density===value} onClick={()=>changeDensity(value)}>{value==='compact'?(he?'צפוף':'Compact'):(he?'מרווח':'Comfortable')}</button>)}</div>
  </div></details></div>}
  </div>
  {fit&&components.length>0&&<div className="viewport-navigation page-navigation">
   <button type="button" className="page-arrow" aria-label={he?'הדף הקודם':'Previous page'} disabled={groupIndex===0} onClick={()=>goPage(groupIndex-1)}>{he?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button>
   <nav className="viewport-tool-nav page-tabs" onKeyDown={event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const next=groupIndex+(event.key==='ArrowRight'?1:-1)*(he?-1:1);goPage(next);requestAnimationFrame(()=>stage.current?.querySelector<HTMLButtonElement>('[data-active-page="true"]')?.focus({preventScroll:true}));}} aria-label={he?'דפי סביבת העבודה':'Workspace pages'}>{viewport.groups.map((page,index)=>{
    const titles=page.ids.map(id=>byId.get(id)?.title??'');
    const summary=titles.slice(0,2).join(' · ')+(titles.length>2?` +${titles.length-2}`:'');
    return <button type="button" key={page.ids.join(':')} data-page-tools={page.ids.join(' ')} data-active-page={groupIndex===index} aria-current={groupIndex===index?'page':undefined} aria-label={`${he?'דף':'Page'} ${index+1}: ${titles.join(', ')}`} title={titles.join(' · ')} onClick={()=>goPage(index)}>
     {groupIndex===index&&<motion.i className="page-active-indicator" layoutId={`active-page-${workspaceId}`} transition={{duration:reducedMotion?0:.24,ease:[.22,1,.36,1]}}/>}<b>{index+1}</b><span>{summary}</span>
    </button>;
   })}</nav>
   <button type="button" className="page-arrow" aria-label={he?'הדף הבא':'Next page'} disabled={groupIndex===viewport.groups.length-1} onClick={()=>goPage(groupIndex+1)}>{he?<ChevronLeft size={17}/>:<ChevronRight size={17}/>}</button>
   <button type="button" className="page-edit-toggle" aria-label={he?'עריכת דף':'Edit page'} aria-expanded={pageEditor} onClick={openPageEditor}><SlidersHorizontal size={15}/><span>{he?'עריכת דף':'Edit page'}</span></button>
  </div>}
  {typeof document!=='undefined'&&createPortal(<AnimatePresence initial={false}>{fit&&pageEditor&&<motion.div className="page-editor-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reducedMotion?0:.16}} onPointerDown={event=>{if(event.target===event.currentTarget)setPageEditor(false);}}>
   <motion.div ref={editorDialog} className="page-editor" role="dialog" aria-modal="true" aria-labelledby={`page-editor-title-${workspaceId}`} aria-describedby={`page-editor-help-${workspaceId}`} dir={he?'rtl':'ltr'} initial={reducedMotion?false:{y:8,scale:.985}} animate={{y:0,scale:1}} exit={reducedMotion?{}:{y:4,scale:.99}} transition={{duration:reducedMotion?0:.18,ease:[.22,1,.36,1]}}>
    <header className="page-editor-heading"><div><h2 id={`page-editor-title-${workspaceId}`}>{he?`הכלים בדף ${groupIndex+1}`:`Tools on page ${groupIndex+1}`}</h2><p id={`page-editor-help-${workspaceId}`}>{he?'בחרו את הכלים שחשובים כאן. היתר מסתדרים לבד.':'Choose the tools you want here. The rest arrange themselves.'}</p></div><button type="button" aria-label={he?'סגירת עריכת דף':'Close page editor'} onClick={()=>setPageEditor(false)}><X size={18}/></button></header>
    <div className="page-editor-tools">{layout.order.map(id=>{const component=byId.get(id);if(!component)return null;const Icon=toolIcons[component.type];const page=viewport.groups.findIndex(page=>page.ids.includes(id));return <label key={id} className={pageDraft.includes(id)?'is-selected':''} title={component.title}><input type="checkbox" aria-label={component.title} checked={pageDraft.includes(id)} onChange={event=>setPageDraft(previous=>event.target.checked?[...previous,id]:previous.filter(item=>item!==id))}/><Icon size={17} aria-hidden="true"/><span className="page-tool-copy"><strong>{component.title}</strong><small>{page===groupIndex?(he?'בדף הזה':'On this page'):`${he?'בדף':'On page'} ${page+1}`}</small></span></label>;})}</div>
    <p className="page-editor-capacity" role="status">{!draftTools.length?(he?'בחרו לפחות כלי אחד.':'Choose at least one tool.'):draftFits===draftTools.length?(he?`${draftTools.length} כלים · מתאימים למסך הזה`:`${draftTools.length} tools · fit this screen`):(he?`${draftFits} כלים כאן · היתר ימשיכו אוטומטית לדפים הבאים`:`${draftFits} tools here · the rest continue automatically on following pages`)}</p>
    <footer className="page-editor-actions"><button type="button" className="page-reset" onClick={()=>{resetPages();setPageEditor(false);}}>{he?'חזרה לאוטומטי':'Reset to automatic'}</button><button type="button" className="page-apply" disabled={!draftTools.length} onClick={applyPageDraft}>{he?'עדכון הדף':'Apply to page'}</button></footer>
   </motion.div>
  </motion.div>}</AnimatePresence>,stage.current?.closest('.shell')??document.body)}

  {announcement&&<p className={fit?"layout-feedback sr-only":"layout-feedback"} role="status">{announcement}</p>}
  {storageWarning&&<p className="r-feedback r-small" role="status">{he?'לא ניתן לשמור את הסידור בדפדפן הזה. הוא יישמר כל עוד העמוד פתוח.':'This browser could not save the layout. It will last while this page stays open.'}</p>}
  <div className="workspace-surface" onTouchStart={event=>{const touch=event.touches[0];swipe.current=event.touches.length===1&&!expanded?{x:touch.clientX,y:touch.clientY,blocked:blocksPaging(event.target)}:null;}} onTouchEnd={event=>{const start=swipe.current;swipe.current=null;if(!start||start.blocked||!fit||gesture.current)return;const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.7)goPage(groupIndex+(dx<0?1:-1)*(he?-1:1));else settlePage();}} onTouchCancel={()=>{swipe.current=null;settlePage();}}><motion.div className={`r-grid${fit?' viewport-grid':!flowing&&components.every(c=>rowSpans[c.id])?' masonry-ready':''}`} style={fit?{x:pageOffset,'--viewport-columns':expanded?1:viewport.columns,'--viewport-rows':expanded?1:group?.rows??1} as MotionStyle:undefined} ref={grid}><AnimatePresence initial={false}>{layout.order.map((id,index)=>{
   const c=byId.get(id);if(!c)return null;
   const hidden=fit&&!visibleIds.has(id);
   const placement=group?.placements[id];
   const Icon=toolIcons[c.type];const size=preview?.id===id?preview.size:layout.sizes[id];
   return <AnimatedCard key={id} inert={hidden} layout={hidden||reducedMotion||manipulating||dragging?false:true} layoutDependency={motionDependency} initial={false} animate={{opacity:1,y:0}} exit={reducedMotion?{opacity:1}:{opacity:0}} transition={{layout:{type:'spring',duration:!animateLayout||reducedMotion?0:0.38,bounce:0.05},opacity:{duration:fit||!animateLayout||reducedMotion?0:0.2},y:{duration:!animateLayout||reducedMotion?0:0.2}}} onFocusCapture={()=>{if(fit&&!hidden)setSelectedId(id);}} id={`tool-${id}`} data-component-id={id} aria-label={c.title} className={`r-card tool-${c.type}${hidden?' viewport-card-hidden':''}${target===id&&dragging!==id?' is-drag-target':''}${dragging===id?' is-dragging':''}`} style={{'--card-columns':Math.max(availableWidth<680?12:availableWidth<1050?6:4,size.columns),'--card-min-height':`${size.minHeight}px`,gridColumn:fit?(expanded||group?.ids.length===1?'1 / -1':placement?`${placement.column} / span ${placement.span}`:undefined):undefined,gridRowStart:fit?(expanded?'1':placement?String(placement.row):undefined):undefined,gridRowEnd:fit?'span 1':!flowing&&rowSpans[id]?`span ${rowSpans[id]}`:undefined} as CSSProperties}>
    <header className="r-card-header"><div className="r-card-mark"><Icon size={18} aria-hidden="true"/></div><h3>{c.title}</h3><div className="card-controls">{fit&&<button type="button" className="viewport-expand" aria-label={`${expanded===id?(he?'החזרת':'Restore'):(he?'הרחבת':'Expand')} ${c.title}`} aria-expanded={expanded===id} onClick={event=>expandTool(id,event.currentTarget)}>{expanded===id?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>}<button className="drag-handle" type="button" aria-label={`${he?'הזזת':'Move'} ${c.title}`} title={he?'גרירה לשינוי מיקום':'Drag to move'} aria-keyshortcuts="ArrowUp ArrowDown Home End" onPointerDown={event=>begin(event,id,'move')} {...pointerHandlers} onKeyDown={event=>{
      if(event.key==='Escape'){cancel();return;}
      const position=event.key==='ArrowUp'?index-1:event.key==='ArrowDown'?index+1:event.key==='Home'?0:event.key==='End'?layout.order.length-1:null;
      if(position!==null){event.preventDefault();move(id,position);}
     }}><GripVertical size={16}/></button><details className="card-layout-options" onToggle={event=>positionMenu(event.currentTarget)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label={`${he?'אפשרויות סידור עבור':'Layout options for'} ${c.title}`}><MoreHorizontal size={18}/></summary><div className="card-menu">
     <button type="button" disabled={index===0} onClick={()=>move(id,index-1)}>{he?'הזזה אחורה':'Move earlier'}</button><button type="button" disabled={index===layout.order.length-1} onClick={()=>move(id,index+1)}>{he?'הזזה קדימה':'Move later'}</button>
     <button className="desktop-layout-control" type="button" disabled={size.columns>=12} onClick={()=>resize(id,{...size,columns:size.columns+2})}>{he?'הרחבה':'Wider'}</button><button className="desktop-layout-control" type="button" disabled={size.columns<=4} onClick={()=>resize(id,{...size,columns:size.columns-2})}>{he?'הצרה':'Narrower'}</button>
     <button className="desktop-layout-control" type="button" disabled={size.minHeight>=900} onClick={()=>resize(id,{...size,minHeight:Math.max(size.minHeight,Array.from(grid.current?.children??[]).find(card=>(card as HTMLElement).dataset.componentId===id)?.getBoundingClientRect().height??0)+80})}>{he?'הגדלת גובה':'Taller'}</button><button className="desktop-layout-control" type="button" disabled={size.minHeight<=160} onClick={()=>resize(id,{...size,minHeight:size.minHeight-80})}>{he?'הקטנת גובה':'Shorter'}</button>
    </div></details></div></header><div className="r-card-content" tabIndex={fit&&!hidden?0:undefined} role={fit?"region":undefined} aria-label={fit?c.title:undefined}>{children(c)}</div><button className="resize-handle desktop-layout-control" type="button" aria-label={`${he?'שינוי גודל':'Resize'} ${c.title}`} title={`${he?'שינוי גודל':'Resize'} · ${toolLabel(c.type,locale)}`} onPointerDown={event=>begin(event,id,'resize')} {...pointerHandlers}><MoveDiagonal2 size={15}/></button>
   </AnimatedCard>;
  })}</AnimatePresence></motion.div>{!components.length&&<p className="workspace-empty" role="status">{he?'אין כרגע כלים זמינים להצגה. אפשר לעדכן את הבקשה למטה.':'No tools are currently available. Update your request below.'}</p>}</div>

 </div>;
}

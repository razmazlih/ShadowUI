'use client';
import {useEffect,useLayoutEffect,useState,useRef,useMemo,useCallback,type ReactNode} from 'react';
import {AnimatePresence,MotionConfig,motion,useIsPresent,useReducedMotion,type HTMLMotionProps} from 'motion/react';
import {ArrowUp,ArrowUpRight,Plus,Command,PanelLeftClose,Sparkles,Layers,Clock3,ChevronDown,RotateCcw,Code2,Check,Sun,Moon,Globe,X,Trash2} from 'lucide-react';
import InterfaceSymbol from '@/components/InterfaceSymbol';
import WorkspaceRenderer from '@/components/WorkspaceRenderer';
import ScheduleExperience from '@/components/ScheduleExperience';
import FloatingAssistant from '@/components/FloatingAssistant';
import AIProgress,{type AIPhase} from '@/components/AIProgress';
import {isLayoutRequest} from '@/lib/workspace-layout';
import AccountLink from '@/components/AccountLink';
import ConversationShare from '@/components/ConversationShare';
import {observeAccountUser} from '@/lib/firebase-client';
import {useAccountWorkspaces} from '@/hooks/useAccountWorkspaces';
import type {WorkspaceSnapshot} from '@/lib/account-workspaces';
import {Workspace,WorkspaceSchema,PlanResult} from '@/lib/schema';
type AIRuntimeStatus={configured:boolean;storageReady:boolean;simulation:boolean;liveEnabled:boolean;spent?:number;limit?:number;warning?:boolean};
const examples=[{icon:'diamond' as const,label:'Learn something deeply',prompt:'I have a biology exam in three days. Help me prepare.',tag:'LEARNING'},{icon:'grid' as const,label:'Organize a working week',prompt:"Organize next week’s shifts for six employees, including Daniel.",tag:'PLANNING'},{icon:'arrow' as const,label:'Go somewhere new',prompt:'Plan a five-day trip to Japan on a budget of 1200 dollars.',tag:'EXPLORING'},{icon:'decision' as const,label:'Make a better decision',prompt:'Compare three business opportunities using weighted criteria.',tag:'DECIDING'}];
const sceneEase=[.22,1,.36,1] as const;
const interfaceSpring={type:'spring' as const,stiffness:380,damping:30};
function PresenceBlock({children,...props}:HTMLMotionProps<'div'>){
 const present=useIsPresent();
 return <motion.div {...props} inert={!present} aria-hidden={!present||undefined}>{children}</motion.div>;
}
function WorkspaceScene({children,className,reduced,onEntered}:{children:ReactNode;className:string;reduced:boolean;onEntered:()=>void}){
 const present=useIsPresent();const callback=useRef(onEntered);callback.current=onEntered;
 useEffect(()=>{if(reduced)callback.current();},[reduced]);
 return <motion.div className={className+' workspace-scene'} data-workspace-scene inert={!present} aria-hidden={!present||undefined}
  initial={reduced?false:{opacity:0,y:8}}
  animate={{opacity:1,y:0}}
  exit={{opacity:0,y:reduced?0:-4,transition:{duration:reduced?0:.14,ease:'easeIn'}}}
  transition={{duration:reduced?0:.32,delay:0,ease:sceneEase}} onAnimationComplete={()=>{if(present)callback.current();}}>{children}</motion.div>;
}
function RequestFeedback({state,reduced,he,children}:{state:string;reduced:boolean;he:boolean;children:ReactNode}){
 const present=useIsPresent();
 const content=useRef<HTMLDivElement>(null);
 const [height,setHeight]=useState<number>();
 useLayoutEffect(()=>{
  const element=content.current;if(!element)return;
  const measure=()=>{const next=element.getBoundingClientRect().height;if(next>0)setHeight(next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[]);
 return <motion.div id="request-status" role="status" aria-live="polite" aria-atomic="true" dir={he?'rtl':'ltr'} inert={!present} aria-hidden={!present||undefined}
  data-request-feedback initial={reduced?false:{height:0,opacity:0}}
  animate={{height:present?(height??'auto'):0,opacity:present?1:0}}
  exit={{height:0,opacity:0}} transition={{duration:reduced?0:.22,ease:sceneEase}} style={{overflow:'hidden'}}>
  <div ref={content} style={{display:'flow-root'}}>
   <AnimatePresence mode="wait" initial={false}>
    <PresenceBlock key={state} className={'request-status '+state}
     initial={reduced?false:{opacity:0,y:3}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-3}}
     transition={{duration:reduced?0:.12,ease:sceneEase}}>{children}</PresenceBlock>
   </AnimatePresence>
  </div>
 </motion.div>;
}
function WorkspaceHistoryRow({children,className,reduced}:{children:ReactNode;className:string;reduced:boolean}){
 const present=useIsPresent();
 return <motion.div className={className} layout="position" inert={!present} aria-hidden={!present||undefined}
  initial={reduced?false:{opacity:0,height:0,x:12}} animate={{opacity:1,height:'auto',x:0}}
  exit={{opacity:0,height:0,x:reduced?0:-9,transition:{duration:reduced?0:.18}}}
  transition={reduced?{duration:0}:interfaceSpring}>{children}</motion.div>;
}
export default function Home(){const[workspaces,setWorkspaces]=useState<Workspace[]>([]);const[active,setActive]=useState<string|null>(null);const[busy,setBusy]=useState(false);const[explain,setExplain]=useState(false);const[dark,setDark]=useState(true);const[rtl,setRtl]=useState(false);const[mobileNav,setMobileNav]=useState(false);const[mode,setMode]=useState('demo');const[logs,setLogs]=useState<string[]>([]);const[showLogs,setShowLogs]=useState(false);const [aiStatus,setAiStatus]=useState<AIRuntimeStatus>();const [sources,setSources]=useState<Record<string,string>>({});const current=workspaces.find(w=>w.id===active);const[domainBusy,setDomainBusy]=useState(false);const[command,setCommand]=useState<{id:string;text:string;workspaceId?:string}>();const planning=useRef(false);const activeRef=useRef(active);activeRef.current=active;
const [accountName,setAccountName]=useState('');
useEffect(()=>observeAccountUser(user=>setAccountName(user?.displayName?.trim()??'')),[]);
// Interface language is a device preference, independent of conversation content.
useEffect(()=>{try{setRtl(localStorage.getItem('shadowui.ui-language.v1')==='he');}catch{}},[]);
function toggleLanguage(){const next=!rtl;setRtl(next);try{localStorage.setItem('shadowui.ui-language.v1',next?'he':'en');}catch{}}
const reducedMotion=Boolean(useReducedMotion());
const [visibleScene,setVisibleScene]=useState<string|null>(null);
const focusNewWorkspace=useRef(false);
const scrollSurface=useRef<HTMLDivElement>(null);
const [compactNav,setCompactNav]=useState(false);
const [desktopNavCollapsed,setDesktopNavCollapsed]=useState(false);
const navigationVisible=compactNav?mobileNav:!desktopNavCollapsed;
const navigation=useRef<HTMLElement>(null);
const navigationToggle=useRef<HTMLButtonElement>(null);
const closeMobileNavigation=useCallback(()=>{
 setMobileNav(false);
 if(compactNav)requestAnimationFrame(()=>navigationToggle.current?.focus());
},[compactNav]);
useEffect(()=>{
 const media=window.matchMedia('(max-width:700px)');
 const update=()=>{setCompactNav(media.matches);if(!media.matches)setMobileNav(false);};
 update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);
},[]);
useEffect(()=>{
 if(!compactNav||!mobileNav)return;
 const focusable=()=>Array.from(navigation.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')??[]).filter(element=>element.getClientRects().length>0&&!element.closest('[inert]'));
 const frame=requestAnimationFrame(()=>{(focusable()[0]??navigation.current)?.focus();});
 const keyboard=(event:KeyboardEvent)=>{
  if(event.key==='Escape'){event.preventDefault();closeMobileNavigation();return;}
  if(event.key!=='Tab')return;
  const controls=focusable(),first=controls[0],last=controls.at(-1);
  if(!first){event.preventDefault();navigation.current?.focus();return;}
  if(event.shiftKey&&(document.activeElement===first||!navigation.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!navigation.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
 };
 document.addEventListener('keydown',keyboard);
 return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keyboard);};
},[compactNav,mobileNav,closeMobileNavigation]);
// Feedback and drafts belong to the originating conversation, including async completions.
const conversationKey=active??'playground';
type Feedback={status:'idle'|'working'|'done'|'error';summary:string;error:string};
const [feedback,setFeedback]=useState<Record<string,Feedback>>({});
const [drafts,setDrafts]=useState<Record<string,string>>({});
const {status:requestStatus='idle',summary:responseSummary='',error=''}=feedback[conversationKey]??{};
const prompt=drafts[conversationKey]??'';
function setPrompt(value:string){setDrafts(old=>({...old,[conversationKey]:value}));}
function updateFeedback(patch:Partial<Feedback>,key=conversationKey){setFeedback(old=>({...old,[key]:{...(old[key]??{status:'idle',summary:'',error:''}),...patch}}));}
function setRequestStatus(status:Feedback['status'],key=conversationKey){updateFeedback({status},key);}
function setResponseSummary(summary:string,key=conversationKey){updateFeedback({summary},key);}
function setError(error:string,key=conversationKey){updateFeedback({error},key);}
const [activePhase,setActivePhase]=useState<AIPhase>(null);
const [conversations,setConversations]=useState<Record<string,Array<{role:'user'|'assistant';content:string}>>>({});
const history=conversations[active??'playground']??[];
const [undoWorkspaces,setUndoWorkspaces]=useState<Record<string,Workspace>>({});
const requestHebrew=rtl;
const [exporting,setExporting]=useState(false);
const [exportError,setExportError]=useState('');
const [accountRevision,setAccountRevision]=useState(0);
useEffect(()=>{const refresh=()=>setAccountRevision(value=>value+1);window.addEventListener('shadowui:account-synced',refresh);return()=>window.removeEventListener('shadowui:account-synced',refresh);},[]);
const [deviceData,setDeviceData]=useState<Record<string,string>>({});
const snapshot=useMemo(()=>({workspaces,active,conversations,undoWorkspaces,sources,deviceData}),[workspaces,active,conversations,undoWorkspaces,sources,deviceData]);
const loadSnapshot=useCallback((value:WorkspaceSnapshot)=>{setWorkspaces(value.workspaces);setActive(value.active);setConversations(value.conversations);setUndoWorkspaces(value.undoWorkspaces);setSources(value.sources);setDeviceData(value.deviceData??{});},[]);
const {ready,owner,status:accountStatus,onUser}=useAccountWorkspaces(snapshot,loadSnapshot,busy||domainBusy);
useEffect(()=>observeAccountUser(onUser),[onUser]);
const routeInitialized=useRef(false);
const [shareAfterAuth,setShareAfterAuth]=useState<string|null>(null);
useEffect(()=>{
 if(!ready)return;
 if(!routeInitialized.current){
  routeInitialized.current=true;
  const routeParams=new URL(window.location.href).searchParams;
  const requested=routeParams.get('conversation');
  if(requested&&routeParams.get('share')==='1')setShareAfterAuth(requested);
  if(requested){
   if(workspaces.some(workspace=>workspace.id===requested)){if(active!==requested){setActive(requested);return;}}
   else
   setError(rtl?'השיחה לא נמצאה בחשבון או במכשיר הזה.':'This conversation was not found in this account or device.');
  }
  // A bare home URL starts at home, regardless of the saved selection.
  else if(active!==null){setActive(null);return;}
 }
 const target=active?`/conversations/${encodeURIComponent(active)}`:'/';
 if(window.location.pathname+window.location.search!==target)window.history.replaceState(null,'',target);
},[ready,active,workspaces,rtl]);

useEffect(()=>{setDrafts({});setFeedback({});setLogs([]);},[owner]);
const sceneKey=`${owner??'guest'}:${current?.id??'home'}`;
const previousScene=useRef(sceneKey),resetScrollAfterExit=useRef(false);
useLayoutEffect(()=>{if(previousScene.current!==sceneKey){previousScene.current=sceneKey;resetScrollAfterExit.current=true;}},[sceneKey]);
const sceneExited=()=>{if(resetScrollAfterExit.current){resetScrollAfterExit.current=false;scrollSurface.current?.scrollTo({top:0,behavior:'instant'});}};
const sceneEntered=()=>{setVisibleScene(sceneKey);if(!current&&focusNewWorkspace.current){focusNewWorkspace.current=false;document.getElementById('goal')?.focus();}};
const requestedMode:'demo'|'live'=aiStatus?.liveEnabled?'live':'demo';
const compositionReady=Boolean(aiStatus&&(aiStatus.liveEnabled?aiStatus.configured&&aiStatus.storageReady:aiStatus.simulation));
const statusRequest=useRef<Promise<AIRuntimeStatus>|null>(null);
async function checkAI():Promise<AIRuntimeStatus>{
 let status:AIRuntimeStatus;
 try{const response=await fetch('/api/plan',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Runtime status unavailable');status=await response.json();}
 catch{status={configured:false,storageReady:false,simulation:false,liveEnabled:false};}
 setAiStatus(status);return status;
}
useEffect(()=>{
 const refresh=()=>{if(document.visibilityState==='visible')void checkAI()};
 if(!statusRequest.current)statusRequest.current=checkAI();
 else refresh();
 window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',refresh);
 const interval=window.setInterval(refresh,30000);
 return ()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.clearInterval(interval)};
},[]);
useEffect(()=>{setDomainBusy(false);setCommand(undefined)},[active]);
useEffect(()=>{const shortcut=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();startNewWorkspace()}};window.addEventListener('keydown',shortcut);return ()=>window.removeEventListener('keydown',shortcut)},[busy,domainBusy]);
async function generate(text=prompt){
 if(!ready||!text.trim()||busy||domainBusy||planning.current)return;
 if(current&&isLayoutRequest(text)){
  const he=rtl;const message=he?'סידרתי את הרכיבים: התוכנית תחילה, אזור קריאה רחב, ושאר הכלים בהמשך. הנתונים נשמרו.':'Rearranged the components: the plan comes first, reading areas are wide, and supporting tools follow. Your data is preserved.';
  window.dispatchEvent(new CustomEvent('shadowui:arrange-layout',{detail:{workspaceId:current.id}}));
  setConversations(old=>({...old,[current.id]:[...history,{role:'user' as const,content:text},{role:'assistant' as const,content:message}].slice(-12)}));
  setError('');setResponseSummary(message);setRequestStatus('done');setPrompt('');recordTool(message);return;
 }
 setError('');setRequestStatus('working');setActivePhase(null);setResponseSummary('');setBusy(true);
 planning.current=true;const origin=active;
 try{
  const runtime=await (statusRequest.current??(statusRequest.current=checkAI()));
  const requestMode=runtime.liveEnabled?'live':runtime.simulation?'demo':null;
  if(!requestMode||requestMode==='live'&&(!runtime.configured||!runtime.storageReady))throw new Error(rtl?'ה־AI אינו זמין כרגע. יש להשלים את הגדרת השירות בשרת ולרענן.':'AI is unavailable. Complete the server configuration and refresh.');
  setActivePhase('interpret');
  const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:text,current:current||null,mode:requestMode,history}),signal:AbortSignal.timeout(305000)});
  let result:any;
  if(response.headers.get('content-type')?.includes('text/event-stream')){
   if(!response.body)throw new Error('The live progress stream was unavailable.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   const handleEvent=(block:string)=>{let event='message',data='';for(const line of block.split(/\r?\n/)){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data+=line.slice(5).trim();}if(!data)return;const payload=JSON.parse(data);if(event==='progress'){setActivePhase(payload.step);return;}if(event==='error')throw new Error(payload.error||'Could not create your workspace.');if(event==='result')result=payload;};
   while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()??'';for(const block of blocks)handleEvent(block);if(done)break;}
   if(buffer.trim())handleEvent(buffer);
   if(!result)throw new Error('The AI response ended before the workspace was ready.');
  }else {result=await response.json();if(!response.ok)throw new Error(result.error||'Could not create your workspace.');}
  if(result.budget)setAiStatus(old=>({...old!,...result.budget}));
  if(result.operation==='schedule'&&current?.domain){setCommand({id:crypto.randomUUID(),text,workspaceId:origin??undefined});setDomainBusy(true);return;}
  const key=origin??'playground';
  const turns=[...history,{role:'user' as const,content:text},{role:'assistant' as const,content:String(result.explanation).slice(0,4000)}].slice(-12);
  if(result.operation==='reply'){
   setConversations(old=>({...old,[key]:turns}));setRequestStatus('done');setResponseSummary(result.explanation);setPrompt('');return;
  }
  const plan=result as PlanResult;const validated=WorkspaceSchema.safeParse(plan.workspace);if(!validated.success)throw new Error('The planner returned an unsupported interface. Your saved work is unchanged. Retry with a supported goal.');const workspace=validated.data;
  setConversations(old=>({...old,[workspace.id]:turns}));
  if(current&&current.id===workspace.id)setUndoWorkspaces(old=>({...old,[current.id]:current}));
  setWorkspaces(old=>[...old.filter(w=>w.id!==workspace.id),workspace]);
  if(activeRef.current===origin)setActive(workspace.id);
  if(workspace.id!==key)setFeedback(old=>{const next={...old};delete next[key];return next});
  updateFeedback({status:'done',summary:plan.explanation,error:''},workspace.id);setMode(plan.mode);setSources(old=>({...old,[workspace.id]:plan.mode}));if(result.budget)setAiStatus(old=>({...old!,...result.budget}));setLogs(old=>[`${new Date().toLocaleTimeString()} · ${plan.mode} · ${plan.operation}: ${plan.explanation}`,...old].slice(0,40));setPrompt('');
 }catch(e){setRequestStatus('error');setError(e instanceof Error?e.message:'Something went wrong. Try again.');void checkAI()}finally{planning.current=false;setBusy(false);setActivePhase(null)}
}
function recordTool(message:string){setLogs(old=>[`${new Date().toLocaleTimeString()} · ${message}`,...old].slice(0,40))}

function change(w:Workspace){const parsed=WorkspaceSchema.safeParse(w);if(!parsed.success){setError('This edit exceeds a workspace limit or contains an invalid value. Your previous state is preserved.');return;}const before=workspaces.find(x=>x.id===w.id);if(before&&JSON.stringify(before.components)!==JSON.stringify(w.components))w={...w,progress:undefined};if(before)setUndoWorkspaces(old=>({...old,[w.id]:before}));setWorkspaces(old=>old.map(x=>x.id===w.id?w:x));setLogs(old=>[`${new Date().toLocaleTimeString()} · Local state saved: ${w.title}`,...old].slice(0,30))}

function deleteChat(id:string){setFeedback(old=>{const next={...old};delete next[id];return next});setDrafts(old=>{const next={...old};delete next[id];return next});setUndoWorkspaces(old=>{const next={...old};delete next[id];return next});setWorkspaces(old=>old.filter(w=>w.id!==id));setConversations(old=>{const next={...old};delete next[id];return next});setSources(old=>{const next={...old};delete next[id];return next});if(activeRef.current===id){setActive(null);setCommand(undefined);setDomainBusy(false)}}
function startNewWorkspace(){if(busy||domainBusy||planning.current)return;const alreadyHome=!activeRef.current;focusNewWorkspace.current=true;activeRef.current=null;setActive(null);clearPlaygroundHistory();setCommand(undefined);setExplain(false);closeMobileNavigation();if(alreadyHome)requestAnimationFrame(()=>{focusNewWorkspace.current=false;document.getElementById('goal')?.focus()})}
function clearPlaygroundHistory(){setFeedback(old=>{const next={...old};delete next.playground;return next});setDrafts(old=>{const next={...old};delete next.playground;return next});setConversations(old=>{const next={...old};delete next.playground;return next})}
async function download(){if(!current||exporting)return;setExporting(true);setExportError('');try{const {downloadWorkspaceImage}=await import('@/lib/workspace-image');await downloadWorkspaceImage(current,{dark,locale:rtl?'he':'en'});}catch{setExportError(rtl?'לא ניתן ליצור את התמונה. נסו שוב.':'Could not create the image. Please retry.');}finally{setExporting(false)}}
const statusTitle=requestHebrew?(requestStatus==='working'?(requestedMode==='live'?'ה־AI מעבד את הבקשה…':'מעבד את הבקשה…'):requestStatus==='done'?'התשובה מוכנה':'הבקשה נכשלה'):(requestStatus==='working'?(requestedMode==='live'?'AI is working…':'Processing your request…'):requestStatus==='done'?'Response ready':'Request failed');
const composerHebrew=rtl;
const showRequestFeedback=requestStatus!=='idle'&&!(current&&requestStatus==='working');
useEffect(()=>{if(ready)window.dispatchEvent(new Event('shadowui:ready'));},[ready]);
if(!ready)return <div className="shell dark" aria-busy="true"><main>{accountStatus.startsWith('לא ניתן')&&<div className="boot-error" role="alert"><p>{accountStatus}</p><button type="button" onClick={()=>window.location.reload()}>{rtl?'ניסיון נוסף':'Try again'}</button></div>}</main></div>;
const composer=<form dir={composerHebrew?'rtl':'ltr'} className={'composer '+(current?'compact':'')} aria-busy={busy||!!command} onSubmit={e=>{e.preventDefault();generate()}}><label className="sr-only" htmlFor="goal">What do you want to accomplish?</label><textarea dir="auto" aria-describedby={showRequestFeedback?'request-status':undefined} id="goal" disabled={busy||domainBusy} value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();generate()}}} placeholder={composerHebrew?(current?'שנו אילוץ, הוסיפו כלי או התחילו מטרה חדשה…':'מה תרצו להשיג?'):(current?'Change a constraint, add a tool, or start a new goal…':'What do you want to accomplish?')} maxLength={4000}/><div className="composer-bottom"><span><Sparkles size={14}/> {!compositionReady?(composerHebrew?'ממתין לשירות AI זמין':'Waiting for an available AI service'):composerHebrew?(requestedMode==='live'?'הבקשה וסביבת העבודה נשלחות לספק ה־AI שלכם':current?'סביבת העבודה מתאימה את עצמה אליכם':'הבנת שפה בהדמיה · ללא קריאות AI בתשלום'):(requestedMode==='live'?'Goal and workspace are sent to your AI provider':current?'Your workspace adapts with you':'Simulated language understanding · No paid AI calls')}</span><button className="send" disabled={busy||domainBusy||!compositionReady||!prompt.trim()} aria-label="Build workspace">{busy||domainBusy?<span className="spinner"/>:<ArrowUp size={20}/>}</button></div><AnimatePresence initial={false}>{showRequestFeedback&&<RequestFeedback key={conversationKey} state={requestStatus} reduced={reducedMotion} he={requestHebrew}>{requestStatus==='working'?<AIProgress phase={activePhase} he={requestHebrew}/>:requestStatus==='done'?<Check size={18} aria-hidden="true"/>:<X size={18} aria-hidden="true"/>}{requestStatus!=='working'&&<div><strong>{statusTitle}</strong><p>{requestStatus==='done'?(responseSummary||(requestHebrew?'סביבת העבודה עודכנה. אפשר להמשיך.':'Your workspace is updated. You can continue.')):(requestHebrew?'לא התקבלה תשובה. פרטי השגיאה מופיעים בהמשך.':'No response completed. See the error details below.')}</p></div>}{requestStatus!=='working'&&<button type="button" className="icon-button dismiss-status" aria-label={requestHebrew?'סגירת הודעה':'Dismiss notification'} onClick={()=>setRequestStatus('idle')}><X size={16}/></button>}</RequestFeedback>}</AnimatePresence></form>;
return <MotionConfig reducedMotion="user" transition={interfaceSpring}><div lang={rtl?'he':'en'} className={dark?'shell dark':'shell'} dir={rtl?'rtl':'ltr'}>
<AnimatePresence>{compactNav&&mobileNav&&<motion.button key="navigation-backdrop" className="nav-backdrop" type="button" tabIndex={-1} aria-hidden="true" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reducedMotion?0:.24}} onClick={closeMobileNavigation}/>}</AnimatePresence>
<aside ref={navigation} id="workspace-navigation" tabIndex={-1} role={compactNav?'dialog':undefined} aria-modal={compactNav&&mobileNav?true:undefined} aria-label={rtl?'ניווט סביבות עבודה':'Workspace navigation'} aria-hidden={!navigationVisible||undefined} inert={!navigationVisible} className={'sidebar '+(mobileNav?'mobile-open ':'')+(desktopNavCollapsed?'desktop-collapsed':'')}><button type="button" className="nav-close icon-button" aria-label={rtl?'סגירת הניווט':'Close navigation'} onClick={closeMobileNavigation}><X size={18}/></button><a dir="ltr" className="brand" href="/" aria-label="ShadowUI home"><span className="brand-mark">S</span>Shadow<span>UI</span><span className="beta">BETA</span></a><button className="new-workspace" disabled={busy||domainBusy} onClick={startNewWorkspace}><Plus size={17}/>New workspace <span>⌘ K</span></button><div className="nav-section">YOUR SPACE <Layers size={12}/></div><button className={!current?'nav-item selected':'nav-item'} onClick={()=>{setActive(null);closeMobileNavigation()}}><Command size={16}/> Playground <span className="nav-dot"/></button><div className="nav-section recent">RECENT WORKSPACES <span>{workspaces.length.toString().padStart(2,'0')}</span></div><div className="workspace-links"><AnimatePresence initial={false}>{!workspaces.length?<PresenceBlock key="empty" className="empty-history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reducedMotion?0:.15}}><p>Your next idea starts here.<br/>Workspaces will appear as you create.</p></PresenceBlock>:workspaces.slice().reverse().map(w=><WorkspaceHistoryRow key={w.id} reduced={reducedMotion} className={'workspace-history-row '+(active===w.id?'selected':'')}><button className="nav-item workspace-history-open" onClick={()=>{setActive(w.id);closeMobileNavigation()}}><span className="mini-orb"/><bdi>{w.title}</bdi></button><button type="button" className="delete-chat icon-button" aria-label={`Delete chat ${w.title}`} title="Delete chat and workspace" disabled={busy||domainBusy} onClick={()=>deleteChat(w.id)}><Trash2 size={14}/></button></WorkspaceHistoryRow>)}</AnimatePresence></div><div className="sidebar-bottom"><AccountLink locale={rtl?'he':'en'} disabled={busy||domainBusy}/><div className="local-status" role="status"><i/>{accountStatus}</div><div className="raben"><span className="raben-logo">R</span><div>RABEN <small>Ideas, made possible.</small></div><ArrowUpRight size={16}/></div></div></aside>
<main inert={compactNav&&mobileNav} aria-hidden={compactNav&&mobileNav||undefined}>
<header><div className="breadcrumb"><button ref={navigationToggle} className="icon-button" aria-label="Toggle navigation" aria-controls="workspace-navigation" aria-expanded={navigationVisible} onClick={()=>{if(!compactNav)setDesktopNavCollapsed(value=>!value);else if(mobileNav)closeMobileNavigation();else setMobileNav(true)}}><PanelLeftClose size={18} style={{transform:navigationVisible?undefined:'rotate(180deg)'}}/></button><span>Workspace</span><span className="slash">/</span><AnimatePresence mode="wait" initial={false}><motion.strong key={current?.id??'playground'} initial={reducedMotion?false:{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-4}} transition={{duration:reducedMotion?0:.14}}><bdi>{current?current.title:'Playground'}</bdi></motion.strong></AnimatePresence></div><div className="header-actions"><button className="icon-button" aria-label="Toggle language direction" onClick={toggleLanguage} aria-pressed={rtl}><Globe size={17}/></button><button className="icon-button" aria-label="Toggle color theme" onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button></div></header>
<div className={'main-scroll'+(!current?' home-screen':'')} ref={scrollSurface}>
<AnimatePresence mode="wait" onExitComplete={sceneExited}>{!current?<WorkspaceScene key={sceneKey} className="welcome home-flow" reduced={reducedMotion} onEntered={sceneEntered}><div className="intro-tag"><span/>SOFTWARE THAT CHANGES WITH YOUR WORK</div><div className="hero-orbit" aria-hidden="true"><div className="orbit one"/><div className="orbit two"/><div className="orbit three"/><div className="orb-center"><InterfaceSymbol/></div><span className="orbit-dot"/></div>{accountName&&<p className="personal-greeting" dir={rtl?'rtl':'ltr'}>{rtl?'שלום, ':'Welcome, '}<bdi>{accountName}</bdi><span aria-hidden="true"><InterfaceSymbol kind="sparkle"/></span></p>}<h1>Work changes.<br/><span>Your interface should, too.</span></h1><p className="hero-description">Turn an objective into action. When the situation changes,<br className="desktop-break"/> your workspace finds a better way forward.</p>{history.length>0&&<details className="conversation-history"><summary>{rtl||requestHebrew?'היסטוריית שיחה':'Conversation history'}</summary><button type="button" className="clear-chat-history" disabled={busy} onClick={clearPlaygroundHistory}><Trash2 size={13}/>{rtl||requestHebrew?'מחיקת השיחה':'Delete chat'}</button>{history.map((turn,i)=><p key={i} dir="auto"><strong>{turn.role==='user'?'You':'ShadowUI'}: </strong>{turn.content}</p>)}</details>}{composer}<div className="suggestion-label">CHOOSE A STARTING POINT. MAKE IT YOURS.</div><div className="examples">{examples.map((e,index)=><button key={e.tag} onClick={()=>generate(e.prompt)} disabled={busy||!compositionReady}><span className="example-icon"><InterfaceSymbol kind={e.icon}/></span><span className="example-tag">{e.tag}</span><strong>{e.label}</strong><div className={`demo-preview preview-${index}`} aria-hidden="true">{Array.from({length:index===1?10:3},(_,i)=><span key={i}><i/>{index===0?["Recall","Practice","Focus"][i]:index===2?["Tokyo","Kyoto","Explore"][i]:index===3?["Option A","Option B","Option C"][i]:""}<b/></span>)}</div><small className="example-open">Start this workspace <InterfaceSymbol kind="arrow"/></small><ArrowUpRight className="example-arrow" size={17}/></button>)}</div><div className="possibilities"><span>Think it.</span><div/><span>Shape it.</span><div/><span>Make it yours.</span></div></WorkspaceScene>:<WorkspaceScene key={sceneKey} className="workspace" reduced={reducedMotion} onEntered={sceneEntered}><div className="workspace-actionbar"><div className="workspace-tools"><button onClick={()=>setExplain(!explain)} className={explain?'active':''} aria-pressed={explain}><Sparkles size={14}/>{rtl?'למה נבחרו הכלים האלה?':'Why these tools?'}</button><ConversationShare key={current.id} workspaceId={current.id} he={rtl} onDownload={download} autoOpen={shareAfterAuth===current.id} onAutoOpen={()=>setShareAfterAuth(null)}/>{exportError&&<span className="export-error" role="alert">{exportError}</span>}</div></div><AnimatePresence mode="popLayout"><WorkspaceRenderer primaryPanel={current.domain?.kind==='schedule'?<ScheduleExperience key={`${current.domain.id}:${accountRevision}`} workspaceId={current.domain.id} goal={current.goal} explain={explain} onEvent={recordTool} command={command} aiMode={requestedMode} onAIBudget={budget=>setAiStatus(old=>({...old!,...budget}))} onBusy={setDomainBusy} onCommandResult={(id,result)=>{if(command?.id===id&&command.workspaceId){const key=command.workspaceId;setConversations(old=>({...old,[key]:[...(old[key]??[]),{role:'user' as const,content:command.text},{role:'assistant' as const,content:result.message.slice(0,4000)}].slice(-12)}));}setDomainBusy(false);setCommand(c=>c?.id===id?undefined:c);const resultKey=command?.workspaceId??current.id;updateFeedback({status:result.ok?'done':'error',summary:result.message,error:result.ok?'':result.message},resultKey);if(result.ok){setPrompt('');recordTool(result.message)}}}/>:undefined} key={`${current.id}:${accountRevision}`} locale={rtl?'he':'en'} workspace={current.domain?{...current,components:current.components.filter(c=>!['calendar','approval','timeline'].includes(c.type))}:current} onChange={next=>change(current.domain?{...current,components:current.components.map(c=>next.components.find(n=>n.id===c.id)??c)}:next)} explain={explain}/></AnimatePresence></WorkspaceScene>}</AnimatePresence><AnimatePresence initial={false}>{error&&!current&&<PresenceBlock key="home-error" initial={reducedMotion?false:{height:0,opacity:0,y:8}} animate={{height:'auto',opacity:1,y:0}} exit={{height:0,opacity:0}} transition={{duration:reducedMotion?0:.22,ease:sceneEase}} role="alert" className="error">{error}<button onClick={()=>generate()}><RotateCcw size={14}/>Retry</button></PresenceBlock>}</AnimatePresence></div>
<footer><a href="/catalog">{rtl?'מאגר רכיבים':'Component catalog'}</a><span><span className="footer-mark"><InterfaceSymbol/></span> Built around you. Powered by possibility.</span><button onClick={()=>setShowLogs(!showLogs)}><Code2 size={14}/>Action log <span>{logs.length}</span></button></footer>{current&&visibleScene===sceneKey&&<FloatingAssistant key={sceneKey} history={history} composer={composer} he={rtl} busy={requestStatus==='working'} error={error} phase={requestStatus==='working'?activePhase:null} onRetry={()=>{void generate()}}/>}
<AnimatePresence>{showLogs&&<PresenceBlock key="action-log" className="log-panel" initial={reducedMotion?false:{opacity:0,y:14,scale:.98,filter:'blur(4px)'}} animate={{opacity:1,y:0,scale:1,filter:'none'}} exit={{opacity:0,y:reducedMotion?0:8,scale:reducedMotion?1:.99}} transition={{duration:reducedMotion?0:.24,ease:sceneEase}}><div><strong>Actual application actions</strong><button className="icon-button" aria-label="Close action log" onClick={()=>setShowLogs(false)}><X size={16}/></button></div><p>Workspace layout is saved in this browser. Hosted schedules stay in this browser; localhost schedules use local server storage. Account synchronization status appears in the sidebar.</p>{logs.length?logs.map((log,i)=><p key={i}>{log}</p>):<p>No actions yet.</p>}<a href="/mcp-host">Open MCP test host ↗</a></PresenceBlock>}</AnimatePresence></main></div></MotionConfig>}

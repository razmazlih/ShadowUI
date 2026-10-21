/** Authentication may return only to a conversation in this application. */
export function safeAuthReturnTo(value:unknown):string{
 if(typeof value!=='string'||value.length>500||!value.startsWith('/')||value.startsWith('//')||/[\\\s#]/.test(value))return '/';
 try{
  const url=new URL(value,'https://shadowui.invalid');
  if(url.origin!=='https://shadowui.invalid')return '/';
  const keys=[...url.searchParams.keys()];
  if(new Set(keys).size!==keys.length)return '/';
  const safeId=(id:string|null)=>!!id&&/^[A-Za-z0-9_-]{1,100}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);
  if(url.pathname==='/'&&keys.length===2&&keys.every(key=>key==='conversation'||key==='share')&&safeId(url.searchParams.get('conversation'))&&url.searchParams.get('share')==='1')return `/?conversation=${encodeURIComponent(url.searchParams.get('conversation')!)}&share=1`;
  const id=url.pathname.match(/^\/conversations\/([A-Za-z0-9_-]{1,100})$/)?.[1];
  if(id&&safeId(id)&&keys.every(key=>key==='share')&&(!keys.length||url.searchParams.get('share')==='1'))return `/conversations/${id}${keys.length?'?share=1':''}`;
 }catch{/* Invalid URLs return to the application home. */}
 return '/';
}
const returnKey='shadowui.auth.return.v1';
type ReturnStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function rememberAuthReturn(storage:ReturnStorage,target:string,now=Date.now()){
 const safe=safeAuthReturnTo(target);if(safe==='/')return;
 try{storage.setItem(returnKey,JSON.stringify({target:safe,at:now}));}catch{/* Authentication still works without session storage. */}
}
export function readAuthReturn(storage:ReturnStorage,now=Date.now()){
 try{const value=JSON.parse(storage.getItem(returnKey)||'null');if(value&&typeof value.at==='number'&&value.at<=now&&now-value.at<60*60*1000)return safeAuthReturnTo(value.target);}catch{}
 return '/';
}

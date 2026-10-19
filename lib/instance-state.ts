import type {UIComponent} from './schema';
// Paths use stable entity IDs (and dates for weekly columns), never mutable array positions.
const key=(v:unknown,i:number)=>v&&typeof v==='object'?String((v as {id?:string;date?:string}).id??(v as {date?:string}).date??i):String(i);
const token=(value:string)=>encodeURIComponent(value);
function changed(a:unknown,b:unknown,path:string,out:string[]){
 if(JSON.stringify(a)===JSON.stringify(b))return;
 if(Array.isArray(a)&&Array.isArray(b)){
  const left=new Map(a.map((v,i)=>[key(v,i),v])),right=new Map(b.map((v,i)=>[key(v,i),v]));
  for(const id of new Set([...left.keys(),...right.keys()]))changed(left.get(id),right.get(id),`${path}/${token(id)}`,out);
 }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
  for(const id of new Set([...Object.keys(left),...Object.keys(right)]))if(!['editedPaths','catalogRef'].includes(id))changed(left[id],right[id],`${path}/${token(id)}`,out);
 }else out.push(path);
}
export function recordInstanceEdit(previous:UIComponent,next:UIComponent):UIComponent{
 const paths:string[]=[];changed(previous,next,'',paths);return {...next,editedPaths:[...new Set([...(previous.editedPaths??[]),...paths])].slice(0,2000)};
}
function restore(old:unknown,next:unknown,path:string,paths:Set<string>):unknown{
 if(paths.has(path))return structuredClone(old);
 if(![...paths].some(p=>p.startsWith(`${path}/`)))return next;
 if(Array.isArray(old)&&Array.isArray(next)){
  const before=new Map(old.map((v,i)=>[key(v,i),v])),after=new Map(next.map((v,i)=>[key(v,i),v]));
  return [...new Set([...after.keys(),...before.keys()])].map(id=>restore(before.get(id),after.get(id),`${path}/${token(id)}`,paths)).filter(v=>v!==undefined);
 }
 if(old&&typeof old==='object'){
  const a=old as Record<string,unknown>,b=next&&typeof next==='object'?next as Record<string,unknown>:{};
  const result:Record<string,unknown>={...b};for(const id of new Set([...Object.keys(a),...Object.keys(b)])){const v=restore(a[id],b[id],`${path}/${token(id)}`,paths);if(v===undefined)delete result[id];else result[id]=v;}return result;
 }
 return next;
}
export function preserveInstanceEdits(old:UIComponent,next:UIComponent):UIComponent{
 if(old.id!==next.id||old.type!==next.type)return next;
 const restored=restore(old,next,'',new Set(old.editedPaths??[])) as UIComponent;
 return {...restored,...(old.catalogRef?{catalogRef:old.catalogRef}:{}),...(old.editedPaths?{editedPaths:old.editedPaths}:{})};
}

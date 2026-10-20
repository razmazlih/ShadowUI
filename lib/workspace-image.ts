import type {Workspace,UIComponent} from './schema';
import {resolveBindings} from './data-bindings';
import {deriveStudyTools} from './study-source';
import {evaluateCustomTool} from './custom-tool';
import {evaluateRecord} from './record-tool';
import {visibleComponents,toolLabel} from '../components/tool-metadata';

type Line={text:string;kind?:'body'|'muted'|'answer'};
function content(component:UIComponent,he:boolean):Line[]{
 const lines:Line[]=[];
 if(component.text)lines.push({text:component.text});
 if(component.custom){
  for(const field of component.custom.fields)lines.push({text:`${field.label}: ${field.value}`});
  for(const result of evaluateCustomTool(component.custom))lines.push({text:`${result.label}: ${result.error??`${result.value??'—'} ${result.unit??''}`}`,kind:'answer'});
 }
 if(component.weeklySchedule)for(const day of component.weeklySchedule.days){
  lines.push({text:day.date,kind:'answer'});
  for(const event of day.events)lines.push({text:`${event.start}–${event.end} · ${event.title}`});
 }
 if(component.value!==undefined&&!['chart','approval','custom'].includes(component.type))lines.push({text:`${component.value}${component.type==='timer'?(he?' דקות':' minutes'):''}`,kind:'answer'});
 if(component.type==='approval')lines.push({text:component.value===1?(he?'אושר מקומית':'Confirmed locally'):(he?'ממתין לאישור':'Awaiting confirmation'),kind:'answer'});
 for(const item of component.items){
  const prefix=component.type==='checklist'?(item.done?'☑ ':'☐ '):'';
  lines.push({text:`${prefix}${item.label}${item.date?` · ${item.date}`:''}${item.group?` · ${item.group}`:''}${item.value!==undefined?` · ${item.value}`:''}`});
  if(item.detail)lines.push({text:item.detail,kind:'muted'});
  if(item.cells&&component.recordTool){
   for(const column of component.recordTool.columns)lines.push({text:`${column.label}: ${item.cells[column.id]??'—'}`,kind:'muted'});
   for(const output of evaluateRecord(component.recordTool,item.cells))lines.push({text:`${output.label}: ${output.error??`${output.value??'—'} ${output.unit??''}`}`,kind:'answer'});
  }
  if(item.scores)for(const criterion of component.criteria??[])lines.push({text:`${criterion.label}: ${item.scores[criterion.id]??'—'}`,kind:'muted'});
  if(item.options?.length)lines.push({text:item.options.join('  /  '),kind:'muted'});
  if(item.answer)lines.push({text:`${he?'תשובה':'Answer'}: ${item.answer}`,kind:'answer'});
  if(item.url)lines.push({text:item.url,kind:'muted'});
 }
 if(!lines.length)lines.push({text:he?'טרם הוזן תוכן':'No content entered yet',kind:'muted'});
 return lines;
}

/** A local, full-content image: no screenshot service, provider call, or uploaded data. */
export async function workspaceImage(workspace:Workspace,{dark=false,locale='he'}:{dark?:boolean;locale?:'he'|'en'}={}):Promise<Blob>{
 await document.fonts.ready;
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
 const he=locale==='he',width=1200,padding=64,cardWidth=width-padding*2,textWidth=cardWidth-64;
 const palette=dark?{bg:'#101316',panel:'#191e23',text:'#f2f3f4',muted:'#a5afb8',line:'#303941',accent:'#f0ae80'}:{bg:'#f5f2ec',panel:'#ffffff',text:'#202a33',muted:'#62717d',line:'#e3e3df',accent:'#a45b32'};
 const font=(size:number,weight=400)=>`${weight} ${size}px Arial, sans-serif`;
 const wrap=(value:string,size:number,weight=400)=>{
  ctx.font=font(size,weight);
  return value.split('\n').flatMap(paragraph=>{
   if(!paragraph)return [''];
   const result:string[]=[];let line='';
   for(const word of paragraph.split(/\s+/)){
    const candidate=line?`${line} ${word}`:word;
    if(ctx.measureText(candidate).width<=textWidth){line=candidate;continue;}
    if(line){result.push(line);line='';}
    for(const character of word){if(ctx.measureText(line+character).width>textWidth&&line){result.push(line);line='';}line+=character;}
   }
   if(line)result.push(line);return result;
  });
 };
 const text=(value:string,x:number,y:number,size:number,color:string,weight=400)=>{
  const rtl=/[א-ת]/u.test(value);ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';ctx.textBaseline='top';ctx.font=font(size,weight);ctx.fillStyle=color;ctx.fillText(value,rtl?width-x:x,y);
 };
 const round=(x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
 const commands:Array<()=>void>=[];
 const title=wrap(workspace.title,42,700),description=wrap(workspace.description,21);
 let y=108+title.length*54+22+description.length*32+34;
 const headerBottom=y;
 const resolved=resolveBindings({...workspace,components:deriveStudyTools(workspace.components)},workspace.bindings??[]);
 for(const [index,component] of visibleComponents(resolved.workspace.components).entries()){
  const top=y,heading=wrap(component.title,26,700);
  const error=resolved.errors.find(item=>item.componentId===component.id);
  const rows=(error?[{text:error.message}]:content(component,he)).flatMap(line=>wrap(line.text,line.kind==='muted'?19:21).map(value=>({...line,text:value})));
  const height=76+heading.length*36+rows.reduce((sum,line)=>sum+(line.text?31:16),0)+26;
  commands.push(()=>{
   ctx.fillStyle=palette.panel;ctx.strokeStyle=palette.line;ctx.lineWidth=1;round(padding,top,cardWidth,height,20);ctx.fill();ctx.stroke();
   text(`${String(index+1).padStart(2,'0')}  ·  ${toolLabel(component.type,locale)}`,padding+32,top+22,14,palette.accent,600);
   let rowY=top+52;
   for(const line of heading){text(line,padding+32,rowY,26,palette.text,700);rowY+=36;}
   rowY+=16;
   for(const line of rows){text(line.text,padding+32,rowY,line.kind==='muted'?19:21,line.kind==='answer'?palette.accent:line.kind==='muted'?palette.muted:palette.text,line.kind==='answer'?600:400);rowY+=line.text?31:16;}
  });
  y+=height+20;
 }
 const height=y+64;
 const scale=Math.min(2,32760/height,Math.sqrt(24000000/(width*height)));
 canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);ctx.scale(scale,scale);
 ctx.fillStyle=palette.bg;ctx.fillRect(0,0,width,height);
 text('ShadowUI  /  WORKSPACE',padding,36,16,palette.accent,700);
 let headerY=108;
 for(const line of title){text(line,padding,headerY,42,palette.text,700);headerY+=54;}
 headerY+=22;
 for(const line of description){text(line,padding,headerY,21,palette.muted);headerY+=32;}
 ctx.fillStyle=palette.accent;ctx.fillRect(he?width-padding-64:padding,headerBottom-20,64,3);
 commands.forEach(draw=>draw());
 text(he?'נוצר עם ShadowUI · תמונת מצב של סביבת העבודה':'Created with ShadowUI · Workspace snapshot',padding,height-40,14,palette.muted);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),'image/png'));
}

export async function downloadWorkspaceImage(workspace:Workspace,options:Parameters<typeof workspaceImage>[1]){
 const blob=await workspaceImage(workspace,options),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=`${workspace.title.replace(/[\\/:*?"<>|]/g,'').slice(0,80)||'shadowui-workspace'}.png`;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

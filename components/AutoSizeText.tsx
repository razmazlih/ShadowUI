'use client';

import {useLayoutEffect, useRef, type TextareaHTMLAttributes} from 'react';

/** Editable text grows with its content, including after a card is resized. */
export default function AutoSizeText({className='', onKeyDown, ...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
 const ref=useRef<HTMLTextAreaElement>(null);
 const measured=useRef<{width:number;value:string;placeholder:string}|null>(null);
 const resize=()=>{
  const node=ref.current;if(!node||node.offsetWidth===0)return;
  const next={width:node.offsetWidth,value:node.value,placeholder:node.placeholder};
  const previous=measured.current;
  if(previous&&previous.width===next.width&&previous.value===next.value&&previous.placeholder===next.placeholder)return;
  node.style.height='0px';node.style.height=`${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;
  measured.current=next;
 };
 // Parent layout/settings can change width during the mounting commit. Resolve
 // text height before paint as well, rather than waiting for ResizeObserver.
 useLayoutEffect(resize);
 useLayoutEffect(()=>{
  const node=ref.current;if(!node)return;
  const observer=new ResizeObserver(resize);observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 return <textarea {...props} ref={ref} rows={1} className={`r-auto-text ${className}`} onKeyDown={event=>{
  onKeyDown?.(event);
  if(!event.defaultPrevented&&event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.currentTarget.form){event.preventDefault();event.currentTarget.form.requestSubmit();}
 }}/>;
}

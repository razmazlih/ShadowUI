'use client';

import {useLayoutEffect, useRef, type TextareaHTMLAttributes} from 'react';

/** Editable text grows with its content, including after a card is resized. */
export default function AutoSizeText({className='', onKeyDown, ...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
 const ref=useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(()=>{
  const node=ref.current;
  if(!node)return;
  const resize=()=>{node.style.height='0px';node.style.height=`${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;};
  resize();
  let width=node.getBoundingClientRect().width;
  const observer=new ResizeObserver(()=>{const next=node.getBoundingClientRect().width;if(next!==width){width=next;resize();}});
  observer.observe(node);
  return ()=>observer.disconnect();
 },[props.value,props.placeholder]);
 return <textarea {...props} ref={ref} rows={1} className={`r-auto-text ${className}`} onKeyDown={event=>{
  onKeyDown?.(event);
  if(!event.defaultPrevented&&event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.currentTarget.form){event.preventDefault();event.currentTarget.form.requestSubmit();}
 }}/>;
}

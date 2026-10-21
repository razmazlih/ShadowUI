/** Fixed vector versions of the interface's text symbols, independent of device fonts. */
export default function InterfaceSymbol({kind='asterisk',size='1em'}:{kind?:'asterisk'|'diamond'|'grid'|'arrow'|'decision'|'sparkle';size?:number|string}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{display:'inline-block',verticalAlign:'middle'}}>
  {kind==='asterisk'?<path strokeWidth="3" d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72M5.64 18.36 18.36 5.64"/>:kind==='diamond'?<><path d="m12 2 10 10-10 10L2 12Z"/><path fill="currentColor" stroke="none" d="m12 7 5 5-5 5-5-5Z"/></>:kind==='grid'?<><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></>:kind==='arrow'?<path d="M5 19 19 5M5 5h14v14"/>:kind==='decision'?<><rect x="3" y="3" width="18" height="18"/><path d="M12 3v18M3 12h18"/></>:<path fill="currentColor" stroke="none" d="m12 1 3.2 7.8L23 12l-7.8 3.2L12 23l-3.2-7.8L1 12l7.8-3.2Z"/>}
 </svg>;
}

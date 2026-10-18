'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div style={{padding:50,fontFamily:'Arial',background:'#111214',color:'#eee',minHeight:'100vh'}}><h1>This workspace could not be displayed.</h1><p>Your saved browser data has not been deleted.</p><button onClick={reset}>Try again</button><a href="/" style={{margin:20}}>Return to ShadowUI</a></div>}

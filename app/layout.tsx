import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'ShadowUI — An interface for every intention',description:'RABEN · Software that adapts to you. A schema-driven generative workspace.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

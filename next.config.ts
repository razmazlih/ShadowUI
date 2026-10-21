import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
const config=(phase:string):NextConfig=>({distDir:process.env.SHADOWUI_DIST_DIR??(phase===PHASE_DEVELOPMENT_SERVER?'.next-dev':'.next'),poweredByHeader:false,devIndicators:false,
 async rewrites(){
  const project=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if(!project||!/^[-a-z0-9]+$/.test(project)||project.startsWith('demo-'))return [];
  return [{source:'/__/auth/:path*',destination:`https://${project}.firebaseapp.com/__/auth/:path*`}];
 }});
export default config;

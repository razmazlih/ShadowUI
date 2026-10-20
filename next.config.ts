import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
const config=(phase:string):NextConfig=>({distDir:process.env.SHADOWUI_DIST_DIR??(phase===PHASE_DEVELOPMENT_SERVER?'.next-dev':'.next'),poweredByHeader:false,devIndicators:false});
export default config;

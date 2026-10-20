import type { Metadata } from 'next';
import './globals.css';
import './home-motion.css';

const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ShadowUI — Workspaces that adapt to your goals',
  description:
    'Turn a goal into an interactive workspace. ShadowUI shapes tools for learning, planning, decisions, and scheduling, then adapts as your work changes.',
  applicationName: 'ShadowUI',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ShadowUI',
    title: 'ShadowUI — Workspaces that adapt to your goals',
    description:
      'Turn a goal into an interactive workspace for learning, planning, decisions, and scheduling. When your work changes, your workspace adapts.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'ShadowUI — work changes, your workspace adapts' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShadowUI — Workspaces that adapt to your goals',
    description:
      'Turn a goal into an interactive workspace for learning, planning, decisions, and scheduling.',
    images: ['/opengraph-image'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

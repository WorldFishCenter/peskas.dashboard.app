import type { Metadata } from 'next';
import { siteConfig } from '@/config/site.config';

import '@workspace/ui/globals.css';

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  icons: { icon: siteConfig.favicon },
};

/**
 * The real document shell lives in [lang]/layout.tsx, which owns <html>/<body>
 * and every provider. This root only carries global metadata and the stylesheet.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

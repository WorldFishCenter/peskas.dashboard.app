'use client';

import NextTopLoader from 'nextjs-toploader';

export function TopLoader() {
  return <NextTopLoader color="var(--primary)" showSpinner={false} crawlSpeed={100} speed={100} />;
}

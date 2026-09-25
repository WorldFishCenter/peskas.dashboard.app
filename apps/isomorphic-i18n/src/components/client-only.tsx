"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders children only after hydration. The filter atoms read localStorage
 * on init, so anything that depends on them would otherwise hydrate with the
 * server defaults and mismatch.
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? children : null;
}

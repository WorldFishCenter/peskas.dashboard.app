// https://vite.dev/guide/env-and-mode#intellisense-for-typescript
interface ImportMetaEnv {
  /** TZ, KE or MZ; picks the entry of COUNTRY_REGISTRY (default TZ). */
  readonly VITE_COUNTRY_CODE?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
}

/** Whether this deployment has AskFish: the server's `ASKFISH_URL` is set (`vite.config.ts`). */
declare const __ASKFISH__: boolean;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

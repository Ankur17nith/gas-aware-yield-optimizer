/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ROUTER_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

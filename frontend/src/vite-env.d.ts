/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ROUTER_ADDRESS: string;
  readonly NEXT_PUBLIC_ROUTER_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

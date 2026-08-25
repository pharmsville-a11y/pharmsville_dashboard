/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QUERY_URL?: string
  readonly VITE_QUERY_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

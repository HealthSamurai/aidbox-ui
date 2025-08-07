/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AIDBOX_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@panthevm_original/react-components';
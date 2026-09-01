/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QUERY_URL?: string
  readonly VITE_QUERY_SECRET?: string
  readonly VITE_PLUSCL_URL?: string
  readonly VITE_SNAPSHOTS_URL?: string
  readonly VITE_SABANGNET_URL?: string
  /** 로컬 개발 시 개인 실험실 메뉴 강제 표시 (1). 프로덕션 빌드에는 넣지 마세요. */
  readonly VITE_DEV_LAB?: string
  readonly VITE_DEV_LAB_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

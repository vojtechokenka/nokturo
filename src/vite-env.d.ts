/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electronAPI?: {
    platform: string;
    isElectron: boolean;
    checkForUpdate: () => Promise<{ status: string; version?: string; message?: string }>;
    downloadUpdate: () => Promise<{ status: string; message?: string }>;
    installUpdate: () => Promise<void>;
    getAppVersion: () => Promise<string>;
    onUpdateStatus: (callback: (status: string, info?: Record<string, unknown>) => void) => () => void;
  };
}

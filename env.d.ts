declare const runtimeConfig: {
  BASE_URL: string;
} & Record<string, unknown>;

interface ImportMetaEnv
  extends Readonly<Record<string, string>> {
  VITE_APP_VER: string;
  VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

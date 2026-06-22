/// <reference types='vitest' />
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function resolveAppVer(): string {
  if (process.env.VITE_APP_VER)
    return process.env.VITE_APP_VER;
  try {
    return execSync(
      'git describe --tags --always --dirty',
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return '0.0.0-local';
  }
}

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/frontend',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  define: {
    'import.meta.env.VITE_APP_VER':
      JSON.stringify(resolveAppVer()),
  },
  plugins: [
    react(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/frontend',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Legacy Vue specs cannot run after the Vue plugin removal; they are
    // migrated to React Testing Library in task 11.3.
    exclude: [
      'src/features/company/views/company-infohint.spec.ts',
      'src/features/home/components/home-infohint.spec.ts',
      'src/features/job/job-infohint.spec.ts',
      'src/features/techs/views/techs-infohint.spec.ts',
      'src/layout/methodology-nav.spec.ts',
    ],
    reporters: ['default'],
  },
}));

// Meltingplot fork: unit tests (npm test). Kept apart from vite.config.mts so the app build stays as
// upstream has it. Only the parts of vite.config.mts that DWC sources need to load are repeated here
import AutoImport from 'unplugin-auto-import/vite'
import Vue from '@vitejs/plugin-vue'

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    // Same imports as the AutoImport entry of vite.config.mts, since DWC components use ref(),
    // watch() etc. without importing them. No dts, so a test run never rewrites src/auto-imports.d.ts
    AutoImport({
      imports: [
        'vue',
        {
          'vue-router': ['useRoute', 'useRouter'],
        },
      ],
      dts: false,
      vueTemplate: true,
    }),
    Vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup.ts'],
    // Let Vite process the packages Node cannot load on its own: Vuetify's components import their CSS,
    // and the @duet3d packages ship ESM with extensionless relative imports
    server: {
      deps: {
        inline: ['vuetify', /[\\/]node_modules[\\/]@duet3d[\\/]/],
      },
    },
  },
})

/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { netlifyFunctionsDev } from './scripts/vite-netlify-functions';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Make server-only variables from .env (GEMINI_API_KEY, …) visible to the
  // local functions runner. They are NOT exposed to the browser: only
  // VITE_-prefixed variables are bundled into client code.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

  return {
    plugins: [react(), tailwindcss(), netlifyFunctionsDev()],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/recharts|d3-|victory/.test(id)) return 'charts';
            if (/jspdf|html2canvas|dompurify|canvg|fflate/.test(id)) return 'pdf';
            if (/@supabase/.test(id)) return 'supabase';
            if (/framer-motion|motion-dom|motion-utils/.test(id)) return 'motion';
            return undefined;
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});

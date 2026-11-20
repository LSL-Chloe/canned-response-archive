import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Cloudflare's Vite plugin runs the API Worker in a Workers-compatible runtime.
export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } })],
  environments: {
    worker: { build: { sourcemap: true } },
  },
});

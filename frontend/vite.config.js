import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  build: {rollupOptions: {input: {
    dashboard: fileURLToPath(new URL('./index.html', import.meta.url)),
    decision: fileURLToPath(new URL('./decision.html', import.meta.url)), terms: fileURLToPath(new URL('./terms.html', import.meta.url)), establishment: fileURLToPath(new URL('./establishment.html', import.meta.url)),
  }}},
});

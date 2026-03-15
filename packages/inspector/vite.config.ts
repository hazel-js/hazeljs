import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/__hazel/',
  root: path.join(__dirname, 'src/ui'),
  build: {
    outDir: path.join(__dirname, 'ui-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, 'src/ui/index.html'),
    },
  },
});

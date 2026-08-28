import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5175,
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // 400 KB คือเพดานที่ตั้งใจให้เตือน ถ้าเกินแปลว่ามีอะไรหลุดเข้า bundle หลักอีกแล้ว
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('dompurify')) return 'vendor-sanitize';
          return 'vendor';
        },
      },
    },
  },
});

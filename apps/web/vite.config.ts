import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const webPort = parseInt(process.env.WEB_PORT || '5173', 10);
const apiTarget = process.env.KNOWFLOW_API_URL || `http://127.0.0.1:${process.env.PORT || '3001'}`;

const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: webPort,
    proxy: apiProxy,
  },
  preview: {
    port: webPort,
    proxy: apiProxy,
  },
});
